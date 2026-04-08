const SAVE_KEY = "pulse_forge_save_v1";
const SAVE_INTERVAL_MS = 10000;
const TICK_MS = 100;
const MAX_OFFLINE_SECONDS = 60 * 60 * 12;

const BUILDINGS = [
  { id: "micro_cell", name: "Micro Cell", baseCost: 15, baseProduction: 0.2, growthRate: 1.12 },
  { id: "generator", name: "Generator", baseCost: 120, baseProduction: 1.4, growthRate: 1.13 },
  { id: "reactor", name: "Reactor", baseCost: 900, baseProduction: 8, growthRate: 1.14 },
  { id: "fusion_array", name: "Fusion Array", baseCost: 6200, baseProduction: 38, growthRate: 1.15 },
  { id: "quantum_extractor", name: "Quantum Extractor", baseCost: 42000, baseProduction: 180, growthRate: 1.16 },
  { id: "singularity_core", name: "Singularity Core", baseCost: 300000, baseProduction: 900, growthRate: 1.17 },
];

const UPGRADES = [
  { id: "click_1", name: "Click Power I", desc: "+1 click", cost: 50, type: "clickFlat", value: 1 },
  { id: "click_2", name: "Click Power II", desc: "+3 click", cost: 250, type: "clickFlat", value: 3 },
  { id: "click_3", name: "Click Power III", desc: "click x2", cost: 1200, type: "clickMult", value: 2 },
  { id: "auto_1", name: "Automation I", desc: "auto +25%", cost: 500, type: "autoMult", value: 1.25 },
  { id: "reactor_tune", name: "Reactor Tuning", desc: "Reactor x2", cost: 3500, type: "buildingMult", target: "reactor", value: 2 },
  { id: "global_eff", name: "Global Efficiency", desc: "global x1.5", cost: 9000, type: "globalMult", value: 1.5 },
  { id: "micro_boost", name: "Micro Legacy", desc: "Micro Cell x5", cost: 6000, type: "buildingMult", target: "micro_cell", value: 5 },
  { id: "crit_tap", name: "Critical Tap", desc: "10%で5倍", cost: 5000, type: "crit", value: { chance: 0.1, mult: 5 } },
];

const PERMANENT_UPGRADES = [
  { id: "core_legacy", name: "Core Legacy", desc: "全獲得 +10%", baseCost: 5, costScale: 1.8, maxLevel: 25, effect: (lv) => 1 + lv * 0.1 },
  { id: "efficient_rebuild", name: "Efficient Rebuild", desc: "設備価格 -2%", baseCost: 8, costScale: 1.9, maxLevel: 15, effect: (lv) => 1 - lv * 0.02 },
  { id: "idle_mastery", name: "Idle Mastery", desc: "放置報酬 +20%", baseCost: 10, costScale: 2.0, maxLevel: 20, effect: (lv) => 1 + lv * 0.2 },
  { id: "active_surge", name: "Active Surge", desc: "クリック +15%", baseCost: 7, costScale: 1.85, maxLevel: 20, effect: (lv) => 1 + lv * 0.15 },
  { id: "event_control", name: "Event Control", desc: "良イベント率アップ", baseCost: 12, costScale: 2.1, maxLevel: 10, effect: (lv) => lv * 0.025 },
];

const ACHIEVEMENTS = [
  { id: "first_click", name: "初クリック", cond: (s) => s.stats.totalClicks >= 1 },
  { id: "energy_100", name: "100 Energy", cond: (s) => s.stats.totalEnergyEarned >= 100 },
  { id: "buy_first", name: "初設備購入", cond: (s) => s.stats.totalBuildingPurchases >= 1 },
  { id: "eps_10", name: "EPS 10", cond: (s) => getEPS(s) >= 10 },
  { id: "click_1000", name: "クリック1,000", cond: (s) => s.stats.totalClicks >= 1000 },
  { id: "first_prestige", name: "初転生", cond: (s) => s.stats.totalPrestiges >= 1 },
  { id: "energy_1e6", name: "1e6 Energy", cond: (s) => s.stats.bestEnergyThisRun >= 1_000_000 },
];

const EVENTS = [
  { id: "burst", name: "Burst", duration: 10, good: true, apply: (m) => (m.click *= 3), message: "10秒間クリック3倍" },
  { id: "surge", name: "Surge", duration: 30, good: true, apply: (m) => (m.auto *= 2), message: "30秒間自動生成2倍" },
  { id: "supply", duration: 0, name: "Supply Cache", good: true, instant: (s) => addEnergy(s, getEPS(s) * 300), message: "EPS 300秒分を獲得" },
  { id: "instability", name: "Instability", duration: 15, good: false, apply: (m) => (m.click *= 0.5), onEnd: (s) => addEnergy(s, getEPS(s) * 120), message: "15秒間クリック半減。終了後ボーナス" },
];

