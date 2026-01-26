import fs from "fs";
import path from "path";
import { execSync } from "child_process";

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

export function pushToGitHub(weekId) {
  try {
    // Add new files
    execSync(`git -C ${PUBLISH_DIR} add .`, { encoding: "utf8" });

    // Commit
    execSync(`git -C ${PUBLISH_DIR} commit -m "Weekly publish ${weekId}"`, {
      encoding: "utf8",
    });

    // Push
    execSync(`git -C ${PUBLISH_DIR} push origin main`, { encoding: "utf8" });

    return { success: true, weekId };
  } catch (error) {
    // No changes to commit is okay
    if (error.message.includes("nothing to commit")) {
      return { success: true, weekId, message: "No changes" };
    }
    throw error;
  }
}

export function publishToIPFS(weekId) {
  const targetDIR = path.join(PUBLISH_DIR, weekId);

  try {
    const output = execSync(`ipfs add -r ${targetDIR}`, {
      encoding: "utf8",
    });
    const lines = output.trim().split("\n");
    const root = lines[lines.length - 1];
    const [, cid] = root.split(" ");

    // Save CID to a log file
    const cidLog = path.join(PUBLISH_DIR, "ipfs-cids.log");
    fs.appendFileSync(cidLog, `${weekId}: ${cid}\n`);

    return cid;
  } catch (error) {
    console.error("IPFS upload failed:", error.message);
    return null;
  }
}
