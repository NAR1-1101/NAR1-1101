const SAVE_KEY = "corePulseIdle.v1";
const SAVE_INTERVAL_MS = 5000;
const TICK_MS = 100;

const BALANCE = {
  baseTap: 1,
  prestigeThreshold: 1e6,
  offlineCapSec: 8 * 3600,
  eventBaseChance: 0.003,
  eventDurationSec: { tapBoost: 15, epsBoost: 30, discount: 20 },
};

const BUILDINGS = [
  { id: "micro_cell", name: "Micro Cell", description: "微小セル発電。序盤の主力。", baseCost: 12, baseProduction: 0.4, growthRate: 1.15, owned: 0 },
  { id: "generator", name: "Generator", description: "安定した回転発電機。", baseCost: 80, baseProduction: 2.2, growthRate: 1.16, owned: 0 },
  { id: "reactor", name: "Reactor", description: "高効率反応炉。", baseCost: 550, baseProduction: 11, growthRate: 1.17, owned: 0 },
  { id: "fusion_plant", name: "Fusion Plant", description: "融合プラント。中盤の主軸。", baseCost: 3500, baseProduction: 56, growthRate: 1.18, owned: 0 },
  { id: "quantum_extractor", name: "Quantum Extractor", description: "量子抽出で大量生成。", baseCost: 28000, baseProduction: 260, growthRate: 1.19, owned: 0 },
  { id: "singularity_core", name: "Singularity Core", description: "特異点コア。終盤用。", baseCost: 200000, baseProduction: 1400, growthRate: 1.2, owned: 0 },
];

const UPGRADES = [
  { id: "tap_1", type: "tap", name: "Pulse Gloves", desc: "タップ +1", cost: 60, value: 1, bought: false },
  { id: "tap_2", type: "tap", name: "Resonance Knuckle", desc: "タップ +4", cost: 600, value: 4, bought: false },
  { id: "eps_1", type: "eps", name: "Flow Stabilizer", desc: "EPS x1.25", cost: 450, value: 1.25, bought: false },
  { id: "eps_2", type: "eps", name: "Core Overclock", desc: "EPS x1.6", cost: 4200, value: 1.6, bought: false },
  { id: "global_1", type: "global", name: "Quantum Lens", desc: "全体 x1.15", cost: 2000, value: 1.15, bought: false },
  { id: "reactor_boost", type: "building", target: "reactor", name: "Reactor Lattice", desc: "Reactor生産 x2", cost: 7000, value: 2, bought: false },
];

const PERMANENT = [
  { id: "p_tap", name: "Tap Matrix", desc: "恒久タップ +20%", baseCost: 2, growth: 1.8, level: 0, kind: "tap" },
  { id: "p_eps", name: "Auto Matrix", desc: "恒久EPS +20%", baseCost: 2, growth: 1.8, level: 0, kind: "eps" },
  { id: "p_offline", name: "Drift Cache", desc: "オフライン報酬 +25%", baseCost: 3, growth: 2, level: 0, kind: "offline" },
  { id: "p_discount", name: "Nano Fabricator", desc: "設備価格 -3%", baseCost: 4, growth: 2.2, level: 0, kind: "discount" },
  { id: "p_event", name: "Fortune Pulse", desc: "良イベント発生 +15%", baseCost: 5, growth: 2.3, level: 0, kind: "event" },
];

const ACHIEVEMENTS = [
  { id: "first_tap", name: "初タップ", check: (s) => s.stats.totalTaps >= 1, reward: 0 },
  { id: "energy_1k", name: "1K Energy", check: (s) => s.stats.totalEnergyEarned >= 1000, reward: 0 },
  { id: "builder_20", name: "設備20台", check: (s) => totalBuildings(s) >= 20, reward: 0 },
  { id: "first_prestige", name: "初転生", check: (s) => s.stats.totalPrestiges >= 1, reward: 0 },
];

