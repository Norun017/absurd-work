const log = document.querySelector(".log");
const btn = document.querySelector("button");
const source = new EventSource(`/events`);

const GRID_SIZE = 16;
const totalCells = GRID_SIZE * GRID_SIZE;

// Setup Canvas
const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");
const canvasSize = canvas.width;
const cellSize = canvasSize / GRID_SIZE;

let counter = 0n;
let order;

// Init
async function init() {
  order = distanceOrder(GRID_SIZE);
  const res = await fetch(`/read`, { method: "GET" });
  const data = await res.json();
  counter = BigInt(data.counter);
  render(counter);
}

//Init draw Grid
init();

// Draw Grid everytime a button is clicked
btn.addEventListener("click", () => {
  click();
});

// Listen to SSE
source.onmessage = (e) => {
  const global = BigInt(e.data);
  if (global > counter) {
    counter = global;
    render(counter);
  }
};

// -----------Click & Update ----------

async function click() {
  const prevCounter = counter; // For revert back if write failed
  // Optimistic update
  counter += 1n;
  render(counter);

  try {
    const res = await fetch(`/click`, { method: "POST" });
    // Handle non-2xx HTTP status
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
  } catch {
    // Rollback
    counter = prevCounter;
    render(counter);
  }
}

// -----------Draw functions----------

// Top level renderer
function render(counter) {
  let digits = counter.toString(2); // 1 bit (black&white) = binary digit
  digits = digits.padStart(totalCells, 0); // pad left to total cells (total digits)
  drawFromOrder(digits);
  drawGrid(); // Draw grid over cells
  log.textContent = counter; // Show counter
}

// Draw Grid with Canvas
function drawGrid() {
  // 1. Draw inner lines
  ctx.lineWidth = 1;
  ctx.beginPath();
  // need to add 0.5 px This is because a 1px line drawn on a half-pixel boundary (e.g., at x=50.5) will be anti-aliased across two physical pixels.
  for (let i = 1; i < GRID_SIZE; i++) {
    const x = i * cellSize + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasSize);
  }
  for (let i = 1; i < GRID_SIZE; i++) {
    let y = i * cellSize + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(canvasSize, y);
  }
  ctx.stroke();

  // 2. Draw outer border
  const borderLineWidth = 2;
  // We use a small offset (borderLineWidth/2) so the line is centered on the canvas edge.
  const offset = borderLineWidth / 2;
  ctx.lineWidth = borderLineWidth;
  ctx.strokeRect(
    offset,
    offset,
    canvasSize - borderLineWidth,
    canvasSize - borderLineWidth
  );
}

// Draw single cell
function drawCell(col, row, color) {
  // make sure no cell render problem due to grid offset
  const inset = 1; // half of border + grid thickness
  const x = col * cellSize + inset;
  const y = row * cellSize + inset;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, cellSize - inset, cellSize - inset);
}

// Draw cells from digits

function drawFromOrder(digits) {
  let color;
  for (let i = 0; i < totalCells; i++) {
    digits[i] === "0" ? (color = "white") : (color = "black");
    drawCell(order[i].x, order[i].y, color);
  }
}

// -----Create Order to draw array------

// Order from center spread outward
function distanceOrder(N) {
  const center = (N - 1) / 2;
  const order = [];

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x - center;
      const dy = y - center;
      const d = Math.sqrt(dx * dx + dy * dy); //Compute Euclidean distance to center

      order.push({ x, y, d });
    }
  }

  // order by Euclidean distance, if equal compare y then x (you can change this for aesthetics)
  // I reverse or here since the [0] digit will be the last pixel
  order.sort((a, b) => b.d - a.d || b.y - a.y || b.x - a.x);
  return order;
}

//* For Crpto Button *//
document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("wallet-copy")) return;

  const wallet = e.target.dataset.wallet;
  navigator.clipboard.writeText(wallet);

  const original = e.target.textContent;
  e.target.textContent = "Copied";

  setTimeout(() => {
    e.target.textContent = original;
  }, 800);
});
