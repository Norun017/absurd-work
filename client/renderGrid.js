// Grid renderer for 16×16 binary visualization

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
function drawCell(ctx, col, row, color, cellSize, dpr, offsetX = 0, offsetY = 0) {
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

function drawFromOrder2Bit(ctx, digits, order, cellSize, dpr, totalCells, cols, rows, canvasSize) {
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

    drawCell(ctx, order[i].x, order[i].y, color, cellSize, dpr, offsetX, offsetY);
  }
}

// Draw grid lines and border - accepts columns and rows, centers on canvas with square cells
function drawGrid(ctx, cols, rows, canvasSize, dpr) {
  // Calculate cell size to maintain square cells
  // Use the larger dimension to determine cell size
  const maxDimension = Math.max(cols, rows);
  const cellSizeSquare = canvasSize / maxDimension;

  // Calculate grid dimensions with square cells
  const gridWidth = cols * cellSizeSquare;
  const gridHeight = rows * cellSizeSquare;

  // Center offset
  const offsetX = (canvasSize - gridWidth) / 2;
  const offsetY = (canvasSize - gridHeight) / 2;

  // 1. Draw inner lines
  ctx.lineWidth = 1 * dpr;
  ctx.strokeStyle = "#000";
  ctx.beginPath();

  // Vertical lines
  for (let i = 1; i < cols; i++) {
    const x = offsetX + i * cellSizeSquare + 0.5;
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + gridHeight);
  }

  // Horizontal lines
  for (let i = 1; i < rows; i++) {
    const y = offsetY + i * cellSizeSquare + 0.5;
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

export { distanceOrder, drawCell, drawFromOrder, drawGrid, drawFromOrder2Bit };
