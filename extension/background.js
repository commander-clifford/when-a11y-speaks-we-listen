'use strict';

// Session snapshots survive worker suspension, stay on this device, and disappear
// on browser restart. Only packaged extension pages can access session storage.
const REPORT_PREFIX = 'report:';
const MAX_REPORTS = 10;
const MAX_REPORT_BYTES = 2 * 1024 * 1024;
const REPORT_URL = chrome.runtime.getURL('report.html');
const DEFAULT_TITLE = 'A11y Chats: inspect images on this page';
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const activeScans = new Set();
let reportMutationQueue = Promise.resolve();

// Register listeners before any asynchronous initialization.
chrome.action.onClicked.addListener(tab => runInspection(tab));
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'activate_extension') return runInspection(tab);
});
chrome.tabs.onRemoved.addListener(tabId => cleanupClosedReport(tabId));
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'rescan') return false;
  const reply = response => { try { sendResponse(response); } catch (_) { /* The requesting tab closed. */ } };
  handleRescan(message, sender).then(reply, () => {
    reply({ ok: false, error: 'The rescan failed. Return to the source page and activate A11y Chats again.' });
  });
  // Literal true retains callback compatibility across supported Chrome versions.
  return true;
});

function validTabId(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateSourceTab(tab) {
  if (!validTabId(tab?.id) || typeof tab.url !== 'string') {
    throw new Error('Open a normal website tab, then activate A11y Chats from that page. The source tab may have closed or its access may have expired.');
  }
  let url;
  try { url = new URL(tab.url); } catch (_) { /* The guidance below covers malformed URLs. */ }
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('A11y Chats supports HTTP and HTTPS websites. Chrome settings, extension pages, local files, and other protected pages cannot be inspected. Open a website and try again.');
  }
  return tab.id;
}

function userError(error, fallback) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/quota|QUOTA_BYTES|MAX_ITEMS/i.test(message)) {
    return 'Session storage is full. Close some A11y Chats report tabs, then try again.';
  }
  return message || fallback;
}

async function setStatus(tabId, text, title) {
  const target = validTabId(tabId) ? { tabId } : {};
  // A closing tab must not turn a completed or failed scan into an unhandled error.
  await Promise.allSettled([
    chrome.action.setBadgeText({ ...target, text }),
    chrome.action.setTitle({ ...target, title }),
  ]);
}

function boundedSnapshot(data) {
  if (!data || data.schemaVersion !== 1 || !data.meta || !data.scan || !Array.isArray(data.images)) {
    throw new Error('The page did not return a valid image report. Reload the source page and try again.');
  }
  const total = data.images.length;
  const images = data.images.slice(0, 500);
  const scan = { ...data.scan, warnings: Array.isArray(data.scan.warnings) ? [...data.scan.warnings] : [] };
  if (total > images.length) {
    scan.partial = true;
    scan.reason = 'image-limit';
    scan.warnings.push(`Image limit reached: retained ${images.length} of ${total} images; ${total - images.length} were omitted.`);
  }
  const encode = (count, truncated) => JSON.stringify({
    ...data,
    images: images.slice(0, count),
    scan: truncated ? {
      ...scan, partial: true, reason: 'payload-limit',
      warnings: [...scan.warnings, `Report size limit reached: retained ${count} of ${total} images; ${total - count} were omitted to stay below 2 MB.`],
    } : scan,
  });
  const fits = encoded => new TextEncoder().encode(encoded).byteLength < MAX_REPORT_BYTES;
  const complete = encode(images.length, false);
  if (fits(complete)) return JSON.parse(complete);

  // Preserve a useful prefix and every original field on retained image records.
  // Binary search bounds serialization work even when many records are oversized.
  let best = encode(0, true);
  if (!fits(best)) {
    throw new Error('This page metadata alone exceeds the report size limit (2 MB). Inspect a smaller page or reduce unusually large metadata.');
  }
  let low = 0;
  let high = images.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = encode(middle, true);
    if (fits(candidate)) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return JSON.parse(best);
}

async function collectSource(tab) {
  const tabId = validateSourceTab(tab);
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contentScript.js'],
    });
  } catch (_) {
    throw new Error('Chrome could not inspect this page. It may be protected, have navigated, or no longer allow extension access. Return to the source website, reload if needed, and activate A11y Chats there.');
  }
  const mainFrame = results?.find(result => result.frameId === 0);
  return boundedSnapshot(mainFrame?.result);
}

function withReportLock(operation) {
  const pending = reportMutationQueue.then(operation);
  reportMutationQueue = pending.catch(() => {});
  return pending;
}

