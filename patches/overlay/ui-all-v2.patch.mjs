export default {
  ops: [
    // =========================
    // index.html
    // =========================
    {
      op: "edit",
      path: "overlay/index.html",
      content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Live Build</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="titlebar">Live Build</div>

  <div class="field">
    <input id="selfInput" placeholder="Your champion" autocomplete="off" />
    <div id="selfList" class="list"></div>
  </div>

  <div class="field">
    <input id="enemyInput" placeholder="Enemy champion" autocomplete="off" />
    <div id="enemyList" class="list"></div>
  </div>

  <div id="status">Waiting for matchup…</div>

  <script type="module" src="renderer.mjs"></script>
</body>
</html>
      `,
    },

    // =========================
    // style.css
    // =========================
    {
      op: "edit",
      path: "overlay/style.css",
      content: `
body {
  margin: 0;
  background: rgba(18, 18, 18, 0.92);
  color: #fff;
  font-family: system-ui;
  font-size: 12px;
}

#titlebar {
  -webkit-app-region: drag;
  padding: 6px;
  text-align: center;
  font-weight: bold;
  background: rgba(0, 0, 0, 0.4);
}

.field {
  position: relative;
  padding: 6px;
}

input {
  width: 100%;
  padding: 6px;
  border-radius: 4px;
  border: none;
  outline: none;
  background: #222;
  color: #fff;
}

.list {
  position: absolute;
  top: 32px;
  left: 6px;
  right: 6px;
  background: #111;
  border: 1px solid #333;
  max-height: 120px;
  overflow-y: auto;
  display: none;
  z-index: 10;
}

.list div {
  padding: 6px;
  cursor: pointer;
}

.list div:hover {
  background: #333;
}

#status {
  padding: 6px;
  text-align: center;
  opacity: 0.8;
}
      `,
    },

    // =========================
    // renderer.mjs
    // =========================
    {
      op: "edit",
      path: "overlay/renderer.mjs",
      content: `
import champions from "../data/champions.json" assert { type: "json" };

const champNames = champions.map(c => c.name).sort();

function setupAutocomplete(input, list, onSelect) {
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    list.innerHTML = "";
    if (!q) {
      list.style.display = "none";
      return;
    }

    champNames
      .filter(n => n.toLowerCase().includes(q))
      .slice(0, 10)
      .forEach(name => {
        const div = document.createElement("div");
        div.textContent = name;
        div.onclick = () => {
          input.value = name;
          list.style.display = "none";
          onSelect(name);
        };
        list.appendChild(div);
      });

    list.style.display = list.children.length ? "block" : "none";
  });

  document.addEventListener("click", e => {
    if (!list.contains(e.target) && e.target !== input) {
      list.style.display = "none";
    }
  });
}

let selfChamp = null;
let enemyChamp = null;

const status = document.getElementById("status");

setupAutocomplete(
  document.getElementById("selfInput"),
  document.getElementById("selfList"),
  champ => {
    selfChamp = champ;
    updateStatus();
  }
);

setupAutocomplete(
  document.getElementById("enemyInput"),
  document.getElementById("enemyList"),
  champ => {
    enemyChamp = champ;
    updateStatus();
  }
);

function updateStatus() {
  if (selfChamp && enemyChamp) {
    status.textContent = \`\${selfChamp} vs \${enemyChamp} — Live analysis\`;
  } else {
    status.textContent = "Waiting for matchup…";
  }
}
      `,
    },
  ],
};
