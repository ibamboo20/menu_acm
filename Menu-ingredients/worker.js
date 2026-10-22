/* Menu Ingredients — Cloudflare Worker.
   Same two endpoints the Express server had, so index.html needs no changes:
     GET  /api/state  -> { version, state }
     PUT  /api/state  -> { version, state }, 409 + current data if stale
   The whole document lives in one D1 row; the version column is what keeps
   two phones editing at once from overwriting each other. */

"use strict";

import PAGE from "./index.html";

const EMPTY = { menus: [], ingredients: [], sauces: [], beverages: [], drinks: [] };

/* Cheap content hash so a reloaded page gets 304 until the app actually changes. */
const ETAG = (() => {
  let h = 0x811c9dc5;
  for (let i = 0; i < PAGE.length; i++) {
    h ^= PAGE.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return `"${PAGE.length.toString(36)}-${h.toString(36)}"`;
})();

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/* Creates the row on a brand-new database so the first visit still works. */
async function readState(db) {
  const row = await db.prepare("SELECT version, state FROM app_state WHERE id = 1").first();
  if (row) return { version: row.version, state: JSON.parse(row.state) };
  await db.prepare("INSERT OR IGNORE INTO app_state (id, version, state) VALUES (1, 0, ?1)")
    .bind(JSON.stringify(EMPTY)).run();
  return { version: 0, state: EMPTY };
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/state") {
      if (request.method === "GET") {
        return json(await readState(env.DB));
      }

      if (request.method === "PUT") {
        let body;
        try { body = await request.json(); } catch { body = null; }
        const { version, state } = body || {};
        if (typeof version !== "number" || !state ||
            !Array.isArray(state.menus) || !Array.isArray(state.ingredients)) {
          return json({ error: "invalid body" }, 400);
        }

        // Lands only if nobody else saved since this client last read.
        const res = await env.DB.prepare(
          "UPDATE app_state SET version = version + 1, state = ?2 WHERE id = 1 AND version = ?1"
        ).bind(version, JSON.stringify(state)).run();

        if (!res.meta.changes) return json(await readState(env.DB), 409);
        return json({ version: version + 1 });
      }

      return json({ error: "method not allowed" }, 405);
    }

    if (pathname === "/" || pathname === "/index.html") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method not allowed" }, 405);
      }
      if (request.headers.get("if-none-match") === ETAG) {
        return new Response(null, { status: 304, headers: { etag: ETAG, "cache-control": "no-cache" } });
      }
      return new Response(request.method === "HEAD" ? null : PAGE, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache",
          etag: ETAG,
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
