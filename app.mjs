import {
  GENERATORS, UPGRADES, createInitialState, restoreState, collect, advance,
  buyGenerator, buyUpgrade, buyModeCount, getGeneratorTotalCost, getStats,
  prestige, prestigeGain,
} from './game.mjs';

const storageKey = 'stellar-greenhouse-v1';
const $ = selector => document.querySelector(selector);
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });
const format = value => numberFormat.format(value);
let state;
let mode = '1';
let toastTimer;
let dialogAction;
let lastFocused;
let storageFailed = false;

function icon(id) {
  const paths = {
    sprout: '<path d="M12 21v-9m0 3C7 15 4 12 4 7c5 0 8 2 8 7m0-2c0-5 3-8 8-8 0 5-3 8-8 8Z"/>',
    collector: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3M8 16l-3 3"/><path d="M5 12a7 7 0 0 1 7-7m7 7a7 7 0 0 1-7 7"/>',
    reactor: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)"/>',
    lens: '<path d="M4 12h16M12 4v16"/><path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7Z"/>',
    growth: '<path d="M12 21v-9m0 4c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-4c0-5 3-8 8-8 0 5-3 8-8 8Z"/>',
    orbit: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-25 12 12)"/><path d="m17 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/>',
    core: '<path d="m12 2 2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2Z"/><circle cx="12" cy="11" r="2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg>`;
}

function initializeCards() {
  $('#generator-list').innerHTML = GENERATORS.map(item => `
    <article class="generator-card" data-id="${item.id}">
      <div class="generator-main"><div class="generator-icon" aria-hidden="true">${icon(item.id)}</div><div class="generator-info"><h3>${item.name}</h3><p>${item.description}</p></div><span class="generator-owned" aria-label="已有数量">0</span></div>
      <div class="generator-footer"><span class="generator-production">每个 <strong>+${format(item.output)}</strong> / 秒</span><button class="generator-buy" data-buy="${item.id}" type="button"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg><span>购买</span></button></div>
    </article>`).join('');
  $('#upgrade-list').innerHTML = UPGRADES.map(item => `
    <article class="upgrade-card" data-upgrade-card="${item.id}"><div class="upgrade-top"><div class="upgrade-icon" aria-hidden="true">${icon(item.id)}</div><div><h3>${item.name}</h3><p>${item.description}</p></div></div><button data-upgrade="${item.id}" type="button">${format(item.cost)} 星光 · 解锁</button></article>`).join('');
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    $('#save-status').textContent = '进度保存在本机';
  } catch {
    $('#save-status').textContent = '无法保存，请检查浏览器存储';
    if (!storageFailed) {
      storageFailed = true;
      showToast('当前浏览器无法保存进度，请检查站点存储权限');
    }
  }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function render() {
  const stats = getStats(state);
  const lightText = format(state.light);
  $('#light-count').textContent = lightText;
  $('.light-total').dataset.size = lightText.length > 14 ? 'long' : lightText.length > 9 ? 'medium' : 'normal';
  $('#rate-value').textContent = format(stats.perSecond);
  $('#run-value').textContent = format(state.runEarned);
  $('#click-value').textContent = `每次 +${format(stats.perClick)} 星光`;
  $('#star-bonus').textContent = `×${format(stats.starMultiplier)}`;
  $('#star-count').textContent = format(state.stars);
  const gain = prestigeGain(state);
  $('#prestige-gain').textContent = format(gain);
  const prestigeButton = $('#prestige-button');
  prestigeButton.disabled = gain < 1;
  prestigeButton.textContent = gain < 1 ? '还需收集星光' : `重生，获得 ${format(gain)} 颗星种`;
  const progress = Math.min(1, state.runEarned / 5000);
  $('#progress-percent').textContent = `${Math.floor(progress * 100)}%`;
  $('#progress-goal').textContent = `${format(state.runEarned)} / 5,000`;
  $('#progress-fill').style.transform = `scaleX(${progress})`;
  $('#progress-bar').setAttribute('aria-valuenow', String(Math.floor(Math.min(5000, state.runEarned))));

  for (const item of GENERATORS) {
    const card = $(`.generator-card[data-id="${item.id}"]`);
    const owned = state.generators[item.id];
    const count = buyModeCount(state, item.id, mode);
    const requested = mode === 'max' ? Math.max(1, count) : Number(mode);
    const cost = getGeneratorTotalCost(state, item.id, requested);
    const button = card.querySelector('button');
    card.querySelector('.generator-owned').textContent = format(owned);
    const multiplier = stats.starMultiplier * (state.upgrades[{ sprout: 'growth', collector: 'orbit', reactor: 'core' }[item.id]] ? 2 : 1);
    card.querySelector('.generator-production strong').textContent = `+${format(item.output * multiplier)}`;
    button.disabled = count === 0;
    button.querySelector('span').textContent = mode === 'max' && count === 0 ? '买不起' : `买 ${mode === 'max' ? `×${format(count)}` : `×${mode}`} · ${format(cost)}`;
    button.setAttribute('aria-label', `${item.name}，已有 ${format(owned)} 个，${count ? `购买 ${count} 个需要 ${format(cost)} 星光` : `需要 ${format(cost)} 星光，当前不足`}`);
  }
  for (const item of UPGRADES) {
    const card = $(`[data-upgrade-card="${item.id}"]`);
    const button = card.querySelector('button');
    const owned = state.upgrades[item.id];
    card.classList.toggle('is-owned', owned);
    button.disabled = owned || state.light < item.cost;
    button.textContent = owned ? '已解锁' : `${format(item.cost)} 星光 · 解锁`;
    button.setAttribute('aria-label', `${item.name}，${owned ? '已解锁' : `需要 ${format(item.cost)} 星光`}`);
  }
}

