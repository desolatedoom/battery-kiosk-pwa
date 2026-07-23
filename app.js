const TARGET_LEVEL = 0.55; // 55%
let batteryRef = null;
let discharging = false;
let wakeLock = null;

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
  levelEl.textContent = `Battery: ${pct}% (charging: ${batteryRef.charging ? "yes" : "no"})`;
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

  // Hide main UI
  mainUI.style.display = "none";

  // Show navy overlay
  idleOverlay.style.display = "block";

  // ChromeOS kiosk idle timeout will shut down automatically
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
