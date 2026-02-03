// Contract configuration
export const CONTRACT_ADDRESS = "0xaC34fC1A34Ff985Dc2BFc9cd345E6cBc27939C55";

export const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_to", type: "address" },
      { internalType: "uint256", name: "_tokenId", type: "uint256" },
      { internalType: "bool", name: "_paidOffChain", type: "bool" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "safeMint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "mintPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

// Sepolia testnet chain ID
export const CHAIN_ID = 11155111;
export const CHAIN_NAME = "Sepolia";
