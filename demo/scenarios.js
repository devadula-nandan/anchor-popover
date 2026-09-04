import { PLACEMENT_NAMES } from '../src/index.js';

const INSET = 4;

const STAGE = `
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    aspect-ratio: 1;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    background: #1a1a1a;
    outline: 1px solid #ececec;
    border-radius: 6px;
  }
  .wrap {
    position: relative;
    overflow: scroll;
    inline-size: 100%;
    block-size: 100%;
  }
  .canvas {
    position: relative;
  }
  [data-trigger],
  [data-content] {
    font: 15px system-ui, sans-serif;
    padding: 8px 12px;
    border: 0;
    border-radius: 4px;
    background: #ececec;
    color: #111;
  }
  [data-trigger] {
    cursor: pointer;
    position: absolute;
    font-weight: 560;
  }
`;

const closedRoots = new WeakMap();

class ShadowWrap extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>${STAGE}</style>
      <div class="wrap">
        <div class="canvas"><slot></slot></div>
      </div>
    `;
  }
}

class ShadowInner extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>${STAGE}</style>
      <div class="wrap">
        <div class="canvas">
          <anchor-popover placement="block-start" boundary=".wrap">
            <button data-trigger type="button">Open</button>
            <div data-content>Popover and <code>.wrap</code> are both inside this shadow root.</div>
          </anchor-popover>
        </div>
      </div>
    `;
  }
}

