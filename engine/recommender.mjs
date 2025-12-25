/**
 * Recommender Engine
 *
 * Responsibilities:
 * - Decide WHAT item we are building (single target)
 * - Enforce "finish-one-item-first" rule
 * - Ask gold-solver what can be bought RIGHT NOW
 * - Return deterministic, actionable output for overlay
 */

import fs from "fs";
import path from "path";
import { solveGold } from "./gold-solver.mjs";

const DATA_DIR = path.resolve("data");
const ITEMS_PATH = path.join(DATA_DIR, "items.json");

/**
 * Load item data once
 */
function loadItems() {
  return JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
}

const ITEMS = loadItems();

/**
 * Hard rule:
 * - Once we start an item, we FINISH it
 */
function chooseTargetItem({ plannedBuild, inventory }) {
  // If already building something, continue it
  for (const itemId of plannedBuild) {
    if (!inventory.includes(itemId)) {
      return itemId;
    }
  }
  // Otherwise start first item
  return plannedBuild[0];
}

/**
 * Main recommender entry
 */
export function recommend({
  championId,
  role,
  plannedBuild, // ordered list of completed items
  inventory, // item IDs owned
  currentGold,
}) {
  if (!plannedBuild?.length) {
    throw new Error("plannedBuild is required");
  }

  const targetItem = chooseTargetItem({ plannedBuild, inventory });

  const goldPlan = solveGold({
    targetItem,
    inventory,
    currentGold,
  });

  return {
    championId,
    role,
    targetItem,
    currentGold,
    inventory,
    decision: {
      buyNow: goldPlan.buyNow,
      goldRemaining: goldPlan.goldRemaining,
      goldToFinish: goldPlan.goldToFinish,
      complete: goldPlan.complete,
    },
  };
}

/**
 * === TEST MODE ===
 * Run: node engine/recommender.mjs
 */
if (process.argv[1].includes("recommender.mjs")) {
  console.log("=== RECOMMENDER TEST ===");

  const result = recommend({
    championId: 129, // Kindred
    role: "JUNGLE",
    plannedBuild: ["6672", "3006", "3031"], // Kraken → Berserkers → IE
    inventory: [],
    currentGold: 1300,
  });

  console.dir(result, { depth: null });
}
