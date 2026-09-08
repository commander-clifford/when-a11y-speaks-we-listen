import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/theme-light-core-tokens.js';
import '@spectrum-web-components/theme/scale-medium-core-tokens.js';
import '@spectrum-web-components/button/sp-button.js';
import '@spectrum-web-components/status-light/sp-status-light.js';
import '@spectrum-web-components/progress-circle/sp-progress-circle.js';

const examples = [
  { name: 'Example 1', state: 'Alt present', variant: 'info', alt: 'Image inspection extension icon', attribute: 'alt="Image inspection extension icon"', note: 'The text is present. Review whether it describes the image’s purpose in its surrounding content.', role: '(not set)', hidden: 'false' },
  { name: 'Example 2', state: 'Alt missing', variant: 'negative', alt: '(attribute absent)', attribute: '(no alt attribute)', note: 'The source attribute is absent. Check the image’s purpose and whether another accessible name is supplied.', role: '(not set)', hidden: 'false' },
  { name: 'Example 3', state: 'Alt empty', variant: 'notice', alt: '"" (empty string)', attribute: 'alt=""', note: 'An explicitly empty alt may correctly mark a decorative image. Confirm that meaning from the page context.', role: 'presentation', hidden: 'false' },
];

const states = {
  complete: { label:'Complete',variant:'positive',summary:'3 images retained · 2 scrollable components checked',description:'The example inspection finished within its limits. Image purpose still needs a human decision.' },
  partial: { label:'Partial',variant:'notice',summary:'3 images retained · inspection limit reached',description:'The sample stopped at its time limit. Retained images remain available; additional content may be undiscovered.' },
  scanning: { label:'Scanning',variant:'info',summary:'3 images retained · checking scrollable components',description:'This is a local sample transition. Stop at any time to keep the images already retained.' },
  stopped: { label:'Stopped',variant:'neutral',summary:'3 images retained · stopped by you',description:'Inspection ended early. The retained image evidence is still available to review.' },
  error: { label:'Error',variant:'negative',summary:'The page could not be inspected',description:'Example: Chrome blocked access to a protected page. Open an HTTP or HTTPS website and run the inspector there.' },
  empty: { label:'Empty',variant:'neutral',summary:'0 images retained · scan complete',description:'No img elements were found in this example. CSS backgrounds, unmaterialized items, and inaccessible frames are outside the captured evidence.' },
};

const byId = id => document.getElementById(id);
let currentState = 'complete';
let timer;
let dialogIndex = 0;
let opener = null;
function appendText(parent, tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

examples.forEach((item, index) => {
  const card = document.createElement('article');
  card.className = 'image-card';
  card.setAttribute('aria-labelledby', `example-heading-${index}`);
  const stage = appendText(card, 'div', '', 'image-stage');
  const image = document.createElement('img');
  image.src = '../extension/icons/icon128.png';
  image.alt = '';
  image.width = image.height = 108;
  stage.append(image);
  appendText(stage, 'span', 'LOCAL EXAMPLE IMAGE');
  const content = appendText(card, 'div', '', 'image-card-content');
  appendText(content, 'h3', item.name + ' · icon128.png').id = `example-heading-${index}`;
  const status = appendText(content, 'sp-status-light', item.state);
  status.setAttribute('variant', item.variant);
  appendText(content, 'p', item.alt, 'card-alt');
  const bottom = appendText(content, 'div', '', 'card-footer');
  appendText(bottom, 'span', '128 × 128 px');
  const inspect = appendText(bottom, 'sp-button', 'Inspect', 'inspect-image');
  inspect.setAttribute('size', 's');
  inspect.setAttribute('variant', 'secondary');
  inspect.setAttribute('treatment', 'outline');
  inspect.setAttribute('aria-haspopup', 'dialog');
  inspect.setAttribute('label', `Inspect ${item.name.toLowerCase()}`);
  inspect.addEventListener('click', () => openDialog(index, inspect));
  byId('image-list').append(card);
});

function setState(value, announce = true) {
  const state = states[value] || states.complete;
  currentState = Object.hasOwn(states, value) ? value : 'complete';
  byId('state-picker').value = currentState;
  byId('status-light').setAttribute('variant', state.variant);
  byId('status-light').textContent = state.label;
  byId('scan-summary').textContent = state.summary;
  byId('scan-description').textContent = state.description;
  const scanning = currentState === 'scanning';
  byId('stop-button').hidden = !scanning;
  byId('scan-progress').hidden = !scanning;
  byId('scan-button').disabled = scanning;
  const none = ['error', 'empty'].includes(currentState);
  byId('image-selection-prompt').hidden = none;
  byId('results').hidden = none;
  byId('no-results').hidden = !none;
  byId('result-count').textContent = none ? '0' : '3';
  byId('no-results-title').textContent = currentState === 'error' ? 'A report could not be created' : 'No images found';
  byId('no-results-copy').textContent = state.description;
  if (announce) byId('announcement').textContent = `${state.label}. ${state.summary}. ${state.description}`;
}

function startSample() {
  clearTimeout(timer);
  setState('scanning');
  byId('stop-button').focus();
  timer = setTimeout(() => {
    const restore = document.activeElement === byId('stop-button');
    setState('complete');
    if (restore) byId('scan-button').focus();
  }, 6000);
}

byId('scan-button').addEventListener('click', startSample);
byId('catalog-scan').addEventListener('click', () => { startSample(); byId('stop-button').scrollIntoView({ block:'center' }); });
byId('stop-button').addEventListener('click', () => { clearTimeout(timer); setState('stopped'); byId('scan-button').focus(); });
byId('state-picker').addEventListener('change', event => { clearTimeout(timer); setState(event.target.value); });

function renderDialog(index) {
  dialogIndex = (index + examples.length) % examples.length;
  const item = examples[dialogIndex];
  byId('dialog-title').textContent = `${item.name} · icon128.png`;
  byId('dialog-alt-status').setAttribute('variant', item.variant);
  byId('dialog-alt-status').textContent = item.state;
  const details = byId('dialog-details');
  details.replaceChildren();
  for (const [label, value] of [
    ['Original alt attribute', item.attribute], ['Source', '../extension/icons/icon128.png'],
    ['Natural dimensions', '128 × 128 pixels'], ['Role', item.role], ['ARIA hidden', item.hidden],
    ['Lazy source / srcset', '(not set in this local fixture)'],
  ]) {
    const row = document.createElement('div');
    appendText(row, 'dt', label);
    appendText(row, 'dd', value);
    details.append(row);
  }
  byId('dialog-note').textContent = item.note;
  byId('dialog-position').textContent = `Example ${dialogIndex + 1} of ${examples.length}`;
}

function openDialog(index, trigger) {
  opener = trigger;
  renderDialog(index);
  byId('image-dialog').showModal();
  byId('dialog-title').focus();
}
byId('catalog-open').addEventListener('click', event => openDialog(0, event.currentTarget));
byId('close-dialog').addEventListener('click', () => byId('image-dialog').close());
byId('previous-image').addEventListener('click', () => renderDialog(dialogIndex - 1));
byId('next-image').addEventListener('click', () => renderDialog(dialogIndex + 1));
byId('image-dialog').addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
byId('image-dialog').addEventListener('click', event => {
  if (event.target !== byId('image-dialog')) return;
  const bounds = byId('image-dialog').getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) byId('image-dialog').close();
});

setState(new URLSearchParams(location.search).get('state') || 'complete', false);
Promise.all(['sp-theme','sp-button','sp-status-light','sp-progress-circle'].map(name => customElements.whenDefined(name)))
  .then(() => { document.documentElement.dataset.spectrumReady = 'true'; });
