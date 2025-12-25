// overlay/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

/**
 * Minimal, safe bridge for renderer.
 * Keep this tiny; all logic stays in renderer.
 */
contextBridge.exposeInMainWorld("api", {
  // state stream
  onStateUpdate: (cb) => {
    ipcRenderer.on("STATE_UPDATE", (_evt, payload) => cb(payload));
  },

  // anchors stream + RPC
  onAnchors: (cb) => {
    ipcRenderer.on("OVERLAY_ANCHORS", (_evt, payload) => cb(payload));
  },
  getAnchors: () => ipcRenderer.invoke("overlay:anchors:get"),
  setAnchors: (anchors) => ipcRenderer.invoke("overlay:anchors:set", anchors),

  // calibration stream
  onCalibration: (cb) => {
    ipcRenderer.on("OVERLAY_CALIBRATION", (_evt, payload) => cb(payload));
  },
  toggleCalibration: () => ipcRenderer.send("overlay:calibration:toggle"),

  // click-through/drag affordance
  setHeaderHover: (isHover) =>
    ipcRenderer.send("overlay:header-hover", Boolean(isHover)),
});
