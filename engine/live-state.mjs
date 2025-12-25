/**
 * LIVE STATE (minimal)
 *
 * Used mainly for IPC from the overlay to "lock" matchup/role hints.
 * Live polling is handled by engine/live-recommender.mjs.
 */

import { setLockedMatchup } from "./session-context.mjs";

export const LIVE_STATE = {
  lockedMatchup: {
    champion: null,
    enemy: null,
    role: null,
  },
};

/**
 * Lock matchup once (champ select)
 * Accepts champion/enemy as champion names or ids.
 */
export function lockMatchup({ champion, enemy, role } = {}) {
  LIVE_STATE.lockedMatchup.champion =
    champion ?? LIVE_STATE.lockedMatchup.champion;
  LIVE_STATE.lockedMatchup.enemy = enemy ?? LIVE_STATE.lockedMatchup.enemy;
  LIVE_STATE.lockedMatchup.role = role ?? LIVE_STATE.lockedMatchup.role;

  setLockedMatchup({ champion, enemy, role });
}
