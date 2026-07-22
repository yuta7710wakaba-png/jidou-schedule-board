"use strict";

const activities = [
  { id: "meeting", name: "あさ・ひるのかい", image: "meeting.png" },
  { id: "washroom", name: "てあらい", image: "washroom.png" },
  { id: "lunch", name: "おひる", image: "lunch.png" },
  { id: "snack", name: "おやつ", image: "snack.png" },
  { id: "free-play", name: "じゆうあそび", image: "free-play.png" },
  { id: "nakayoshi", name: "なかよし", image: "nakayoshi.png" },
  { id: "goodbye", name: "かえりのかい", image: "goodbye.png" }
];

const $ = id => document.getElementById(id);
const C = 2 * Math.PI * 50;
const KEY = "jidouScheduleBoardV9";
const defaults = {
  currentId: "meeting",
  nextId: "",
  nextStart: "",
  warningMinutes: 5,
  volume: 60
};

let state = load();
let audio = null;
let transitionKey = "";
let warningKey = "";
let transitionRunning = false;
let personalDuration = 300;
let personalRemaining = 300;
let personalRunning = false;
let lastFrame = 0;

const activitySound = new Audio("activity-change.mp3?v=9.3.1");
const warningSound = new Audio("mei-kara-mei-switch2.mp3?v=9.3.1");
const personalSound = new Audio("personal-alarm.mp3?v=9.3.1");

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...defaults };
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function act(id) {
  return activities.find(a => a.id === id) || null;
}

function setImage(el, activity) {
  if (!activity) {
    el.hidden = true;
    el.removeAttribute("src");
    el.alt = "";
    return;
  }
  el.src = `${activity.image}?v=9.3.1`;
  el.alt = activity.name;
  el.hidden = false;
}

function activityOptions(includeEmpty = false) {
  const empty = includeEmpty ? '<option value="">選択してください</option>' : "";
  return empty + activities.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
}

function populate() {
  const currentOptions = activityOptions(false);
  const nextOptions = activityOptions(true);
  $("currentSelect").innerHTML = currentOptions;
  $("quickCurrentSelect").innerHTML = currentOptions;
  $("nextSelect").innerHTML = nextOptions;
  $("quickNextSelect").innerHTML = nextOptions;
}

function render() {
  const current = act(state.currentId) || activities[0];
  const next = act(state.nextId);

  setImage($("currentImg"), current);
  $("currentName").textContent = current.name;

  setImage($("nextImg"), next);
  $("nextPlaceholder").hidden = Boolean(next);
  $("nextName").textContent = next ? next.name : "";

  $("currentSelect").value = current.id;
  $("quickCurrentSelect").value = current.id;
  $("nextSelect").value = next ? next.id : "";
  $("quickNextSelect").value = next ? next.id : "";
  $("nextStart").value = state.nextStart;
  $("quickNextStart").value = state.nextStart;
  $("warningMinutes").value = String(state.warningMinutes);
  $("volume").value = String(state.volume);
  $("manualTransitionBtn").disabled = !next || transitionRunning;

  if (!next) {
    $("board").classList.remove("attention-mode");
  }
}

function clock() {
  const d = new Date();
  $("clockText").textContent = d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  $("todayLabel").textContent = d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
}

