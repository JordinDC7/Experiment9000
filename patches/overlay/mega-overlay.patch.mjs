export default {
  ops: [
    /* =========================
       FIX MAIN WINDOW LOAD PATH
       ========================= */
    {
      op: "edit",
      path: "overlay/main.mjs",
      find: /loadURL\(.+\)/,
      replace: `
mainWindow.loadFile(
  new URL("./index.html", import.meta.url).pathname
);
`,
    },

    /* =========================
       WINDOW CONFIG (SMALL + DRAGGABLE)
       ========================= */
    {
      op: "edit",
      path: "overlay/main.mjs",
      find: /new BrowserWindow\(\{[\s\S]*?\}\)/,
      replace: `
const mainWindow = new BrowserWindow({
  width: 280,
  height: 180,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  resizable: false,
  skipTaskbar: true,
  webPreferences: {
    preload: new URL("./preload.mjs", import.meta.url).pathname
  }
});
`,
    },

    /* =========================
       INS HOTKEY TOGGLE
       ========================= */
    {
      op: "insert_after",
      path: "overlay/main.mjs",
      anchor: /app\.whenReady/,
      content: `
import { globalShortcut } from "electron";

app.whenReady().then(() => {
  globalShortcut.register("Insert", () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });
});
`,
    },

    /* =========================
       OVERLAY HTML (AUTOCOMPLETE UI)
       ========================= */
    {
      op: "edit",
      path: "overlay/index.html",
      find: /<body>[\s\S]*<\/body>/,
      replace: `
<body>
  <div id="app">
    <input id="champ" placeholder="Your Champion" />
    <input id="enemy" placeholder="Enemy Champion" />
    <div id="suggestions"></div>
    <button id="lock">Lock Matchup</button>
  </div>

  <script src="./renderer.mjs"></script>
</body>
`,
    },

    /* =========================
       OVERLAY STYLES (MINIMAL)
       ========================= */
    {
      op: "edit",
      path: "overlay/style.css",
      find: /[\s\S]*/,
      replace: `
body {
  margin: 0;
  background: rgba(10,10,10,0.85);
  color: #fff;
  font-family: system-ui;
  user-select: none;
}

#app {
  padding: 8px;
  -webkit-app-region: drag;
}

input, button {
  width: 100%;
  margin: 4px 0;
  padding: 6px;
  border-radius: 4px;
  border: none;
  font-size: 12px;
  -webkit-app-region: no-drag;
}

#suggestions {
  background: #111;
  max-height: 80px;
  overflow-y: auto;
}

.suggestion {
  padding: 4px;
  cursor: pointer;
}

.suggestion:hover {
  background: #333;
}
`,
    },

    /* =========================
       RENDERER LOGIC (AUTOCOMPLETE)
       ========================= */
    {
      op: "edit",
      path: "overlay/renderer.mjs",
      find: /[\s\S]*/,
      replace: `
import champions from "../data/champions.json" assert { type: "json" };

const champInput = document.getElementById("champ");
const enemyInput = document.getElementById("enemy");
const suggestions = document.getElementById("suggestions");

function autocomplete(input) {
  suggestions.innerHTML = "";
  if (!input.value) return;

  const q = input.value.toLowerCase();
  champions
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 5)
    .forEach(c => {
      const div = document.createElement("div");
      div.className = "suggestion";
      div.textContent = c.name;
      div.onclick = () => {
        input.value = c.name;
        suggestions.innerHTML = "";
      };
      suggestions.appendChild(div);
    });
}

champInput.oninput = () => autocomplete(champInput);
enemyInput.oninput = () => autocomplete(enemyInput);

document.getElementById("lock").onclick = () => {
  window.api.lockMatchup({
    champion: champInput.value,
    enemy: enemyInput.value
  });
};
`,
    },

    /* =========================
       PRELOAD IPC BRIDGE
       ========================= */
    {
      op: "edit",
      path: "overlay/preload.mjs",
      find: /[\s\S]*/,
      replace: `
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  lockMatchup: (data) => ipcRenderer.send("lock-matchup", data)
});
`,
    },

    /* =========================
       MATCHUP IPC HANDLER
       ========================= */
    {
      op: "insert_after",
      path: "overlay/main.mjs",
      anchor: /app\.whenReady/,
      content: `
import { ipcMain } from "electron";

ipcMain.on("lock-matchup", (_, data) => {
  globalThis.__LIVE_STATE__.champion = data.champion;
  globalThis.__LIVE_STATE__.enemy = data.enemy;
  console.log("MATCHUP LOCKED:", data);
});
`,
    },
  ],
};