const state = createInitialState();
const dom = {};
let lastTick = Date.now();
let lastSave = Date.now();

function createInitialState() {
  return {
    version: 1,
    energy: 0,
    shard: 0,
    buildings: Object.fromEntries(BUILDINGS.map((b) => [b.id, 0])),
    upgrades: {},
    permanent: Object.fromEntries(PERMANENT_UPGRADES.map((u) => [u.id, 0])),
    event: null,
    stats: {
      totalClicks: 0,
      totalEnergyEarned: 0,
      totalPrestiges: 0,
      totalBuildingPurchases: 0,
      longestOfflineSeconds: 0,
      maxEPS: 0,
      bestEnergyThisRun: 0,
    },
    achievements: {},
    lastPlayedAt: Date.now(),
  };
}

function setupDom() {
  [
    "energyValue","clickValue","epsValue","shardValue","prestigeEstimate","buildingList","tab-upgrades","tab-permanent","tab-achievements","tab-stats",
    "saveState","globalMultiplier","buffState","eventBanner","coreButton","prestigeButton","floatingContainer","saveButton","resetButton"
  ].forEach((id) => (dom[id] = document.getElementById(id)));
}

function formatNumber(n) {
  if (n < 1000) return n.toFixed(n < 10 ? 2 : 0);
  const units = ["K", "M", "B", "T", "aa", "ab", "ac", "ad"];
  let value = n;
  let idx = -1;
  while (value >= 1000 && idx < units.length - 1) {
    value /= 1000;
    idx++;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)}${units[idx] ?? "e"}`;
}

function getPermanentEffect(id) {
  const def = PERMANENT_UPGRADES.find((u) => u.id === id);
  return def.effect(state.permanent[id]);
}

function getGlobalMultiplier() {
  let mult = getPermanentEffect("core_legacy");
  if (state.upgrades.global_eff) mult *= 1.5;
  return mult;
}

function getClickValue() {
  let click = 1;
  if (state.upgrades.click_1) click += 1;
  if (state.upgrades.click_2) click += 3;
  if (state.upgrades.click_3) click *= 2;
  click *= getPermanentEffect("active_surge");
  click *= getGlobalMultiplier();
  if (state.event?.modifiers) click *= state.event.modifiers.click;
  return click;
}

function getBuildingProduction(id) {
  const building = BUILDINGS.find((b) => b.id === id);
  let prod = building.baseProduction;
  if (state.upgrades.auto_1) prod *= 1.25;
  if (id === "reactor" && state.upgrades.reactor_tune) prod *= 2;
  if (id === "micro_cell" && state.upgrades.micro_boost) prod *= 5;
  return prod;
}

function getEPS(localState = state) {
  let total = BUILDINGS.reduce((sum, b) => sum + localState.buildings[b.id] * getBuildingProduction(b.id), 0);
  total *= getGlobalMultiplier();
  if (localState.event?.modifiers) total *= localState.event.modifiers.auto;
  return total;
}

function getBuildingCost(building) {
  const owned = state.buildings[building.id];
  const discount = getPermanentEffect("efficient_rebuild");
  return building.baseCost * (building.growthRate ** owned) * discount;
}

function addEnergy(localState, amount) {
  if (amount <= 0) return;
  localState.energy += amount;
  localState.stats.totalEnergyEarned += amount;
  localState.stats.bestEnergyThisRun = Math.max(localState.stats.bestEnergyThisRun, localState.energy);
}

function attemptClick() {
  let gain = getClickValue();
  if (state.upgrades.crit_tap && Math.random() < 0.1) gain *= 5;
  addEnergy(state, gain);
  state.stats.totalClicks += 1;
  showFloating(`+${formatNumber(gain)}`);
  updateDerivedStats();
  render();
}

function showFloating(text) {
  const span = document.createElement("span");
  span.className = "float-number";
  span.textContent = text;
  dom.floatingContainer.appendChild(span);
  setTimeout(() => span.remove(), 850);
}

function buyBuilding(id) {
  const b = BUILDINGS.find((x) => x.id === id);
  const cost = getBuildingCost(b);
  if (state.energy < cost) return;
  state.energy -= cost;
  state.buildings[id] += 1;
  state.stats.totalBuildingPurchases += 1;
  updateDerivedStats();
  render();
}

function buyUpgrade(id) {
  const up = UPGRADES.find((u) => u.id === id);
  if (state.upgrades[id] || state.energy < up.cost) return;
  state.energy -= up.cost;
  state.upgrades[id] = true;
  updateDerivedStats();
  render();
}

function permanentUpgradeCost(def) {
  const lv = state.permanent[def.id];
  return Math.floor(def.baseCost * def.costScale ** lv);
}

function buyPermanentUpgrade(id) {
  const def = PERMANENT_UPGRADES.find((u) => u.id === id);
  const lv = state.permanent[id];
  if (lv >= def.maxLevel) return;
  const cost = permanentUpgradeCost(def);
  if (state.shard < cost) return;
  state.shard -= cost;
  state.permanent[id] += 1;
  render();
}

function prestigeGain() {
  if (state.stats.bestEnergyThisRun < 10000) return 0;
  return Math.floor(Math.sqrt(state.stats.bestEnergyThisRun / 10000));
}

function doPrestige() {
  const gain = prestigeGain();
  if (gain <= 0) return;
  state.shard += gain;
  state.energy = 0;
  state.buildings = Object.fromEntries(BUILDINGS.map((b) => [b.id, 0]));
  state.upgrades = {};
  state.event = null;
  state.stats.totalPrestiges += 1;
  state.stats.bestEnergyThisRun = 0;
  render();
}

function processEvent(dtSec) {
  if (!state.event) {
    const baseChance = 0.012;
    const bonus = getPermanentEffect("event_control");
    if (Math.random() < (baseChance + bonus) * dtSec) {
      triggerEvent();
    }
    return;
  }
  if (state.event.remaining > 0) {
    state.event.remaining -= dtSec;
    if (state.event.remaining <= 0) {
      if (state.event.onEnd) state.event.onEnd(state);
      state.event = null;
      renderBanner("イベント終了", false);
    }
  }
}

function triggerEvent() {
  const e = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  if (e.instant) {
    e.instant(state);
    renderBanner(`${e.name}: ${e.message}`, e.good);
    return;
  }
  const modifiers = { click: 1, auto: 1 };
  e.apply(modifiers);
  state.event = { ...e, remaining: e.duration, modifiers };
  renderBanner(`${e.name}: ${e.message}`, e.good);
}

function renderBanner(text, good) {
  dom.eventBanner.textContent = text;
  dom.eventBanner.classList.remove("hidden");
  dom.eventBanner.style.borderColor = good ? "#2a805e" : "#8a4e4e";
  dom.eventBanner.style.background = good ? "#1a3429" : "#352121";
  setTimeout(() => dom.eventBanner.classList.add("hidden"), 5500);
}

function checkAchievements() {
  let changed = false;
  ACHIEVEMENTS.forEach((a) => {
    if (!state.achievements[a.id] && a.cond(state)) {
      state.achievements[a.id] = true;
      renderBanner(`実績解除: ${a.name}`, true);
      changed = true;
    }
  });
  if (changed) render();
}

function updateDerivedStats() {
  const eps = getEPS();
  state.stats.maxEPS = Math.max(state.stats.maxEPS, eps);
}

function runTick() {
  const now = Date.now();
  const dtSec = Math.min(1, (now - lastTick) / 1000);
  lastTick = now;

  addEnergy(state, getEPS() * dtSec);
  processEvent(dtSec);
  updateDerivedStats();
  checkAchievements();
  renderNumbers();

  if (now - lastSave >= SAVE_INTERVAL_MS) {
    saveGame();
    lastSave = now;
  }
}

function render() {
  renderBuildings();
  renderUpgrades();
  renderPermanentUpgrades();
  renderAchievements();
  renderStats();
  renderNumbers();
}

function renderNumbers() {
  dom.energyValue.textContent = formatNumber(state.energy);
  dom.clickValue.textContent = formatNumber(getClickValue());
  dom.epsValue.textContent = `${formatNumber(getEPS())}/s`;
  dom.shardValue.textContent = formatNumber(state.shard);
  dom.prestigeEstimate.textContent = formatNumber(prestigeGain());
  dom.globalMultiplier.textContent = `x${getGlobalMultiplier().toFixed(2)}`;
  dom.buffState.textContent = state.event ? `${state.event.name} (${Math.ceil(state.event.remaining)}s)` : "なし";
  dom.prestigeButton.disabled = prestigeGain() <= 0;
}

function renderBuildings() {
  dom.buildingList.innerHTML = "";
  BUILDINGS.forEach((b) => {
    const cost = getBuildingCost(b);
    const affordable = state.energy >= cost;
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${b.name}</strong>
      <div>所持: ${state.buildings[b.id]}</div>
      <div>生産: ${formatNumber(getBuildingProduction(b.id))}/s</div>
      <div>コスト: ${formatNumber(cost)}</div>
      <button ${affordable ? "class='affordable'" : ""} ${affordable ? "" : "disabled"}>購入</button>
    `;
    div.querySelector("button").addEventListener("click", () => buyBuilding(b.id));
    dom.buildingList.appendChild(div);
  });
}

