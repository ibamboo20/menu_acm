"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

let db = { version: 0, state: { menus: [], ingredients: [] } };
try {
  const loaded = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (loaded && typeof loaded.version === "number" && loaded.state) db = loaded;
} catch (e) { /* no data file yet -> start fresh */ }

function persist() {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DATA_FILE);
}

app.use(express.json({ limit: "5mb" }));

app.get("/api/state", (req, res) => {
  res.json(db);
});

// Optimistic concurrency: client sends the version it based its edit on.
// A stale version gets 409 + current data so the client can refresh.
app.put("/api/state", (req, res) => {
  const { version, state } = req.body || {};
  if (typeof version !== "number" || !state ||
      !Array.isArray(state.menus) || !Array.isArray(state.ingredients)) {
    return res.status(400).json({ error: "invalid body" });
  }
  if (version !== db.version) return res.status(409).json(db);
  db = { version: db.version + 1, state };
  persist();
  res.json({ version: db.version });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Menu Ingredients server listening on port ${PORT}, data at ${DATA_FILE}`);
});
