const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const hostname = "localhost";
const port = 3000;

app.use(cors());

const LOG_PATH = path.join(__dirname, "counters.log");

// --- rebuild counter on startup ---
let counter = 0n;
if (fs.existsSync(LOG_PATH)) {
  const data = fs.readFileSync(LOG_PATH, "utf8");
  counter = BigInt(data.split("\n").filter(Boolean).length);
}

// --- append-only click ---
app.post("/click", (req, res) => {
  const line = `${Date.now()} \n`;

  fs.appendFile(LOG_PATH, line, (err) => {
    if (err) {
      return res.status(500).json({ error: "log write failed" });
    }
    counter += 1n;
  });
  res.json({ counter: counter.toString() });
});

// --- read-only counter ---
app.get("/", (req, res) => {
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
  }, 2000);

  // Close connection
  req.on("close", () => {
    clearInterval(intervalUpdate);
    res.end();
  });
});

app.listen(port, hostname, () => {
  console.log(`v0.2 running on port ${port}`);
});
