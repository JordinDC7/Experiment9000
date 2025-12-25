// engine/stats-collector.mjs
// SAFE: Uses Riot Live Client Data API (localhost)
// NO memory reading, NO injection

import fetch from "node-fetch";

const LIVE_API = "http://127.0.0.1:2999/liveclientdata/allgamedata";
const POLL_INTERVAL_MS = 3000;

/**
 * Normalize enemy team stats into a compact signal
 */
function aggregateEnemyStats(players) {
  let armor = 0;
  let mr = 0;
  let hp = 0;
  let healingSources = 0;
  let tanks = 0;

  for (const p of players) {
    armor += p.armor;
    mr += p.magicResist;
    hp += p.maxHealth;

    if (
      p.items.some((i) =>
        [
          "ImmortalShieldbow",
          "Goredrinker",
          "Riftmaker",
          "DivineSunderer",
        ].includes(i.displayName)
      )
    ) {
      healingSources++;
    }

    if (p.maxHealth > 3000 || p.armor > 150) {
      tanks++;
    }
  }

  const count = players.length || 1;

  return {
    avgArmor: Math.round(armor / count),
    avgMR: Math.round(mr / count),
    avgHP: Math.round(hp / count),
    healingHeavy: healingSources >= 2,
    tankCount: tanks,
  };
}

/**
 * Fetch and compute enemy stats
 */
export async function getEnemyStats() {
  try {
    const res = await fetch(LIVE_API, { timeout: 1500 });
    if (!res.ok) return null;

    const data = await res.json();

    const myTeam = data.activePlayer.team;
    const enemies = data.allPlayers.filter((p) => p.team !== myTeam);

    return aggregateEnemyStats(enemies);
  } catch {
    return null;
  }
}

/**
 * Continuous polling loop (used by overlay)
 */
export async function startStatsFeed(onUpdate) {
  console.log("📡 Enemy stats collector running...");

  setInterval(async () => {
    const stats = await getEnemyStats();
    if (stats) onUpdate(stats);
  }, POLL_INTERVAL_MS);
}
