import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACTIVE_LOG = "absurd-work.log";
const LOGS_DIR = path.join(__dirname, "history_logs");
const SNAPSHOT_DIR = path.join(__dirname, "snapshots");

let nextSegmentName;

function getNextSegmentName() {
  //* Get the next increment segment name (absurd-work.log.0001) *//
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR);
  }
  const files = fs.readdirSync(LOGS_DIR);
  const prefix = "absurd-work.log.";

  // get all numbers of file name (0001,0002,...)
  const numbers = files
    .filter((f) => f.startsWith(prefix))
    .map((f) => parseInt(f.replace(prefix, ""), 10))
    .filter((n) => !isNaN(n));

  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;

  return prefix + String(next).padStart(4, "0");
}

function rotateLog() {
  //* move active log to segmented (.0001, 0002) log for back up *//
  //* clear active log to "" *//

  nextSegmentName = getNextSegmentName();
  const targetPath = path.join(LOGS_DIR, nextSegmentName);

  fs.renameSync(ACTIVE_LOG, targetPath);
  fs.writeFileSync(ACTIVE_LOG, "");
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function getPrevSnapshotPath() {
  //* Get the latest snapshot name. Return path eg. snapshots/snapshot.0001.json *//
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR);
    return null;
  }

  const files = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => f.startsWith("snapshot") && f.endsWith(".json"))
    .sort();

  if (files.length === 0) return null;

  return path.join(SNAPSHOT_DIR, files[files.length - 1]);
}

function writeSnapshot(counter) {
  // Load past segments from previous snapshot
  let inheritedSegments = {};
  const prevSnapshotPath = getPrevSnapshotPath();
  if (prevSnapshotPath) {
    const prev = JSON.parse(fs.readFileSync(prevSnapshotPath), "utf8");
    inheritedSegments = prev.segments;
  }

  // get next segment name, add new segment "file: hash" to the current segments
  // maybe I need to fix this: the current is called rotateLog and update nextSegmentName, and use that name here
  const newSegmentPath = path.join(LOGS_DIR, nextSegmentName);
  const segments = {
    ...inheritedSegments,
    [nextSegmentName]: hashFile(newSegmentPath),
  };

  // create snapshot data, filename, path and write
  const snapshot = {
    protocol: "absurd-work-v0.3.5",
    timestamp: new Date().toISOString(),
    counter: counter.toString(),
    segments,
    inherits: prevSnapshotPath ? path.basename(prevSnapshotPath) : null,
  };

  const fileName = prevSnapshotPath
    ? `snapshot.${nextSegmentName.slice(-4)}.json`
    : "snapshot.0001.json";
  const filePath = path.join(SNAPSHOT_DIR, fileName);

  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

  // Sign after write
  signSnapShot(filePath);
}

function signSnapShot(snapshotPath) {
  const PRIVATE_KEY_PATH = path.join(__dirname, "keys", "absurd-work.key");
  execFileSync("minisign", ["-S", "-s", PRIVATE_KEY_PATH, "-m", snapshotPath]);
}

export { writeSnapshot, rotateLog, getPrevSnapshotPath };
