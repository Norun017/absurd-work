import { distanceOrder, drawFromOrder, drawGrid } from "./renderGrid.js";
import { drawGridSVG, drawFromOrderSVG } from "./renderSVG.js";

// Setup Renderer
const SVGContainer = document.querySelector("#svg-container");
const counterInput = document.querySelector("#counter");
const counterSlider = document.querySelector("#counter-slider");
const counterMsg = document.querySelector("#counter-msg");
const workTitle = document.querySelector("#work-title");
const discovererEl = document.querySelector("#dicoverer");
const discoverDateEl = document.querySelector("#discover-date");
const engraveEl = document.querySelector("#engrave");
const mintButton = document.querySelector("#mint");

const GRID_SIZE = 16;
const totalCells = GRID_SIZE * GRID_SIZE;
const order = distanceOrder(GRID_SIZE, GRID_SIZE);
let GLOBAL_COUNTER;
let counter = 0n;

// ========== Init ==========
async function init() {
  try {
    const res = await fetch(`/read`, { method: "GET" });
    const data = await res.json();
    GLOBAL_COUNTER = BigInt(data.counter);

    // Set slider max value
    counterSlider.max = GLOBAL_COUNTER.toString();
    counterSlider.value = counter.toString();

    // Set input number value
    counterInput.value = counter.toString();

    renderImage(counter);
    workTitle.innerHTML = `WORK #${counter}`;
  } catch (error) {
    console.error("Failed to initialize:", error);
  }
}

init();

// ========== Event Listeners ==========
// Listener for input number
counterInput.addEventListener("input", (e) => {
  try {
    const value = e.target.value;
    if (value === "") return;

    // Prevent negative numbers
    if (value < 0) {
      counterInput.value = 0;
      return;
    }

    if (value > GLOBAL_COUNTER) {
      counterMsg.innerHTML =
        'Cannot explore future works. <a href="/">Back to work.</a>';
    } else {
      counterMsg.innerHTML = "";
      counter = BigInt(value);
      counterSlider.value = value; // Sync slider
      renderImage(counter);
      workTitle.innerHTML = `WORK #${counter}`;
    }
  } catch (error) {
    console.error("Invalid counter value:", error);
  }
});

// Listener for input slider
counterSlider.addEventListener("input", (e) => {
  try {
    const value = e.target.value;
    counter = BigInt(value);
    counterInput.value = value; // Sync number input
    counterMsg.innerHTML = "";
    renderImage(counter);
    workTitle.innerHTML = `WORK #${counter}`;
  } catch (error) {
    console.error("Invalid counter value:", error);
  }
});

// Listener for mint button (test function)
mintButton.addEventListener("click", async () => {
  try {
    // Test data
    const testData = {
      tokenId: counter.toString(),
      discoverer: "0x1234567890123456789012345678901234567890", // Test address
      discoveredAt: new Date().toISOString(),
      engraveMessage: "Test discovery message",
    };

    console.log("Saving discovery:", testData);

    const res = await fetch("/api/discovery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    const data = await res.json();

    if (res.ok) {
      console.log("Discovery saved successfully:", data);
      alert(`Discovery saved for WORK #${counter}`);
      // Refresh discovery info
      fetchDiscoveryInfo(counter.toString());
    } else {
      console.error("Failed to save discovery:", data.error);
      alert(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error("Failed to save discovery:", error);
    alert("Failed to save discovery");
  }
});

// ========== Fetch Discovery Info ==========
async function fetchDiscoveryInfo(tokenId) {
  try {
    const res = await fetch(`/api/discovery/${tokenId}`, { method: "GET" });

    if (res.status === 404) {
      // No discovery found for this tokenId
      discovererEl.innerHTML = "Discoverer: Not yet discovered";
      discoverDateEl.innerHTML = "Discovered Date: -";
      engraveEl.innerHTML = "Engrave: -";
      return;
    }

    if (!res.ok) {
      throw new Error("Failed to fetch discovery");
    }

    const data = await res.json();

    // Display discovery information
    discovererEl.innerHTML = `Discoverer: ${data.discoverer.substring(
      0,
      6
    )}...${data.discoverer.substring(38)}`;
    discoverDateEl.innerHTML = `Discovered Date: ${new Date(
      data.discovered_at
    ).toLocaleDateString()}`;
    engraveEl.innerHTML = data.engrave_message
      ? `Engrave: "${data.engrave_message}"`
      : "Engrave: -";
  } catch (error) {
    console.error("Failed to fetch discovery info:", error);
    discovererEl.innerHTML = "Discoverer: Error loading";
    discoverDateEl.innerHTML = "Discovered Date: -";
    engraveEl.innerHTML = "Engrave: -";
  }
}

// ========== Render ==========
function renderImage(counter) {
  const cellSizeSVG = 480 / GRID_SIZE;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 480 480">`;
  svg += drawGridSVG(GRID_SIZE, GRID_SIZE, cellSizeSVG);
  svg += drawFromOrderSVG(counter, order, totalCells, cellSizeSVG);
  svg += `</svg>`;

  SVGContainer.style.display = "flex";
  SVGContainer.innerHTML = svg;

  // Fetch and display discovery info
  fetchDiscoveryInfo(counter.toString());

  return svg;
}
