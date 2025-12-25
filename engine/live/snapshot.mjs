/**
 * Normalize live Riot data into a stable snapshot
 * This is the SINGLE source of truth for live state
 */
export function snapshot(liveState) {
  if (!liveState?.self) {
    throw new Error("Invalid liveState: missing self");
  }

  return {
    self: {
      gold: Number(liveState.self.gold ?? 0),
      items: Array.isArray(liveState.self.items) ? liveState.self.items : [],
      level: Number(liveState.self.level ?? 1),
      champion: liveState.self.champion ?? null,
    },
    enemies: Array.isArray(liveState.enemies)
      ? liveState.enemies.map((e) => ({
          champion: e.champion,
          level: e.level,
          items: e.items ?? [],
          stats: e.stats ?? {},
        }))
      : [],
  };
}
