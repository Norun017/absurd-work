# The Absurd Work

The Absurd Work is a counter toward every possible image in a 16×16 grid: 2²⁵⁶, or 115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457,584,007,913,129,639,936 possibilities, to be exact. The counter increments through the work done by participants, by clicking a button, or blinking, in this context. Can 8,300,000,000 humans (as of 2026) perform that much work? Should we work anyway, regardless of the outcome?

My naïve belief that we could reach this number led me to create The Absurd Work to last as long as necessary for the counter to reach its goal. Each work produces a unique pixelated image, each carrying meaning through its visual, the act that generated it, or whatever was in the participant’s mind at that moment. I hope the pleasure of looking at these images might help us endure the absurdity of these works.

This project draws inspiration from Every Icon (1996) by John F. Simon.

**[Live Project](https://absurd-work.norun.art)** | **[Read the Essay](https://norun017.substack.com/t/theabsurdwork)**

---

## Architecture

```
┌─────────────┐
│   Browser   │ ──── Click ───▶ ┌──────────────┐
│  (Canvas)   │ ◀─── SSE ────── │ Express      │
└─────────────┘                 │ Server       │
                                │              │
                                │ • Counter    │
                                │ • Write Queue│
                                │ • SSE Stream │
                                └──────┬───────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │ File System  │
                                │              │
                                │ • Log Files  │
                                │ • Snapshots  │
                                └──────────────┘
```

### How This Work?

**Work Tracking**

- Append-only log file records every work with timestamp
- BigInt counter handles unlimited clicks (beyond JavaScript's Number.MAX_SAFE_INTEGER)
- Batched write queue for high-performance under load (100,000+ clicks/sec)

**Real-time Updates**

- Server-Sent Events (SSE) broadcasts counter updates every 3 seconds
- Heartbeat ping every 45 seconds to detect zombie connections
- Optimistic UI updates with rollback on failure

**Data Integrity**

- Weekly log rotation creates immutable segments (`absurd-work.log.0001`, `.0002`, etc.)
- Cryptographic snapshots with SHA-256 hashing and Merkle root verification
- Snapshot chain for temporal ordering and authenticity
- ISO week-based publishing for archival

**Archival Mirrors**

- **GitHub Repository**: [absird-work-history](https://github.com/Norun017/absird-work-history) - Weekly snapshots and logs
- **IPFS**: Each week published to IPFS for decentralized preservation (CIDs logged in repo)
- Periodic archival bundles deposited with the Internet Archive

---

## Server

**Location:** [`/server`](./server)

Node.js/Express server handling clicks, persistence, and weekly publishing.

### API Endpoints

The Absurd Work is modular — anyone can send inputs to increment the counter, and present any output that can represent a 256-bit space. Build your work tools with the endpoints below.

**Base URL:** `https://absurd-work.norun.art`

| Endpoint  | Method | Description                               | Response                |
| --------- | ------ | ----------------------------------------- | ----------------------- |
| `/click`  | POST   | Increment counter by 1 (no body required) | `{ "counter": "4218" }` |
| `/read`   | GET    | Get current counter value                 | `{ "counter": "4218" }` |
| `/events` | GET    | SSE stream (broadcasts every 3s)          | `data: 4218`            |
| `/health` | GET    | Health check                              | `{ "ok": true }`        |

Counter is returned as a string (BigInt that will exceed `Number.MAX_SAFE_INTEGER`). The main site converts it to a 256-bit binary string where each bit maps to a pixel in a 16×16 grid (`1` = black, `0` = white).

### File Structure

```
server/
├── index.js                    # Main Express server
├── snapshot.js                 # Log rotation & snapshot creation
├── publish-standalone.js       # Weekly publish script
├── publish-prepare.js          # Copy files to publish folder
├── time.js                     # ISO week calculation
├── absurd-work.log            # Active click log (rotated weekly)
├── history_logs/              # Segmented log backups
│   ├── absurd-work.log.0001
│   └── absurd-work.log.0002
├── snapshots/                 # Weekly snapshots with signatures
│   ├── snapshot.0001.json
│   ├── snapshot.0001.json.minisig
│   └── snapshot.0002.json
└── publish/weekly/            # IPFS & Git distribution
    ├── 2026-W01/
    ├── 2026-W02/
    └── 2026-W03/
```

### Weekly Publishing

Automated weekly snapshot and publish process runs **every Sunday at midnight**.

**What it does:**

1. Rotates active log to segmented backup
2. Creates cryptographic snapshot with hash chain
3. Copies files to `/publish/YYYY-WXX/` folder
4. Uploads to IPFS and logs the CID
5. Pushes to GitHub repository: [absird-work-history](https://github.com/Norun017/absird-work-history)

**Publishing Destinations:**

- **GitHub**: [github.com/Norun017/absird-work-history](https://github.com/Norun017/absird-work-history)
- **IPFS**: Distributed storage with CIDs logged in `ipfs-cids.log`

### Snapshot Format

Each weekly snapshot contains comprehensive metadata for long-term archival and verification.

```json
{
  "protocol": "absurd-work-v0.3.5",
  "timestamp": "2026-01-26T00:00:00.000Z",
  "counter": "150000",

  "segments": {
    "absurd-work.log.0001": {
      "hash": "sha256:a1b2c3d4e5f6...",
      "lines": 50000,
      "firstClick": 1,
      "lastClick": 50000,
      "timeRange": {
        "start": "2026-01-01T00:00:00.000Z",
        "end": "2026-01-08T00:00:00.000Z"
      }
    },
    "absurd-work.log.0002": {
      "hash": "sha256:d4e5f6a7b8c9...",
      "lines": 50000,
      "firstClick": 50001,
      "lastClick": 100000,
      "timeRange": {
        "start": "2026-01-08T00:00:01.000Z",
        "end": "2026-01-15T00:00:00.000Z"
      }
    },
    "absurd-work.log.0003": {
      "hash": "sha256:g7h8i9j0k1l2...",
      "lines": 50000,
      "firstClick": 100001,
      "lastClick": 150000,
      "timeRange": {
        "start": "2026-01-15T00:00:01.000Z",
        "end": "2026-01-22T00:00:00.000Z"
      }
    }
  },

  "verification": {
    "totalLines": 150000,
    "merkleRoot": "sha256:master1234567890abcdef..."
  },

  "previousSnapshot": {
    "file": "snapshot.0002.json",
    "hash": "sha256:xyz789abc123...",
    "counter": 100000
  },

  "metadata": {
    "maintainer": "Norun",
    "repository": "https://github.com/norun/absurd-work",
    "website": "https://absurd-work.norun.art"
  }
}
```

**Snapshot Components:**

- **Protocol version** - Format specification for future compatibility
- **Timestamp** - When snapshot was created
- **Counter** - Total clicks at time of snapshot
- **Segments** - Detailed metadata for each log segment:
  - SHA-256 hash for integrity verification
  - Line count and click range (first/last)
  - Time range of clicks in the segment
- **Verification** - Merkle root of all segment hashes for quick integrity check
- **Previous snapshot** - Reference to prior snapshot (chain of custody)
- **Metadata** - Maintainer and project information

### Verifying Data Integrity

**To verify a log segment:**

```bash
# Calculate SHA-256 hash of a segment
sha256sum absurd-work.log.0001

# Compare with hash in snapshot.json
# Should match the "hash" value for that segment
```

**To verify the entire chain:**

1. Check each segment hash matches its file
2. Verify Merkle root matches combined segment hashes
3. Verify previous snapshot hash matches the actual file
4. Confirm counter = sum of all segment line counts

The snapshot chain creates an immutable record - each snapshot references the previous one, making it impossible to alter history without breaking the chain.

---

## Version History

**v0.5** (February 2026)

- Explorer page: browse past works by number, slider, or random
- NFT minting with server-signed authorization
- On-chain SVG rendering (with daily color mode)
- Smart contract deployed to Ethereum mainnet (Contract: [0xeaB574d06282F1b7ecA24C7495597de8D3508e6B](https://etherscan.io/address/0xeab574d06282f1b7eca24c7495597de8d3508e6b))
- About page with project description and modular concept
- SQLite database

**v0.3.5** (January 2026)

- Batched write queue for high-performance click handling
- SSE heartbeat for connection management
- Weekly publish script
- Enhanced snapshot format with Merkle root and detailed segment metadata

**v0.2** (Prototype)

- Initial public release
- Basic click tracking and persistence

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

This is an art project exploring the absurdity of human actions.

**Created by Norun** | [norun.art](https://norun.art)
