/**
 * RUNE MATCHUP ENGINE
 * Picks keystone + stat shards based on matchup
 */

export function computeRunes(champ, enemy) {
  if (!champ) return null;

  let keystone = "Press the Attack";
  let reason = "Default DPS scaling";

  if (enemy) {
    if ((enemy.tags || []).includes("Tank")) {
      keystone = "Lethal Tempo";
      reason = "Extended fights vs tank";
    }

    if ((enemy.tags || []).includes("Assassin")) {
      keystone = "Fleet Footwork";
      reason = "Survivability vs burst";
    }
  }

  return {
    keystone,
    shards: ["Attack Speed", "Adaptive Force", "Armor"],
    reason,
  };
}
