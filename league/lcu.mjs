import https from "https";
import fs from "fs";
import path from "path";

/**
 * Reads Riot lockfile to access LCU
 */
function getLockfile() {
  const lockfilePath = path.join(
    process.env.LOCALAPPDATA,
    "Riot Games",
    "League of Legends",
    "lockfile"
  );

  if (!fs.existsSync(lockfilePath)) return null;

  const [name, pid, port, password, protocol] = fs
    .readFileSync(lockfilePath, "utf8")
    .trim()
    .split(":");

  return { port, password, protocol };
}

/**
 * Returns your championId during champ select
 */
export async function getMyChampionId() {
  const lock = getLockfile();
  if (!lock) return null;

  const auth = Buffer.from(`riot:${lock.password}`).toString("base64");

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "127.0.0.1",
        port: lock.port,
        path: "/lol-champ-select/v1/session",
        method: "GET",
        rejectUnauthorized: false,
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            const me = json.myTeam.find(
              (p) => p.cellId === json.localPlayerCellId
            );
            resolve(me?.championId ?? null);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on("error", () => resolve(null));
    req.end();
  });
}
