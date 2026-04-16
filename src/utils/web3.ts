import { ethers } from 'ethers';
import { Token } from './tokens';

export interface WalletState {
  address: string | null;
  chainId: number | null;
  connected: boolean;
}

export interface SwapQuote {
  amountOut: string;
  fee: string;
  priceImpact: string;
  minimumReceived: string;
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on: (event: 'accountsChanged' | 'chainChanged', handler: (payload: unknown) => void) => void;
  removeListener: (event: 'accountsChanged' | 'chainChanged', handler: (payload: unknown) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const LITEFORGE_CHAIN_ID = Number(import.meta.env.VITE_LITEFORGE_CHAIN_ID ?? 1337);
const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%

const SWAP_CONTRACT_ABI = [
  'function getSwapQuote(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256 amountOut, uint256 fee)',
  'function getReserves(address tokenA, address tokenB) view returns (uint256 reserveA, uint256 reserveB)',
  'function swap(address tokenIn, address tokenOut, uint256 amountIn) returns (uint256 amountOut)',
] as const;

const requireEthereumProvider = (): EthereumProvider => {
  if (!window.ethereum) {
    throw new Error('No wallet provider found. Install MetaMask or another EVM wallet.');
  }

  return window.ethereum;
};

const normalizeChainId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return Number.parseInt(value, 16);
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const getSwapContractAddress = (): string => {
  const address = import.meta.env.VITE_SWAP_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error('Missing VITE_SWAP_CONTRACT_ADDRESS. Set it in your .env file.');
  }

  return address;
};

const toDisplayAmount = (value: bigint, decimals: number, precision = 6): string => {
  const formatted = Number.parseFloat(ethers.formatUnits(value, decimals));
  if (!Number.isFinite(formatted)) {
    return '0';
  }

  return formatted.toFixed(precision);
};

const getWalletNetwork = async (): Promise<number | null> => {
  const ethereum = requireEthereumProvider();
  const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
  return normalizeChainId(chainIdHex);
};

const getWalletAddress = async (): Promise<string | null> => {
  const ethereum = requireEthereumProvider();
  const accounts = await ethereum.request({ method: 'eth_accounts' });
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return null;
  }

  const firstAccount = accounts[0];
  return typeof firstAccount === 'string' ? firstAccount : null;
};

export const getCurrentWalletState = async (): Promise<WalletState> => {
  if (!window.ethereum) {
    return {
      address: null,
      chainId: null,
      connected: false,
    };
  }

  const [address, chainId] = await Promise.all([getWalletAddress(), getWalletNetwork()]);

  return {
    address,
    chainId,
    connected: !!address && chainId === LITEFORGE_CHAIN_ID,
  };
};

export const connectWallet = async (): Promise<WalletState> => {
  const ethereum = requireEthereumProvider();
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

  if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== 'string') {
    throw new Error('Wallet did not return an account.');
  }

  const chainId = await getWalletNetwork();
  if (chainId !== LITEFORGE_CHAIN_ID) {
    throw new Error(`Wrong network. Switch wallet network to chain ID ${LITEFORGE_CHAIN_ID}.`);
  }

  return {
    address: accounts[0],
    chainId,
    connected: true,
  };
};

export const disconnectWallet = async (): Promise<void> => {
  // EVM wallets do not support a programmatic disconnect for dapps.
  // We keep this for API symmetry and clear local UI state in hooks.
  return Promise.resolve();
};

export const subscribeWalletEvents = (
  onState: (walletState: WalletState) => void,
  onError?: (message: string) => void
): (() => void) => {
  if (!window.ethereum) {
    return () => undefined;
  }

  const ethereum = window.ethereum;

  const handleAccountsChanged = async (accountsPayload: unknown) => {
    const accounts = Array.isArray(accountsPayload) ? accountsPayload : [];
    const address = typeof accounts[0] === 'string' ? accounts[0] : null;

    try {
      const chainId = await getWalletNetwork();
      onState({
        address,
        chainId,
        connected: !!address && chainId === LITEFORGE_CHAIN_ID,
      });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to read wallet state');
    }
  };

  const handleChainChanged = async (chainIdPayload: unknown) => {
    const chainId = normalizeChainId(chainIdPayload);

    try {
      const address = await getWalletAddress();
      if (chainId !== LITEFORGE_CHAIN_ID && address) {
        onError?.(`Wrong network. Switch wallet network to chain ID ${LITEFORGE_CHAIN_ID}.`);
      }
      onState({
        address,
        chainId,
        connected: !!address && chainId === LITEFORGE_CHAIN_ID,
      });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to read wallet state');
    }
  };

  ethereum.on('accountsChanged', handleAccountsChanged);
  ethereum.on('chainChanged', handleChainChanged);

  return () => {
    ethereum.removeListener('accountsChanged', handleAccountsChanged);
    ethereum.removeListener('chainChanged', handleChainChanged);
  };
};

