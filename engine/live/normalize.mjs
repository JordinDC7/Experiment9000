export function normalize(raw) {
  if (!raw) return null;

  const player = raw.activePlayer;
  const self = raw.allPlayers.find(
    (p) => p.summonerName === player.summonerName
  );

  return {
    time: raw.gameData.gameTime,

    self: {
      champion: self.championName,
      level: self.level,
      gold: player.currentGold,
      items: self.items.map((i) => i.itemID),
      stats: self.championStats,
      abilities: player.abilities,
      runes: self.runes,
    },

    enemies: raw.allPlayers
      .filter((p) => p.team !== self.team)
      .map((p) => ({
        champion: p.championName,
        level: p.level,
        items: p.items.map((i) => i.itemID),
        stats: p.championStats,
      })),
  };
}
