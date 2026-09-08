import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function launchChrome() {
  const profile = await mkdtemp(join(tmpdir(), 'a11y-chrome-test-'));
  const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', [
    '--headless', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update',
    '--enable-unsafe-extension-debugging', '--remote-debugging-pipe',
    '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let id = 0, buffer = '', stderr = '';
  const pending = new Map();
  const events = [];
  chrome.stderr.on('data', d => { stderr += d.toString(); });
  chrome.stdio[4].on('data', d => {
    buffer += d.toString();
    let at;
    while ((at = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, at));
      buffer = buffer.slice(at + 1);
      if (message.id && pending.has(message.id)) {
        const p = pending.get(message.id);
        clearTimeout(p.timer); pending.delete(message.id);
        message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result);
      } else events.push(message);
    }
  });
  chrome.on('exit', () => {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Chrome exited: ' + stderr.slice(-2000))); }
    pending.clear();
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (chrome.exitCode !== null || chrome.signalCode !== null) { reject(new Error('Chrome not running: ' + stderr.slice(-2000))); return; }
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(method + ' timed out: ' + stderr.slice(-1000))); }, 20000);
    pending.set(requestId, {resolve, reject, timer});
    chrome.stdio[3].write(JSON.stringify({id:requestId, method, params, ...(sessionId ? {sessionId} : {})}) + '\0');
  });
  const close = async () => {
    if (chrome.exitCode === null && chrome.signalCode === null) {
      try { await send('Browser.close'); } catch {}
      if (chrome.exitCode === null && chrome.signalCode === null) await new Promise(resolve => { chrome.once('exit', resolve); setTimeout(() => {chrome.kill();resolve();}, 3000); });
    }
    await rm(profile, {recursive:true, force:true, maxRetries:3});
  };
  return {send, events, close};
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const browser = await launchChrome();
  try { console.log(JSON.stringify(await browser.send('Browser.getVersion'))); }
  catch (error) { console.error(error); process.exitCode = 1; }
  finally { await browser.close(); }
}
