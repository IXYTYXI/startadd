export const GENERATORS = Object.freeze([
  { id: 'sprout', name: '光芽', description: '把微弱星光培育成稳定能源。', baseCost: 10, output: 0.3 },
  { id: 'collector', name: '轨道集光器', description: '从温室上空汇聚恒星光束。', baseCost: 90, output: 2.4 },
  { id: 'reactor', name: '星核反应堆', description: '为整座温室提供持续脉冲。', baseCost: 650, output: 18 },
]);

export const UPGRADES = Object.freeze([
  { id: 'lens', name: '棱镜手套', description: '每次手动收集的星光翻倍。', cost: 45, kind: 'click' },
  { id: 'growth', name: '快速生长', description: '光芽的产量翻倍。', cost: 60, kind: 'sprout' },
  { id: 'orbit', name: '精准轨道', description: '集光器的产量翻倍。', cost: 420, kind: 'collector' },
  { id: 'core', name: '恒星共振', description: '反应堆的产量翻倍。', cost: 2800, kind: 'reactor' },
]);

const generatorIds = GENERATORS.map(item => item.id);
const upgradeIds = UPGRADES.map(item => item.id);
const capSeconds = 8 * 60 * 60;

export function createInitialState(now = Date.now()) {
  return {
    light: 0,
    runEarned: 0,
    allTimeEarned: 0,
    totalClicks: 0,
    stars: 0,
    generations: 0,
    generators: { sprout: 0, collector: 0, reactor: 0 },
    upgrades: { lens: false, growth: false, orbit: false, core: false },
    updatedAt: now,
  };
}

export function getStats(state) {
  const starMultiplier = 1 + state.stars;
  const perClick = (state.upgrades.lens ? 2 : 1) * starMultiplier;
  const perSecond = GENERATORS.reduce((sum, generator) => {
    const doubled = state.upgrades[
      { sprout: 'growth', collector: 'orbit', reactor: 'core' }[generator.id]
    ] ? 2 : 1;
    return sum + state.generators[generator.id] * generator.output * doubled * starMultiplier;
  }, 0);
  return { perClick, perSecond, starMultiplier };
}

function earned(state, amount) {
  return {
    ...state,
    light: state.light + amount,
    runEarned: state.runEarned + amount,
    allTimeEarned: state.allTimeEarned + amount,
  };
}

export function collect(state) {
  return { ...earned(state, getStats(state).perClick), totalClicks: state.totalClicks + 1 };
}

export function advance(state, seconds, now = Date.now()) {
  const elapsed = Math.min(capSeconds, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  const gain = getStats(state).perSecond * elapsed;
  return { ...earned(state, gain), updatedAt: now };
}

export function getGeneratorCost(state, id, offset = 0) {
  const generator = GENERATORS.find(item => item.id === id);
  if (!generator) return Infinity;
  return Math.floor(generator.baseCost * 1.15 ** (state.generators[id] + offset));
}

export function getGeneratorTotalCost(state, id, count) {
  if (!Number.isInteger(count) || count < 1 || !generatorIds.includes(id)) return Infinity;
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += getGeneratorCost(state, id, i);
  }
  return total;
}

export function buyModeCount(state, id, mode) {
  if (!generatorIds.includes(id)) return 0;
  if (mode === '1' || mode === '10') {
    const count = Number(mode);
    return getGeneratorTotalCost(state, id, count) <= state.light ? count : 0;
  }
  if (mode !== 'max') return 0;
  let count = 0;
  let remaining = state.light;
  while (count < 10000) {
    const cost = getGeneratorCost(state, id, count);
    if (!Number.isFinite(cost) || cost > remaining) break;
    remaining -= cost;
    count++;
  }
  return count;
}

export function buyGenerator(state, id, count = 1) {
  const cost = getGeneratorTotalCost(state, id, count);
  if (!Number.isFinite(cost) || cost > state.light) return state;
  return {
    ...state,
    light: state.light - cost,
    generators: { ...state.generators, [id]: state.generators[id] + count },
  };
}

export function buyUpgrade(state, id) {
  const upgrade = UPGRADES.find(item => item.id === id);
  if (!upgrade || state.upgrades[id] || state.light < upgrade.cost) return state;
  return {
    ...state,
    light: state.light - upgrade.cost,
    upgrades: { ...state.upgrades, [id]: true },
  };
}

export function prestigeGain(state) {
  return Math.floor(Math.sqrt(state.runEarned / 5000));
}

export function prestige(state, now = Date.now()) {
  const gained = prestigeGain(state);
  if (gained < 1) return state;
  return {
    ...createInitialState(now),
    allTimeEarned: state.allTimeEarned,
    totalClicks: state.totalClicks,
    stars: state.stars + gained,
    generations: state.generations + 1,
  };
}

function nonnegativeNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

export function restoreState(raw, now = Date.now()) {
  const fresh = createInitialState(now);
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return fresh;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return fresh;
  const generators = Object.fromEntries(generatorIds.map(id => [id, Math.floor(nonnegativeNumber(saved.generators?.[id]))]));
  const upgrades = Object.fromEntries(upgradeIds.map(id => [id, saved.upgrades?.[id] === true]));
  return {
    light: nonnegativeNumber(saved.light),
    runEarned: nonnegativeNumber(saved.runEarned),
    allTimeEarned: nonnegativeNumber(saved.allTimeEarned),
    totalClicks: Math.floor(nonnegativeNumber(saved.totalClicks)),
    stars: Math.floor(nonnegativeNumber(saved.stars)),
    generations: Math.floor(nonnegativeNumber(saved.generations)),
    generators,
    upgrades,
    updatedAt: nonnegativeNumber(saved.updatedAt, now),
  };
}
