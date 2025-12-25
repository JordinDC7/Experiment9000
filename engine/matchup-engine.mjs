/**
 * MATCHUP ENGINE
 * Deterministic lane advantage model
 *
 * This is intentionally simple and explainable.
 * Later, weights can be learned and personalized.
 */

export function computeMatchupDelta(a, b) {
  if (!a || !b) return null;

  const score = {
    range: 0,
    burst: 0,
    sustain: 0,
    mobility: 0,
    scaling: 0,
  };

  /* -------- RANGE -------- */
  if (a.stats.attackrange && b.stats.attackrange) {
    score.range = clamp(
      (a.stats.attackrange - b.stats.attackrange) / 100,
      -2,
      2
    );
  }

  /* -------- EARLY DAMAGE (BURST) -------- */
  score.burst = clamp(
    (a.stats.attackdamage - b.stats.attackdamage) / 15,
    -2,
    2
  );

  /* -------- SUSTAIN -------- */
  score.sustain = clamp(
    ((a.stats.hpregen || 0) - (b.stats.hpregen || 0)) / 2,
    -2,
    2
  );

  /* -------- MOBILITY -------- */
  score.mobility = clamp(
    ((a.stats.movespeed || 0) - (b.stats.movespeed || 0)) / 20,
    -2,
    2
  );

  /* -------- SCALING (LATE GAME BIAS) -------- */
  const aScaling = (a.tags || []).includes("Marksman") ? 1 : 0;
  const bScaling = (b.tags || []).includes("Marksman") ? 1 : 0;
  score.scaling = aScaling - bScaling;

  const total =
    score.range + score.burst + score.sustain + score.mobility + score.scaling;

  return {
    score,
    total,
    verdict: total > 1.5 ? "Favored" : total < -1.5 ? "Unfavored" : "Even",
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
