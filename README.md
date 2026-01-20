# The Absurd Work

A part ‘copy the master’ reimagination of Every Icon (1996) and part creative coding practice art project.
Could human collective action ever exhaust the possibilities of a 16×16 grid?

**[Live Project](https://absurd-work.norun.art)** | **[Read the Essay](https://norun017.substack.com/p/making-of-the-absurd-work)**

---

## Overview

The Absurd Work lets everyone participate in “working” with a 16×16 grid. Each action (click) represents one image the grid can display, turning a single pixel from white to black and spreading outward from the center. The question is simple: Can we exhaust all 2^256 possible states of this grid,and if not, should we still try?

**Current Version:** v0.3.5 (January 2026)

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
                                │ • Signatures │
                                └──────────────┘
```

### Core Components

**Click Tracking**

- Append-only log file records every click with timestamp
- BigInt counter handles unlimited clicks (beyond JavaScript's Number.MAX_SAFE_INTEGER)
- Batched write queue for high-performance under load (100,000+ clicks/sec)

**Real-time Updates**

- Server-Sent Events (SSE) broadcasts counter updates every 3 seconds
- Heartbeat ping every 45 seconds to detect zombie connections
- Optimistic UI updates with rollback on failure

**Data Integrity**

- Weekly log rotation creates immutable segments (`absurd-work.log.0001`, `.0002`, etc.)
- Cryptographic snapshots with SHA-256 hashing
- Minisign signatures for verifiable authenticity
- ISO week-based publishing for archival

**Archival Mirrors**

- Weekly publication units distributed via Github and IPFS
- Periodic archival bundles deposited with the Internet Archive

---

## Client

**Location:** [`/client`](./client)

The client is a vanilla JavaScript canvas application with no build step.

### Features

- **Canvas Rendering**: 16×16 grid drawn with HTML5 Canvas API
- **Distance-Based Order**: Pixels fill from center outward using Euclidean distance
- **Real-time Updates**: SSE connection shows live global counter
- **Optimistic UI**: Instant visual feedback with rollback on error
- **Binary Representation**: Counter converted to binary, each bit = one pixel

### Files

- `index.html` - Canvas element and UI
- `script.js` - Grid rendering, SSE, click handling
- `style.css` - Styling

### How It Works

1. On load, fetches current counter from `/read`
2. Converts counter to 256-bit binary string
3. Maps each bit to a pixel position using distance order
4. Draws grid with black (1) or white (0) pixels
5. Listens to `/events` SSE for real-time updates
6. On click, optimistically updates UI and posts to `/click`

**Key Algorithm:**

```javascript
// Convert counter to binary (256 bits)
let digits = counter.toString(2).padStart(256, "0");

// Each pixel fills based on distance from center
// Pixel at index 0 = center, index 255 = corner
for (let i = 0; i < 256; i++) {
  drawCell(order[i].x, order[i].y, digits[i] === "1" ? "black" : "white");
}
```

---

## Server

**Location:** [`/server`](./server)

Node.js/Express server handling clicks, persistence, and weekly publishing.

### Performance Features (v0.3.5)

**Batched Write Queue**

- **100 clicks per batch** - Reduces file I/O by 100x
- **100ms flush interval** - Maximum 100ms write delay
- **Graceful degradation** - Returns 503 when overloaded (>10,000 pending writes)
- Can handle 100,000+ clicks/second

**SSE Memory Management**

- Heartbeat mechanism detects and removes dead connections
- Prevents memory leaks from zombie clients
- Broadcasts only when counter changes

### API Endpoints

| Endpoint  | Method | Description                         |
| --------- | ------ | ----------------------------------- |
| `/click`  | POST   | Record a click (increments counter) |
| `/read`   | GET    | Get current counter value           |
| `/events` | GET    | SSE stream for real-time updates    |
| `/health` | GET    | Health check with environment       |

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

1. Stops server gracefully
2. Rotates active log to segmented backup
3. Creates cryptographic snapshot with signatures
4. Copies files to `/publish/weekly/YYYY-WXX/` for distribution
5. Restarts server

**Downtime:** ~10-30 seconds once per week (acceptable trade-off for data integrity)

### Snapshot Format

```json
{
  "protocol": "absurd-work-v0.3.5",
  "timestamp": "2026-01-20T00:00:00.000Z",
  "counter": "1234567890",
  "segments": {
    "absurd-work.log.0001": "sha256_hash_here",
    "absurd-work.log.0002": "sha256_hash_here"
  },
  "inherits": "snapshot.0001.json"
}
```

Each snapshot includes:

- Total click counter at time of snapshot
- SHA-256 hashes of all log segments (for verification)
- Reference to previous snapshot (chain of custody)
- Minisign signature for authenticity

### Signature Verification

All snapshots are cryptographically signed with Minisign for verifiable authenticity.

**Public Key (Norun):**
```
untrusted comment: minisign public key 169CC68FE53E7344
RWREcz7lj8acFsROk7DPsNdIAL3pgHS9pdNtYbZQyCiTVxr1vgVHk2Kq
```

**To verify a snapshot:**

```bash
# Install minisign
apt-get install minisign  # Ubuntu/Debian
brew install minisign      # macOS

# Download the public key
curl -o absurd-work.pub https://raw.githubusercontent.com/yourusername/every-icon-collective/main/server/absurd-work.pub

# Verify a snapshot
minisign -Vm snapshot.0001.json -p absurd-work.pub

# Should output: Signature and comment signature verified
```

If stewardship changes in the future, the new maintainer's public key will be documented here with the transition date.

---

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- minisign (for cryptographic signatures)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/every-icon-collective.git
cd every-icon-collective

# Install server dependencies
cd server
npm install

# Start development server
npm run devstart

# In another terminal, serve the client
cd ../client
python3 -m http.server 3000
# Or use any static file server

# Open browser
open http://localhost:3000
```

### Server Scripts

```bash
npm start              # Production server
npm run devstart       # Development with nodemon
npm run publish        # Weekly publish (run while server is stopped)
```

---

## Production Deployment

### Setup with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start server
cd server
pm2 start index.js --name absurd-work

# Save PM2 configuration
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

### Weekly Publishing Cron Job

```bash
# Edit crontab
crontab -e

# Add this line (runs every Sunday at midnight)
0 0 * * 0 cd /path/to/server && pm2 stop absurd-work && sleep 2 && node publish-standalone.js >> /path/to/publish.log 2>&1 && sleep 1 && pm2 start absurd-work
```

### Environment Variables

```bash
NODE_ENV=production    # Set production mode
```

---

## Philosophy

This project intentionally has **no rate limiting** on clicks. The art piece explores whether humans can exhaust all possibilities of the 16×16 grid. Anyone can click as fast as they want, even with the help of their creations (machines).

---

## Version History

**v0.3.5** (January 2026)

- Batched write queue for high-performance click handling
- SSE heartbeat for connection management
- Standalone weekly publish script with PM2 integration
- Cryptographic snapshots with Minisign signatures

**v0.2** (Prototype)

- Initial public release
- Basic click tracking and persistence

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

This is an art project exploring the absurdity of human actions.

**Created by Norun** | [norun.art](https://norun.art)
