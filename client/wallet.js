import { CHAIN_ID, CHAIN_NAME } from "./contract.js";

let walletAddress = null;

// Check if MetaMask is installed
export function isWalletInstalled() {
  return typeof window.ethereum !== "undefined";
}

// Get current connected wallet address
export function getWalletAddress() {
  return walletAddress;
}

// Connect to user's wallet
export async function connectWallet() {
  if (!isWalletInstalled()) {
    throw new Error(
      "MetaMask is not installed. Please install MetaMask to continue."
    );
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (accounts.length === 0) {
      throw new Error("No accounts found");
    }

    walletAddress = accounts[0];

    // Check if on correct network
    await checkNetwork();

    return walletAddress;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error("Please connect your wallet to continue");
    }
    throw error;
  }
}

// Check if user is on the correct network
async function checkNetwork() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  const currentChainId = parseInt(chainId, 16);

  if (currentChainId !== CHAIN_ID) {
    throw new Error(
      `Please switch to ${CHAIN_NAME} network in your wallet. Current network is not supported.`
    );
  }
}
