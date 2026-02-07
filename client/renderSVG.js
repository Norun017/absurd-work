function getDailyColor(colorMode) {
  if (!colorMode) return "#000";
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const r = (daysSinceEpoch * 2) % 256;
  const g = (daysSinceEpoch * 1) % 255;
  const b = (daysSinceEpoch * 3) % 254;
  console.log(daysSinceEpoch);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function drawGridSVG(cols, rows, cellSize, colorMode = false) {
  const color = getDailyColor(colorMode);
  let svg = "";

  svg += `<defs><pattern id="grid" width="${cellSize.toString()}" height="${cellSize.toString()}" patternUnits="userSpaceOnUse">`;
  svg += `<path d="M ${cellSize.toString()} 0 L 0 0 0 ${cellSize.toString()}" fill="none" stroke="${color}" stroke-width="1"/></pattern></defs>`;
  svg += `<rect width="480" height="480" fill="url(#grid)" stroke="${color}" stroke-width="4"/>`;
  return svg;
}

function drawFromOrderSVG(
  counter,
  order,
  totalCells,
  cellSize,
  colorMode = false,
) {
  const fillColor = getDailyColor(colorMode);
  const digits = counter.toString(2).padStart(totalCells, "0");
  let svg = "";

  svg += `<rect width="${cellSize * 16}" height="${cellSize * 16}" fill="#fff"/>`;

  for (let i = 0; i < totalCells; i++) {
    if (digits[i] === "1") {
      const x = order[i].x * cellSize;
      const y = order[i].y * cellSize;
      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fillColor}" />`;
    }
  }

  return svg;
}

export { drawGridSVG, drawFromOrderSVG, getDailyColor };