class ShadowHost extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>
        :host { display: contents; }
        [data-trigger],
        [data-content] {
          font: 15px system-ui, sans-serif;
          padding: 8px 12px;
          border: 0;
          border-radius: 4px;
          background: #ececec;
          color: #111;
        }
        [data-trigger] {
          cursor: pointer;
          position: absolute;
          font-weight: 560;
        }
      </style>
      <anchor-popover placement="block-start" boundary=".wrap">
        <button data-trigger type="button">Open</button>
        <div data-content>Popover is in the shadow. Boundary <code>.wrap</code> is the light-DOM ancestor.</div>
      </anchor-popover>
    `;
  }
}

class ClosedWrap extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'closed' });
    closedRoots.set(this, root);
    root.innerHTML = `
      <style>${STAGE}</style>
      <div class="wrap">
        <div class="canvas"><slot></slot></div>
      </div>
    `;
  }
}

customElements.define('shadow-wrap', ShadowWrap);
customElements.define('shadow-inner', ShadowInner);
customElements.define('shadow-host', ShadowHost);
customElements.define('closed-wrap', ClosedWrap);

class LateWrap extends ShadowWrap {}
setTimeout(() => {
  customElements.define('late-wrap', LateWrap);
  requestAnimationFrame(layoutAll);
}, 1500);

function pinName(el) {
  const pin = [...el.classList].find((name) => name.startsWith('pin-'));
  return pin ? pin.slice(4) : 'ne';
}

function viewTarget(pin, viewW, viewH, tw, th) {
  const xStart = tw / 2 + INSET;
  const xEnd = viewW - tw / 2 - INSET;
  const yStart = th / 2 + INSET;
  const yEnd = viewH - th / 2 - INSET;
  const xMid = viewW / 2;
  const yMid = viewH / 2;
  switch (pin) {
    case 'nw':
      return [xStart, yStart];
    case 'ne':
      return [xEnd, yStart];
    case 'sw':
      return [xStart, yEnd];
    case 'se':
      return [xEnd, yEnd];
    case 'w':
      return [xStart, yMid];
    case 'e':
      return [xEnd, yMid];
    default:
      return [xMid, yMid];
  }
}

function scrollTriggerIntoPin(scroller, trigger, pin) {
  if (pin === 'center') {
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
    return;
  }
  const [viewX, viewY] = viewTarget(
    pin,
    scroller.clientWidth,
    scroller.clientHeight,
    trigger.offsetWidth,
    trigger.offsetHeight,
  );
  const cx = Number.parseFloat(trigger.style.left) || trigger.offsetLeft;
  const cy = Number.parseFloat(trigger.style.top) || trigger.offsetTop;
  scroller.scrollLeft = cx - viewX;
  scroller.scrollTop = cy - viewY;
}

const laidOut = new WeakMap();

function findTrigger(root) {
  if (!root) return null;
  const nested = typeof root.querySelector === 'function' ? root.querySelector('shadow-host') : null;
  const pop =
    (typeof root.querySelector === 'function' ? root.querySelector('anchor-popover') : null) ??
    nested?.shadowRoot?.querySelector('anchor-popover') ??
    null;
  return (
    pop?.triggerElement ??
    pop?.querySelector('[data-trigger], button') ??
    nested?.shadowRoot?.querySelector('[data-trigger]') ??
    (typeof root.querySelector === 'function' ? root.querySelector('[data-trigger]') : null)
  );
}

function layoutStage(scroller, canvas, trigger, pin) {
  if (!scroller || !canvas || !(trigger instanceof HTMLElement)) return;
  if (scroller.dataset.lockLayout === '1') return;

  const viewW = scroller.clientWidth;
  const viewH = scroller.clientHeight;
  const tw = trigger.offsetWidth;
  const th = trigger.offsetHeight;
  if (viewW < 1 || viewH < 1 || viewW > 2000 || viewH > 2000) return;

  const key = `${viewW}x${viewH}x${tw}x${th}x${pin}`;
  if (laidOut.get(scroller) === key) return;
  laidOut.set(scroller, key);

  const canvasW = Math.max(viewW, viewW * 2 - tw - INSET * 2);
  const canvasH = Math.max(viewH, viewH * 2 - th - INSET * 2);
  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;
  trigger.style.position = 'absolute';
  trigger.style.left = `${canvasW / 2}px`;
  trigger.style.top = `${canvasH / 2}px`;
  trigger.style.right = 'auto';
  trigger.style.bottom = 'auto';
  trigger.style.transform = 'translate(-50%, -50%)';

  scrollTriggerIntoPin(scroller, trigger, pin);
}

function layoutPair(stage) {
  const canvas = stage.querySelector('.canvas');
  const triggers = [...stage.querySelectorAll(':scope > .canvas > anchor-popover')].map(
    (host) => host.triggerElement ?? host.querySelector('[data-trigger]'),
  );
  if (!canvas || triggers.some((node) => !(node instanceof HTMLElement))) return;

  const viewW = stage.clientWidth;
  const viewH = stage.clientHeight;
  const tw = Math.max(...triggers.map((node) => node.offsetWidth));
  const th = Math.max(...triggers.map((node) => node.offsetHeight));
  if (viewW < 1 || viewH < 1 || viewW > 2000 || viewH > 2000) return;

  const key = `pair-${viewW}x${viewH}x${tw}x${th}`;
  if (laidOut.get(stage) === key) return;
  laidOut.set(stage, key);

  const canvasW = Math.max(viewW, viewW * 2 - tw - INSET * 2);
  const canvasH = Math.max(viewH, viewH * 2 - th - INSET * 2);
  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;
  const xs = [0.35, 0.65];
  triggers.forEach((node, i) => {
    node.style.position = 'absolute';
    node.style.left = `${canvasW * xs[i]}px`;
    node.style.top = `${canvasH / 2}px`;
    node.style.transform = 'translate(-50%, -50%)';
  });
  stage.scrollLeft = (canvasW - viewW) / 2;
  stage.scrollTop = (canvasH - viewH) / 2;
}

function hostRoot(host) {
  return host.shadowRoot ?? closedRoots.get(host) ?? null;
}

function layoutAll() {
  for (const stage of document.querySelectorAll('.stage')) {
    if (stage.classList.contains('pair-stage')) {
      layoutPair(stage);
      continue;
    }
    layoutStage(stage, stage.querySelector('.canvas'), findTrigger(stage), pinName(stage));
  }

  for (const host of document.querySelectorAll('shadow-wrap, late-wrap, closed-wrap, shadow-inner')) {
    const root = hostRoot(host);
    if (!root) continue;
    const search = host.localName === 'shadow-inner' ? root : host;
    const pin = host.localName === 'shadow-inner' ? 'ne' : pinName(host);
    layoutStage(root.querySelector('.wrap'), root.querySelector('.canvas'), findTrigger(search), pin);
  }
}

function buildMatrix() {
  const mount = document.querySelector('#place-matrix');
  if (!mount || mount.childElementCount) return;
  for (const name of PLACEMENT_NAMES) {
    const cell = document.createElement('div');
    cell.innerHTML = `
      <div class="stage wrap pin-center">
        <div class="canvas">
          <anchor-popover placement="${name}" boundary=".wrap">
            <button data-trigger type="button">Open</button>
            <div data-content>${name}</div>
          </anchor-popover>
        </div>
      </div>
      <p class="caption"><code>${name}</code></p>
    `;
    mount.append(cell);
  }
}

buildMatrix();
layoutAll();
requestAnimationFrame(layoutAll);
window.addEventListener('resize', layoutAll);
new ResizeObserver(layoutAll).observe(document.documentElement);
for (const el of document.querySelectorAll('.resizer')) {
  new ResizeObserver(layoutAll).observe(el);
}

const livePop = document.querySelector('#live-pop');
const liveOut = document.querySelector('#live-readout');
let placeIndex = PLACEMENT_NAMES.indexOf('block-end');
const offsets = ['0', '4', '16', '1rem'];
const durations = ['0', '200', '400', '0.4s'];
let offsetIndex = offsets.indexOf('4');
let durationIndex = 0;

function paintLive() {
  if (!livePop || !liveOut) return;
  liveOut.textContent = `placement=${livePop.placement} boundary=${livePop.boundary || '(viewport)'} offset=${livePop.offset} duration=${livePop.duration} open=${livePop.open}`;
}

document.querySelector('#cycle-place')?.addEventListener('click', () => {
  placeIndex = (placeIndex + 1) % PLACEMENT_NAMES.length;
  if (livePop) livePop.placement = PLACEMENT_NAMES[placeIndex];
  paintLive();
});

document.querySelector('#toggle-bound')?.addEventListener('click', () => {
  if (!livePop) return;
  livePop.boundary = livePop.boundary ? '' : '.wrap';
  paintLive();
});

document.querySelector('#cycle-offset')?.addEventListener('click', () => {
  offsetIndex = (offsetIndex + 1) % offsets.length;
  if (livePop) livePop.offset = offsets[offsetIndex];
  paintLive();
});

document.querySelector('#cycle-duration')?.addEventListener('click', () => {
  durationIndex = (durationIndex + 1) % durations.length;
  if (livePop) livePop.duration = durations[durationIndex];
  paintLive();
});

paintLive();

document.querySelector('#burst')?.addEventListener('click', async () => {
  const el = document.querySelector('#burst-pop');
  if (!el) return;
  for (let i = 0; i < 24; i += 1) {
    el.toggle();
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
});

const ariaPop = document.querySelector('#aria-pop');
const ariaOut = document.querySelector('#aria-readout');

function paintAria() {
  const trigger = ariaPop?.triggerElement;
  if (!ariaOut || !trigger) return;
  ariaOut.textContent = `aria-haspopup=${trigger.getAttribute('aria-haspopup')} aria-expanded=${trigger.getAttribute('aria-expanded')} open=${ariaPop.open}`;
}

paintAria();
ariaPop?.addEventListener('toggle', paintAria, true);
setInterval(paintAria, 400);

const apiPop = document.querySelector('#api-pop');
const apiOut = document.querySelector('#api-readout');

function paintApi() {
  if (!apiPop || !apiOut) return;
  apiOut.textContent = `open=${apiPop.open} expanded=${apiPop.triggerElement?.getAttribute('aria-expanded')}`;
}

document.querySelector('#api-show')?.addEventListener('click', () => {
  apiPop?.show();
  paintApi();
});
document.querySelector('#api-hide')?.addEventListener('click', () => {
  apiPop?.hide();
  paintApi();
});
document.querySelector('#api-toggle')?.addEventListener('click', () => {
  apiPop?.toggle();
  paintApi();
});
paintApi();
apiPop?.addEventListener('toggle', paintApi, true);

document.querySelector('#swap-trigger')?.addEventListener('click', () => {
  const pop = document.querySelector('#swap-pop');
  const old = pop?.querySelector('[data-trigger], button');
  if (!pop || !old) return;
  const next = document.createElement('button');
  next.dataset.trigger = '';
  next.type = 'button';
  next.textContent = 'New';
  old.replaceWith(next);
  const stage = pop.closest('.stage');
  if (stage) laidOut.delete(stage);
  requestAnimationFrame(layoutAll);
});

let travelDock = 'a';
document.querySelector('#travel')?.addEventListener('click', () => {
  const pop = document.querySelector('#travel-pop');
  if (!pop) return;
  pop.hide();
  travelDock = travelDock === 'a' ? 'b' : 'a';
  const dest = document.querySelector(`#dock-${travelDock} .canvas`);
  dest?.append(pop);
  const readout = document.querySelector('#travel-readout');
  if (readout) readout.textContent = `dock ${travelDock.toUpperCase()}`;
  laidOut.delete(document.querySelector('#dock-a'));
  laidOut.delete(document.querySelector('#dock-b'));
  requestAnimationFrame(layoutAll);
});

