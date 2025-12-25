/**
 * TARGET PRIORITY ENGINE (v1) — PURE, NO IMPORTS
 *
 * Output: compact "Fight Brain"
 *  - primary focus target (highest value/killable)
 *  - secondary target
 *  - respect list (largest threats)
 *  - avoid list (top threats to not facecheck / must kite)
 *  - short rule + longer rule
 *
 * Inputs (lightweight summaries):
 *  self:   { championName, level, tags[], stats? }
 *  enemies:[ { championName, level, tags[], stats?, kills?, deaths?, assists?, kda? } ]
 */

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function tagset(tags) {
  const s = new Set();
  for (const t of Array.isArray(tags) ? tags : []) {
    if (!t) continue;
    s.add(String(t));
  }
  return s;
}

function classify(tags) {
  if (tags.has("Assassin")) return "ASSASSIN";
  if (tags.has("Marksman")) return "MARKSMAN";
  if (tags.has("Mage")) return "MAGE";
  if (tags.has("Tank")) return "TANK";
  if (tags.has("Fighter")) return "FIGHTER";
  if (tags.has("Support")) return "SUPPORT";
  return "UNKNOWN";
}

function estDurability01(stats, level, tags) {
  // Rough tankiness estimate in 0..1
  const s = stats || {};
  const lvl = clamp(num(level, 1), 1, 18);

  const hp = num(s.hp, 600) + num(s.hpperlevel, 90) * (lvl - 1);
  const armor = num(s.armor, 30) + num(s.armorperlevel, 3.5) * (lvl - 1);
  const mr = num(s.spellblock, 30) + num(s.spellblockperlevel, 1.5) * (lvl - 1);

  const ehp = hp * (1 + armor / 100) * (1 + mr / 120);

  let d = (ehp - 900) / (4200 - 900);
  if (tags?.has("Tank")) d += 0.18;
  if (tags?.has("Support")) d += 0.06;
  return clamp(d, 0, 1);
}

function parseKDA(e) {
  const k = num(e?.kills, NaN);
  const d = num(e?.deaths, NaN);
  const a = num(e?.assists, NaN);
  if (Number.isFinite(k) && Number.isFinite(d) && Number.isFinite(a)) {
    return { kills: k, deaths: d, assists: a };
  }
  const s = typeof e?.kda === "string" ? e.kda : "";
  const m = s.match(/^(\d+)\/(\d+)\/(\d+)/);
  if (!m) return { kills: 0, deaths: 0, assists: 0 };
  return { kills: num(m[1], 0), deaths: num(m[2], 0), assists: num(m[3], 0) };
}

function isCarry(tags) {
  return tags.has("Marksman") || tags.has("Mage") || tags.has("Assassin");
}

function isFrontline(tags) {
  return tags.has("Tank") || tags.has("Fighter");
}

function shortReasons(tags, durability01, fedScore, range) {
  const out = [];
  if (tags.has("Marksman")) out.push("carry DPS");
  else if (tags.has("Mage")) out.push("burst/AP");
  else if (tags.has("Assassin")) out.push("burst threat");
  else if (tags.has("Tank")) out.push("frontline");
  else if (tags.has("Support")) out.push("CC/utility");
  else if (tags.has("Fighter")) out.push("skirmisher");

  if (durability01 < 0.35) out.push("squishy");
  if (durability01 > 0.75) out.push("tanky");

  if (fedScore >= 3) out.push("fed");
  if (fedScore <= -2) out.push("behind");

  if (range >= 475) out.push("long range");

  return out.slice(0, 4);
}

