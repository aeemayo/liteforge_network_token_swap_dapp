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

// Mock wallet connection
export const connectWallet = async (): Promise<WalletState> => {
  // Simulate wallet connection delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    address: '0x' + Math.random().toString(16).substring(2, 42),
    chainId: 1337, // Liteforge network
    connected: true,
  };
};

export const disconnectWallet = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
};

// Mock token balance fetching
export const getTokenBalance = async (tokenAddress: string, walletAddress: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Generate random balance between 0 and 10000
  const balance = (Math.random() * 10000).toFixed(6);
  return balance;
};

// Mock swap quote
export const getSwapQuote = async (
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string
): Promise<SwapQuote> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const amountInNum = parseFloat(amountIn);
  if (isNaN(amountInNum) || amountInNum <= 0) {
    throw new Error('Invalid input amount');
  }
  
  // Simulate price calculation with some randomness
  const rate = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
  const amountOut = (amountInNum * rate).toFixed(6);
  const fee = (amountInNum * 0.003).toFixed(6); // 0.3% fee
  const priceImpact = (Math.random() * 2).toFixed(2); // 0-2% impact
  const minimumReceived = (parseFloat(amountOut) * 0.995).toFixed(6); // 0.5% slippage
  
  return {
    amountOut,
    fee,
    priceImpact,
    minimumReceived,
  };
};

// Mock swap execution
export const executeSwap = async (
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  amountOut: string
): Promise<{ txHash: string; success: boolean }> => {
  // Simulate transaction delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 95% success rate
  const success = Math.random() > 0.05;
  
  return {
    txHash: '0x' + Math.random().toString(16).substring(2, 66),
    success,
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
