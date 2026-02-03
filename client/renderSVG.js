function drawGridSVG(cols, rows, cellSize) {
  const width = cols * cellSize;
  const height = rows * cellSize;
  let svg = "";

  svg += `<defs><pattern id="grid" width="${cellSize.toString()}" height="${cellSize.toString()}" patternUnits="userSpaceOnUse">`;
  svg += `<path d="M ${cellSize.toString()} 0 L 0 0 0 ${cellSize.toString()}" fill="none" stroke="black" stroke-width="1"/></pattern></defs>`;
  svg += `<rect width="480" height="480" fill="url(#grid)" stroke="black" stroke-width="4"/>`;
  return svg;
}

function drawFromOrderSVG(counter, order, totalCells, cellSize) {
  const digits = counter.toString(2).padStart(totalCells, "0");
  let svg = "";

  for (let i = 0; i < totalCells; i++) {
    if (digits[i] === "1") {
      const x = order[i].x * cellSize;
      const y = order[i].y * cellSize;
      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#000" shape-rendering="crispEdges" />`;
    }
  }

  return svg;
}

export { drawGridSVG, drawFromOrderSVG };