async function createReport(data, error, sourceTabId) {
  // Serialize reservations so simultaneous scans cannot both claim the final slot.
  return withReportLock(async () => {
    const entries = await chrome.storage.session.get(null);
    const count = Object.keys(entries).filter(key => key.startsWith(REPORT_PREFIX)).length;
    if (count >= MAX_REPORTS) {
      throw new Error('Ten A11y Chats reports are already open. Close a report tab, then inspect the page again.');
    }
    const id = crypto.randomUUID();
    const key = REPORT_PREFIX + id;
    const record = {
      data, error, sourceTabId: validTabId(sourceTabId) ? sourceTabId : null,
      reportTabId: null, createdAt: new Date().toISOString(),
    };
    await chrome.storage.session.set({ [key]: record });
    try {
      const tab = await chrome.tabs.create({ url: `${REPORT_URL}?id=${id}` });
      if (!validTabId(tab?.id)) throw new Error('Chrome did not create a report tab. Try again.');
      record.reportTabId = tab.id;
      await chrome.storage.session.set({ [key]: record });
      // Handles a tab closed between creation and the stored association.
      await chrome.tabs.get(tab.id);
      return id;
    } catch (failure) {
      await chrome.storage.session.remove(key).catch(() => {});
      throw failure;
    }
  });
}

async function runInspection(tab) {
  const tabId = tab?.id;
  if (activeScans.has(tabId)) return;
  activeScans.add(tabId);
  await setStatus(tabId, '…', 'A11y Chats: scanning images. Use Stop on the source page to finish early.');
  try {
    const data = await collectSource(tab);
    await createReport(data, null, tabId);
    await setStatus(tabId, '', DEFAULT_TITLE);
  } catch (failure) {
    const error = userError(failure, 'The scan failed. Return to the source website and try again.');
    try { await createReport(null, error, tabId); } catch (reportFailure) {
      const reportError = userError(reportFailure, 'Chrome could not open a report. Close old report tabs and try again.');
      await setStatus(tabId, '!', `A11y Chats: ${reportError}`);
      return;
    }
    await setStatus(tabId, '!', `A11y Chats: ${error}`);
  } finally {
    activeScans.delete(tabId);
  }
}

function reportSenderMatches(message, sender, record) {
  if (!TOKEN_PATTERN.test(message?.id || '') || !validTabId(sender?.tab?.id)) return false;
  let senderUrl;
  try { senderUrl = new URL(sender.url); } catch (_) { return false; }
  const expected = new URL(REPORT_URL);
  return senderUrl.protocol === expected.protocol
    && senderUrl.host === expected.host
    && senderUrl.pathname === expected.pathname
    && senderUrl.searchParams.get('id') === message.id
    && record?.reportTabId === sender.tab.id;
}

async function handleRescan(message, sender) {
  if (!TOKEN_PATTERN.test(message?.id || '')) return { ok: false, error: 'Invalid report identifier.' };
  const key = REPORT_PREFIX + message.id;
  try {
    const record = (await chrome.storage.session.get(key))[key];
    if (!reportSenderMatches(message, sender, record)) {
      return { ok: false, error: 'Only the report tab that created this request can rescan its source.' };
    }
    if (!validTabId(record.sourceTabId)) return { ok: false, error: 'This report has no inspectable source. Open a website and activate A11y Chats there.' };
    if (activeScans.has(record.sourceTabId)) return { ok: false, error: 'This source page is already being scanned. Wait for it to finish or use its Stop control.' };
    activeScans.add(record.sourceTabId);
    try {
      let tab;
      try { tab = await chrome.tabs.get(record.sourceTabId); } catch (_) {
        throw new Error('The source tab is closed. Open the website and activate A11y Chats there.');
      }
      validateSourceTab(tab);
      try { await chrome.tabs.update(record.sourceTabId, { active: true }); } catch (_) {
        throw new Error('The source tab could not be activated. Return to the website and activate A11y Chats there.');
      }
      const data = await collectSource(tab);
      // Closing this report during collection must not recreate its deleted data.
      await withReportLock(async () => {
        const current = (await chrome.storage.session.get(key))[key];
        if (!reportSenderMatches(message, sender, current)) throw new Error('This report was closed while its source was being scanned.');
        await chrome.storage.session.set({ [key]: { ...current, data, error: null } });
      });
      return { ok: true };
    } finally {
      activeScans.delete(record.sourceTabId);
    }
  } catch (failure) {
    return { ok: false, error: userError(failure, 'The rescan failed. Activate A11y Chats again from the source page.') };
  }
}

async function cleanupClosedReport(tabId) {
  try {
    await withReportLock(async () => {
      const entries = await chrome.storage.session.get(null);
      const keys = Object.entries(entries)
        .filter(([key, record]) => key.startsWith(REPORT_PREFIX) && record?.reportTabId === tabId)
        .map(([key]) => key);
      if (keys.length) await chrome.storage.session.remove(keys);
    });
  } catch (_) {
    await setStatus(undefined, '!', 'A11y Chats could not clear a closed report. Restart Chrome to clear all session reports.');
  }
}
