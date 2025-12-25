/**
 * CHAMP SELECT WATCHER (stable, no flicker)
 *
 * Emits updates shaped for overlay/main.mjs:
 *   { phase, lcuOk, champSelect }
 *
 * champSelect payload is structured for overlay/index.html:
 *   champSelect = {
 *     ok: true,
 *     data: {
 *       localCellId,
 *       myTeamPicks: [...],
 *       enemyTeamPicks: [...],
 *       bans,
 *       timer,
 *       actions
 *     }
 *   }
 *
 * Notes:
 * - We latch ChampSelect for a short grace window to avoid phase flapping.
 * - We also latch the last good session payload briefly to avoid UI clearing.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { lcuGet } from "../lcu/lcu-client.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");

const CHAMPS_PATH = path.join(ROOT, "data", "champions.json");

const POLL_MS = 650;
const PHASE_GRACE_MS = 2200;
const SESSION_GRACE_MS = 2200;

let CHAMP_BY_ID = null;

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function loadChamps() {
  if (CHAMP_BY_ID) return CHAMP_BY_ID;
  const raw = JSON.parse(fs.readFileSync(CHAMPS_PATH, "utf8"));
  const champs = Array.isArray(raw?.champions) ? raw.champions : [];
  CHAMP_BY_ID = new Map();
  for (const c of champs) {
    const id = num(c?.id, 0);
    if (id > 0) CHAMP_BY_ID.set(id, c);
  }
  return CHAMP_BY_ID;
}

function champMetaById(championId) {
  const id = num(championId, 0);
  if (!id) return null;
  const m = loadChamps().get(id) || null;
  if (!m) return null;
  return {
    id: m.id ?? null,
    key: m.key ?? null,
    name: m.name ?? null,
    tags: Array.isArray(m.tags) ? m.tags : [],
    stats: m.stats || null,
  };
}

function normalizeRole(p) {
  const pos = safeStr(p?.assignedPosition ?? p?.lane ?? p?.role ?? "");
  if (!pos) return "";
  return pos.toUpperCase();
}

function normalizePick(p) {
  const championId = num(p?.championId, 0);
  const meta = champMetaById(championId);
  return {
    cellId: num(p?.cellId, -1),
    championId,
    summonerName:
      safeStr(p?.summonerName ?? p?.name ?? p?.summonerInternalName ?? "—") ||
      "—",
    role: normalizeRole(p),
    meta,
  };
}

function sessionToData(session) {
  const localCellId = num(
    session?.localPlayerCellId ?? session?.localCellId,
    -1
  );

  const myTeam = Array.isArray(session?.myTeam) ? session.myTeam : [];
  const theirTeam = Array.isArray(session?.theirTeam) ? session.theirTeam : [];

  const bans = session?.bans
    ? {
        myTeam: Array.isArray(session.bans.myTeamBans)
          ? session.bans.myTeamBans
          : [],
        enemyTeam: Array.isArray(session.bans.theirTeamBans)
          ? session.bans.theirTeamBans
          : [],
      }
    : null;

  return {
    localCellId,
    myTeamPicks: myTeam.map(normalizePick),
    enemyTeamPicks: theirTeam.map(normalizePick),
    bans,
    timer: session?.timer ?? null,
    actions: session?.actions ?? null,
  };
}

function stablePhaseFromRaw(rawPhase, lcuOk, lastStable, lastStableAt) {
  const t = Date.now();

  if (!lcuOk) return { phase: "None", at: t };

  if (rawPhase === "ChampSelect") return { phase: "ChampSelect", at: t };
  if (rawPhase === "InProgress") return { phase: "InProgress", at: t };

  // ignore transient phases briefly to prevent UI flapping
  if (lastStable === "ChampSelect" && t - lastStableAt <= PHASE_GRACE_MS) {
    return { phase: "ChampSelect", at: lastStableAt };
  }
  if (lastStable === "InProgress" && t - lastStableAt <= PHASE_GRACE_MS) {
    return { phase: "InProgress", at: lastStableAt };
  }

  return { phase: "None", at: t };
}

export function startChampSelectWatcher(onUpdate) {
  let stopped = false;

  let lastStablePhase = "None";
  let lastStableAt = 0;

  let lastGoodSession = null;
  let lastGoodSessionAt = 0;

  let lastSig = "";

  async function tick() {
    if (stopped) return;

    const phaseRes = await lcuGet("/lol-gameflow/v1/gameflow-phase");
    const lcuOk = Boolean(phaseRes.ok);
    const rawPhase = phaseRes.ok ? String(phaseRes.data) : "Unknown";

    const sp = stablePhaseFromRaw(
      rawPhase,
      lcuOk,
      lastStablePhase,
      lastStableAt
    );
    lastStablePhase = sp.phase;
    lastStableAt = sp.at;

    let champSelect = null;

    if (lastStablePhase === "ChampSelect" && lcuOk) {
      const sessRes = await lcuGet("/lol-champ-select/v1/session");

      if (sessRes.ok && sessRes.data) {
        champSelect = { ok: true, data: sessionToData(sessRes.data) };
        lastGoodSession = champSelect;
        lastGoodSessionAt = Date.now();
      } else {
        // latch last good session briefly to avoid UI clearing
        if (
          lastGoodSession &&
          Date.now() - lastGoodSessionAt <= SESSION_GRACE_MS
        ) {
          champSelect = lastGoodSession;
        } else {
          champSelect = { ok: false, error: "session_unavailable" };
        }
      }
    } else {
      champSelect = null;
      lastGoodSession = null;
      lastGoodSessionAt = 0;
    }

    const payload = {
      lcuOk,
      phase: lastStablePhase,
      champSelect,
    };

    // only emit on meaningful change to reduce renderer thrash
    const sig = JSON.stringify(payload);
    if (sig !== lastSig) {
      lastSig = sig;
      onUpdate(payload);
    }

    setTimeout(tick, POLL_MS);
  }

  tick();

  return () => {
    stopped = true;
  };
}
