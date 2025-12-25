/**
 * SKILL ORDER ENGINE
 * Determines ability priority based on matchup pressure
 */

export function computeSkillOrder(champ, enemy) {
  if (!champ) return null;

  const base = champ.abilities || [];
  if (!base.length) return null;

  let bias = "DAMAGE";

  if (enemy) {
    if (enemy.stats.attackrange > champ.stats.attackrange) {
      bias = "MOBILITY";
    }
    if ((enemy.tags || []).includes("Assassin")) {
      bias = "SURVIVABILITY";
    }
  }

  const ordered = [...base].sort((a, b) => {
    if (bias === "DAMAGE") return b.damage - a.damage;
    if (bias === "MOBILITY") return b.mobility - a.mobility;
    if (bias === "SURVIVABILITY") return b.utility - a.utility;
    return 0;
  });

  return {
    bias,
    order: ordered.map((a) => a.key),
  };
}
