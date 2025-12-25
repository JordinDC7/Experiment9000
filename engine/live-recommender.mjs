// engine/live-recommender.mjs
/**
 * LIVE RECOMMENDER
 * Polls Riot Live Client Data API (https://127.0.0.1:2999)
 * Produces a stable, renderer-friendly snapshot for the overlay.
 *
 * Adds "MOLD" UI hints:
 * - unspent skill points + next skill (Q/W/E/R)
 * - objective spawn timers (dragon/baron) within 90s
 * - inBase / inShopRange (approx)
 * - target priority micro callout
 */

import https from "https";
import fs from "fs";
import path from "path";

import { lockMatchup } from "./live-state.mjs";
import { pickBuild, guessRoleFromLive } from "./build-loader.mjs";
import { solveGold } from "./gold-solver.mjs";
import { computeTargetPriority } from "./target-priority-engine.mjs";

const LIVE_HOST = "127.0.0.1";
const LIVE_PORT = 2999;

const CHAMPIONS_PATH = path.join(process.cwd(), "data", "champions.json");
const ITEMS_PATH = path.join(process.cwd(), "data", "items.json");

let CHAMPIONS = null;
let ITEMS = null;

function loadJsonOnce(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function ensureDataLoaded() {
  if (!CHAMPIONS) CHAMPIONS = loadJsonOnce(CHAMPIONS_PATH) || { champions: [] };
  if (!ITEMS) ITEMS = loadJsonOnce(ITEMS_PATH) || {};
}

function champMetaByName(name) {
  ensureDataLoaded();
  const n = String(name || "").toLowerCase();
  const list = Array.isArray(CHAMPIONS?.champions) ? CHAMPIONS.champions : [];
  return list.find((c) => String(c?.name || "").toLowerCase() === n) || null;
}

function itemsMetaById(id) {
  ensureDataLoaded();
  const items = ITEMS?.data || {};
  return items?.[String(id)] || null;
}

function httpsJson({ host, port, path, timeoutMs = 900 }) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host,
        port,
        path,
        method: "GET",
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          try {
            const data = JSON.parse(body || "{}");
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data,
            });
          } catch {
            resolve({ ok: false, status: res.statusCode, error: "bad_json" });
          }
        });
      }
    );

    req.on("error", () =>
      resolve({ ok: false, status: 0, error: "net_error" })
    );
    req.on("timeout", () => {
      try {
        req.destroy(new Error("timeout"));
      } catch {}
      resolve({ ok: false, status: 0, error: "timeout" });
    });

    req.end();
  });
}

function safeStr(v, fallback = "") {
  if (v === null || v === undefined) return fallback;
  const s = String(v);
  return s.length ? s : fallback;
}