const state = {
  version: 1,
  energy: 0,
  shards: 0,
  buyMode: "1",
  globalMultiplier: 1,
  buildingMult: {},
  upgrades: structuredClone(UPGRADES),
  buildings: structuredClone(BUILDINGS),
  permanent: structuredClone(PERMANENT),
  achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, unlocked: false })),
  event: null,
  stats: {
    totalTaps: 0,
    totalEnergyEarned: 0,
    totalPrestiges: 0,
    bestEPS: 0,
    totalPlayTimeSec: 0,
    longestOfflineSec: 0,
  },
  lastSaveAt: Date.now(),
  lastTickAt: Date.now(),
};

const el = {
  energy: document.getElementById("energyValue"),
  eps: document.getElementById("epsValue"),
  tap: document.getElementById("tapValue"),
  mult: document.getElementById("multValue"),
  shardPreview: document.getElementById("shardPreview"),
  prestigeBtn: document.getElementById("prestigeBtn"),
  coreButton: document.getElementById("coreButton"),
  tabBuildings: document.getElementById("tab-buildings"),
  tabUpgrades: document.getElementById("tab-upgrades"),
  tabPermanent: document.getElementById("tab-permanent"),
  tabAchievements: document.getElementById("tab-achievements"),
  toast: document.getElementById("toastContainer"),
  buffBanner: document.getElementById("buffBanner"),
  offlineModal: document.getElementById("offlineModal"),
  offlineSummary: document.getElementById("offlineSummary"),
  claimOfflineBtn: document.getElementById("claimOfflineBtn"),
  prestigeModal: document.getElementById("prestigeModal"),
  prestigeSummary: document.getElementById("prestigeSummary"),
  cancelPrestigeBtn: document.getElementById("cancelPrestigeBtn"),
  confirmPrestigeBtn: document.getElementById("confirmPrestigeBtn"),
};

function fmt(n) {
  if (!Number.isFinite(n)) return "∞";
  if (n < 1000) return n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2).replace(/\.0$/, "");
  const units = ["K", "M", "B", "T", "Qa", "Qi"];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  if (i >= 0) return `${n.toFixed(1)}${units[i]}`;
  return n.toExponential(2);
}

function totalBuildings(s = state) { return s.buildings.reduce((a, b) => a + b.owned, 0); }
function permanentFactor(kind) {
  const lv = state.permanent.find((p) => p.kind === kind)?.level ?? 0;
  if (kind === "discount") return Math.max(0.5, 1 - lv * 0.03);
  if (kind === "event") return 1 + lv * 0.15;
  if (kind === "offline") return 1 + lv * 0.25;
  return 1 + lv * 0.2;
}

function getTapPower() {
  let tap = BALANCE.baseTap;
  for (const u of state.upgrades) if (u.bought && u.type === "tap") tap += u.value;
  tap *= permanentFactor("tap");
  if (state.event?.type === "tapBoost") tap *= state.event.value;
  return tap * state.globalMultiplier;
}

function buildingPrice(b, qty = 1) {
  const discount = permanentFactor("discount") * (state.event?.type === "discount" ? 0.9 : 1);
  if (qty === "max") {
    let count = 0;
    let energy = state.energy;
    while (count < 10000) {
      const c = Math.floor(b.baseCost * (b.growthRate ** (b.owned + count)) * discount);
      if (energy < c) break;
      energy -= c;
      count++;
    }
    return { total: state.energy - energy, qty: count };
  }
  let total = 0;
  for (let i = 0; i < qty; i++) total += Math.floor(b.baseCost * (b.growthRate ** (b.owned + i)) * discount);
  return { total, qty };
}

function getEPS() {
  let eps = 0;
  for (const b of state.buildings) {
    const specific = state.buildingMult[b.id] || 1;
    eps += b.owned * b.baseProduction * specific;
  }
  for (const u of state.upgrades) if (u.bought && u.type === "eps") eps *= u.value;
  eps *= permanentFactor("eps") * state.globalMultiplier;
  if (state.event?.type === "epsBoost") eps *= state.event.value;
  return eps;
}

