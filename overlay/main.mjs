// overlay/main.mjs
/**
 * LoL Build Intel — Overlay Main Process
 *
 * Goals:
 * - Full-screen-ish transparent overlay that can be click-through in-game
 * - "MOLD" HUD augments (tiny widgets near LoL HUD) in-game
 * - Champ Select can be more informative, but still lightweight
 * - Calibration mode (Ctrl+Alt+Insert) to nudge anchors + save hud_anchors.json
 * - Draggable via top-edge hover "grab strip" (renderer tells us when cursor is at top)
 */

import { app, BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { startChampSelectWatcher } from "../engine/champ-select/champ-select-watcher.mjs";
import { startLiveRecommender } from "../engine/live-recommender.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win = null;
let visible = true;

let stopChamp = null;
let stopLive = null;

// ------------------------ runtime paths ------------------------

const RUNTIME_DIR = path.join(process.cwd(), "runtime");
const BOUNDS_PATH = path.join(RUNTIME_DIR, "overlay-bounds.json");
const ANCHORS_PATH = path.join(RUNTIME_DIR, "hud_anchors.json");

function ensureRuntimeDir() {
  try {
    if (!fs.existsSync(RUNTIME_DIR))
      fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  } catch {}
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function computeDefaultBounds() {
  const d = screen.getPrimaryDisplay();
  const b = d?.bounds || { x: 0, y: 0, width: 1920, height: 1080 };

  // Default: fill display bounds (NOT workArea) so it molds to fullscreen games.
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

function normalizeBounds(saved) {
  const d = screen.getPrimaryDisplay();
  const b = d?.bounds || { x: 0, y: 0, width: 1920, height: 1080 };

  const minW = 900;
  const minH = 600;

  const def = computeDefaultBounds();

  if (
    !saved ||
    !Number.isFinite(saved.width) ||
    !Number.isFinite(saved.height)
  ) {
    return {
      x: def.x,
      y: def.y,
      width: clamp(def.width, minW, b.width),
      height: clamp(def.height, minH, b.height),
    };
  }

  const width = clamp(saved.width, minW, b.width);
  const height = clamp(saved.height, minH, b.height);

  const x = clamp(saved.x ?? def.x, b.x, b.x + b.width - 80);
  const y = clamp(saved.y ?? def.y, b.y, b.y + b.height - 60);

  return { x, y, width, height };
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonSafe(p, obj) {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
  } catch {}
}

function readBounds() {
  return readJsonSafe(BOUNDS_PATH);
}

function writeBounds() {
  if (!win) return;
  writeJsonSafe(BOUNDS_PATH, win.getBounds());
}

// ------------------------ HUD anchors persistence ------------------------

function defaultAnchors() {
  // Stored as:
  // { x: 0..1, y: 0..1, dx: px, dy: px }
  // x/y are percent-of-window anchors; dx/dy are pixel nudges.
  return {
    version: 1,
    anchors: {
      // Ability rings (approx 1920x1080 default LoL HUD)
      skill_q: { x: 0.468, y: 0.932, dx: 0, dy: 0 },
      skill_w: { x: 0.502, y: 0.932, dx: 0, dy: 0 },
      skill_e: { x: 0.536, y: 0.932, dx: 0, dy: 0 },
      skill_r: { x: 0.571, y: 0.932, dx: 0, dy: 0 },

      // Next buy (near item slots, bottom right)
      next_buy: { x: 0.808, y: 0.935, dx: 0, dy: 0 },

      // Micro fight callout (edge above ability bar)
      fight_callout: { x: 0.5, y: 0.878, dx: 0, dy: 0 },

      // Objective timers (top right)
      objectives: { x: 0.91, y: 0.055, dx: 0, dy: 0 },

      // Recall checklist (near bottom center edge)
      recall_check: { x: 0.5, y: 0.84, dx: 0, dy: 0 },

      // Drag strip indicator (top center)
      drag_hint: { x: 0.5, y: 0.015, dx: 0, dy: 0 },
    },
  };
}

function readAnchors() {
  const raw = readJsonSafe(ANCHORS_PATH);
  if (!raw || typeof raw !== "object") return null;
  if (!raw.anchors || typeof raw.anchors !== "object") return null;
  return raw;
}

function getAnchorsOrDefault() {
  const a = readAnchors();
  if (a) return a;

  const def = defaultAnchors();
  writeJsonSafe(ANCHORS_PATH, def);
  return def;
}

function setAnchors(newAnchors) {
  // Validate lightly to avoid nuking from bad payloads.
  if (!newAnchors || typeof newAnchors !== "object")
    return getAnchorsOrDefault();
  if (!newAnchors.anchors || typeof newAnchors.anchors !== "object")
    return getAnchorsOrDefault();

  const out = { version: 1, anchors: {} };

  for (const [k, v] of Object.entries(newAnchors.anchors)) {
    if (!v || typeof v !== "object") continue;
    const x = clamp(v.x, 0, 1);
    const y = clamp(v.y, 0, 1);
    const dx = clamp(v.dx ?? 0, -5000, 5000);
    const dy = clamp(v.dy ?? 0, -5000, 5000);
    out.anchors[k] = { x, y, dx, dy };
  }

  // Ensure defaults exist (never remove keys)
  const def = defaultAnchors();
  for (const [k, v] of Object.entries(def.anchors)) {
    if (!out.anchors[k]) out.anchors[k] = v;
  }

  writeJsonSafe(ANCHORS_PATH, out);
  return out;
}

// ------------------------ central state (single source of truth) ------------------------

const CHAMP_GRACE_MS = 2500;
const LIVE_GRACE_MS = 2500;

const state = {
  lcuOk: false,
  _lastLcuOkAt: 0,
  phase: "None",

  champSelect: null,
  _lastChampOkAt: 0,
  _lastChampOkPayload: null,

  liveOk: false,
  liveError: null,
  live: null,
  _lastLiveOkAt: 0,
  _lastLiveOkPayload: null,
};

function now() {
  return Date.now();
}

function deriveMode() {
  const t = now();
  const champOk =
    state.champSelect?.ok === true ||
    (state._lastChampOkPayload && t - state._lastChampOkAt <= CHAMP_GRACE_MS);

  const liveOk =
    state.liveOk === true ||
    (state._lastLiveOkPayload && t - state._lastLiveOkAt <= LIVE_GRACE_MS);

  if (champOk) return "CHAMP_SELECT";
  if (liveOk) return "IN_GAME";
  return "IDLE";
}

// ------------------------ mouse policy ------------------------

let headerHover = false;
let calibration = false;

function setIgnoreMouse(ignore) {
  if (!win) return;
  // When ignore=true we still forward mouse moves so renderer can detect top-edge hover.
  win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
}

function applyMousePolicy() {
  if (!win) return;

  if (calibration) {
    setIgnoreMouse(false);
    return;
  }

  const mode = deriveMode();

  // Champ select: interactive UI.
  if (mode === "CHAMP_SELECT") {
    setIgnoreMouse(false);
    return;
  }

  // In-game / idle: click-through unless user hovers top edge (to drag/resize)
  if (headerHover) {
    setIgnoreMouse(false);
    return;
  }

  setIgnoreMouse(true);
}

// renderer → main
ipcMain.on("overlay:header-hover", (_evt, isHover) => {
  headerHover = Boolean(isHover);
  applyMousePolicy();
});

// renderer → main (optional, in case you want an on-screen button)
ipcMain.on("overlay:calibration:toggle", () => {
  calibration = !calibration;
  applyMousePolicy();
  if (win && win.webContents)
    win.webContents.send("OVERLAY_CALIBRATION", { calibration });
  if (win && win.webContents)
    win.webContents.send("OVERLAY_ANCHORS", getAnchorsOrDefault());
});

// renderer ↔ main (anchors)
ipcMain.handle("overlay:anchors:get", () => getAnchorsOrDefault());
ipcMain.handle("overlay:anchors:set", (_evt, anchors) => {
  const saved = setAnchors(anchors);
  if (win && win.webContents) win.webContents.send("OVERLAY_ANCHORS", saved);
  return saved;
});

// ------------------------ window creation ------------------------

function createWindow() {
  ensureRuntimeDir();

  const saved = readBounds();
  const bounds = normalizeBounds(saved);

  win = new BrowserWindow({
    ...bounds,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: true,
    fullscreenable: false,

    frame: false,
    transparent: true,
    backgroundColor: "#00000000",

    alwaysOnTop: true,
    skipTaskbar: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, "index.html"));

  win.on("resize", () => writeBounds());
  win.on("move", () => writeBounds());
  win.on("closed", () => {
    win = null;
  });

  win.webContents.on("did-finish-load", () => {
    try {
      win.webContents.send("OVERLAY_ANCHORS", getAnchorsOrDefault());
      win.webContents.send("OVERLAY_CALIBRATION", { calibration });
    } catch {}
    sendUpdate();
  });

  applyMousePolicy();
}

function registerShortcuts() {
  // INS: show/hide overlay
  globalShortcut.register("Insert", () => {
    if (!win) return;
    visible = !visible;
    if (visible) win.show();
    else win.hide();
  });

  // Ctrl+Alt+INS: calibration mode
  globalShortcut.register("Control+Alt+Insert", () => {
    calibration = !calibration;
    applyMousePolicy();
    if (win && win.webContents)
      win.webContents.send("OVERLAY_CALIBRATION", { calibration });
    if (win && win.webContents)
      win.webContents.send("OVERLAY_ANCHORS", getAnchorsOrDefault());
  });
}

// ------------------------ renderer snapshot ------------------------

function snapshotForRenderer() {
  const t = now();

  const champSelect =
    state.champSelect?.ok === true
      ? state.champSelect
      : state._lastChampOkPayload && t - state._lastChampOkAt <= CHAMP_GRACE_MS
      ? state._lastChampOkPayload
      : state.champSelect;

  const live =
    state.liveOk === true && state.live
      ? state.live
      : state._lastLiveOkPayload && t - state._lastLiveOkAt <= LIVE_GRACE_MS
      ? state._lastLiveOkPayload
      : state.live;

  const liveOk =
    state.liveOk === true
      ? true
      : state._lastLiveOkPayload && t - state._lastLiveOkAt <= LIVE_GRACE_MS
      ? true
      : false;

  const lcuOk = state.lcuOk === true ? true : t - state._lastLcuOkAt <= 2200;

  return {
    lcuOk,
    phase: state.phase,
    mode: deriveMode(),
    champSelect,
    liveOk,
    liveError: state.liveError,
    live,
    overlay: {
      calibration,
    },
  };
}

function sendUpdate() {
  if (!win || !win.webContents) return;
  win.webContents.send("STATE_UPDATE", snapshotForRenderer());
}

// ------------------------ watchers ------------------------

function startWatchers() {
  stopChamp = startChampSelectWatcher((payload) => {
    if (typeof payload?.lcuOk === "boolean") {
      state.lcuOk = payload.lcuOk;
      if (payload.lcuOk) state._lastLcuOkAt = now();
    }

    if (payload?.phase) state.phase = String(payload.phase);

    if (payload && "champSelect" in payload) {
      state.champSelect = payload.champSelect;

      if (payload.champSelect?.ok === true) {
        state._lastChampOkAt = now();
        state._lastChampOkPayload = payload.champSelect;
      }
    }

    applyMousePolicy();
    sendUpdate();
  });

  stopLive = startLiveRecommender((payload) => {
    if (typeof payload?.liveOk === "boolean") state.liveOk = payload.liveOk;
    if ("liveError" in payload) state.liveError = payload.liveError;
    if ("live" in payload) state.live = payload.live;

    if (payload?.liveOk === true && payload?.live) {
      state._lastLiveOkAt = now();
      state._lastLiveOkPayload = payload.live;
    }

    applyMousePolicy();
    sendUpdate();
  });
}

// ------------------------ app lifecycle ------------------------

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();
  startWatchers();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  try {
    globalShortcut.unregisterAll();
  } catch {}
  try {
    stopChamp?.();
  } catch {}
  try {
    stopLive?.();
  } catch {}
});
