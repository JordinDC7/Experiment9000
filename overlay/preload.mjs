/**
 * PRELOAD (CommonJS)
 * This WILL execute reliably in Electron and expose IPC to the renderer.
 */

const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] CommonJS preload loaded");

contextBridge.exposeInMainWorld("electron", {
  // Renderer -> Main
  lockMatchup: (data) => {
    ipcRenderer.send("lock-matchup", data);
  },

  // Main -> Renderer
  onLiveUpdate: (callback) => {
    ipcRenderer.removeAllListeners("live-update");
    ipcRenderer.on("live-update", (_event, data) => {
      try {
        callback(data);
      } catch (err) {
        // Do not crash renderer on callback errors
        console.error("[preload] onLiveUpdate callback error:", err);
      }
    });
  },
});
