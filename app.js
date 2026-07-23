const TARGET_LEVEL = 0.55; // 55%
let batteryRef = null;
let discharging = false;
let wakeLock = null;

const statusEl = document.getElementById("status");
const levelEl = document.getElementById("battery-level");
const startBtn = document.getElementById("start-btn");
const videoEl = document.getElementById("gpu-video");

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

function startCpuBurn() {
  // Simple CPU burn in a worker-like loop
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

function startDischarge() {
  if (!batteryRef) return;
  discharging = true;
  statusEl.textContent = "Discharging… will stop at 55%.";
  requestWakeLock();
  videoEl.play().catch(() => {});
  startCpuBurn();
  checkThreshold();
}

function stopDischarge() {
  discharging = false;
  releaseWakeLock();
  statusEl.textContent = "Target reached. REMOVE BATTERY NOW.";
}

function checkThreshold() {
  const level = batteryRef.level;
  const pct = Math.round(level * 100);
  if (level <= TARGET_LEVEL) {
    stopDischarge();
    levelEl.textContent = `Battery: ${pct}% (target reached)`;
    // Optional: auto-shutdown if chrome://shutdown is allowed
    window.location.href = "chrome://shutdown";
  }
}

startBtn.addEventListener("click", () => {
  if (!batteryRef) return;
  startDischarge();
});

window.addEventListener("load", () => {
  initBattery();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(console.error);
}
