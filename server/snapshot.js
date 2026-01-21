import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { VERSION } from "./version.js";

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

  return nextSegmentName;
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

function analyzeSegment(segmentPath, startingCounter) {
  // Read segment file and extract metadata
  const data = fs.readFileSync(segmentPath, "utf8");
  const lines = data.split("\n").filter(Boolean);
  const lineCount = lines.length;

  if (lineCount === 0) {
    return {
      hash: hashFile(segmentPath),
      lines: 0,
      firstClick: startingCounter,
      lastClick: startingCounter - 1,
      timeRange: null,
    };
  }

  // Parse timestamps (first and last)
  const firstTimestamp = parseInt(lines[0].trim(), 10);
  const lastTimestamp = parseInt(lines[lineCount - 1].trim(), 10);

  return {
    hash: hashFile(segmentPath),
    lines: lineCount,
    firstClick: startingCounter,
    lastClick: startingCounter + lineCount - 1,
    timeRange: {
      start: new Date(firstTimestamp).toISOString(),
      end: new Date(lastTimestamp).toISOString(),
    },
  };
}

function calculateMerkleRoot(segmentHashes) {
  // Combine all hashes and hash again to create Merkle root
  const combined = segmentHashes.join("");
  const hash = crypto.createHash("sha256");
  hash.update(combined);
  return "sha256:" + hash.digest("hex");
}

function writeSnapshot(counter) {
  // Load past segments from previous snapshot
  let inheritedSegments = {};
  let previousSnapshotData = null;
  const prevSnapshotPath = getPrevSnapshotPath();

  if (prevSnapshotPath) {
    const prev = JSON.parse(fs.readFileSync(prevSnapshotPath, "utf8"));
    inheritedSegments = prev.segments || {};

    // Store previous snapshot info for new format
    previousSnapshotData = {
      file: path.basename(prevSnapshotPath),
      hash: "sha256:" + hashFile(prevSnapshotPath),
      counter: parseInt(prev.counter, 10),
    };
  }

  // Analyze new segment with metadata
  const newSegmentPath = path.join(LOGS_DIR, nextSegmentName);

  // Calculate starting counter for this segment
  let segmentStartCounter = 1;
  if (prevSnapshotPath) {
    const prev = JSON.parse(fs.readFileSync(prevSnapshotPath, "utf8"));
    segmentStartCounter = parseInt(prev.counter, 10) + 1;
  }

  const newSegmentMetadata = analyzeSegment(
    newSegmentPath,
    segmentStartCounter
  );

  // Build segments object with full metadata
  const segments = {
    ...inheritedSegments,
    [nextSegmentName]: {
      hash: "sha256:" + newSegmentMetadata.hash,
      lines: newSegmentMetadata.lines,
      firstClick: newSegmentMetadata.firstClick,
      lastClick: newSegmentMetadata.lastClick,
      timeRange: newSegmentMetadata.timeRange,
    },
  };

  // Calculate Merkle root from all segment hashes
  const segmentHashes = Object.values(segments).map((seg) => {
    // Handle both old format (string) and new format (object)
    return typeof seg === "string" ? seg : seg.hash;
  });
  const merkleRoot = calculateMerkleRoot(segmentHashes);

  // Calculate total lines across all segments
  const totalLines = Object.values(segments).reduce((sum, seg) => {
    return sum + (typeof seg === "object" ? seg.lines : 0);
  }, 0);

  // Create snapshot data with new format
  const snapshot = {
    protocol: `absurd-work-${VERSION}`,
    timestamp: new Date().toISOString(),
    counter: counter.toString(),
    segments,
    verification: {
      totalLines,
      merkleRoot,
    },
    previousSnapshot: previousSnapshotData,
    metadata: {
      maintainer: "Norun",
      repository: "https://github.com/norun/absurd-work",
      website: "https://absurd-work.norun.art",
    },
  };

  const fileName = prevSnapshotPath
    ? `snapshot.${nextSegmentName.slice(-4)}.json`
    : "snapshot.0001.json";
  const filePath = path.join(SNAPSHOT_DIR, fileName);

  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

  return fileName;
}

export { writeSnapshot, rotateLog, getPrevSnapshotPath };
