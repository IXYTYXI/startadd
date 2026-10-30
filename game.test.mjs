import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  collect,
  advance,
  buyGenerator,
  buyUpgrade,
  buyModeCount,
  getGeneratorCost,
  getStats,
  prestige,
  restoreState,
} from './game.mjs';

test('collect earns light and respects click upgrades and prestige', () => {
  let state = createInitialState(1000);
  state = collect(state);
  assert.equal(state.light, 1);
  state = { ...state, light: 100, upgrades: { ...state.upgrades, lens: true }, stars: 2 };
  state = collect(state);
  assert.equal(state.light, 106);
  assert.equal(state.runEarned, 7);
});

test('generator purchases charge escalating costs and never overspend', () => {
  let state = { ...createInitialState(0), light: 100 };
  const firstCost = getGeneratorCost(state, 'sprout');
  assert.equal(firstCost, 10);
  state = buyGenerator(state, 'sprout', 2);
  assert.equal(state.generators.sprout, 2);
  assert.equal(state.light, 79);
  state = buyGenerator(state, 'sprout', 100);
  assert.ok(state.light >= 0);
  assert.equal(buyGenerator(state, 'unknown', 1), state);
});

test('buy max finds only affordable count', () => {
  const state = { ...createInitialState(0), light: 35 };
  assert.equal(buyModeCount(state, 'sprout', 'max'), 3);
  assert.equal(buyModeCount(state, 'sprout', '10'), 0);
});

test('automatic production advances with an eight hour offline cap', () => {
  let state = { ...createInitialState(1000), generators: { sprout: 10, collector: 0, reactor: 0 } };
  assert.equal(getStats(state).perSecond, 3);
  state = advance(state, 10, 11000);
  assert.equal(state.light, 30);
  assert.equal(state.runEarned, 30);
  const capped = advance(state, 999999, 12000);
  assert.equal(capped.light, 30 + 3 * 28800);
});

test('upgrades require funds, are purchased once, and alter production', () => {
  let state = createInitialState(0);
  assert.equal(buyUpgrade(state, 'growth'), state);
  state = { ...state, light: 100, generators: { sprout: 1, collector: 0, reactor: 0 } };
  state = buyUpgrade(state, 'growth');
  assert.equal(state.light, 40);
  assert.equal(getStats(state).perSecond, 0.6);
  assert.equal(buyUpgrade(state, 'growth'), state);
});

test('prestige resets the run and grants persistent stars only when eligible', () => {
  let state = createInitialState(0);
  assert.equal(prestige(state), state);
  state = { ...state, light: 5000, runEarned: 5000, generators: { sprout: 2, collector: 0, reactor: 0 } };
  state = prestige(state, 2000);
  assert.equal(state.stars, 1);
  assert.equal(state.light, 0);
  assert.equal(state.runEarned, 0);
  assert.equal(state.generators.sprout, 0);
  assert.equal(state.updatedAt, 2000);
});

test('restore rejects corrupt data and clamps impossible values', () => {
  assert.deepEqual(restoreState('{', 3000), createInitialState(3000));
  const restored = restoreState(JSON.stringify({ light: -8, runEarned: 90, stars: 3, generators: { sprout: 2.7 }, updatedAt: 1000 }), 3000);
  assert.equal(restored.light, 0);
  assert.equal(restored.generators.sprout, 2);
  assert.equal(restored.stars, 3);
  assert.equal(restored.updatedAt, 1000);
});
