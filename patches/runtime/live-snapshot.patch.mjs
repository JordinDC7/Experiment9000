export default {
  ops: [
    {
      op: "insert_after",
      path: "engine/live/live-state.mjs",
      anchor: /export\s+const\s+LIVE_STATE/,
      content: `
/**
 * Poll Riot Live Client API
 */
export async function fetchLiveSnapshot() {
  try {
    const res = await fetch("https://127.0.0.1:2999/liveclientdata/allgamedata", {
      agent: new (await import("https")).Agent({ rejectUnauthorized: false })
    });
    const data = await res.json();

    const self = data.activePlayer;
    const players = data.allPlayers;

    const enemies = players
      .filter(p => p.team !== self.team)
      .map(p => p.championName);

    return {
      gameTime: data.gameData.gameTime,
      self: {
        champion: self.championName,
        level: self.level,
        gold: self.currentGold,
        items: self.items.map(i => ({
          itemID: i.itemID,
          count: i.count
        }))
      },
      enemies
    };
  } catch {
    return null;
  }
}
`,
    },

    {
      op: "edit",
      path: "engine/live/live-state.mjs",
      find: /setInterval\([\s\S]*?\);/,
      replace: `
setInterval(async () => {
  const snap = await fetchLiveSnapshot();
  if (snap) Object.assign(LIVE_STATE, snap);
}, 500);
`,
    },
  ],
};
