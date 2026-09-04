import { AnchorPopover, PLACEMENT_NAMES, supportsAnchorPositioning, supportsPopover } from '../src/index.js';

const support = document.querySelector('#support');
if (support && (!supportsAnchorPositioning() || !supportsPopover())) {
  support.hidden = false;
  const missing = [
    !supportsAnchorPositioning() ? 'CSS Anchor Positioning' : null,
    !supportsPopover() ? 'Popover API' : null,
  ].filter(Boolean);
  support.textContent = `This browser is missing ${missing.join(' and ')}.`;
}

const form = document.querySelector('#controls');
const stage = document.querySelector('#stage');
const snippet = document.querySelector('#snippet');

function field(name) {
  const el = form?.elements.namedItem(name);
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    return el.value;
  }
  return '';
}

function fillPlacements() {
  const select = form?.elements.namedItem('placement');
  if (!(select instanceof HTMLSelectElement)) return;
  select.replaceChildren();
  for (const [label, names] of [
    ['Block', PLACEMENT_NAMES.filter((name) => name.startsWith('block-'))],
    ['Inline', PLACEMENT_NAMES.filter((name) => name.startsWith('inline-'))],
  ]) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const name of names) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === 'block-end') option.selected = true;
      group.append(option);
    }
    select.append(group);
  }
}

function host() {
  return document.querySelector('#playground');
}

function mountStage() {
  if (!stage) return;
  stage.innerHTML = `<div class="stage-canvas">
    <anchor-popover id="playground">
      <button data-trigger type="button" class="stage-trigger">Open menu</button>
      <div data-content class="stage-menu">
        <p></p>
        <button type="button" data-close>Action</button>
      </div>
    </anchor-popover>
  </div>`;
}

function applyAttrs(el) {
  el.placement = field('placement') || 'block-end';
  el.offset = field('offset') || '4';
  el.duration = field('duration') || '0';
  el.boundary = field('boundary').trim() || null;
  const hasPopup = field('ariaHasPopup') || 'true';
  if (hasPopup === 'true') el.removeAttribute('aria-haspopup');
  else el.setAttribute('aria-haspopup', hasPopup);
}

function renderSnippet() {
  if (!snippet) return;
  const attrs = [
    ['placement', field('placement') || 'block-end'],
    ['offset', field('offset')],
    ['duration', field('duration')],
    ['boundary', field('boundary').trim()],
    ['aria-haspopup', field('ariaHasPopup') === 'true' ? '' : field('ariaHasPopup')],
  ]
    .filter(([, value]) => value && value !== '0')
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
  snippet.textContent = `<anchor-popover${attrs}>
  <button data-trigger type="button">Open menu</button>
  <div data-content>…</div>
</anchor-popover>`;
}

const TRIGGER_INSET = 4;

function layoutStageCanvas() {
  if (!stage) return;
  const canvas = stage.querySelector('.stage-canvas');
  const trigger = stage.querySelector('.stage-trigger');
  if (!canvas) return;

  const viewW = Math.min(stage.clientWidth, document.documentElement.clientWidth);
  const viewH = Math.min(stage.clientHeight, document.documentElement.clientHeight);
  const tw = trigger instanceof HTMLElement ? trigger.offsetWidth : 0;
  const th = trigger instanceof HTMLElement ? trigger.offsetHeight : 0;
  const canvasW = Math.max(viewW, viewW * 2 - tw - TRIGGER_INSET * 2);
  const canvasH = Math.max(viewH, viewH * 2 - th - TRIGGER_INSET * 2);
  canvas.style.position = 'relative';
  canvas.style.margin = '0';
  canvas.style.placeSelf = 'start';
  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;

  if (trigger instanceof HTMLElement) {
    trigger.style.position = 'absolute';
    trigger.style.left = `${canvasW / 2}px`;
    trigger.style.top = `${canvasH / 2}px`;
    trigger.style.transform = 'translate(-50%, -50%)';
  }

  void canvas.offsetWidth;
  stage.scrollLeft = (canvasW - viewW) / 2;
  stage.scrollTop = (canvasH - viewH) / 2;
}

/** @type {HTMLElement | null} */
let highlightedBoundary = null;

function highlightBoundary(selector) {
  if (highlightedBoundary) {
    highlightedBoundary.classList.remove('boundary-target');
    highlightedBoundary = null;
  }
  const token = selector.trim();
  if (!token) return;
  try {
    const trigger = stage?.querySelector('.stage-trigger');
    const el =
      (trigger instanceof Element ? trigger.closest(token) : null) ?? document.querySelector(token);
    if (!(el instanceof HTMLElement)) return;
    el.classList.add('boundary-target');
    highlightedBoundary = el;
  } catch {
    /* invalid selector */
  }
}

function apply() {
  if (!form || !stage) return;
  const offsetOut = form.elements.namedItem('offsetOut');
  if (offsetOut && 'value' in offsetOut) offsetOut.value = `${field('offset')}px`;
  const durationOut = form.elements.namedItem('durationOut');
  if (durationOut && 'value' in durationOut) durationOut.value = `${field('duration')}ms`;

  highlightBoundary(field('boundary'));
  const el = host();
  if (el instanceof AnchorPopover) applyAttrs(el);
  const copy = stage.querySelector('.stage-menu p');
  if (copy) copy.textContent = field('text');
  renderSnippet();
}

fillPlacements();
const presetBoundary = new URLSearchParams(location.search).get('boundary');
if (presetBoundary) {
  const el = form?.elements.namedItem('boundary');
  if (el instanceof HTMLInputElement) el.value = presetBoundary;
}

mountStage();
apply();
layoutStageCanvas();
requestAnimationFrame(() => layoutStageCanvas());
if (typeof ResizeObserver === 'function' && stage) {
  new ResizeObserver(() => layoutStageCanvas()).observe(stage);
}

stage?.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('[data-close]')) return;
  host()?.hide();
});

form?.addEventListener('input', () => apply());
window.addEventListener('resize', () => layoutStageCanvas());

document.querySelector('#copy')?.addEventListener('click', async (event) => {
  const btn = event.currentTarget;
  if (!(btn instanceof HTMLButtonElement) || !snippet) return;
  try {
    await navigator.clipboard.writeText(snippet.textContent ?? '');
    btn.textContent = 'Copied';
    setTimeout(() => {
      btn.textContent = 'Copy';
    }, 1200);
  } catch {
    /* ignore */
  }
});
