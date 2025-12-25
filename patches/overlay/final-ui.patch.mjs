export default {
  ops: [
    // ============================
    // overlay/main.mjs
    // ============================
    {
      op: "edit",
      path: "overlay/main.mjs",
      replace: `
import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 260,
    height: 160,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));

  globalShortcut.register("Insert", () => {
    if (win.isVisible()) win.hide();
    else win.show();
  });
}

app.whenReady().then(createWindow);

ipcMain.on("lock-matchup", (_, data) => {
  globalThis.__LIVE_STATE__ = globalThis.__LIVE_STATE__ || {};
  globalThis.__LIVE_STATE__.champion = data.champion;
  globalThis.__LIVE_STATE__.enemy = data.enemy;
  console.log("MATCHUP LOCKED:", data);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
`,
    },

    // ============================
    // overlay/index.html
    // ============================
    {
      op: "edit",
      path: "overlay/index.html",
      replace: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Live Build</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <div id="app">
    <div id="header">LIVE BUILD</div>

    <input id="champion" placeholder="Your champ…" autocomplete="off" />
    <input id="enemy" placeholder="Enemy champ…" autocomplete="off" />

    <div id="suggestions"></div>

    <button id="lock">LOCK MATCHUP</button>

    <div id="output"></div>
  </div>

  <script type="module" src="./renderer.mjs"></script>
</body>
</html>
`,
    },

    // ============================
    // overlay/style.css
    // ============================
    {
      op: "edit",
      path: "overlay/style.css",
      replace: `
body {
  margin: 0;
  background: transparent;
  font-family: Arial, sans-serif;
  color: white;
}

#app {
  background: rgba(15, 15, 15, 0.92);
  border-radius: 8px;
  padding: 8px;
  width: 240px;
  user-select: none;
}

#header {
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 6px;
  cursor: move;
}

input {
  width: 100%;
  margin-bottom: 4px;
  padding: 4px;
  font-size: 11px;
}

button {
  width: 100%;
  padding: 4px;
  font-size: 11px;
  background: #2b6cff;
  border: none;
  color: white;
  cursor: pointer;
}

#suggestions {
  font-size: 10px;
}

.suggestion {
  cursor: pointer;
  padding: 2px;
}
.suggestion:hover {
  background: #333;
}

#output {
  margin-top: 6px;
  font-size: 11px;
}
`,
    },

    // ============================
    // overlay/renderer.mjs
    // ============================
    {
      op: "edit",
      path: "overlay/renderer.mjs",
      replace: `
const { ipcRenderer } = window.electron;

let champs = [];

fetch("../data/champions.json")
  .then(r => r.json())
  .then(d => champs = d.map(c => c.name));

const champInput = document.getElementById("champion");
const enemyInput = document.getElementById("enemy");
const suggestions = document.getElementById("suggestions");

function showSuggestions(value, target) {
  suggestions.innerHTML = "";
  if (!value) return;

  champs
    .filter(c => c.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 6)
    .forEach(name => {
      const div = document.createElement("div");
      div.textContent = name;
      div.className = "suggestion";
      div.onclick = () => {
        target.value = name;
        suggestions.innerHTML = "";
      };
      suggestions.appendChild(div);
    });
}

champInput.oninput = e => showSuggestions(e.target.value, champInput);
enemyInput.oninput = e => showSuggestions(e.target.value, enemyInput);

document.getElementById("lock").onclick = () => {
  ipcRenderer.send("lock-matchup", {
    champion: champInput.value,
    enemy: enemyInput.value
  });

  document.getElementById("output").textContent = "MATCHUP LOCKED";
};
`,
    },
  ],
};
