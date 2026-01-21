import fs from "fs";
import path from "path";
import { rotateLog, writeSnapshot, getPrevSnapshotPath } from "./snapshot.js";
import { prepareWeeklyPublish } from "./publish-prepare.js";
import { getISOWeek } from "./time.js";

const __dirname = import.meta.dirname;

console.log("═══════════════════════════════════════════════");
console.log(`📊 Weekly Publish Started`);
console.log(`   Time: ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════════");

// Rebuild counter (server stop, read from counter and active log file)
let counter = 0n;
const snapshotPath = getPrevSnapshotPath();

// counter from previous log
if (snapshotPath) {
  const file = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  counter = BigInt(file.counter);
  console.log(`   Previous counter: ${counter}`);
} else {
  console.log(`📄 No previous snapshot found, starting from 0`);
}

// Count click from current active log
const LOG_PATH = path.join(__dirname, "absurd-work.log");
if (fs.existsSync(LOG_PATH)) {
  const data = fs.readFileSync(LOG_PATH, "utf8");
  const lines = data.split("\n").filter(Boolean);
  const newCount = BigInt(lines.length);
  console.log(`📝 New clicks in log: ${newCount}`);
  counter += newCount;
} else {
  console.log(`📝 No log file found`);
}

console.log(`📈 Final counter: ${counter}`);
console.log("───────────────────────────────────────────────");

// Rotate log file
console.log("🔄 Rotating log file...");
const publishedSegmentLog = rotateLog();
console.log(`   ✅ Log: ${publishedSegmentLog} rotated`);

// Create snapshot with hash
console.log("📸 Creating snapshot...");
const publishedSnapshot = writeSnapshot(counter);
console.log(`   ✅ Snapshot: ${publishedSnapshot} created`);

// Publish for mirroring
const { year, week } = getISOWeek();

const result = prepareWeeklyPublish({
  weekId: `${year}-W${week.toString().padStart(2, "0")}`,
  snapshotFile: publishedSnapshot,
  segmentFile: publishedSegmentLog,
});
console.log("✅Published:", result);

console.log("═══════════════════════════════════════════════");
console.log("✅ Weekly Publish Complete!");
console.log(`   Final Counter: ${counter}`);
console.log(`   Time: ${new Date().toISOString()}`);
console.log("═══════════════════════════════════════════════");
