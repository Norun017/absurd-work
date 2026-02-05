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
} from "https://esm.sh/viem@2.45.1";
import { sepolia } from "https://esm.sh/viem@2.45.1/chains";

// Setup Renderer
const SVGContainer = document.querySelector("#svg-container");
const subCounter = document.querySelector("#sub-counter");
const counterInput = document.querySelector("#counter");
const counterSlider = document.querySelector("#counter-slider");
const counterRandom = document.querySelector("#counter-random");
const counterMsg = document.querySelector("#counter-msg");
const workTitle = document.querySelector("#work-title");
const discovererEl = document.querySelector("#dicoverer");
const discoverDateEl = document.querySelector("#discover-date");
const inscriptionEl = document.querySelector("#inscription");
const inscriptionInput = document.querySelector("#inscription-input");
const mintButton = document.querySelector("#mint");
const mintStatus = document.querySelector("#mint-status");
const whyDiscoverBtn = document.querySelector("#why-discover");
const whyDiscoverModal = document.querySelector("#why-discover-modal");
const modalClose = document.querySelector(".modal-close");

const GRID_SIZE = 16;
const totalCells = GRID_SIZE * GRID_SIZE;
const order = distanceOrder(GRID_SIZE, GRID_SIZE);
let GLOBAL_COUNTER;
let counter = 0n;

// Cache to avoid repeated calls
const ensCache = new Map();
const currentOwnerCache = new Map();

// ========== Init ==========
async function init() {
  try {
    const res = await fetch(`/read`, { method: "GET" });
    const data = await res.json();
    GLOBAL_COUNTER = BigInt(data.counter);
    subCounter.innerHTML = `<u>${GLOBAL_COUNTER}</u>`; // update subtitle counter
    counter = randomBigInt(GLOBAL_COUNTER); // Show random counter at start

    // Set slider max value
    counterSlider.max = GLOBAL_COUNTER.toString();
    counterSlider.value = counter.toString();

    // Set input number value
    counterInput.value = counter.toString();

    render(counter);
  } catch (error) {
    console.error("Failed to initialize:", error);
  }
}

init();

// ========== Event Listeners ==========
// Listener for input number
counterInput.addEventListener("input", (e) => {
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
    counter = BigInt(value);
    render(counter);
  }
});

// Listener for input slider
counterSlider.addEventListener("input", (e) => {
  const value = e.target.value;
  counter = BigInt(value);
  render(counter);
});

// Listener for random counter
counterRandom.addEventListener("click", () => {
  counter = randomBigInt(GLOBAL_COUNTER);
  render(counter);
});

// ========== Why Discover Modal ==========
// Open modal
whyDiscoverBtn.addEventListener("click", () => {
  whyDiscoverModal.style.display = "block";
});

// Close modal when clicking X
modalClose.addEventListener("click", () => {
  whyDiscoverModal.style.display = "none";
});

