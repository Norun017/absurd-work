import { renderHash } from "./render.js";
import { createP5Sketch } from "./renderp5.js";

const log = document.querySelector(".log");
const btn = document.querySelector("button");
const preLog = document.querySelector("#pre-log");
const source = new EventSource(`/events`);
const dpr = Math.min(window.devicePixelRatio || 1, 2);

const GRID_SIZE = 16;
const totalCells = GRID_SIZE * GRID_SIZE;
const START_DATE = new Date("2026-01-16"); // Project start date

// Setup Canvas
const canvasContainer = document.querySelector(".canvas-container");
const canvas = document.createElement("canvas");
canvas.id = "canvas";
canvas.width = 480 * dpr;
canvas.height = 480 * dpr;
canvasContainer.appendChild(canvas);

const ctx = canvas.getContext("2d");
const canvasSize = canvas.width;
const cellSize = canvasSize / GRID_SIZE;

let counter = 0n;
let order;
let p5Sketch; // p5.js instance
let renderMode = "square"; // "grid" or "square"

// Calculate days since start
function updateDaysOfWork() {
  const today = new Date();
  const diffTime = today - START_DATE;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  preLog.textContent = `Day ${diffDays} of work`;
}

// Init
async function init() {
  order = distanceOrder(GRID_SIZE);
  const res = await fetch(`/read`, { method: "GET" });
  const data = await res.json();
  counter = BigInt(data.counter);

  // Initialize p5 sketch once, with callback to render after setup completes
  p5Sketch = createP5Sketch("p5-container", () => {
    // This runs after p5 setup is complete
    if (p5Sketch) {
      p5Sketch.updateCounter(counter);
    }
  });

  render(counter);
  updateDaysOfWork();
  /// For testing
  //renderHash(counter, totalCells);
}

//---------------Init draw Grid-------------
init();

// Listen to toggle mode
const toggleInputs = document.querySelectorAll('input[name="render-mode"]');
toggleInputs.forEach((input) => {
  input.addEventListener("change", (e) => {
    renderMode = e.target.value;
    render(counter);
  });
});

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
  //renderHash(counter, totalCells);

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

  // Get containers by ID
  const canvasContainer = document.querySelector("#canvas-container");
  const p5Container = document.querySelector("#p5-container");

  // Hide all
  canvasContainer.style.display = "none";
  p5Container.style.display = "none";

  if (renderMode === "grid") {
    canvasContainer.style.display = "flex";
    drawFromOrder(digits);
    drawGrid(GRID_SIZE, GRID_SIZE); // Draw 16×16 grid over cells
  } else if (renderMode === "square") {
    p5Container.style.display = "flex";
    // Update p5 sketch if initialized
    if (p5Sketch) {
      p5Sketch.updateCounter(counter);
    }
  }

  log.textContent = counter; // Show counter
}

// Draw Grid with Canvas - accepts columns and rows, centers on canvas
function drawGrid(cols = GRID_SIZE, rows = GRID_SIZE) {
  // Calculate cell size based on grid dimensions
  const gridCellWidth = canvasSize / cols;
  const gridCellHeight = canvasSize / rows;

  // Calculate grid dimensions
  const gridWidth = cols * gridCellWidth;
  const gridHeight = rows * gridCellHeight;

  // Center offset (for non-square grids or grids smaller than canvas)
  const offsetX = (canvasSize - gridWidth) / 2;
  const offsetY = (canvasSize - gridHeight) / 2;

  // 1. Draw inner lines
  ctx.lineWidth = 1 * dpr;
  ctx.strokeStyle = "#000";
  ctx.beginPath();

  // Vertical lines
  for (let i = 1; i < cols; i++) {
    const x = offsetX + i * gridCellWidth + 0.5;
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + gridHeight);
  }

  // Horizontal lines
  for (let i = 1; i < rows; i++) {
    const y = offsetY + i * gridCellHeight + 0.5;
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + gridWidth, y);
  }

  ctx.stroke();

  // 2. Draw outer border
  const borderLineWidth = 2 * dpr;
  const borderOffset = borderLineWidth / 2;
  ctx.lineWidth = borderLineWidth;
  ctx.strokeRect(
    offsetX + borderOffset,
    offsetY + borderOffset,
    gridWidth - borderLineWidth,
    gridHeight - borderLineWidth
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
  for (let i = 0; i < totalCells; i++) {
    const color = digits[i] === "0" ? "white" : "black";
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

// For testing hash render
/* function scrollEdge() {
  const container = document.querySelector(".hash-container");
  container.scrollLeft = container.scrollWidth; // Scrolls to the rightmost edge
} */
