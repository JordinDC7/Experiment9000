import fs from "fs";
import path from "path";
import process from "process";
import { pathToFileURL } from "url";

const PATCH_DIR = path.resolve("patches");
const FORCE = process.argv.includes("--force");

function normalizePatch(patch, patchPath) {
  // Case 1: { ops: [...] }
  if (patch && Array.isArray(patch.ops)) {
    return patch.ops;
  }

  // Case 2: export default [ ... ]
  if (Array.isArray(patch)) {
    return patch;
  }

  throw new Error(
    `Invalid patch format in ${patchPath}\n` +
      `Expected:\n` +
      `  export default { ops: [...] }\n` +
      `OR\n` +
      `  export default [ ... ]`
  );
}

async function applyPatch(patchPath) {
  const mod = await import(pathToFileURL(patchPath).href);
  const ops = normalizePatch(mod.default, patchPath);

  for (const op of ops) {
    const filePath = path.resolve(op.path);
    let src = fs.readFileSync(filePath, "utf8");

    if (!FORCE && op.find && !op.find.test(src)) {
      console.log(`✔ Patch already applied → ${op.path}`);
      continue;
    }

    let out = src;

    if (op.op === "edit") {
      out = src.replace(op.find, op.replace);
    } else if (op.op === "insert_after") {
      out = src.replace(op.anchor, (m) => m + "\n" + op.content);
    } else {
      throw new Error(`Unknown op: ${op.op} in ${patchPath}`);
    }

    fs.writeFileSync(filePath, out, "utf8");
    console.log(`✔ Patch applied → ${op.path}`);
  }
}

async function run() {
  const patches = fs
    .readdirSync(PATCH_DIR, { recursive: true })
    .filter((f) => f.endsWith(".patch.mjs"));

  for (const p of patches) {
    await applyPatch(path.join(PATCH_DIR, p));
  }

  console.log("\n=== ALL PATCHES APPLIED SUCCESSFULLY ===");
}

run();
