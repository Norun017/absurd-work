import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs";
import path from "path";
import { rotateLog, writeSnapshot } from "./snapshot.js";

const __dirname = import.meta.dirname;

const app = express();
const hostname = "localhost";
const port = 3001;

app.use(express.static(path.join(__dirname, "../client")));

const LOG_PATH = path.join(__dirname, "absurd-work.log");

// --- rebuild counter on startup ---
let counter = 0n;
if (getPrevSnapshotPath()) {
  const path = getPrevSnapshotPath();
  const file = JSON.parse(fs.readFileSync(path, "utf8"));
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

  fs.appendFile(LOG_PATH, line, (err) => {
    if (err) {
      return res.status(500).json({ error: "log write failed" });
    }
    counter += 1n;
    res.json({ counter: counter.toString() });
  });
});

// --- read-only counter ---
app.get("/read", (req, res) => {
  res.json({ counter: counter.toString() });
});

// --- Update SSE ---
app.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Update every 2 seconds
  const intervalUpdate = setInterval(() => {
    res.write(`data: ${counter.toString()}\n\n`);
  }, 3000);

  // Close connection
  req.on("close", () => {
    clearInterval(intervalUpdate);
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
  rotateLog;
  writeSnapshot(counter);
  process.exit(0);
}
