/**
 * SESSION CONTEXT (in-memory)
 * Shared between champ-select watcher and live recommender.
 *
 * Keeps small, non-sensitive state that helps the overlay feel "continuous"
 * between phases without requiring the user to re-enter anything.
 */

const CTX = {
  // Best-effort role for the local player (from champ select, if available)
  myRole: null, // "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT" | null
  myCellId: null,
  myChampionId: null,
  lastChampSelectAt: 0,

  // Optional user-locked matchup via overlay UI
  locked: {
    champion: null, // champion name OR id (string/number)
    enemy: null, // champion name OR id (string/number)
    role: null, // role hint
    updatedAt: 0,
  },
};

function normRole(r) {
  const s = String(r || "").trim();
  if (!s) return null;
  const u = s.toUpperCase();
  // LCU can emit "BOTTOM" or "UTILITY" sometimes; map to our canonical labels.
  if (u === "BOTTOM") return "ADC";
  if (u === "UTILITY") return "SUPPORT";
  if (["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].includes(u)) return u;
  return u;
}

export function setChampSelectContext({ myRole, myCellId, myChampionId } = {}) {
  const role = normRole(myRole);
  if (role) CTX.myRole = role;
  if (Number.isFinite(Number(myCellId))) CTX.myCellId = Number(myCellId);
  if (Number.isFinite(Number(myChampionId)))
    CTX.myChampionId = Number(myChampionId);
  CTX.lastChampSelectAt = Date.now();
}

export function setLockedMatchup({ champion, enemy, role } = {}) {
  if (champion !== undefined) CTX.locked.champion = champion;
  if (enemy !== undefined) CTX.locked.enemy = enemy;
  const r = normRole(role);
  if (r) CTX.locked.role = r;
  CTX.locked.updatedAt = Date.now();
}

export function getSessionContext() {
  return {
    myRole: CTX.myRole,
    myCellId: CTX.myCellId,
    myChampionId: CTX.myChampionId,
    lastChampSelectAt: CTX.lastChampSelectAt,
    locked: { ...CTX.locked },
  };
}
