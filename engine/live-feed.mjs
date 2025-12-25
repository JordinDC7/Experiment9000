/**
 * Riot Live Client Data Ingestor
 *
 * Polls the local Live Client API and emits a normalized game snapshot.
 *
 * SAFE:
 * - No OCR
 * - No memory reading
 * - Local-only HTTP
 *
 * Source:
 *   http://127.0.0.1:2999/liveclientdata/allgamedata
 */

import process from "node:process";

const LIVE_ENDPOINT = "http://127.0.0.1:2999/liveclientdata/allgamedata";
const POLL_MS = Number(process.env.LIVE_POLL_MS || 1000);

/**
 * Fetch live game data from Riot client
 */
async function fetchLiveGame() {
  try {
    const res = await fetch(LIVE_ENDPOINT, { timeout: 800 });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Extract player + enemy data into a clean snapshot
 */
function normalizeGame(raw) {
  if (!raw || !raw.activePlayer) return null;

  const me = raw.activePlayer;
  const allPlayers = raw.allPlayers || [];

  const myChampion = me.championName;
  const myTeam = allPlayers.find(
    (p) => p.summonerName === me.summonerName
  )?.team;

  const enemies = allPlayers
    .filter((p) => p.team !== myTeam)
    .map((p) => ({
      champion: p.championName,
      level: p.level,
      items: p.items?.map((i) => String(i.itemID)) ?? [],
      stats: {
        attackDamage: p.championStats.attackDamage,
        abilityPower: p.championStats.abilityPower,
        armor: p.championStats.armor,
        magicResist: p.championStats.magicResist,
        attackSpeed: p.championStats.attackSpeed,
      },
    }));

  return {
    timestamp: Date.now(),
    gameTime: raw.gameData?.gameTime ?? 0,

    champion: myChampion,
    level: me.level,
    gold: Math.floor(me.currentGold ?? 0),

    inventory: me.items?.map((i) => String(i.itemID)) ?? [],

    stats: {
      attackDamage: me.championStats.attackDamage,
      abilityPower: me.championStats.abilityPower,
      armor: me.championStats.armor,
      magicResist: me.championStats.magicResist,
      attackSpeed: me.championStats.attackSpeed,
      moveSpeed: me.championStats.moveSpeed,
      health: me.championStats.currentHealth,
      maxHealth: me.championStats.maxHealth,
    },

    enemies,
  };
}

/**
 * Start polling loop
 */
export async function startLiveFeed(onUpdate) {
  console.log("=== LIVE FEED START ===");

  let lastSnapshot = null;

  setInterval(async () => {
    const raw = await fetchLiveGame();
    if (!raw) return;

    const snapshot = normalizeGame(raw);
    if (!snapshot) return;

    lastSnapshot = snapshot;
    onUpdate(snapshot);
  }, POLL_MS);

  return () => lastSnapshot;
}

/**
 * CLI TEST MODE
 *   node engine/live-feed.mjs
 */
if (process.argv[1]?.includes("live-feed.mjs")) {
  startLiveFeed((snapshot) => {
    console.clear();
    console.log("LIVE SNAPSHOT");
    console.log(JSON.stringify(snapshot, null, 2));
  });
}
