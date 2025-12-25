/**
 * OVERLAY RENDERER (CHAMP SELECT GUARANTEED)
 *
 * - Champ Select UI renders whenever phase === "ChampSelect"
 * - Live UI renders only when liveOk === true
 * - Idle UI otherwise
 * - Defensive against partial / merged state
 */

let state = {};

function byId(id) {
  return document.getElementById(id);
}

function renderChampSelect(cs) {
  const myChamp = cs?.myChampionName ?? "—";
  const locked = cs?.myPickCompleted ? "LOCKED" : "SELECTING";

  const myTeam = cs?.myTeamPicks?.map((p) => p.championName).join(" · ") || "—";

  const enemyTeam =
    cs?.enemyTeamPicks?.map((p) => p.championName).join(" · ") || "—";

  byId("main").innerHTML = `
    <div style="font-weight:900;font-size:15px;margin-bottom:4px;">
      ${myChamp}
    </div>

    <div style="opacity:.7;margin-bottom:8px;">
      ${locked}
    </div>

    <div style="margin-bottom:8px;">
      <div style="opacity:.6;">My Team</div>
      <div style="font-weight:700;">
        ${myTeam}
      </div>
    </div>

    <div>
      <div style="opacity:.6;">Enemy Team</div>
      <div style="font-weight:700;">
        ${enemyTeam}
      </div>
    </div>
  `;
}

function renderLive(live) {
  byId("main").innerHTML = `
    <div style="font-weight:900;font-size:15px;margin-bottom:6px;">
      ${live?.self?.champion ?? "—"}
    </div>

    <div style="opacity:.75;margin-bottom:8px;">
      Level ${live?.self?.level ?? "—"} · ${live?.self?.gold ?? "—"}g
    </div>

    <div>
      <div style="opacity:.6;">Enemies</div>
      <div style="font-weight:700;">
        ${live?.enemies?.join(" · ") || "—"}
      </div>
    </div>
  `;
}

function renderIdle(phase) {
  byId("main").innerHTML = `
    <div style="opacity:.6;">
      ${phase || "Waiting for game data…"}
    </div>
  `;
}

function render() {
  // Phase always visible
  if (byId("phase")) {
    byId("phase").textContent = state.phase ?? "—";
  }

  // 🟢 CHAMP SELECT MODE (highest priority)
  if (state.phase === "ChampSelect" && state.champSelect?.data) {
    renderChampSelect(state.champSelect.data);
    return;
  }

  // 🔵 LIVE MODE
  if (state.liveOk === true && state.live) {
    renderLive(state.live);
    return;
  }

  // ⚪ IDLE MODE
  renderIdle(state.phase);
}

window.electron.onLiveUpdate((payload) => {
  // Merge state instead of replacing
  state = { ...state, ...payload };
  render();
});
