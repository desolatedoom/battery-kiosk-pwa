const TARGET_LEVEL = 0.55; // 55%
let batteryRef = null;
let discharging = false;
let wakeLock = null;

const SAMPLE_INTERVAL_MS = 30000; // 30 seconds
const MAX_HISTORY_MINUTES = 10;   // keep last 10 minutes

let drainHistory = [];
let drainTimer = null;

// UI elements
const statusEl = document.getElementById("status");
const levelEl = document.getElementById("battery-level");
const startBtn = document.getElementById("start-btn");
const videoEl = document.getElementById("gpu-video");

// Idle overlay elements
const idleOverlay = document.getElementById("idleOverlay");

// ------------------------------
// STOP EVERYTHING (shutdown-safe)
// ------------------------------
function stopAllActivity() {

  // Stop discharging logic
  discharging = false;

  // Stop CPU burn + wake lock
  releaseWakeLock();

  // Stop video drain
  videoEl.pause();
  videoEl.src = "";

  // Stop drain-rate sampling timer
  if (drainTimer) {
    clearInterval(drainTimer);
    drainTimer = null;
  }

  // Stop battery listeners
  if (batteryRef) {
    batteryRef.removeEventListener("levelchange", batteryLevelHandler);
    batteryRef.removeEventListener("chargingchange", batteryChargingHandler);
  }

  // Freeze UI updates
  statusEl.textContent = "";
  levelEl.textContent = "";

  // Freeze drain-rate display
  const drainRateEl = document.getElementById("drain-rate");
  if (drainRateEl) drainRateEl.textContent = "";
}

// ------------------------------
// Battery Initialization
// ------------------------------
async function initBattery() {
  if (!("getBattery" in navigator)) {
    statusEl.textContent = "Battery API not available.";
    return;
  }

  batteryRef = await navigator.getBattery();
  updateBatteryUI();
  attachBatteryListeners();
  startDrainSampling();
  statusEl.textContent = "Ready. Insert battery and press Start.";
}

// ------------------------------
// Drain Sampling (time-based)
// ------------------------------
function startDrainSampling() {
  drainTimer = setInterval(() => {
    if (!batteryRef || !discharging) return;

    const now = Date.now();
    const pct = Math.round(batteryRef.level * 100);

    drainHistory.push({ time: now, pct });

    const cutoff = now - MAX_HISTORY_MINUTES * 60 * 1000;
    drainHistory = drainHistory.filter(entry => entry.time >= cutoff);

    updateDrainRate();
  }, SAMPLE_INTERVAL_MS);
}

function updateDrainRate() {
  const drainRateEl = document.getElementById("drain-rate");
  if (!drainRateEl) return;
  if (drainHistory.length < 2) {
    drainRateEl.textContent = "Drain rate: -- %/hr";
    return;
  }

  const first = drainHistory[0];
  const last = drainHistory[drainHistory.length - 1];

  const deltaPct = first.pct - last.pct;
  const deltaHours = (last.time - first.time) / 3600000;

  if (deltaHours <= 0 || deltaPct <= 0) {
    drainRateEl.textContent = "Drain rate: -- %/hr";
    return;
  }

  const rate = (deltaPct / deltaHours).toFixed(2);
  drainRateEl.textContent = `Drain rate: ${rate} %/hr`;
}

// ------------------------------
// Battery UI Update
// ------------------------------
function updateBatteryUI() {
  if (!batteryRef) return;

  const pct = Math.round(batteryRef.level * 100);
  levelEl.textContent = `Battery: ${pct}%`;
}

// ------------------------------
// Battery Listeners (removable)
// ------------------------------
function batteryLevelHandler() {
  updateBatteryUI();
  if (discharging) checkThreshold();
}

function batteryChargingHandler() {
  updateBatteryUI();
}

function attachBatteryListeners() {
  batteryRef.addEventListener("levelchange", batteryLevelHandler);
  batteryRef.addEventListener("chargingchange", batteryChargingHandler);
}

// ------------------------------
// Wake Lock
// ------------------------------
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) {
    console.warn("WakeLock failed:", e);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// ------------------------------
// CPU Burn
// ------------------------------
function startCpuBurn() {
  function burn() {
    let x = 0;
    for (let i = 0; i < 1e7; i++) {
      x += Math.random() * Math.random();
    }
    if (discharging) {
      setTimeout(burn, 0);
    }
  }
  burn();
}

// ------------------------------
// Discharge Start/Stop
// ------------------------------
function startDischarge() {
  if (!batteryRef) return;
  discharging = true;

  statusEl.textContent = "Discharging… will stop at 55%.";
  requestWakeLock();

  videoEl.src = "assets/discharge-video-4k.mp4";
  videoEl.play().catch(() => {});

  startCpuBurn();
  checkThreshold();
}

function stopDischarge() {
  discharging = false;
  releaseWakeLock();

  videoEl.pause();
  videoEl.src = "";

  statusEl.textContent = "Target reached. REMOVE BATTERY NOW.";
}

// ------------------------------
// Idle Mode (shutdown-safe)
// ------------------------------
function enterIdleMode() {

  stopAllActivity();

  const whiteOverlay = document.getElementById("white-overlay");
  whiteOverlay.style.backgroundColor = "#0a1a3a"; // navy

  document.getElementById("ui").style.display = "none";

  idleOverlay.style.display = "block";
}

// ------------------------------
// Threshold Check
// ------------------------------
function checkThreshold() {
  const level = batteryRef.level;
  const pct = Math.round(level * 100);

  if (level <= TARGET_LEVEL) {

    stopAllActivity();

    levelEl.textContent = `Battery: ${pct}% (target reached)`;

    enterIdleMode();
  }
}

// ------------------------------
// UI Events
// ------------------------------
startBtn.addEventListener("click", () => {
  if (!batteryRef) return;
  startDischarge();
});

// ------------------------------
// Startup
// ------------------------------
window.addEventListener("load", () => {
  initBattery();
});

// ------------------------------
// Service Worker
// ------------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(console.error);
}
