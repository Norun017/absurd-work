function drawGridSVG(cols, rows, cellSize) {
  const width = cols * cellSize;
  const height = rows * cellSize;
  let svg = "";

  // 1. Draw Border
  svg += `<rect width="100%" height="100%" stroke="#000" fill="none" stroke-width="2" />`;

  // 2. Draw Grid lines
  svg += `<g stroke="#000" stroke-width="1">`;
  for (let i = 0; i <= cols; i++) {
    let x = i * cellSize;
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" />`;
  }
  for (let i = 0; i <= rows; i++) {
    let y = i * cellSize;
    svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" />`;
  }

  svg += `</g>`;
  return svg;
}

function drawFromOrderSVG(counter, order, totalCells, cellSize) {
  const digits = counter.toString(2).padStart(totalCells, "0");
  let svg = "";

  for (let i = 0; i < totalCells; i++) {
    const color = digits[i] === "0" ? "#ffffff" : "#000000";
    const x = order[i].x * cellSize;
    const y = order[i].y * cellSize;
    svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" />`;
  }

  return svg;
}

export { drawGridSVG, drawFromOrderSVG };