// Placeholder until token contracts are wired for live reads.
export const getTokenBalance = async (_tokenAddress: string, _walletAddress: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Generate random balance between 0 and 10000
  const balance = (Math.random() * 10000).toFixed(6);
  return balance;
};

export const getSwapQuote = async (
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string
): Promise<SwapQuote> => {
  const amountInNum = parseFloat(amountIn);
  if (isNaN(amountInNum) || amountInNum <= 0) {
    throw new Error('Invalid input amount');
  }

  const ethereum = requireEthereumProvider();
  const provider = new ethers.BrowserProvider(ethereum);
  const contractAddress = getSwapContractAddress();
  const swapContract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, provider);

  const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
  const [amountOutWei, feeWei] = await swapContract.getSwapQuote(tokenIn.address, tokenOut.address, amountInWei) as [bigint, bigint];

  if (amountOutWei <= 0n) {
    throw new Error('No quote available for this pair. Pool may have insufficient liquidity.');
  }

  const [reserveInWei, reserveOutWei] = await swapContract.getReserves(tokenIn.address, tokenOut.address) as [bigint, bigint];

  const amountOut = toDisplayAmount(amountOutWei, tokenOut.decimals);
  const fee = toDisplayAmount(feeWei, tokenIn.decimals);

  let priceImpact = '0.00';
  if (reserveInWei > 0n && reserveOutWei > 0n && amountInNum > 0) {
    const reserveIn = Number.parseFloat(ethers.formatUnits(reserveInWei, tokenIn.decimals));
    const reserveOut = Number.parseFloat(ethers.formatUnits(reserveOutWei, tokenOut.decimals));
    const spotPrice = reserveOut / reserveIn;
    const executionPrice = Number.parseFloat(amountOut) / amountInNum;

    if (Number.isFinite(spotPrice) && spotPrice > 0 && Number.isFinite(executionPrice)) {
      const impact = Math.max(0, ((spotPrice - executionPrice) / spotPrice) * 100);
      priceImpact = impact.toFixed(2);
    }
  }

  const minimumReceivedWei = (amountOutWei * BigInt(10000 - DEFAULT_SLIPPAGE_BPS)) / 10000n;
  const minimumReceived = toDisplayAmount(minimumReceivedWei, tokenOut.decimals);
  
  return {
    amountOut,
    fee,
    priceImpact,
    minimumReceived,
  };
};

export const executeSwap = async (
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  minimumExpectedAmountOut: string
): Promise<{ txHash: string; success: boolean }> => {
  const amountInNum = Number.parseFloat(amountIn);
  if (!Number.isFinite(amountInNum) || amountInNum <= 0) {
    throw new Error('Invalid swap input amount');
  }

  const expectedOutNum = Number.parseFloat(minimumExpectedAmountOut);
  if (!Number.isFinite(expectedOutNum) || expectedOutNum <= 0) {
    throw new Error('Invalid expected output amount');
  }

  const chainId = await getWalletNetwork();
  if (chainId !== LITEFORGE_CHAIN_ID) {
    throw new Error(`Wrong network. Switch wallet network to chain ID ${LITEFORGE_CHAIN_ID}.`);
  }

  const address = await getWalletAddress();
  if (!address) {
    throw new Error('Wallet is not connected');
  }

  const ethereum = requireEthereumProvider();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const contractAddress = getSwapContractAddress();
  const swapContract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, signer);

  const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
  const minimumExpectedOutWei = ethers.parseUnits(minimumExpectedAmountOut, tokenOut.decimals);
  const currentQuote = await swapContract.getSwapQuote(tokenIn.address, tokenOut.address, amountInWei) as [bigint, bigint];
  const currentOutWei = currentQuote[0];

  // The contract does not support minOut in swap(); perform client-side protection pre-broadcast.
  if (currentOutWei < minimumExpectedOutWei) {
    throw new Error('Quote moved below minimum expected output. Refresh quote and try again.');
  }

  const tx = await swapContract.swap(tokenIn.address, tokenOut.address, amountInWei);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error('Swap transaction failed on-chain');
  }

  return {
    txHash: tx.hash,
    success: true,
  };
};

// Format address for display
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Format token amount
export const formatTokenAmount = (amount: string, decimals: number = 6): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  
  return num.toFixed(decimals);
};
