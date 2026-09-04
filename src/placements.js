/**
 * Placement tokens → CSS `position-area` (logical only).
 * `*-start` / `*-end` span two tiles so edges match the anchor, not a corner cell.
 */

export const PLACEMENTS = {
  'block-start': 'block-start',
  'block-start-start': 'block-start span-inline-end',
  'block-start-end': 'block-start span-inline-start',
  'block-end': 'block-end',
  'block-end-start': 'block-end span-inline-end',
  'block-end-end': 'block-end span-inline-start',
  'inline-start': 'inline-start',
  'inline-start-start': 'inline-start span-block-end',
  'inline-start-end': 'inline-start span-block-start',
  'inline-end': 'inline-end',
  'inline-end-start': 'inline-end span-block-end',
  'inline-end-end': 'inline-end span-block-start',
};

export const PLACEMENT_NAMES = Object.keys(PLACEMENTS);
export const DEFAULT_PLACEMENT = 'block-end';
export const CSS_FLIP = 'flip-block, flip-inline, flip-block flip-inline';

const SIDES = ['block-start', 'block-end', 'inline-start', 'inline-end'];

/** @param {string | null | undefined} name */
export function getPlacement(name) {
  if (!name) return PLACEMENTS[DEFAULT_PLACEMENT];
  const area = PLACEMENTS[name];
  if (!area) {
    throw new RangeError(
      `Unknown placement "${name}". Expected one of: ${PLACEMENT_NAMES.join(', ')}`,
    );
  }
  return area;
}

function swapPrefix(name, pairs) {
  for (const [a, b] of pairs) {
    if (name === a) return b;
    if (name === b) return a;
    if (name.startsWith(`${a}-`)) return `${b}${name.slice(a.length)}`;
    if (name.startsWith(`${b}-`)) return `${a}${name.slice(b.length)}`;
  }
  return null;
}

function swapAlignSuffix(name) {
  if (SIDES.includes(name)) return name;
  if (name.endsWith('-start')) return `${name.slice(0, -6)}-end`;
  if (name.endsWith('-end')) return `${name.slice(0, -4)}-start`;
  return name;
}

/**
 * @param {string} name
 * @param {'block' | 'inline'} axis
 */
export function flipPlacement(name, axis) {
  const pairs =
    axis === 'block'
      ? [['block-start', 'block-end']]
      : [['inline-start', 'inline-end']];
  return swapPrefix(name, pairs) ?? swapAlignSuffix(name);
}

/** @param {string | null | undefined} name */
export function placementCandidates(name) {
  const base = name && name in PLACEMENTS ? name : DEFAULT_PLACEMENT;
  const out = [base];
  const add = (next) => {
    if (next && next in PLACEMENTS && !out.includes(next)) out.push(next);
  };
  add(flipPlacement(base, 'block'));
  add(flipPlacement(base, 'inline'));
  add(flipPlacement(flipPlacement(base, 'block'), 'inline'));
  return out;
}

/** @param {string | null | undefined} name */
export function boundaryFitCandidates(name) {
  const out = placementCandidates(name);
  for (const side of PLACEMENT_NAMES) {
    if (!out.includes(side)) out.push(side);
  }
  return out;
}

/** @param {string | null | undefined} name */
export function placementAxis(name) {
  const n = name && name in PLACEMENTS ? name : DEFAULT_PLACEMENT;
  return n.startsWith('block-') ? 'block' : 'inline';
}

/** @param {string | null | undefined} name */
function placementSide(name) {
  const n = name || DEFAULT_PLACEMENT;
  if (n.startsWith('block-start')) return 'block-start';
  if (n.startsWith('block-end')) return 'block-end';
  if (n.startsWith('inline-start')) return 'inline-start';
  return 'inline-end';
}

/**
 * Viewport-space estimate. Assumes horizontal-tb + LTR (getBoundingClientRect is physical).
 *
 * @param {string} name
 * @param {{ top: number, right: number, bottom: number, left: number, width: number, height: number }} trigger
 * @param {{ width: number, height: number }} size
 * @param {number} [offset]
 */
export function estimatePlacementRect(name, trigger, size, offset = 0) {
  const w = size.width;
  const h = size.height;
  const o = offset;
  const side = placementSide(name);
  const alignStart = name.endsWith('-start') && !SIDES.includes(name);
  const alignEnd = name.endsWith('-end') && !SIDES.includes(name);
  const centerX = trigger.left + trigger.width / 2 - w / 2;
  const centerY = trigger.top + trigger.height / 2 - h / 2;
  const x = alignStart ? trigger.left : alignEnd ? trigger.right - w : centerX;
  const y = alignStart ? trigger.top : alignEnd ? trigger.bottom - h : centerY;
  let top;
  let left;
  if (side === 'block-end') {
    top = trigger.bottom + o;
    left = x;
  } else if (side === 'block-start') {
    top = trigger.top - o - h;
    left = x;
  } else if (side === 'inline-end') {
    left = trigger.right + o;
    top = y;
  } else {
    left = trigger.left - o - w;
    top = y;
  }
  return { top, left, width: w, height: h, right: left + w, bottom: top + h };
}