function num(v, dflt = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function toMMSS(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function parseAbilitiesLevels(raw) {
  const pick = (obj, key) =>
    num(
      obj?.abilities?.[key]?.abilityLevel ??
        obj?.abilities?.[key]?.level ??
        obj?.[key]?.abilityLevel ??
        obj?.[key]?.level ??
        obj?.Abilities?.[key]?.abilityLevel ??
        obj?.Abilities?.[key]?.level ??
        0,
      0
    );

  return {
    Q: Math.max(0, Math.floor(pick(raw, "Q"))),
    W: Math.max(0, Math.floor(pick(raw, "W"))),
    E: Math.max(0, Math.floor(pick(raw, "E"))),
    R: Math.max(0, Math.floor(pick(raw, "R"))),
  };
}

function recommendNextSkill({ level, abil, tags }) {
  const q = abil.Q,
    w = abil.W,
    e = abil.E,
    r = abil.R;

  const spent = q + w + e + r;
  const unspent = Math.max(0, Math.floor(level) - spent);
  if (unspent <= 0) return { unspent: 0, next: null };

  // Ult levels: 6/11/16
  const ultUnlock = level === 6 || level === 11 || level === 16;
  const ultCap = level >= 16 ? 3 : level >= 11 ? 2 : 1;
  if (ultUnlock && r < ultCap) return { unspent, next: "R" };

  const t = Array.isArray(tags) ? tags : [];
  const has = (x) => t.includes(x);

  // Heuristics (placeholder until champion-specific skill orders exist)
  let order = ["Q", "E", "W"];
  if (has("Support")) order = ["W", "E", "Q"];
  else if (has("Tank") || has("Fighter")) order = ["Q", "W", "E"];
  else if (has("Marksman")) order = ["Q", "W", "E"];
  else if (has("Mage") || has("Assassin")) order = ["Q", "E", "W"];

  const levels = { Q: q, W: w, E: e };
  let best = order[0];
  for (const k of order) {
    if ((levels[k] ?? 0) < (levels[best] ?? 0)) best = k;
  }
  return { unspent, next: best };
}

function computeObjectivesUi(gameTimeSec, dataEvents, mem) {
  const t = num(gameTimeSec, 0) ?? 0;
  const list = Array.isArray(dataEvents) ? dataEvents : [];

  for (const ev of list) {
    const et = num(ev?.EventTime ?? ev?.eventTime, null);
    if (!Number.isFinite(et) || et <= (mem.lastEventTime || 0)) continue;

    mem.lastEventTime = Math.max(mem.lastEventTime || 0, et);

    const name = String(ev?.EventName ?? ev?.eventName ?? "");
    if (name.includes("DragonKill") || name.includes("ElderDragonKill"))
      mem.lastDragonKill = et;
    if (name.includes("BaronKill")) mem.lastBaronKill = et;
  }

  const firstDragon = 300;
  const dragonRespawn = 300;

  const firstBaron = 1200;
  const baronRespawn = 360;

  const nextDragon = Number.isFinite(mem.lastDragonKill)
    ? mem.lastDragonKill + dragonRespawn
    : firstDragon;
  const nextBaron = Number.isFinite(mem.lastBaronKill)
    ? mem.lastBaronKill + baronRespawn
    : firstBaron;

  const dragonIn = nextDragon - t;
  const baronIn = nextBaron - t;

  return {
    dragon:
      Number.isFinite(dragonIn) && dragonIn > 0
        ? { in: Math.floor(dragonIn) }
        : null,
    baron:
      Number.isFinite(baronIn) && baronIn > 0
        ? { in: Math.floor(baronIn) }
        : null,
  };
}

export function startLiveRecommender(onUpdate) {
  let stopped = false;

  const objectiveMem = {
    lastEventTime: 0,
    lastDragonKill: NaN,
    lastBaronKill: NaN,
  };

  async function tick() {
    if (stopped) return;

    const res = await httpsJson({
      host: LIVE_HOST,
      port: LIVE_PORT,
      path: "/liveclientdata/allgamedata",
      timeoutMs: 900,
    });

    if (!res.ok || !res.data?.gameData) {
      onUpdate({
        phase: "None",
        lcuOk: true,
        liveOk: false,
        liveError: res.error || `status_${res.status}`,
        live: null,
      });
      return;
    }

    const { data } = res;

    const gameTime = data?.gameData?.gameTime;
    const allPlayers = Array.isArray(data?.allPlayers) ? data.allPlayers : [];

    const self = allPlayers.find((p) => p?.isMe) || null;
    const champName = safeStr(self?.championName, "Unknown");
    const myTeam = self?.team || null;
    const level = num(self?.level, 0) ?? 0;

    // total gold (more stable than currentGold in some phases)
    const gold = num(data?.activePlayer?.currentGold, 0) ?? 0;

    // Abilities → unspent skill points + next skill
    const abilRes = await httpsJson({
      host: LIVE_HOST,
      port: LIVE_PORT,
      path: "/liveclientdata/activeplayerabilities",
      timeoutMs: 800,
    });

    const abilLevels = abilRes.ok
      ? parseAbilitiesLevels(abilRes.data)
      : { Q: 0, W: 0, E: 0, R: 0 };
    const tags = champMetaByName(champName)?.tags || [];

    const skillRec = recommendNextSkill({
      level: Number(level || 0),
      abil: abilLevels,
      tags,
    });

    // Base/shop range (approx via position)
    const pos = self?.position || self?.pos || null;
    const px = num(pos?.x, NaN);
    const py = num(pos?.y, NaN);

    let inBase = false;
    if (Number.isFinite(px) && Number.isFinite(py) && myTeam) {
      const base = String(myTeam).toUpperCase().includes("ORDER")
        ? { x: 500, y: 500 }
        : { x: 14300, y: 14300 };
      const dx = px - base.x;
      const dy = py - base.y;
      inBase = dx * dx + dy * dy < 2600 * 2600;
    }

    // Objective timers (prefer eventdata endpoint)
    const evRes = await httpsJson({
      host: LIVE_HOST,
      port: LIVE_PORT,
      path: "/liveclientdata/eventdata",
      timeoutMs: 800,
    });

    const eventsList = evRes.ok
      ? Array.isArray(evRes.data?.Events)
        ? evRes.data.Events
        : []
      : [];

    const objectives = computeObjectivesUi(
      num(gameTime, 0) || 0,
      eventsList,
      objectiveMem
    );

    // Target priority (micro callout)
    const enemiesForPri = myTeam
      ? allPlayers
          .filter((p) => p.team !== myTeam)
          .map((p) => ({
            championName: safeStr(p?.championName, "—"),
            level: num(p?.level, null),
            tags: champMetaByName(p?.championName)?.tags || [],
          }))
      : [];

    const pri = computeTargetPriority(
      { championName: champName, level: num(level, null), tags },
      enemiesForPri
    );

    /* ----- BUILD + GOLD SOLVER ----- */

    const role = guessRoleFromLive(self, allPlayers) || "DEFAULT";
    const build = pickBuild(champName, role) || pickBuild(champName, "DEFAULT");

    const owned = Array.isArray(self?.items) ? self.items : [];
    const ownedIds = owned
      .map((it) => it?.itemID)
      .filter((x) => Number.isFinite(Number(x)));
    const ownedNames = owned.map((it) => it?.displayName).filter(Boolean);

    const plan = build?.items || [];
    const targetItem =
      plan.find((it) => !ownedIds.includes(it.id)) || plan[0] || null;

    const suggestion = targetItem
      ? solveGold({
          gold,
          ownedIds,
          targetItemId: targetItem.id,
          itemsMetaById,
        })
      : { ok: false, reason: "no_target" };

    if (suggestion?.ok && targetItem?.name) {
      suggestion.targetItem.name = targetItem.name;
    }

    /* ----- TEAM OVERVIEW ----- */
    const allies = myTeam ? allPlayers.filter((p) => p.team === myTeam) : [];
    const enemies = myTeam ? allPlayers.filter((p) => p.team !== myTeam) : [];

    onUpdate({
      phase: "InGame",
      lcuOk: true,
      liveOk: true,
      liveError: null,
      live: {
        time: toMMSS(gameTime),
        self: {
          champion: champName,
          level,
          gold: Math.floor(gold ?? 0),
          items: ownedNames,
          abilities: abilLevels,
          unspentSkillPoints: skillRec.unspent,
        },
        ui: {
          skillPointAvailable: skillRec.unspent > 0,
          nextSkill: skillRec.next,
          unspentSkillPoints: skillRec.unspent,
          inBase,
          inShopRange: inBase,
          recalling: false,
          objectives,
        },
        suggestion,
        fight: pri
          ? {
              focus: pri.primary || null,
              avoid: Array.isArray(pri.avoid) ? pri.avoid : [],
            }
          : null,
        teams: { allies, enemies },
      },
    });
  }

  const interval = setInterval(() => tick().catch(() => {}), 750);
  tick().catch(() => {});

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
