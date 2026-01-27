// Grid renderer

// Order from center spread outward using Euclidean distance
function distanceOrder(col, row) {
  const centerX = (col - 1) / 2;
  const centerY = (row - 1) / 2;
  const order = [];

  for (let y = 0; y < row; y++) {
    for (let x = 0; x < col; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const d = Math.sqrt(dx * dx + dy * dy); //Compute Euclidean distance to center

      order.push({ x, y, d });
    }
  }

  // order by Euclidean distance, if equal compare y then x (you can change this for aesthetics)
  // I reverse or here since the [0] digit will be the last pixel
  order.sort((a, b) => b.d - a.d || b.y - a.y || b.x - a.x);
  return order;
}

// Draw single cell
function drawCell(
  ctx,
  col,
  row,
  color,
  cellSize,
  dpr,
  offsetX = 0,
  offsetY = 0
) {
  // make sure no cell render problem due to grid offset
  const inset = 1; // half of border + grid thickness
  const x = offsetX + col * cellSize + inset;
  const y = offsetY + row * cellSize + inset;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, cellSize - inset, cellSize - inset);
}

// Draw cells from binary digits using distance order
function drawFromOrder(ctx, digits, order, cellSize, dpr, totalCells) {
  for (let i = 0; i < totalCells; i++) {
    const color = digits[i] === "0" ? "white" : "black";
    drawCell(ctx, order[i].x, order[i].y, color, cellSize, dpr);
  }
}

function drawFromOrder2Bit(
  ctx,
  digits,
  order,
  cellSize,
  dpr,
  totalCells,
  cols,
  rows,
  canvasSize
) {
  // Calculate offset to center the grid
  const gridWidth = cols * cellSize;
  const gridHeight = rows * cellSize;
  const offsetX = (canvasSize - gridWidth) / 2;
  const offsetY = (canvasSize - gridHeight) / 2;

  for (let i = 0; i < totalCells; i++) {
    // Convert base-4 digit (0-3) to greyscale (255, 170, 85, 0)
    const digitValue = parseInt(digits[i], 10);
    const grey = 255 - digitValue * 85;
    const color = `rgb(${grey}, ${grey}, ${grey})`;

    drawCell(
      ctx,
      order[i].x,
      order[i].y,
      color,
      cellSize,
      dpr,
      offsetX,
      offsetY
    );
  }
}

// RGBI color palette (4-bit CGA colors) - reversed order
const RGBI_COLORS = [
  "rgb(255, 255, 255)", // 0x0: White
  "rgb(170, 170, 170)", // 0x1: Light Gray
  "rgb(85, 255, 255)", // 0x2: Cyan
  "rgb(0, 170, 170)", // 0x3: Dark Cyan
  "rgb(255, 85, 255)", // 0x4: Magenta
  "rgb(170, 0, 170)", // 0x5: Dark Magenta
  "rgb(85, 85, 255)", // 0x6: Blue
  "rgb(0, 0, 170)", // 0x7: Dark Blue
  "rgb(255, 255, 85)", // 0x8: Yellow
  "rgb(170, 85, 0)", // 0x9: Brown/Dark Yellow
  "rgb(85, 255, 85)", // 0xA: Green
  "rgb(0, 170, 0)", // 0xB: Dark Green
  "rgb(255, 85, 85)", // 0xC: Red
  "rgb(170, 0, 0)", // 0xD: Dark Red
  "rgb(85, 85, 85)", // 0xE: Dark Gray
  "rgb(0, 0, 0)", // 0xF: Black
];

function drawFromOrder4Bit(
  ctx,
  digits,
  order,
  cellSize,
  dpr,
  totalCells,
  cols,
  rows,
  canvasSize
) {
  // Calculate offset to center the grid
  const gridWidth = cols * cellSize;
  const gridHeight = rows * cellSize;
  const offsetX = (canvasSize - gridWidth) / 2;
  const offsetY = (canvasSize - gridHeight) / 2;

  for (let i = 0; i < totalCells; i++) {
    // Convert hex digit (0-F) to RGBI color
    const digitValue = parseInt(digits[i], 16);
    const color = RGBI_COLORS[digitValue];

    drawCell(
      ctx,
      order[i].x,
      order[i].y,
      color,
      cellSize,
      dpr,
      offsetX,
      offsetY
    );
  }
}

// Draw grid lines and border - accepts columns, rows, and cellSize
function drawGrid(ctx, cols, rows, canvasSize, dpr, cellSize) {
  // Calculate grid dimensions using provided cellSize
  const gridWidth = cols * cellSize;
  const gridHeight = rows * cellSize;

  // Center offset
  const offsetX = (canvasSize - gridWidth) / 2;
  const offsetY = (canvasSize - gridHeight) / 2;

  // 1. Draw inner lines
  ctx.lineWidth = 1 * dpr;
  ctx.strokeStyle = "#000";
  ctx.beginPath();

  // Vertical lines
  for (let i = 1; i < cols; i++) {
    const x = offsetX + i * cellSize + 0.5;
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + gridHeight);
  }

  // Horizontal lines
  for (let i = 1; i < rows; i++) {
    const y = offsetY + i * cellSize + 0.5;
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

export {
  distanceOrder,
  drawCell,
  drawFromOrder,
  drawGrid,
  drawFromOrder2Bit,
  drawFromOrder4Bit,
};
