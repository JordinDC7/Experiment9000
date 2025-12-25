/**
 * LCU CLIENT (reliable)
 * Uses https.request (NOT fetch) so TLS + auth works consistently in Electron/Node.
 *
 * Env override:
 *   LOL_LOCKFILE_PATH=C:\Riot Games\League of Legends\lockfile
 */

import fs from "fs";
import https from "https";

function candidateLockfilePaths() {
  const out = [];
  if (process.env.LOL_LOCKFILE_PATH) out.push(process.env.LOL_LOCKFILE_PATH);

  out.push("C:\\Riot Games\\League of Legends\\lockfile");
  out.push("C:\\Program Files\\Riot Games\\League of Legends\\lockfile");
  out.push("C:\\Program Files (x86)\\Riot Games\\League of Legends\\lockfile");

  out.push("C:\\Riot Games\\League of Legends\\Game\\lockfile");
  out.push("C:\\Program Files\\Riot Games\\League of Legends\\Game\\lockfile");
  out.push(
    "C:\\Program Files (x86)\\Riot Games\\League of Legends\\Game\\lockfile"
  );

  return out;
}

export function readLockfile() {
  for (const p of candidateLockfilePaths()) {
    try {
      if (!fs.existsSync(p)) continue;

      const raw = fs.readFileSync(p, "utf8").trim();
      // name:pid:port:password:protocol
      const parts = raw.split(":");
      if (parts.length < 5) continue;

      const port = parts[2];
      const password = parts[3];
      const protocol = parts[4]; // usually "https"

      if (!port || !password) continue;

      return { port: Number(port), password, protocol, path: p };
    } catch {
      // keep scanning
    }
  }
  return null;
}

function basicAuth(password) {
  const token = Buffer.from(`riot:${password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function httpsJson({ port, path, password }) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        method: "GET",
        host: "127.0.0.1",
        port,
        path,
        rejectUnauthorized: false,
        headers: {
          Authorization: basicAuth(password),
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const status = res.statusCode ?? 0;

          if (status < 200 || status >= 300) {
            resolve({
              ok: false,
              reason: "HTTP_NOT_OK",
              status,
              body: body?.slice(0, 500),
            });
            return;
          }

          try {
            const json = body ? JSON.parse(body) : null;
            resolve({ ok: true, data: json });
          } catch (err) {
            resolve({
              ok: false,
              reason: "JSON_PARSE_ERROR",
              status,
              error: String(err),
              body: body?.slice(0, 500),
            });
          }
        });
      }
    );

    req.on("error", (err) => {
      resolve({ ok: false, reason: "REQUEST_ERROR", error: String(err) });
    });

    req.end();
  });
}

/**
 * lcuGet(route) -> { ok:true, data, lockPath } OR { ok:false, reason, ... }
 */
export async function lcuGet(route) {
  const lock = readLockfile();
  if (!lock) {
    return { ok: false, reason: "LOCKFILE_NOT_FOUND" };
  }

  const res = await httpsJson({
    port: lock.port,
    path: route,
    password: lock.password,
  });
  if (!res.ok) {
    return { ...res, lockPath: lock.path, port: lock.port, route };
  }

  return {
    ok: true,
    data: res.data,
    lockPath: lock.path,
    port: lock.port,
    route,
  };
}