document.querySelector('#grow')?.addEventListener('click', () => {
  const content = document.querySelector('#grow-pop')?.contentElement;
  if (!content) return;
  content.append(document.createTextNode(' More copy to force a refit.'));
});

const nudgeStage = document.querySelector('#nudge-stage');
document.querySelector('#nudge')?.addEventListener('click', () => {
  const trigger = document.querySelector('#nudge-pop')?.triggerElement;
  if (!trigger) return;
  if (nudgeStage) nudgeStage.dataset.lockLayout = '1';
  const left = Number.parseFloat(trigger.style.left) || 0;
  trigger.style.left = `${left + 28}px`;
  document.querySelector('#nudge-pop')?.controller?.update({});
});

document.querySelector('#nudge-reset')?.addEventListener('click', () => {
  if (nudgeStage) {
    delete nudgeStage.dataset.lockLayout;
    laidOut.delete(nudgeStage);
  }
  requestAnimationFrame(layoutAll);
});

const idPop = document.querySelector('#id-pop');
const idOut = document.querySelector('#id-readout');

function paintId() {
  if (!idPop || !idOut) return;
  const trigger = idPop.triggerElement;
  const content = idPop.contentElement;
  idOut.textContent = `content.id=${content?.id} popovertarget=${trigger?.getAttribute('popovertarget')} open=${idPop.open}`;
}

paintId();
idPop?.addEventListener('toggle', paintId, true);
setInterval(paintId, 400);
setInterval(paintApi, 400);
setInterval(paintLive, 400);
