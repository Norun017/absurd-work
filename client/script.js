import { createP5Sketch } from "./renderp5.js";
import {
  distanceOrder,
  drawFromOrder as drawFromOrderGrid,
  drawGrid as drawGridLines,
  drawFromOrder2Bit,
  drawFromOrder4Bit,
} from "./renderGrid.js";
import { renderVoxel } from "./renderVoxel.js";
import { setupDetector, stopWebCam } from "./blink.js";

const log = document.querySelector(".log");
const btn = document.querySelector("button");
const preLog = document.querySelector("#pre-log");
const source = new EventSource(`/events`);
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const modeSelector = document.querySelector("#mode-selector");

const GRID_SIZE = 16;
const totalCells = GRID_SIZE * GRID_SIZE;
const START_DATE = new Date("2026-01-16"); // Project start date

const GRID_2BIT_COLS = 8;
const GRID_2BIT_ROWS = 16;
const totalCells2bit = GRID_2BIT_COLS * GRID_2BIT_ROWS; // 128

const GRID_4BIT_COLS = 8;
const GRID_4BIT_ROWS = 8;
const totalCells4bit = GRID_4BIT_COLS * GRID_4BIT_ROWS; // 32

// Setup Canvas
const canvasContainer = document.querySelector("#canvas-container");
const p5Container = document.querySelector("#p5-container");
const svgContainer = document.querySelector("#svg-container");
const voxelContainer = document.querySelector("#voxel-container");
const webCam = document.querySelector("#webcam");
const canvas = document.createElement("canvas");
canvas.id = "canvas";
canvas.width = 480 * dpr;
canvas.height = 480 * dpr;
canvasContainer.appendChild(canvas);

const ctx = canvas.getContext("2d");
const canvasSize = canvas.width;
const cellSize = canvasSize / GRID_SIZE;

// State
let counter = 0n;
let renderMode = "grid"; // "grid", "grid2bit", "grid4bit", "square", or "voxel"
let inputMode = "work"; // "work" or "blink"

// Pre-calculate distance orders (can be computed synchronously)
const order = distanceOrder(GRID_SIZE, GRID_SIZE);
const order2bit = distanceOrder(GRID_2BIT_COLS, GRID_2BIT_ROWS);
const order4bit = distanceOrder(GRID_4BIT_COLS, GRID_4BIT_ROWS);

// Initialize p5 sketch with lazy counter update
const p5Sketch = createP5Sketch("p5-container", () => {
  if (p5Sketch && counter > 0n) {
    p5Sketch.updateCounter(counter);
  }
});

// Not show Webcam by default
webCam.style.display = "none";

// -----------Init----------

async function init() {
  try {
    const res = await fetch(`/read`, { method: "GET" });
    const data = await res.json();
    counter = BigInt(data.counter);

    render(counter);
    updateDaysOfWork();
  } catch (error) {
    console.error("Failed to initialize:", error);
  }
}

init();

// -----------Render Configuration----------

// Render mode configuration
const RENDER_MODES = {
  grid: {
    container: canvasContainer,
    render: (counter) => {
      const digits = counter.toString(2).padStart(totalCells, "0");
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      drawFromOrderGrid(ctx, digits, order, cellSize, dpr, totalCells);
      drawGridLines(ctx, GRID_SIZE, GRID_SIZE, canvasSize, dpr, cellSize);
    },
  },

  square: {
    container: p5Container,
    render: (counter) => {
      if (p5Sketch) {
        p5Sketch.updateCounter(counter);
      }
    },
  },

  grid2bit: {
    container: canvasContainer,
    render: (counter) => {
      const digits2bit = counter.toString(4).padStart(totalCells2bit, "0");
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      drawFromOrder2Bit(
        ctx,
        digits2bit,
        order2bit,
        cellSize,
        dpr,
        totalCells2bit,
        GRID_2BIT_COLS,
        GRID_2BIT_ROWS,
        canvasSize
      );
      drawGridLines(
        ctx,
        GRID_2BIT_COLS,
        GRID_2BIT_ROWS,
        canvasSize,
        dpr,
        cellSize
      );
    },
  },

  grid4bit: {
    container: canvasContainer,
    render: (counter) => {
      const digits4bit = counter.toString(16).padStart(totalCells4bit, "0");
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      drawFromOrder4Bit(
        ctx,
        digits4bit,
        order4bit,
        cellSize,
        dpr,
        totalCells4bit,
        GRID_4BIT_COLS,
        GRID_4BIT_ROWS,
        canvasSize
      );
      drawGridLines(
        ctx,
        GRID_4BIT_COLS,
        GRID_4BIT_ROWS,
        canvasSize,
        dpr,
        cellSize
      );
    },
  },

  voxel: {
    container: voxelContainer,
    render: (counter) => {
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      requestAnimationFrame(() => {
        renderVoxel("voxel-container", counter);
      });
    },
  },
};

// -----------Render Function----------

// Top level renderer
function render(counter) {
  // Hide all containers
  [canvasContainer, p5Container, svgContainer, voxelContainer].forEach(
    (container) => (container.style.display = "none")
  );

  // Show and render active mode
  const mode = RENDER_MODES[renderMode];
  if (mode) {
    mode.container.style.display = "flex";
    mode.render(counter);
  }

  log.textContent = counter;
}

// -----------Click Handler----------

async function handleClick() {
  const prevCounter = counter;
  // Optimistic update
  counter += 1n;
  render(counter);

  try {
    const res = await fetch(`/click`, { method: "POST" });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
  } catch {
    // Rollback
    counter = prevCounter;
    render(counter);
  }
}

// -----------Event Listeners----------

// Input mode selector (Work vs Blink)
modeSelector.addEventListener("change", (e) => {
  inputMode = e.target.value;

  if (inputMode === "blink") {
    // Enable blink detection
    webCam.style.display = "block";
    setupDetector(handleClick);
  } else {
    // Disable blink detection
    webCam.style.display = "none";
    stopWebCam();
  }
});

// Render mode toggle
const toggleInputs = document.querySelectorAll('input[name="render-mode"]');
toggleInputs.forEach((input) => {
  input.addEventListener("change", (e) => {
    renderMode = e.target.value;
    render(counter);
  });
});

// Click button
btn.addEventListener("click", handleClick);

// Server-Sent Events for real-time updates
source.onmessage = (e) => {
  const global = BigInt(e.data);
  if (global > counter) {
    counter = global;
    render(counter);
  }
};

// Crypto wallet copy button
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

// -----------Utility Functions----------

// Calculate days since start
function updateDaysOfWork() {
  const today = new Date();
  const diffTime = today - START_DATE;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  preLog.textContent = `Day ${diffDays} of work`;
}
