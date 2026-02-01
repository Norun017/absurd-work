import {
  distanceOrder,
  drawFromOrder as drawFromOrderGrid,
  drawGrid as drawGridLines,
} from "./renderGrid.js";
import { setupDetector, stopWebCam } from "./blink.js";
import { drawGridSVG, drawFromOrderSVG } from "./renderSVG.js";

const log = document.querySelector(".log");
const btn = document.querySelector("#work-btn");
const preLog = document.querySelector("#pre-log");
const source = new EventSource(`/events`);
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const modeSelector = document.querySelector("#mode-selector");

const GRID_SIZE = 16;
const totalCells = GRID_SIZE * GRID_SIZE;
const START_DATE = new Date("2026-01-16"); // Project start date

// Setup Canvas
const canvasContainer = document.querySelector("#canvas-container");
const SVGContainer = document.querySelector("#svg-container");
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
let renderMode = "gridSVG";
let inputMode = "work"; // "work" or "blink"

// Pre-calculate distance orders (can be computed synchronously)
const order = distanceOrder(GRID_SIZE, GRID_SIZE);

// Not show Webcam & Canvas by default
webCam.style.display = "none";
canvasContainer.style.display = "none";

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

  gridSVG: {
    container: SVGContainer,
    render: (counter) => {
      SVGContainer.style.display = "flex";
      const INTERNAL_SIZE = 480;
      const cellSizeSVG = INTERNAL_SIZE / GRID_SIZE;

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${INTERNAL_SIZE} ${INTERNAL_SIZE}" style="max-width: 480px; width: 100%;">`;
      svg += drawFromOrderSVG(counter, order, totalCells, cellSizeSVG);
      svg += drawGridSVG(GRID_SIZE, GRID_SIZE, cellSizeSVG);
      svg += `</svg>`;

      SVGContainer.innerHTML = svg;
    },
  },
};

// -----------Render Function----------

// Top level renderer
function render(counter) {
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
modeSelector.addEventListener("click", () => {
  // Toggle between work and blink
  inputMode = inputMode === "work" ? "blink" : "work";

  // Update button text
  modeSelector.textContent = inputMode === "work" ? "Work" : "Blink";

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