function renderUpgrades() {
  const container = dom["tab-upgrades"];
  container.innerHTML = "";
  UPGRADES.forEach((u) => {
    const bought = !!state.upgrades[u.id];
    const affordable = state.energy >= u.cost;
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${u.name}</strong>
      <div>${u.desc}</div>
      <div>Cost: ${formatNumber(u.cost)}</div>
      <button ${bought || !affordable ? "disabled" : ""} ${affordable && !bought ? "class='affordable'" : ""}>${bought ? "購入済み" : "購入"}</button>
    `;
    div.querySelector("button").addEventListener("click", () => buyUpgrade(u.id));
    container.appendChild(div);
  });
}

function renderPermanentUpgrades() {
  const container = dom["tab-permanent"];
  container.innerHTML = "";
  PERMANENT_UPGRADES.forEach((u) => {
    const lv = state.permanent[u.id];
    const cost = permanentUpgradeCost(u);
    const maxed = lv >= u.maxLevel;
    const affordable = state.shard >= cost;
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${u.name} Lv.${lv}</strong>
      <div>${u.desc}</div>
      <div>Cost: ${maxed ? "MAX" : `${cost} Shard`}</div>
      <button ${maxed || !affordable ? "disabled" : ""} ${affordable && !maxed ? "class='affordable'" : ""}>${maxed ? "最大" : "強化"}</button>
    `;
    div.querySelector("button").addEventListener("click", () => buyPermanentUpgrade(u.id));
    container.appendChild(div);
  });
}

