import { distanceOrder } from "./renderGrid.js";
import { drawGridSVG, drawFromOrderSVG } from "./renderSVG.js";
import {
  connectWallet,
  getWalletAddress,
  isWalletInstalled,
} from "./wallet.js";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract.js";
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  createPublicClient,
  http,
} from "https://esm.sh/viem@2.21.54";
import { sepolia } from "https://esm.sh/viem@2.21.54/chains";

// Setup Renderer
const SVGContainer = document.querySelector("#svg-container");
const counterInput = document.querySelector("#counter");
const counterSlider = document.querySelector("#counter-slider");
const counterMsg = document.querySelector("#counter-msg");
const workTitle = document.querySelector("#work-title");
const discovererEl = document.querySelector("#dicoverer");
const discoverDateEl = document.querySelector("#discover-date");
const engraveEl = document.querySelector("#engrave");
const engraveInput = document.querySelector("#engrave-input");
const mintButton = document.querySelector("#mint");
const mintStatus = document.querySelector("#mint-status");

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

// ========== Mint Flow ==========
mintButton.addEventListener("click", async () => {
  mintButton.disabled = true;
  mintStatus.innerHTML = "";
  mintStatus.style.color = "";

  try {
    // Step 1: Check wallet installation
    if (!isWalletInstalled()) {
      throw new Error(
        "MetaMask is not installed. Please install MetaMask to mint."
      );
    }

    // Step 2: Connect wallet
    mintStatus.innerHTML = "Connecting wallet...";
    let userAddress = getWalletAddress(); // get address if already connected

    if (!userAddress) {
      // Not currently connected
      userAddress = await connectWallet();
    }

    console.log("Connected wallet:", userAddress);

    // Step 2.5: Check network and switch if needed
    mintStatus.innerHTML = "Checking network...";
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    const currentChainId = parseInt(chainId, 16);

    if (currentChainId !== sepolia.id) {
      mintStatus.innerHTML = "Please switch to Sepolia network...";
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${sepolia.id.toString(16)}` }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          throw new Error(
            "Sepolia network is not added to your wallet. Please add it manually."
          );
        }
        throw switchError;
      }
    }

    mintStatus.innerHTML = "Wallet connected. Getting signature...";

    // Step 3: Request signature from backend
    const tokenId = counter.toString();
    const signatureRes = await fetch("/api/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress,
        tokenId,
      }),
    });

    if (!signatureRes.ok) {
      const error = await signatureRes.json();
      throw new Error(error.error || "Failed to get signature");
    }

    const { signature } = await signatureRes.json();
    console.log("Signature received");

    // Step 4: Create viem clients
    mintStatus.innerHTML = "Preparing transaction...";

    const walletClient = createWalletClient({
      account: userAddress,
      chain: sepolia,
      transport: custom(window.ethereum),
    });

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });

    // Step 5: Get mint price from contract
    mintStatus.innerHTML = "Getting mint price...";
    const mintPrice = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "mintPrice",
    });

    console.log("Mint price:", mintPrice.toString());

    // Step 6: Encode function call data
    const paidOffChain = false;
    const data = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: "safeMint",
      args: [userAddress, BigInt(tokenId), paidOffChain, signature],
    });

    // Step 7: Send transaction
    mintStatus.innerHTML = "Please confirm transaction in wallet...";
    const txHash = await walletClient.sendTransaction({
      to: CONTRACT_ADDRESS,
      data,
      value: mintPrice,
    });

    console.log("Transaction sent:", txHash);
    mintStatus.innerHTML = "Transaction sent! Waiting for confirmation...";

    // Step 8: Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "reverted") {
      throw new Error("Transaction failed");
    }

    console.log("Transaction confirmed:", receipt);
    mintStatus.innerHTML = "Minted! Saving to database...";

    // Step 9: Save to database
    const engraveMessage = engraveInput.value.trim();
    const saveRes = await fetch("/api/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId,
        discoverer: userAddress,
        discoveredAt: new Date().toISOString(),
        engraveMessage: engraveMessage || null,
      }),
    });

    if (!saveRes.ok) {
      console.error("Failed to save to database, but mint succeeded");
    }

    // Step 10: Success!
    mintStatus.innerHTML = `✓ Successfully minted WORK #${counter}!`;
    mintStatus.style.color = "green";

    // Clear input and refresh discovery info
    engraveInput.value = "";
    fetchDiscoveryInfo(tokenId);
  } catch (error) {
    console.error("Mint error:", error);

    let errorMsg = error.message;
    if (error.code === 4001) {
      errorMsg = "Transaction rejected by user";
    } else if (error.message.includes("User rejected")) {
      errorMsg = "Transaction rejected by user";
    } else if (error.message.includes("already minted")) {
      errorMsg = "This work has already been minted";
    }

    mintStatus.innerHTML = `✗ Error: ${errorMsg}`;
    mintStatus.style.color = "red";
  } finally {
    mintButton.disabled = false;
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