function commit(next) {
  if (next === state) return;
  state = next;
  render();
  save();
}

function openDialog({ title, description, label, danger = false, action }) {
  const dialog = $('#confirm-dialog');
  lastFocused = document.activeElement;
  $('#dialog-title').textContent = title;
  $('#dialog-description').textContent = description;
  $('#dialog-confirm').textContent = label;
  $('#dialog-confirm').classList.toggle('is-danger', danger);
  dialogAction = action;
  dialog.showModal();
  $('#dialog-cancel').focus();
}

function setupInteractions() {
  $('#collect-button').addEventListener('click', () => commit(collect(state)));
  $('#generator-list').addEventListener('click', event => {
    const button = event.target.closest('[data-buy]');
    if (!button) return;
    const id = button.dataset.buy;
    const count = buyModeCount(state, id, mode);
    if (count) commit(buyGenerator(state, id, count));
  });
  $('#upgrade-list').addEventListener('click', event => {
    const button = event.target.closest('[data-upgrade]');
    if (!button) return;
    const id = button.dataset.upgrade;
    const next = buyUpgrade(state, id);
    if (next !== state) {
      commit(next);
      showToast(`${UPGRADES.find(item => item.id === id).name}已解锁`);
    }
  });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    render();
  }));
  $('#prestige-button').addEventListener('click', () => {
    const gain = prestigeGain(state);
    if (gain < 1) return;
    openDialog({ title: '开启新的温室？', description: `本轮星光、设施与升级会重置，你将获得 ${format(gain)} 颗星种。每颗星种永久提升 100% 采集和自动产出。`, label: '确认重生', action: () => { commit(prestige(state)); showToast(`获得 ${format(gain)} 颗星种，新的旅程开始了`); } });
  });
  $('#reset-button').addEventListener('click', () => openDialog({ title: '重置所有进度？', description: '所有星光、设施、升级和星种都会清空。此操作无法撤销。', label: '清空进度', danger: true, action: () => { commit(createInitialState()); showToast('游戏进度已清空'); } }));
  $('#dialog-cancel').addEventListener('click', () => $('#confirm-dialog').close());
  $('#dialog-confirm').addEventListener('click', () => { const action = dialogAction; $('#confirm-dialog').close(); action?.(); });
  $('#confirm-dialog').addEventListener('close', () => lastFocused?.focus());
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { const now = Date.now(); state = advance(state, (now - state.updatedAt) / 1000, now); render(); save(); } else save(); });
}

function start() {
  const now = Date.now();
  let raw = null;
  try { raw = localStorage.getItem(storageKey); } catch { /* Private mode can block storage. */ }
  state = raw ? restoreState(raw, now) : createInitialState(now);
  const offlineSeconds = Math.min(28800, Math.max(0, (now - state.updatedAt) / 1000));
  const offlineGain = getStats(state).perSecond * offlineSeconds;
  state = advance(state, offlineSeconds, now);
  initializeCards();
  setupInteractions();
  render();
  save();
  if (offlineGain >= 1) showToast(`离线期间收获 ${format(offlineGain)} 星光`);
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const time = Date.now();
    state = advance(state, (time - state.updatedAt) / 1000, time);
    render();
  }, 200);
  setInterval(save, 5000);
}

start();
