import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs";
import path from "path";
import { rotateLog, writeSnapshot, getPrevSnapshotPath } from "./snapshot.js";

const __dirname = import.meta.dirname;

const app = express();
const hostname = "localhost";
const port = 3001;

app.use(express.static(path.join(__dirname, "../client")));

const LOG_PATH = path.join(__dirname, "absurd-work.log");

// --- rebuild counter on startup ---
let counter = 0n;
const snapshotPath = getPrevSnapshotPath();
if (snapshotPath) {
  const file = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  counter = BigInt(file.counter);
  if (fs.existsSync(LOG_PATH)) {
    const data = fs.readFileSync(LOG_PATH, "utf8");
    const newCount = BigInt(data.split("\n").filter(Boolean).length);
    counter += newCount;
  }
}

// --- append-only click ---
app.post("/click", (req, res) => {
  const line = `${Date.now()} \n`;

  counter += 1n;
  const currentCount = counter;

  fs.appendFile(LOG_PATH, line, (err) => {
    if (err) {
      counter -= 1n; // Rollback on error
      return res.status(500).json({ error: "log write failed" });
    }
    res.json({ counter: currentCount.toString() });
  });
});

// --- read-only counter ---
app.get("/read", (req, res) => {
  res.json({ counter: counter.toString() });
});

// --- SSE client management
const sseClients = new Set();
let lastBroadcastCounter = counter;

function broadcastUpdate(newCounter) {
  const data = `data: ${newCounter.toString()}\n\n`;
  sseClients.forEach((client) => {
    client.write(data);
  });
  lastBroadcastCounter = newCounter;
}

// Broadcast every 3 seconds only if counter changed
setInterval(() => {
  if (counter !== lastBroadcastCounter) {
    broadcastUpdate(counter);
  }
}, 3000);

// --- Update SSE ---
app.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send initial state
  res.write(`data: ${counter.toString()}\n\n`);

  // Add client to set
  sseClients.add(res);

  // Close connection
  req.on("close", () => {
    sseClients.delete(res);
    res.end();
  });
});

// Check Health
app.get("/health", (req, res) => {
  res.json({ ok: true, environment: process.env.NODE_ENV });
});

app.listen(port, hostname, () => {
  console.log(`v0.2 running on port ${port}`);
});

if (process.argv.includes("--prepare-publish")) {
  console.log("Preparing weekly publish…");
  rotateLog();
  writeSnapshot(counter);
  process.exit(0);
}