function shardPreview() {
  if (state.energy < BALANCE.prestigeThreshold) return 0;
  return Math.floor((Math.log10(state.energy) - 5.7) ** 1.4);
}

function addEnergy(v) {
  state.energy += v;
  state.stats.totalEnergyEarned += v;
}

function tapCore(evt) {
  const gain = getTapPower();
  addEnergy(gain);
  state.stats.totalTaps++;
  spawnFloat(`+${fmt(gain)}`, evt.clientX, evt.clientY);
  el.coreButton.classList.add("pressed");
  setTimeout(() => el.coreButton.classList.remove("pressed"), 90);
  checkAchievements();
  render();
}

function spawnFloat(text, x, y) {
  const d = document.createElement("div");
  d.textContent = text;
  d.style.position = "fixed";
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  d.style.color = "#8bf8ff";
  d.style.fontWeight = "700";
  d.style.pointerEvents = "none";
  d.style.transition = "all .7s ease";
  d.style.zIndex = "80";
  document.body.appendChild(d);
  requestAnimationFrame(() => { d.style.transform = "translateY(-40px)"; d.style.opacity = "0"; });
  setTimeout(() => d.remove(), 700);
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  el.toast.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function buyBuilding(id) {
  const b = state.buildings.find((x) => x.id === id);
  const mode = state.buyMode === "max" ? "max" : Number(state.buyMode);
  const costInfo = buildingPrice(b, mode);
  if (costInfo.qty <= 0 || state.energy < costInfo.total) return;
  state.energy -= costInfo.total;
  b.owned += costInfo.qty;
  render();
}

function buyUpgrade(id) {
  const u = state.upgrades.find((x) => x.id === id);
  if (!u || u.bought || state.energy < u.cost) return;
  state.energy -= u.cost;
  u.bought = true;
  if (u.type === "global") state.globalMultiplier *= u.value;
  if (u.type === "building") state.buildingMult[u.target] = (state.buildingMult[u.target] || 1) * u.value;
  render();
}

function permanentCost(p) { return Math.floor(p.baseCost * (p.growth ** p.level)); }
function buyPermanent(id) {
  const p = state.permanent.find((x) => x.id === id);
  const c = permanentCost(p);
  if (state.shards < c) return;
  state.shards -= c;
  p.level++;
  render();
}

function doPrestige() {
  const gain = shardPreview();
  if (gain <= 0) return;
  state.shards += gain;
  state.stats.totalPrestiges++;
  state.energy = 0;
  state.globalMultiplier = 1;
  state.buildingMult = {};
  state.buildings = structuredClone(BUILDINGS);
  state.upgrades = structuredClone(UPGRADES);
  state.event = null;
  el.prestigeModal.classList.add("hidden");
  showToast(`Shard +${gain}`);
  checkAchievements();
  render();
}

function checkAchievements() {
  ACHIEVEMENTS.forEach((a) => {
    const slot = state.achievements.find((x) => x.id === a.id);
    if (!slot.unlocked && a.check(state)) {
      slot.unlocked = true;
      showToast(`実績解除: ${a.name}`);
    }
  });
}

function maybeSpawnEvent() {
  if (state.event) return;
  const chance = BALANCE.eventBaseChance * permanentFactor("event");
  if (Math.random() > chance) return;
  const pool = [
    { type: "tapBoost", label: "Burst: 15秒間タップx3", value: 3, duration: BALANCE.eventDurationSec.tapBoost },
    { type: "epsBoost", label: "Surge: 30秒間EPSx2", value: 2, duration: BALANCE.eventDurationSec.epsBoost },
    { type: "supply", label: "Supply Drop: EPS3分を即時獲得", value: 180, duration: 0 },
    { type: "discount", label: "Discount: 20秒間設備価格-10%", value: 1, duration: BALANCE.eventDurationSec.discount },
  ];
  const event = pool[Math.floor(Math.random() * pool.length)];
  if (event.type === "supply") {
    addEnergy(getEPS() * event.value);
    showToast(event.label);
    return;
  }
  state.event = { ...event, remain: event.duration };
  el.buffBanner.textContent = `${event.label}（タップで受け取り）`;
  el.buffBanner.classList.remove("hidden");
}

function claimEvent() {
  if (!state.event) return;
  showToast(`イベント開始: ${state.event.label}`);
  el.buffBanner.textContent = `${state.event.label} 残り${Math.ceil(state.event.remain)}秒`;
}

function renderBuildings() {
  el.tabBuildings.innerHTML = state.buildings.map((b) => {
    const mode = state.buyMode === "max" ? "max" : Number(state.buyMode);
    const c = buildingPrice(b, mode);
    const can = state.energy >= c.total && c.qty > 0;
    return `<article class="card ${can ? "can-buy" : ""}" data-id="${b.id}">
      <div class="card-head"><strong>${b.name}</strong><span>所持 ${b.owned}</span></div>
      <p class="muted">${b.description}</p>
      <p class="muted">生産: ${fmt(b.baseProduction)} / 合計 ${fmt(b.baseProduction * b.owned)}</p>
      <button data-buy-building="${b.id}">購入 (${state.buyMode.toUpperCase()}) - ${fmt(c.total)}</button>
    </article>`;
  }).join("");
}

function renderUpgrades() {
  el.tabUpgrades.innerHTML = state.upgrades.map((u) => {
    const can = !u.bought && state.energy >= u.cost;
    return `<article class="card ${can ? "can-buy" : ""}">
      <div class="card-head"><strong>${u.name}</strong><span>${fmt(u.cost)}</span></div>
      <p class="muted">${u.desc}</p>
      <button data-buy-upgrade="${u.id}" ${u.bought ? "disabled" : ""}>${u.bought ? "購入済み" : "購入"}</button>
    </article>`;
  }).join("");
}

function renderPermanent() {
  el.tabPermanent.innerHTML = `<p>Shard: <strong>${fmt(state.shards)}</strong></p>` + state.permanent.map((p) => {
    const c = permanentCost(p);
    const can = state.shards >= c;
    return `<article class="card ${can ? "can-buy" : ""}">
      <div class="card-head"><strong>${p.name} Lv.${p.level}</strong><span>${c} Shard</span></div>
      <p class="muted">${p.desc}</p>
      <button data-buy-permanent="${p.id}">強化</button>
    </article>`;
  }).join("");
}

function renderAchievements() {
  const unlocked = state.achievements.filter((a) => a.unlocked).length;
  const achText = ACHIEVEMENTS.map((a) => {
    const on = state.achievements.find((x) => x.id === a.id).unlocked;
    return `<li>${on ? "✅" : "⬜"} ${a.name}</li>`;
  }).join("");
  el.tabAchievements.innerHTML = `
    <article class="card"><strong>実績 ${unlocked}/${ACHIEVEMENTS.length}</strong><ul>${achText}</ul></article>
    <article class="card"><strong>統計</strong>
      <p class="muted">総タップ: ${fmt(state.stats.totalTaps)}</p>
      <p class="muted">総獲得Energy: ${fmt(state.stats.totalEnergyEarned)}</p>
      <p class="muted">総転生回数: ${state.stats.totalPrestiges}</p>
      <p class="muted">最高EPS: ${fmt(state.stats.bestEPS)}</p>
      <p class="muted">総プレイ時間: ${fmt(state.stats.totalPlayTimeSec)} 秒</p>
      <p class="muted">最長放置: ${fmt(state.stats.longestOfflineSec)} 秒</p>
    </article>`;
}

function render() {
  const eps = getEPS();
  state.stats.bestEPS = Math.max(state.stats.bestEPS, eps);
  el.energy.textContent = fmt(state.energy);
  el.eps.textContent = fmt(eps);
  el.tap.textContent = fmt(getTapPower());
  el.mult.textContent = `x${state.globalMultiplier.toFixed(2)}`;
  const shards = shardPreview();
  el.shardPreview.textContent = shards;
  el.prestigeBtn.classList.toggle("hidden", shards <= 0);
  if (state.event) {
    el.buffBanner.classList.remove("hidden");
    el.buffBanner.textContent = `${state.event.label} 残り${Math.ceil(state.event.remain)}秒`;
  } else {
    el.buffBanner.classList.add("hidden");
  }
  renderBuildings();
  renderUpgrades();
  renderPermanent();
  renderAchievements();
}

function save() {
  state.lastSaveAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return;
    Object.assign(state, parsed);
  } catch (e) {
    console.warn("save load failed", e);
  }
}