function target() {
  if (!state.nextStart) return null;
  const [h, m] = state.nextStart.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function scheduleKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}_${state.nextStart}_${state.nextId}`;
}

function progress(el, value) {
  el.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, value))));
}

function resetMainTimer(message) {
  $("mainText").textContent = "--:--";
  $("mainSub").textContent = "開始時間";
  $("countTitle").textContent = message;
  progress($("mainProgress"), 0);
  $("board").classList.remove("attention-mode");
}

function updateMain() {
  const next = act(state.nextId);
  if (!next) {
    resetMainTimer("つぎの活動を選んでください");
    return;
  }

  const t = target();
  if (!t) {
    resetMainTimer("開始時間は未設定です");
    return;
  }

  const diff = t - Date.now();
  const warn = Math.max(1, Number(state.warningMinutes)) * 60000;
  const k = scheduleKey();

  if (diff > warn) {
    $("mainText").textContent = state.nextStart;
    $("mainSub").textContent = "開始時間";
    $("countTitle").textContent = `${state.warningMinutes}分前に おしらせします`;
    $("message").textContent = "たのしく すごそう";
    progress($("mainProgress"), 0);
    $("board").classList.remove("attention-mode");
    return;
  }

  if (diff > 0) {
    if (warningKey !== k) {
      warningKey = k;
      soundWarning();
    }
    $("board").classList.add("attention-mode");
    $("mainText").textContent = fmt(diff);
    $("mainSub").textContent = "あと";
    $("countTitle").textContent = "つぎの じかんまで";
    $("message").textContent = `あと ${Math.ceil(diff / 60000)}ぷんで きりかえ`;
    progress($("mainProgress"), 1 - diff / warn);
    return;
  }

  $("board").classList.add("attention-mode");
  $("mainText").textContent = "00:00";
  $("mainSub").textContent = "じかんです";
  $("countTitle").textContent = "つぎの じかんです";
  progress($("mainProgress"), 1);

  if (transitionKey !== k && !transitionRunning) {
    transitionKey = k;
    transition();
  }
}

function transition({ manual = false } = {}) {
  const next = act(state.nextId);
  if (!next) return;

  transitionRunning = true;
  $("manualTransitionBtn").disabled = true;
  soundActivity();
  setImage($("overlayImg"), next);
  $("overlayName").textContent = next.name;
  $("transitionOverlay").hidden = false;

  setTimeout(() => {
    $("transitionOverlay").hidden = true;
    state.currentId = next.id;
    state.nextId = "";
    state.nextStart = "";
    warningKey = "";
    save();
    render();
    $("message").textContent = "たのしく すごそう";
    transitionRunning = false;
    updateMain();
  }, 4500);
}

function ensureAudio() {
  if (!audio) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audio = new AudioContextClass();
  }
  if (audio && audio.state === "suspended") audio.resume().catch(() => {});
}

function beep(frequency = 660, duration = 0.16, delay = 0, strength = 0.16) {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + delay;
  const volume = Math.max(0, Math.min(1, Number(state.volume) / 100)) * strength;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playFileSound(player, fallback) {
  player.pause();
  player.currentTime = 0;
  player.volume = Math.max(0, Math.min(1, Number(state.volume) / 100));
  const promise = player.play();
  if (promise && promise.catch) promise.catch(fallback);
}

function fallbackActivity() {
  ensureAudio();
  beep(523, 0.18, 0);
  beep(659, 0.18, 0.2);
  beep(784, 0.28, 0.4);
}

function fallbackPersonal() {
  ensureAudio();
  beep(880, 0.20, 0);
  beep(660, 0.30, 0.28);
  beep(880, 0.20, 0.80);
  beep(660, 0.35, 1.08);
}

function soundWarning() {
  playFileSound(warningSound, fallbackWarning);
}

function fallbackWarning() {
  ensureAudio();
  beep(698, 0.15, 0, 0.13);
  beep(880, 0.20, 0.2, 0.13);
}

function soundActivity() {
  playFileSound(activitySound, fallbackActivity);
}

function soundPersonal() {
  playFileSound(personalSound, fallbackPersonal);
}

function setMinutes(minutes) {
  personalDuration = minutes * 60;
  personalRemaining = personalDuration;
  personalRunning = false;
  renderPersonal();
}

function renderPersonal() {
  $("personalText").textContent = fmt(personalRemaining * 1000);
  progress($("personalProgress"), personalDuration ? 1 - personalRemaining / personalDuration : 0);
  $("personalStart").textContent = personalRunning ? "ストップ" : "スタート";
}

function tick(timestamp) {
  if (personalRunning) {
    if (!lastFrame) lastFrame = timestamp;
    personalRemaining = Math.max(0, personalRemaining - (timestamp - lastFrame) / 1000);
    if (personalRemaining <= 0) {
      personalRunning = false;
      personalRemaining = 0;
      soundPersonal();
    }
    renderPersonal();
  }
  lastFrame = timestamp;
  requestAnimationFrame(tick);
}

function openDialog(dialog) {
  ensureAudio();
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (dialog.close) dialog.close();
  else dialog.removeAttribute("open");
}

function openCurrentDialog() {
  $("quickCurrentSelect").value = state.currentId;
  openDialog($("currentDialog"));
}

function openNextDialog() {
  $("quickNextSelect").value = state.nextId;
  $("quickNextStart").value = state.nextStart;
  openDialog($("nextDialog"));
}

function openSettings() {
  render();
  openDialog($("settingsDialog"));
}

function saveCurrent(e) {
  e.preventDefault();
  state.currentId = $("quickCurrentSelect").value;
  save();
  render();
  closeDialog($("currentDialog"));
}

function saveNext(e) {
  e.preventDefault();
  state.nextId = $("quickNextSelect").value;
  state.nextStart = state.nextId ? $("quickNextStart").value : "";
  transitionKey = "";
  warningKey = "";
  save();
  render();
  closeDialog($("nextDialog"));
  updateMain();
}

function saveSettings(e) {
  e.preventDefault();
  state.currentId = $("currentSelect").value;
  state.nextId = $("nextSelect").value;
  state.nextStart = state.nextId ? $("nextStart").value : "";
  state.warningMinutes = Number($("warningMinutes").value);
  state.volume = Number($("volume").value);
  transitionKey = "";
  warningKey = "";
  save();
  render();
  closeDialog($("settingsDialog"));
  updateMain();
}

async function fullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {}
}

function init() {
  populate();
  render();
  clock();
  renderPersonal();

  $("currentActivityButton").onclick = openCurrentDialog;
  $("nextActivityButton").onclick = openNextDialog;
  $("manualTransitionBtn").onclick = () => transition({ manual: true });
  $("settingsBtn").onclick = openSettings;
  $("closeCurrentDialog").onclick = () => closeDialog($("currentDialog"));
  $("closeNextDialog").onclick = () => closeDialog($("nextDialog"));
  $("closeSettings").onclick = () => closeDialog($("settingsDialog"));
  $("currentForm").onsubmit = saveCurrent;
  $("nextForm").onsubmit = saveNext;
  $("settingsForm").onsubmit = saveSettings;
  $("testSound").onclick = soundActivity;
  $("testPersonalSound").onclick = soundPersonal;
  $("soundBtn").onclick = soundActivity;
  $("fullscreenBtn").onclick = fullscreen;

  document.querySelectorAll("[data-minutes]").forEach(button => {
    button.onclick = () => setMinutes(Number(button.dataset.minutes));
  });

  $("personalStart").onclick = () => {
    if (personalRemaining <= 0) personalRemaining = personalDuration;
    personalRunning = !personalRunning;
    ensureAudio();
    renderPersonal();
  };

  $("personalReset").onclick = () => {
    personalRunning = false;
    personalRemaining = personalDuration;
    renderPersonal();
  };

  setInterval(() => {
    clock();
    updateMain();
  }, 500);

  updateMain();
  requestAnimationFrame(tick);
}

window.addEventListener("DOMContentLoaded", init);
