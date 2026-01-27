/// takes a 256-bit string and converts it into a generative SVG "constellation."

let draw;

function renderSVG(containerId, count, numPoints) {
  // 1. Initialize ONLY if it doesn't exist yet
  if (!draw) {
    draw = SVG()
      .addTo(`#${containerId}`)
      .size("100%", "100%")
      .viewbox(0, 0, 16, 16);
  } else {
    // If it exists, wipe the old art before drawing the new one
    draw.clear();
  }

  // Background
  draw.rect(16, 16).fill("#0a0a0a");

  // 2. Process counter into points
  const hexDigits = count.toString(16).padStart(64, "0"); // turn to 64 char hexadecimal

  // Split 64 chars into numPoints chunks (16 points 16 bits each, 32 points 8 bit each);
  // Each hexdecimal digit is 4 bits
  const chunkChars = 256 / numPoints / 4;
  const points = [];
  for (let i = 0; i < 64; i += chunkChars) {
    const chunk = hexDigits.substring(i, i + chunkChars);
    // Map hex chars to X and Y (0-255), to Y (0-255)
    const coorChars = chunkChars / 2; // each for X, Y coor
    const x = parseInt(chunk.substring(0, coorChars), 16);
    const y = parseInt(chunk.substring(coorChars, chunkChars), 16);
    points.push([x, y]);
  }

  // 3. Build Cubic Bezier Path String
  // We'll use the points as anchors and control points
  let pathString = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 2; i += 3) {
    pathString += ` C ${points[i][0]} ${points[i][1]}, ${points[i + 1][0]} ${
      points[i + 1][1]
    }, ${points[i + 2][0]} ${points[i + 2][1]}`;
  }

  console.log(pathString);

  // 4. Draw the Path
  draw
    .path(pathString)
    .fill("none")
    .stroke({ color: "#00ffcc", width: 1, linecap: "round" })
    .opacity(0.8);

  // 5. Draw Data Nodes (Optional dots)
  points.forEach((p) => {
    draw
      .circle(2)
      .move(p[0] - 1, p[1] - 1)
      .fill("#ffffff")
      .opacity(0.4);
  });
}

export { renderSVG };