function renderAchievements() {
  const container = dom["tab-achievements"];
  container.innerHTML = "";
  ACHIEVEMENTS.forEach((a) => {
    const unlocked = !!state.achievements[a.id];
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<strong>${a.name}</strong><div>${unlocked ? "解除済み" : "未解除"}</div>`;
    container.appendChild(div);
  });
}

function renderStats() {
  const s = state.stats;
  dom["tab-stats"].innerHTML = `
    <div class="card"><strong>総クリック数</strong><div>${formatNumber(s.totalClicks)}</div></div>
    <div class="card"><strong>総獲得Energy</strong><div>${formatNumber(s.totalEnergyEarned)}</div></div>
    <div class="card"><strong>総転生回数</strong><div>${formatNumber(s.totalPrestiges)}</div></div>
    <div class="card"><strong>最長放置時間</strong><div>${formatNumber(s.longestOfflineSeconds)} sec</div></div>
    <div class="card"><strong>最大EPS</strong><div>${formatNumber(s.maxEPS)}</div></div>
    <div class="card"><strong>今周最高Energy</strong><div>${formatNumber(s.bestEnergyThisRun)}</div></div>
  `;
}

function saveGame() {
  state.lastPlayedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  dom.saveState.textContent = new Date().toLocaleTimeString();
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return;
    Object.assign(state, createInitialState(), parsed);
  } catch {
    // intentionally ignore malformed saves
  }
}

function grantOfflineProgress() {
  const now = Date.now();
  const elapsed = Math.max(0, (now - state.lastPlayedAt) / 1000);
  const capped = Math.min(elapsed, MAX_OFFLINE_SECONDS);
  state.stats.longestOfflineSeconds = Math.max(state.stats.longestOfflineSeconds, capped);
  const rewardMult = getPermanentEffect("idle_mastery");
  const gain = getEPS() * capped * rewardMult;
  addEnergy(state, gain);
  if (gain > 0) renderBanner(`放置報酬 +${formatNumber(gain)} Energy (${Math.floor(capped)}秒)`, true);
}

function wireEvents() {
  dom.coreButton.addEventListener("click", attemptClick);
  dom.prestigeButton.addEventListener("click", doPrestige);
  dom.saveButton.addEventListener("click", saveGame);
  dom.resetButton.addEventListener("click", () => {
    if (!window.confirm("セーブデータを削除します。よろしいですか？")) return;
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-content").forEach((p) => p.classList.add("hidden"));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
    });
  });
}

function boot() {
  setupDom();
  loadGame();
  grantOfflineProgress();
  wireEvents();
  render();
  setInterval(runTick, TICK_MS);
  window.addEventListener("beforeunload", saveGame);
}

boot();
