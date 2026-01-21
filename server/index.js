import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { rotateLog, writeSnapshot, getPrevSnapshotPath } from "./snapshot.js";
import { VERSION } from "./version.js";

const __dirname = import.meta.dirname;

const app = express();
const hostname = "localhost";
const port = 3001;

app.use(express.static(path.join(__dirname, "../client")));

const LOG_PATH = path.join(__dirname, "absurd-work.log");

// --- Batched write queue system ---
let writeQueue = [];
let isWriting = false;
const MAX_QUEUE_SIZE = 10000; // Protect against memory overflow
const BATCH_SIZE = 100; // Write 100 clicks at a time
const FLUSH_INTERVAL = 100; // Flush every 100ms

async function flushQueue() {
  if (isWriting || writeQueue.length === 0) return;

  isWriting = true;
  const batch = writeQueue.splice(0, BATCH_SIZE);
  const lines = batch.map((ts) => `${ts} \n`).join("");

  try {
    await fsPromises.appendFile(LOG_PATH, lines);
  } catch (err) {
    console.error("Batch write failed:", err);
    // Put failed batch back at front of queue for retry
    writeQueue.unshift(...batch);
  }

  isWriting = false;

  // Continue flushing if queue still has items
  if (writeQueue.length > 0) {
    setImmediate(flushQueue);
  }
}

// Flush periodically
setInterval(flushQueue, FLUSH_INTERVAL);

// --- Rebuild counter on startup ---
let counter = 0n;
const snapshotPath = getPrevSnapshotPath();
if (snapshotPath) {
  const file = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  counter = BigInt(file.counter);
}

// Always check active log (even if no snapshot)
if (fs.existsSync(LOG_PATH)) {
  const data = fs.readFileSync(LOG_PATH, "utf8");
  const newCount = BigInt(data.split("\n").filter(Boolean).length);
  counter += newCount;
}

// --- append-only click ---
app.post("/click", (req, res) => {
  // Check if system is overloaded
  if (writeQueue.length > MAX_QUEUE_SIZE) {
    return res.status(503).json({
      error: "Overloaded, please work again",
      counter: counter.toString(),
    });
  }

  counter += 1n;
  const currentCount = counter;

  // Add to write queue
  writeQueue.push(Date.now());

  // Trigger immediate flush if queue is getting large
  if (writeQueue.length >= BATCH_SIZE) {
    setImmediate(flushQueue);
  }

  // Respond immediately (write happens asynchronously)
  res.json({ counter: currentCount.toString() });
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

  // Ping to remove zombie connection
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch (err) {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 45000);

  // Close connection
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });

  res.on("error", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Check Health
app.get("/health", (req, res) => {
  res.json({ ok: true, environment: process.env.NODE_ENV });
});

app.listen(port, hostname, () => {
  console.log(`${VERSION} running on port ${port}`);
});
