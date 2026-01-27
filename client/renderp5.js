export function createP5Sketch(containerID, onReady) {
  return new p5((p) => {
    const canvasSize = 480;
    const SPACE = 256;
    const bitDepth = 2;
    const totalPixels = SPACE / bitDepth;
    let isReady = false;

    p.setup = function () {
      const canvas = p.createCanvas(canvasSize, canvasSize);
      canvas.parent(containerID);

      // Remove p5's inline width/height
      canvas.elt.style.width = "";
      canvas.elt.style.height = "";

      p.rectMode(p.CENTER);
      p.noLoop(); // Don't auto-redraw, we'll call updateCounter manually
      isReady = true;
      if (onReady) onReady(); // Callback when setup is complete
    };

    // Public method to update the visualization with new counter
    p.updateCounter = function (count) {
      if (!isReady) return; // Don't render until setup is complete

      // Switch between full square or grow from center
      //const digits = count.toString(4).padStart(totalPixels, 0);
      const digits = count.toString(4);
      const totalRects = digits.length;
      const stepSize = canvasSize / totalRects;
      p.clear();
      p.noStroke();

      for (let i = 0; i < totalRects; i++) {
        let color = 255;
        switch (digits[i]) {
          case "1":
            color = 255 - (255 / (bitDepth ** 2 - 1)) * 1;
            break;
          case "2":
            color = 255 - (255 / (bitDepth ** 2 - 1)) * 2;
            break;
          case "3":
            color = 255 - (255 / (bitDepth ** 2 - 1)) * 3;
            break;
        }
        p.fill(color);
        p.rect(p.width / 2, p.height / 2, canvasSize - stepSize * i);
      }
    };
  });
}
