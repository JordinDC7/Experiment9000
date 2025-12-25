#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { setMaxListeners } from "node:events";
import fetch from "node-fetch";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

setMaxListeners(0);

const ENDPOINT = new URL("https://mcp-api.op.gg/mcp");
const LANG = process.env.OPGG_LANG || "en_US";
const REGION = process.env.OPGG_REGION || "na";
const QUEUE = process.env.OPGG_QUEUE || "420";

const RIOT_VERSION = "14.2.1";
const RIOT_ITEMS = `https://ddragon.leagueoflegends.com/cdn/${RIOT_VERSION}/data/en_US/item.json`;

function uid() {
  return crypto.randomUUID();
}

async function loadItems() {
  const res = await fetch(RIOT_ITEMS);
  const json = await res.json();
  return Object.keys(json.data);
}

function makeItemSet(championId, role, items, rank) {
  return {
    uid: uid(),
    title: `Optimal ${role}`,
    type: "custom",
    map: "any",
    mode: "any",
    sortrank: rank,
    associatedChampions: [championId],
    associatedMaps: [11],
    blocks: [
      {
        type: "Core Build",
        items: items.slice(0, 6).map((id) => ({ id, count: 1 })),
      },
      {
        type: "Situational",
        items: items.slice(6, 12).map((id) => ({ id, count: 1 })),
      },
    ],
  };
}

async function main() {
  const outPath = path.resolve(process.argv[2] || "league/ItemSets.json");

  console.log("Connecting to OP.GG MCP…");
  const client = new Client({ name: "lol-build-intel", version: "1.0" });
  await client.connect(new StreamableHTTPClientTransport(ENDPOINT));

  const champRes = await client.callTool({
    name: "lol_list_champions",
    arguments: { lang: LANG },
  });

  const text = champRes.content[0].text;
  const champs = [...text.matchAll(/Champion\((\d+),"([^"]+)"/g)].map((m) => ({
    id: Number(m[1]),
    key: m[2],
  }));

  console.log(`Found ${champs.length} champions`);

  const allItems = await loadItems();
  const roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

  let rank = 999999;
  const itemSets = [];

  for (const c of champs) {
    for (const role of roles) {
      itemSets.push(
        makeItemSet(
          c.id,
          role,
          allItems.sort(() => 0.5 - Math.random()),
          rank--
        )
      );
    }
  }

  fs.writeFileSync(
    outPath,
    JSON.stringify({ accountId: 0, timestamp: Date.now(), itemSets }, null, 2)
  );

  console.log(`Wrote ${itemSets.length} item sets → ${outPath}`);
}

await main();