// Close modal when clicking outside of it
window.addEventListener("click", (e) => {
  if (e.target === whyDiscoverModal) {
    whyDiscoverModal.style.display = "none";
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
        "MetaMask is not installed. Please install MetaMask to mint.",
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
            "Sepolia network is not added to your wallet. Please add it manually.",
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
    const inscriptionMessage = inscriptionInput.value.trim();
    const saveRes = await fetch("/api/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId,
        discoverer: userAddress,
        discoveredAt: new Date().toISOString(),
        inscriptionMessage: inscriptionMessage || null,
      }),
    });

    if (!saveRes.ok) {
      console.error("Failed to save to database, but mint succeeded");
    }

    // Step 10: Success!
    mintStatus.innerHTML = `✓ Successfully minted WORK #${counter}!`;
    mintStatus.style.color = "green";

    // Clear input and refresh discovery info
    inscriptionInput.value = "";
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
  const res = await fetch(`/api/discovery/${tokenId}`, { method: "GET" });

  //Failed to fetch from server database: Display and return
  if (!res.ok) {
    console.error("Failed to fetch discovery info");
    discovererEl.innerHTML = "Discoverer: Error loading";
    discoverDateEl.innerHTML = "Discovered Date: -";
    inscriptionEl.innerHTML = `<i>Inscription: -</i>`;
    return;
  }

  const data = await res.json();
  const originalOwner = data.discoverer;

  // If token has not been minted: Display and return
  if (!data.minted) {
    discovererEl.innerHTML = "Discoverer: Not yet discovered";
    discoverDateEl.innerHTML = "Discovered Date: -";
    inscriptionEl.innerHTML = `<i>Inscription: -</i>`;
    //Enable minting
    mintButton.disabled = false;
    mintButton.textContent = "Connect to collect (0.01 ETH)";
    return;
  }

  // If Reserved by paid offchain (plain name): Display and return
  if (!/^0x[a-fA-F0-9]{40}$/.test(originalOwner)) {
    discovererEl.innerHTML = `${ownerLabel}: ${data.discoverer}`;
    discoverDateEl.innerHTML = `Discovered Date: ${new Date(
      data.discovered_at,
    ).toLocaleDateString()}`;
    inscriptionEl.innerHTML = data.inscription_message
      ? `<i>Inscription: "${data.inscription_message}"</i>`
      : `<i>Inscription: -</i>`;
    return;
  }

  // Continue if owner is valid address
  // Token has been minted - disable minting
  mintButton.disabled = true;
  mintButton.textContent = "Already discovered";
  discovererEl.innerHTML = "Discoverer: Loading...";

  let changeHand = false;

  // Get current owner and check it the token has changed hand
  const currentOwner = await currentOwnerCheckAndCache(tokenId);
  if (currentOwner.toLowerCase() !== originalOwner.toLowerCase()) {
    changeHand = true;
  }

  // Get ENS name (for both original and current owner)
  const originalENSName = await ensNameCheckAndCache(originalOwner);
  let currentENSName;
  if (changeHand) {
    currentENSName = await ensNameCheckAndCache(currentOwner);
  }

  // Display original discoverer
  discovererEl.innerHTML = `Discoverer: ${
    originalENSName ? originalENSName : originalOwner.substring(0, 6)
  }...${originalOwner.substring(38)}`;
  // Display current owner after (if change hand)
  if (changeHand) {
    discovererEl.innerHTML += `</br>(Current Owner: ${
      currentENSName ? currentENSName : currentOwner.substring(0, 6)
    }...${currentOwner.substring(38)})`;
  }

  discoverDateEl.innerHTML = `Discovered Date: ${new Date(
    data.discovered_at,
  ).toLocaleDateString()}`;

  inscriptionEl.innerHTML = data.inscription_message
    ? `<i>Inscription: "${data.inscription_message}"</i>`
    : `<i>Inscription: -</i>`;
}

async function backup(tokenId) {
  try {
    const res = await fetch(`/api/discovery/${tokenId}`, { method: "GET" });

    if (!res.ok) {
      throw new Error("Failed to fetch discovery");
    }

    const data = await res.json();

    // Check if token has been minted
    if (!data.minted) {
      // Token has not been minted
      discovererEl.innerHTML = "Discoverer: Not yet discovered";
      discoverDateEl.innerHTML = "Discovered Date: -";
      inscriptionEl.innerHTML = `<i>Inscription: -</i>`;
      //Enable minting
      mintButton.disabled = false;
      mintButton.textContent = "Connect to collect (0.01 ETH)";
      return;
    }

    // Token has been minted

    // Disable minting
    mintButton.disabled = true;
    mintButton.textContent = "Already discovered";

    // Display discovery information
    let displayAddress = data.discoverer;
    let ownerLabel = "Discoverer";
    let ensName;

    // If the discoverer already mint with address
    if (/^0x[a-fA-F0-9]{40}$/.test(data.discoverer)) {
      // Check if token ownership has changed
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });

      // If cached
      if (currentOwnerCache.has(tokenId)) {
        const currentOwner = currentOwnerCache.get(tokenId);
        if (
          // If current owner != original discoverer
          currentOwner.toLowerCase() !== data.discoverer.toLowerCase()
        ) {
          displayAddress = currentOwner;
          ownerLabel = "Current owner";
        }
      } else {
        // Try to get current owner
        const currentOwner = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        });
        // Then cache the owner
        currentOwnerCache.set(tokenId, currentOwner);
        // If owner has changed, show current owner instead
        if (currentOwner.toLowerCase() !== data.discoverer.toLowerCase()) {
          displayAddress = currentOwner;
          ownerLabel = "Current owner";
        }
      }

      // Try to get ENS name for the address (with caching)
      const addressLower = displayAddress.toLowerCase();
      if (ensCache.has(addressLower)) {
        ensName = ensCache.get(addressLower);
      } else {
        try {
          ensName = await publicClient.getEnsName({
            address: displayAddress,
          });
          // Cache the result (including null/undefined for addresses without ENS)
          ensCache.set(addressLower, ensName);
        } catch (ensError) {
          // ENS lookup failed, cache the failure to avoid retrying
          ensCache.set(addressLower, null);
          console.log("ENS lookup failed:", ensError);
        }
      }

      // Display Current Owner name
      discovererEl.innerHTML = ensName
        ? `${ownerLabel}: ${ensName}`
        : `${ownerLabel}: ${displayAddress.substring(
            0,
            6,
          )}...${displayAddress.substring(38)}`;
    } else {
      // Display plain name if owner is not an address
      discovererEl.innerHTML = `${ownerLabel}: ${data.discoverer}`;
    }

    discoverDateEl.innerHTML = `Discovered Date: ${new Date(
      data.discovered_at,
    ).toLocaleDateString()}`;
    inscriptionEl.innerHTML = data.inscription_message
      ? `<i>Inscription: "${data.inscription_message}"</i>`
      : `<i>Inscription: -</i>`;
  } catch (error) {
    console.error("Failed to fetch discovery info:", error);
    discovererEl.innerHTML = "Discoverer: Error loading";
    discoverDateEl.innerHTML = "Discovered Date: -";
    inscriptionEl.innerHTML = `<i>Inscription: -</i>`;
  }
}

