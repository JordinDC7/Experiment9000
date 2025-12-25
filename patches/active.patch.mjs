export default {
  ops: [
    {
      op: "edit",
      path: "overlay/renderer.mjs",
      find: /[\s\S]*/,
      replace: `
/**
 * DEBUG RENDERER
 * Shows raw live data to prove IPC works
 */

document.body.style.margin = "0";
document.body.style.padding = "6px";
document.body.style.fontFamily = "monospace";
document.body.style.fontSize = "11px";
document.body.style.color = "#00ffcc";
document.body.style.background = "rgba(0,0,0,0.7)";
document.body.style.whiteSpace = "pre-wrap";

// Hard fallback text so we KNOW renderer loaded
document.body.textContent = "Overlay renderer loaded...";

// Subscribe to live updates
if (window.electron && window.electron.onLiveUpdate) {
  window.electron.onLiveUpdate((data) => {
    try {
      document.body.textContent =
        "LIVE DATA:\\n\\n" + JSON.stringify(data, null, 2);
    } catch (err) {
      document.body.textContent =
        "RENDER ERROR:\\n" + String(err);
    }
  });
} else {
  document.body.textContent =
    "ERROR: window.electron.onLiveUpdate not found";
}
`,
    },
  ],
};
