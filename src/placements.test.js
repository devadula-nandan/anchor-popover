import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPlacement,
  flipPlacement,
  placementCandidates,
  boundaryFitCandidates,
  estimatePlacementRect,
  placementAxis,
  PLACEMENTS,
} from './placements.js';

test('every placement maps to a logical position-area string', () => {
  for (const [name, area] of Object.entries(PLACEMENTS)) {
    assert.equal(typeof area, 'string', name);
    assert.equal(area.includes('top') || area.includes('left') || area.includes('right') || area.includes('bottom'), false, name);
  }
});

test('getPlacement maps aligned tokens', () => {
  assert.equal(getPlacement('block-end-end'), 'block-end span-inline-start');
  assert.equal(getPlacement('inline-end-end'), 'inline-end span-block-start');
  assert.equal(getPlacement(), 'block-end');
});

test('flipPlacement swaps block and inline sides', () => {
  assert.equal(flipPlacement('block-end', 'block'), 'block-start');
  assert.equal(flipPlacement('block-end', 'inline'), 'block-end');
  assert.equal(flipPlacement('block-end-end', 'block'), 'block-start-end');
  assert.equal(flipPlacement('block-end-end', 'inline'), 'block-end-start');
  assert.equal(flipPlacement('inline-start-start', 'inline'), 'inline-end-start');
  assert.equal(flipPlacement('inline-start-start', 'block'), 'inline-start-end');
});

test('placementCandidates expands flip tactics', () => {
  assert.deepEqual(placementCandidates('block-end'), ['block-end', 'block-start']);
  assert.deepEqual(placementCandidates('block-end-end'), [
    'block-end-end',
    'block-start-end',
    'block-end-start',
    'block-start-start',
  ]);
});

test('boundaryFitCandidates adds inline sides when placement is block-end', () => {
  const names = boundaryFitCandidates('block-end');
  assert.ok(names.includes('block-start'));
  assert.ok(names.includes('inline-start'));
  assert.ok(names.includes('inline-end'));
  assert.ok(names.includes('block-end-start'));
  assert.equal(names[0], 'block-end');
});

test('placementAxis is block or inline from the token', () => {
  assert.equal(placementAxis('block-end-start'), 'block');
  assert.equal(placementAxis('inline-start'), 'inline');
  assert.equal(placementAxis(), 'block');
});

test('estimatePlacementRect puts block-end below and block-start above the trigger', () => {
  const trigger = { top: 100, right: 180, bottom: 140, left: 80, width: 100, height: 40 };
  const size = { width: 120, height: 72 };
  const below = estimatePlacementRect('block-end', trigger, size, 8);
  assert.equal(below.top, 148);
  const above = estimatePlacementRect('block-start', trigger, size, 8);
  assert.equal(above.bottom, 92);
  const aligned = estimatePlacementRect('block-end-start', trigger, size, 8);
  const alignedFlush = estimatePlacementRect('block-end-start', trigger, size, 0);
  assert.equal(aligned.left, alignedFlush.left);
  assert.equal(aligned.left, trigger.left);
});