// ========== Render ==========
function render(counter) {
  const cellSizeSVG = 480 / GRID_SIZE;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 480 480" shape-rendering="crispEdges">`;
  svg += drawGridSVG(GRID_SIZE, GRID_SIZE, cellSizeSVG);
  svg += drawFromOrderSVG(counter, order, totalCells, cellSizeSVG);
  svg += `</svg>`;

  SVGContainer.style.display = "flex";
  SVGContainer.innerHTML = svg;

  // Fetch and display discovery info
  fetchDiscoveryInfo(counter.toString());

  // Update UI counter
  counterSlider.value = counter; // Sync slider
  counterInput.value = counter; // Sync number input
  counterMsg.innerHTML = "";
  workTitle.innerHTML = `WORK #${counter}`;

  return svg;
}

// ========== Utils ==========
function randomBigInt(max) {
  // Generate random BigInt between 1 and GLOBAL_COUNTER by creating random bytes
  const maxHex = max.toString(16);
  const numDigits = maxHex.length;

  let randomBigInt;
  do {
    // Generate random hex string of the same length
    const hexString = Array(numDigits)
      .fill()
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join("");

    randomBigInt = BigInt(`0x${hexString}`);
  } while (randomBigInt > max || randomBigInt === 0n);
  return randomBigInt;
}

async function currentOwnerCheckAndCache(tokenId) {
  let currentOwner;

  // If has current owner cache => return current owner
  if (currentOwnerCache.has(tokenId)) {
    currentOwner = currentOwnerCache.get(tokenId);
    return currentOwner;
  }

  // Try to get current owner
  try {
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });
    currentOwner = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });
    // Then cache the owner
    currentOwnerCache.set(tokenId, currentOwner);
    return currentOwner;
  } catch (error) {
    // Token may not exist yet (not minted) or network error
    console.error("Failed to fetch current owner:", error);
    return null;
  }
}

async function ensNameCheckAndCache(address) {
  let ensName;

  // If has ENS name cached >> return cache
  const addressLower = address.toLowerCase();
  if (ensCache.has(addressLower)) {
    ensName = ensCache.get(addressLower);
    return ensName;
  }

  // Try get ENS name
  try {
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });
    ensName = await publicClient.getEnsName({
      address: address,
    });
    // Cache the result (including null/undefined for addresses without ENS)
    ensCache.set(addressLower, ensName);
    return ensName;
  } catch (ensError) {
    // ENS lookup failed, cache the failure to avoid retrying
    ensCache.set(addressLower, null);
    console.log("ENS lookup failed:", ensError);
    return null;
  }
}