function processOfflineProgress() {
  const now = Date.now();
  const last = state.lastSaveAt || now;
  const elapsed = Math.max(0, Math.floor((now - last) / 1000));
  if (elapsed < 10) return;
  const capped = Math.min(elapsed, BALANCE.offlineCapSec);
  state.stats.longestOfflineSec = Math.max(state.stats.longestOfflineSec, capped);
  const gain = getEPS() * capped * permanentFactor("offline");
  if (gain <= 0) return;
  el.offlineSummary.textContent = `${capped}秒の放置で ${fmt(gain)} Energy を獲得しました。`;
  el.offlineModal.classList.remove("hidden");
  el.claimOfflineBtn.onclick = () => {
    addEnergy(gain);
    el.offlineModal.classList.add("hidden");
    render();
  };
}

function bindEvents() {
  el.coreButton.addEventListener("pointerdown", tapCore);
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById(`tab-${t.dataset.tab}`).classList.add("active");
  }));
  document.querySelectorAll(".buy-mode-btn").forEach((b) => b.addEventListener("click", () => {
    state.buyMode = b.dataset.buy;
    document.querySelectorAll(".buy-mode-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    renderBuildings();
  }));

  let holdTimer = null;
  document.body.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-buy-building]");
    if (!btn) return;
    const id = btn.dataset.buyBuilding;
    buyBuilding(id);
    holdTimer = setInterval(() => buyBuilding(id), 140);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => document.body.addEventListener(ev, () => {
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = null;
  }));

  document.body.addEventListener("click", (e) => {
    const u = e.target.closest("[data-buy-upgrade]");
    const p = e.target.closest("[data-buy-permanent]");
    if (u) buyUpgrade(u.dataset.buyUpgrade);
    if (p) buyPermanent(p.dataset.buyPermanent);
  });

  el.buffBanner.addEventListener("click", claimEvent);
  el.prestigeBtn.addEventListener("click", () => {
    el.prestigeSummary.textContent = `現在の進行をリセットして Shard +${shardPreview()} を獲得します。`;
    el.prestigeModal.classList.remove("hidden");
  });
  el.cancelPrestigeBtn.addEventListener("click", () => el.prestigeModal.classList.add("hidden"));
  el.confirmPrestigeBtn.addEventListener("click", doPrestige);
}

function gameLoop() {
  const now = Date.now();
  const dt = (now - state.lastTickAt) / 1000;
  state.lastTickAt = now;
  addEnergy(getEPS() * dt);
  state.stats.totalPlayTimeSec += dt;

  if (state.event) {
    state.event.remain -= dt;
    if (state.event.remain <= 0) {
      showToast("イベント終了");
      state.event = null;
    }
  } else {
    maybeSpawnEvent();
  }

  checkAchievements();
  render();
}

function init() {
  load();
  bindEvents();
  processOfflineProgress();
  render();
  setInterval(gameLoop, TICK_MS);
  setInterval(save, SAVE_INTERVAL_MS);
  window.addEventListener("beforeunload", save);
}

init();
