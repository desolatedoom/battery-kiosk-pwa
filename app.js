const TARGET_LEVEL = 0.55; // 55%
let batteryRef = null;
let discharging = false;
let wakeLock = null;
let lastLevel = null;
let lastTime = null;


// UI elements
const statusEl = document.getElementById("status");
const levelEl = document.getElementById("battery-level");
const startBtn = document.getElementById("start-btn");
const videoEl = document.getElementById("gpu-video");

// Idle overlay elements
const idleOverlay = document.getElementById("idleOverlay");
const mainUI = document.getElementById("mainUI");

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
  statusEl.textContent = "Ready. Insert battery and press Start.";
}

function updateBatteryUI() {
  if (!batteryRef) return;

  const pct = Math.round(batteryRef.level * 100);
  levelEl.textContent = `Battery: ${pct}%`;

  // Drain rate calculation
  const now = Date.now();

  if (lastLevel !== null && lastTime !== null) {
    const deltaPct = lastLevel - pct;
    const deltaHours = (now - lastTime) / 3600000;

    if (deltaHours > 0) {
      const rate = (deltaPct / deltaHours).toFixed(2);
      document.getElementById("drain-rate").textContent =
        `Drain rate: ${rate} %/hr`;
    }
  }

  lastLevel = pct;
  lastTime = now;
}


function attachBatteryListeners() {
  batteryRef.addEventListener("levelchange", () => {
    updateBatteryUI();
    if (discharging) checkThreshold();
  });

  batteryRef.addEventListener("chargingchange", () => {
    updateBatteryUI();
  });
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

  // Load your drain video
  videoEl.src = "assets/discharge-video-4k.mp4";
  videoEl.play().catch(() => {});

  startCpuBurn();
  checkThreshold();
}

function stopDischarge() {
  discharging = false;
  releaseWakeLock();

  // Stop video drain
  videoEl.pause();
  videoEl.src = "";

  statusEl.textContent = "Target reached. REMOVE BATTERY NOW.";
}

// ------------------------------
// Idle Mode (replaces shutdown)
// ------------------------------
function enterIdleMode() {
  stopDischarge();

  // Switch white overlay to navy
  const whiteOverlay = document.getElementById("white-overlay");
  whiteOverlay.style.backgroundColor = "#0a1a3a"; // navy

  // Hide UI
  document.getElementById("ui").style.display = "none";

  // Show idle overlay message
  idleOverlay.style.display = "block";

  statusEl.textContent = "Idle mode activated.";
}


// ------------------------------
// Threshold Check
// ------------------------------
function checkThreshold() {
  const level = batteryRef.level;
  const pct = Math.round(level * 100);

  if (level <= TARGET_LEVEL) {
    stopDischarge();
    levelEl.textContent = `Battery: ${pct}% (target reached)`;

    // Replace chrome://shutdown with idle mode
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
