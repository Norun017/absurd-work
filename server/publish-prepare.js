import fs from "fs";
import path from "path";

const ROOT = path.resolve(".");
const LOGS_DIR = path.join(ROOT, "history_logs");
const SNAPSHOT_DIR = path.join(ROOT, "snapshots");
const PUBLISH_DIR = path.join(ROOT, "publish");

export function prepareWeeklyPublish({
  weekId, // e.g. "2026-W03"
  snapshotFile, // e.g. "snapshot.0042.json"
  segmentFile, // e.g. "absurd-work.log.0042"
}) {
  const targetDIR = path.join(PUBLISH_DIR, weekId);
  fs.mkdirSync(targetDIR, { recursive: true });

  // copy snapshot
  fs.copyFileSync(
    path.join(SNAPSHOT_DIR, snapshotFile),
    path.join(targetDIR, snapshotFile)
  );

  // copy segment log
  fs.copyFileSync(
    path.join(LOGS_DIR, segmentFile),
    path.join(targetDIR, segmentFile)
  );

  return targetDIR;
}

/* 
// Manual for v0.3.5. Implement auto in later version
export function publishToIPFS(folderPath) {
  const output = execSync(`ipfs add -r ${folderPath}`, {
    encoding: "utf8",
  });
  const lines = output.trim().split("\n");
  const root = lines[lines.length - 1];
  const [, cid] = root.split(" ");

  return cid;
} */
