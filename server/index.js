import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, encodePacked } from "viem";
import { rotateLog, writeSnapshot, getPrevSnapshotPath } from "./snapshot.js";
import { VERSION } from "./version.js";
import { saveDiscovery, getDiscovery, getAllDiscoveries } from "./database.js";

const __dirname = import.meta.dirname;

const app = express();
const hostname = "localhost";
const port = 3001;

app.use(express.static(path.join(__dirname, "../client")));
app.use(express.json()); // Add this for JSON body parsing

// Serve explorer page at /explorer
app.get("/explorer", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/explorer.html"));
});

const LOG_PATH = path.join(__dirname, "absurd-work.log");

// ============ SIGNATURE SETUP ============
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
if (!SIGNER_PRIVATE_KEY) {
  console.error("Missing SIGNER_PRIVATE_KEY in .env");
  process.exit(1);
}

const signerAccount = privateKeyToAccount(SIGNER_PRIVATE_KEY);
console.log(`Signer Address: ${signerAccount}`);

// ============ Batched write queue system ============
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

// ============ Rebuild counter on startup ============
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

// ============ Append-only click ============
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

// ============ SIGNATURE ENDPOINT ============
app.post("/api/signature", async (req, res) => {
  try {
    const { userAddress, tokenId } = req.body;

    // Validate inputs
    if (!userAddress || tokenId === undefined) {
      return res.status(400).json({
        error: "Missing userAddress or tokenId",
      });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return res.status(400).json({
        error: "Invalid address format",
      });
    }

    const tokenIdBigInt = BigInt(tokenId);

    // Check if tokenId is within allowed range (Global counter)
    if (tokenIdBigInt > counter) {
      return res.status(403).json({
        error: "The Image not available yet",
      });
    }
    if (tokenIdBigInt < 0n) {
      return res.status(400).json({
        error: "Invalid tokenId",
      });
    }

    // Create message hash (must match contract)
    const paidOffChain = false; //Default to false, prepare for credit card pay
    const messageHash = keccak256(
      encodePacked(
        ["address", "uint256", "bool"],
        [userAddress, tokenIdBigInt, paidOffChain]
      )
    );

    // Sign the message
    const signature = await signerAccount.signMessage({
      message: { raw: messageHash },
    });
    console.log(
      `Signature generated for ${userAddress} - tokenId: ${tokenId} - paidOffChain: ${paidOffChain}`
    );

    res.json({
      signature,
      userAddress,
      tokenId: tokenId.toString(),
    });
  } catch (error) {
    console.error("Error generating signature:", error);
    res.status(500).json({
      error: "Failed to generate signature",
    });
  }
});

// Get signer address (for contract deployment)
app.get("/api/signer", (req, res) => {
  res.json({
    signer: signerAccount.address,
  });
});

// ============ DISCOVERY ENDPOINTS ============
// Save discovery information
app.post("/api/discovery", (req, res) => {
  try {
    const { tokenId, discoverer, discoveredAt, inscriptionMessage } = req.body;

    // Validate inputs
    if (!tokenId || !discoverer || !discoveredAt) {
      return res.status(400).json({
        error: "Missing required fields: tokenId, discoverer, discoveredAt",
      });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(discoverer)) {
      return res.status(400).json({
        error: "Invalid discoverer address format",
      });
    }

    // Save to database
    saveDiscovery.run(
      tokenId.toString(),
      discoverer,
      discoveredAt,
      inscriptionMessage || null
    );

    res.json({
      success: true,
      tokenId: tokenId.toString(),
    });
  } catch (error) {
    console.error("Error saving discovery:", error);
    res.status(500).json({
      error: "Failed to save discovery",
    });
  }
});

// Get discovery by tokenId
app.get("/api/discovery/:tokenId", (req, res) => {
  try {
    const { tokenId } = req.params;
    const discovery = getDiscovery.get(tokenId);

    if (!discovery) {
      return res.status(200).json({
        minted: false,
        tokenId,
      });
    }

    res.json({
      minted: true,
      ...discovery,
    });
  } catch (error) {
    console.error("Error getting discovery:", error);
    res.status(500).json({
      error: "Failed to get discovery",
    });
  }
});

// Get all discoveries
app.get("/api/discoveries", (req, res) => {
  try {
    const discoveries = getAllDiscoveries.all();
    res.json(discoveries);
  } catch (error) {
    console.error("Error getting discoveries:", error);
    res.status(500).json({
      error: "Failed to get discoveries",
    });
  }
});

// ============ SSE client management ============
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

// ============ Check Health ============
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    environment: process.env.NODE_ENV,
    signer: signerAccount.address,
  });
});

app.listen(port, hostname, () => {
  console.log(`${VERSION} running on port ${port}`);
});