export function computeTargetPriority(self, enemies) {
  if (!self || !Array.isArray(enemies) || enemies.length === 0) return null;

  const selfTags = tagset(self.tags);
  const selfRole = classify(selfTags);
  const selfLvl = num(self.level, 1);

  const scored = enemies
    .filter((e) => e && e.championName)
    .map((e) => {
      const tags = tagset(e.tags);
      const lvl = num(e.level, 1);
      const stats = e.stats || null;

      const { kills, deaths, assists } = parseKDA(e);
      const fed = kills * 1.35 + assists * 0.6 - deaths * 1.15;

      const range = num(stats?.attackrange, 0);
      const durability01 = estDurability01(stats, lvl, tags);
      const carry = isCarry(tags);
      const frontline = isFrontline(tags);

      // priority = who we want to kill first (value + killability)
      let priority = 0;

      if (tags.has("Marksman")) priority += 6.0;
      if (tags.has("Mage")) priority += 4.9;
      if (tags.has("Assassin")) priority += 4.2;
      if (tags.has("Support")) priority += 2.0;
      if (tags.has("Fighter")) priority += 1.2;
      if (tags.has("Tank")) priority -= 2.3;

      priority += (1 - durability01) * 3.0;
      priority -= durability01 * 1.4;

      priority += clamp(fed, -6, 10) * 0.55;

      priority -= (lvl - selfLvl) * 0.25;

      // role-specific adjustments
      if (selfRole === "ASSASSIN") {
        if (tags.has("Tank")) priority -= 2.2;
        if (tags.has("Support")) priority -= 0.5;
        if (range >= 450) priority += 0.5;
      } else if (selfRole === "MARKSMAN" || selfRole === "MAGE") {
        if (tags.has("Assassin")) priority += 1.4;
        if (tags.has("Fighter")) priority += 0.6;
        if (tags.has("Tank")) priority -= 0.7;
      } else if (selfRole === "TANK" || selfRole === "SUPPORT") {
        if (carry) priority += 1.1;
        if (tags.has("Tank")) priority -= 0.9;
      }

      // threat = who is most dangerous in the fight
      let threat = 0;
      if (tags.has("Assassin")) threat += 5.0;
      if (tags.has("Fighter")) threat += 3.2;
      if (tags.has("Mage")) threat += 3.0;
      if (tags.has("Marksman")) threat += 2.6;
      if (tags.has("Tank")) threat += 2.1;
      if (tags.has("Support")) threat += 2.0;

      if (frontline && range < 250) threat += 0.8;

      threat += clamp(fed, -6, 10) * 0.45;
      threat += clamp(lvl - selfLvl, -6, 6) * 0.15;

      const reasons = shortReasons(tags, durability01, fed, range);

      return {
        championName: e.championName,
        tags: Array.from(tags),
        level: lvl,
        kills,
        deaths,
        assists,
        fedScore: fed,
        priorityScore: priority,
        threatScore: threat,
        reasons,
      };
    });

  if (scored.length === 0) return null;

  const byPriority = [...scored].sort(
    (a, b) => b.priorityScore - a.priorityScore
  );
  const primary = byPriority[0] || null;
  const secondary =
    byPriority.find((x) => x.championName !== primary?.championName) || null;

  const byThreat = [...scored].sort((a, b) => b.threatScore - a.threatScore);
  const respect = byThreat.filter((x) => x.threatScore >= 5.0).slice(0, 3);

  const avoid =
    selfRole === "MARKSMAN" || selfRole === "MAGE"
      ? byThreat.filter((x) => x.threatScore >= 6.0).slice(0, 2)
      : byThreat.filter((x) => x.threatScore >= 7.0).slice(0, 2);

  const p = primary?.championName || "the carry";

  let ruleShort = "Play disciplined";
  let rule = `Focus ${p}. Respect engage + burst. Remove damage dealers first.`;

  if (selfRole === "ASSASSIN") {
    ruleShort = "Flank carry";
    rule = `Flank ${p} after key CC is used. Avoid hitting tanks first; wait for a clean angle.`;
  } else if (selfRole === "MARKSMAN") {
    ruleShort = "Kite divers";
    rule = `Kite back; hit the closest safe target. If ${
      avoid[0]?.championName || "divers"
    } can reach you, prioritize spacing + peel.`;
  } else if (selfRole === "MAGE") {
    ruleShort = "Play range";
    rule = `Play your range and burst windows. Don't facecheck; save cooldowns to punish divers and delete ${p} when exposed.`;
  } else if (selfRole === "TANK") {
    ruleShort = "Engage/peel";
    rule = `Start fights on ${p} when it's safe, or peel your carry from divers. Your CC decides the fight.`;
  } else if (selfRole === "SUPPORT") {
    ruleShort = "Peel first";
    rule = `Peel your carry from threats, then help lock ${p}. Vision + CC timing wins fights.`;
  }

  const summary = `Focus: ${primary?.championName || "—"} · Respect: ${
    respect[0]?.championName || "—"
  }`;

  return {
    primary,
    secondary,
    avoid,
    respect,
    ruleShort,
    rule,
    summary,
  };
}
