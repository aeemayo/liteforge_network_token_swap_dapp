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
  /** True when the quote was derived from a fixed rate rather than the on-chain AMM */
  isFixedRate: boolean;
}

export type SwapExecutionStatus = 'checking-allowance' | 'approving' | 'swapping';

export type ApprovalStrategy = 'exact' | 'infinite';

interface SwapExecutionOptions {
  onStatusChange?: (status: SwapExecutionStatus) => void;
  approvalStrategy?: ApprovalStrategy;
}

interface WalletAsset {
  type?: string;
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number | string;
  image?: string;
  chainId?: number | string;
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

const LITEFORGE_CHAIN_ID = Number(import.meta.env.VITE_LITEFORGE_CHAIN_ID ?? 4441);

export const SWAP_CONTRACT_ABI = [
  'function getSwapQuote(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256 amountOut, uint256 fee)',
  'function getReserves(address tokenA, address tokenB) view returns (uint256 reserveA, uint256 reserveB)',
  'function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) payable returns (uint256 amountOut)',
  'function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) payable returns (uint256 liquidity)',
  'function getSupportedTokens() view returns (address[])',
  'function supportedTokens(address) view returns (bool)',
  'function addSupportedToken(address token, string symbol)',
  'function owner() view returns (address)',
  'function totalLiquidity(address, address) view returns (uint256)',
  'function fixedRateTokensPerNative(address) view returns (uint256)',
  'event Swap(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee)',
  'event LiquidityAdded(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 liquidity)',
  'event LiquidityRemoved(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 liquidity)',
] as const;

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
] as const;

const FALLBACK_TOKEN_LOGO_URL = '/liteforge-logo.png';
const NATIVE_ZKLTC_PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000001';

const sanitizeLogoUrl = (logoUrl?: string): string => {
  if (!logoUrl) return FALLBACK_TOKEN_LOGO_URL;
  // Only allow same-origin or relative asset paths to avoid remote tracking.
  if (logoUrl.startsWith('/')) return logoUrl;
  return FALLBACK_TOKEN_LOGO_URL;
};

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

const getErrorCode = (error: unknown): unknown => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code?: unknown }).code;
  }

  return undefined;
};

const getErrorReason = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const maybeError = error as { reason?: unknown; message?: unknown };
  if (typeof maybeError.reason === 'string') {
    return maybeError.reason;
  }
  if (typeof maybeError.message === 'string') {
    return maybeError.message;
  }

  return '';
};

export const getSwapContractAddress = (): string => {
  const address = import.meta.env.VITE_SWAP_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error('Missing VITE_SWAP_CONTRACT_ADDRESS. Set it in your .env file.');
  }

  try {
    const checksummed = ethers.getAddress(address);
    if (checksummed === ethers.ZeroAddress) {
      throw new Error('Contract address cannot be zero address.');
    }
    return checksummed;
  } catch {
    throw new Error('Invalid VITE_SWAP_CONTRACT_ADDRESS format.');
  }
};

const getExplorerTxBaseUrl = (): string | null => {
  const baseUrl = import.meta.env.VITE_EXPLORER_TX_URL;
  return baseUrl ? baseUrl.trim() : null;
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

export const switchToLiteforgeNetwork = async (): Promise<void> => {
  const ethereum = requireEthereumProvider();
  const chainIdHex = `0x${LITEFORGE_CHAIN_ID.toString(16)}`;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: unknown) {
    // 4001 is the user rejecting the request. Don't prompt to add if they rejected switching.
    if (getErrorCode(switchError) === 4001) {
      throw new Error('User rejected network switch.');
    }

    // This error code indicates that the chain has not been added to MetaMask (4902),
    // but some wallets might use different structures or internal error codes.
    try {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: 'LitVM LiteForge',
            nativeCurrency: {
              name: 'zkLTC',
              symbol: 'zkLTC',
              decimals: 18,
            },
            rpcUrls: ['https://liteforge.rpc.caldera.xyz/http'],
            blockExplorerUrls: ['https://liteforge.explorer.caldera.xyz'],
          },
        ],
      });
    } catch (addError: unknown) {
      if (getErrorCode(addError) === 4001) {
         throw new Error('User rejected adding the network.');
      }
      throw new Error('Failed to add Liteforge network to wallet.');
    }
  }
};

export const ensureCorrectNetwork = async (): Promise<void> => {
  let chainId = await getWalletNetwork();
  if (chainId !== LITEFORGE_CHAIN_ID) {
    try {
      await switchToLiteforgeNetwork();
      chainId = await getWalletNetwork();
      if (chainId !== LITEFORGE_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to chain ID ${LITEFORGE_CHAIN_ID}.`);
      }
    } catch {
      throw new Error(`Wrong network. Switch to chain ID ${LITEFORGE_CHAIN_ID}.`);
    }
  }
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

export const getExplorerTxUrl = (txHash: string): string | null => {
  const baseUrl = getExplorerTxBaseUrl();
  if (!baseUrl) {
    return null;
  }

  if (baseUrl.includes('{txHash}')) {
    return baseUrl.replace('{txHash}', txHash);
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${txHash}`;
};

export const getTokenMetadata = async (tokenAddress: string, logoUrl?: string): Promise<Token> => {
  const checksummedAddress = ethers.getAddress(tokenAddress);
  if (checksummedAddress === ethers.ZeroAddress) {
    throw new Error('Token address cannot be zero address');
  }

  await ensureCorrectNetwork();

  const ethereum = requireEthereumProvider();
  const provider = new ethers.BrowserProvider(ethereum);
  const tokenContract = new ethers.Contract(checksummedAddress, ERC20_ABI, provider);

  try {
    const [name, symbol, rawDecimals] = await Promise.all([
      tokenContract.name() as Promise<string>,
      tokenContract.symbol() as Promise<string>,
      tokenContract.decimals() as Promise<bigint>,
    ]);

    // ethers v6 returns bigint for uint8 — convert to number
    const decimals = Number(rawDecimals);

    if (!name || !symbol) {
      throw new Error('Invalid ERC-20 metadata: missing name or symbol');
    }

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Invalid token decimals: ' + String(rawDecimals));
    }

    return {
      address: checksummedAddress,
      name,
      symbol,
      decimals,
      logoUrl: sanitizeLogoUrl(logoUrl),
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Invalid')) {
      throw err;
    }
    throw new Error(
      'Unable to read ERC-20 metadata from this address' +
      (err instanceof Error ? ': ' + err.message : '')
    );
  }
};

/**
 * Discover tokens registered on the LiteforgeSwap contract.
 * This is the primary discovery path — it reads the on-chain token list,
 * fetches ERC-20 metadata for each address, and returns them as Token[].
 */
export const discoverContractTokens = async (): Promise<Token[]> => {
  if (!window.ethereum) {
    return [];
  }

  const chainId = await getWalletNetwork();
  if (chainId !== LITEFORGE_CHAIN_ID) {
    return [];
  }

  let contractAddress: string;
  try {
    contractAddress = getSwapContractAddress();
  } catch {
    return [];
  }

  const ethereum = requireEthereumProvider();
  const provider = new ethers.BrowserProvider(ethereum);
  const swapContract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, provider);

  let tokenAddresses: string[];
  try {
    tokenAddresses = (await swapContract.getSupportedTokens()) as string[];
  } catch {
    return [];
  }

  const discoveredTokens: Token[] = [];
  const seen = new Set<string>();

  for (const rawAddress of tokenAddresses) {
    let checksummed: string;
    try {
      checksummed = ethers.getAddress(rawAddress);
    } catch {
      continue;
    }

    // Skip the native zkLTC placeholder — it is already a built-in token
    if (checksummed === ethers.getAddress(NATIVE_ZKLTC_PLACEHOLDER_ADDRESS)) {
      continue;
    }

    const key = checksummed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    try {
      const token = await getTokenMetadata(checksummed);
      discoveredTokens.push(token);
    } catch {
      // Token address didn't return valid ERC-20 metadata — skip it
      continue;
    }
  }

  return discoveredTokens;
};

/**
 * Secondary discovery — reads wallet-tracked assets via the non-standard
 * `wallet_getAssets` RPC. Not all wallets support this, so failures are
 * silently ignored.
 */
const discoverWalletAssets = async (): Promise<Token[]> => {
  if (!window.ethereum) {
    return [];
  }

  const ethereum = requireEthereumProvider();

  let rawAssets: unknown;
  try {
    rawAssets = await ethereum.request({ method: 'wallet_getAssets' });
  } catch {
    return [];
  }

  const assets = Array.isArray(rawAssets)
    ? rawAssets
    : (typeof rawAssets === 'object' && rawAssets !== null && Array.isArray((rawAssets as { assets?: unknown[] }).assets)
      ? (rawAssets as { assets: unknown[] }).assets
      : []);

  const discoveredTokens: Token[] = [];

  for (const item of assets) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const asset = item as WalletAsset;
    const assetType = typeof asset.type === 'string' ? asset.type.toLowerCase() : '';
    if (assetType && assetType !== 'erc20') {
      continue;
    }

    if (typeof asset.address !== 'string' || asset.address.trim().length === 0) {
      continue;
    }

    let checksummedAddress: string;
    try {
      checksummedAddress = ethers.getAddress(asset.address);
    } catch {
      continue;
    }

    if (checksummedAddress === ethers.getAddress(NATIVE_ZKLTC_PLACEHOLDER_ADDRESS)) {
      continue;
    }

    const duplicate = discoveredTokens.some((token) => token.address.toLowerCase() === checksummedAddress.toLowerCase());
    if (duplicate) {
      continue;
    }

    const parsedDecimals = typeof asset.decimals === 'number'
      ? asset.decimals
      : (typeof asset.decimals === 'string' ? Number.parseInt(asset.decimals, 10) : NaN);

    if (
      typeof asset.symbol === 'string' &&
      asset.symbol.length > 0 &&
      Number.isInteger(parsedDecimals) &&
      parsedDecimals >= 0 &&
      parsedDecimals <= 255
    ) {
      discoveredTokens.push({
        address: checksummedAddress,
        symbol: asset.symbol,
        name: typeof asset.name === 'string' && asset.name.length > 0 ? asset.name : asset.symbol,
        decimals: parsedDecimals,
        logoUrl: sanitizeLogoUrl(typeof asset.image === 'string' ? asset.image : undefined),
      });
      continue;
    }

    try {
      const metadataToken = await getTokenMetadata(
        checksummedAddress,
        typeof asset.image === 'string' ? asset.image : undefined
      );
      discoveredTokens.push(metadataToken);
    } catch {
      continue;
    }
  }

  return discoveredTokens;
};

/**
 * Unified token discovery — merges contract-registered tokens (primary)
 * with wallet-tracked assets (secondary). Deduplicates by address.
 */
export const getWalletTrackedTokens = async (): Promise<Token[]> => {
  // Run both discovery strategies in parallel
  const [contractTokens, walletAssets] = await Promise.all([
    discoverContractTokens().catch(() => [] as Token[]),
    discoverWalletAssets().catch(() => [] as Token[]),
  ]);

  // Merge — contract tokens take priority
  const merged: Token[] = [...contractTokens];
  const seen = new Set(contractTokens.map((t) => t.address.toLowerCase()));

  for (const token of walletAssets) {
    const key = token.address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(token);
    }
  }

  return merged;
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

  await ensureCorrectNetwork();
  const chainId = await getWalletNetwork();

  return {
    address: accounts[0],
    chainId,
    connected: !!accounts[0] && chainId === LITEFORGE_CHAIN_ID,
  };
};

export const disconnectWallet = async (): Promise<void> => {
  const ethereum = requireEthereumProvider();

  try {
    await ethereum.request({
      method: 'wallet_revokePermissions',
      params: [{ eth_accounts: {} }],
    });
  } catch (err: unknown) {
    const code = getErrorCode(err);
    if (code === 4001) {
      throw new Error('User rejected wallet disconnect.');
    }

    throw new Error(
      'This wallet does not support app-triggered disconnect. ' +
      'Remove this site from the wallet connected-sites or permissions panel.'
    );
  }

  const remainingAddress = await getWalletAddress();
  if (remainingAddress) {
    throw new Error(
      'Wallet permission could not be revoked. ' +
      'Remove this site from the wallet connected-sites or permissions panel.'
    );
  }
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

export const getTokenBalance = async (
  tokenAddress: string,
  walletAddress: string,
  tokenDecimals: number = 18,
  isNative: boolean = false
): Promise<string> => {
  const ethereum = requireEthereumProvider();
  const provider = new ethers.BrowserProvider(ethereum);

  const normalizedAddress = ethers.getAddress(tokenAddress);
  const isNativeToken = isNative || normalizedAddress === ethers.getAddress(NATIVE_ZKLTC_PLACEHOLDER_ADDRESS);

  if (isNativeToken) {
    const nativeBalanceWei = await provider.getBalance(walletAddress);
    return ethers.formatUnits(nativeBalanceWei, tokenDecimals);
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const balanceWei = await tokenContract.balanceOf(walletAddress) as bigint;
  return ethers.formatUnits(balanceWei, tokenDecimals);
};

export const getSwapQuote = async (
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  slippageBps: number = 50
): Promise<SwapQuote> => {
  const amountInNum = parseFloat(amountIn);
  if (isNaN(amountInNum) || amountInNum <= 0) {
    throw new Error('Invalid input amount');
  }

  // ── On-chain quote from the swap contract ──
  const ethereum = requireEthereumProvider();
  const provider = new ethers.BrowserProvider(ethereum);
  const contractAddress = getSwapContractAddress();

  // Verify contract exists at the configured address
  const code = await provider.getCode(contractAddress);
  if (code === '0x') {
    throw new Error(
      'No contract found at the configured address. ' +
      'Please deploy the updated LiteforgeSwap contract and update VITE_SWAP_CONTRACT_ADDRESS in .env.'
    );
  }

  const swapContract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, provider);

  let amountOutWei: bigint;
  let feeWei: bigint;

  try {
    const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
    [amountOutWei, feeWei] = await swapContract.getSwapQuote(tokenIn.address, tokenOut.address, amountInWei) as [bigint, bigint];
  } catch (err: unknown) {
    const errorObj = err as { code?: string; reason?: string; message?: string };

    if (errorObj.code === 'BAD_DATA') {
      throw new Error(
        'Contract ABI mismatch — the deployed contract may be outdated. ' +
        'Redeploy the updated LiteforgeSwap.sol and update VITE_SWAP_CONTRACT_ADDRESS in .env.'
      );
    }

    if (errorObj.code === 'CALL_EXCEPTION') {
      const reason = errorObj.reason || errorObj.message || '';
      if (reason.includes('Token not supported')) {
        throw new Error(
          'One or both tokens are not supported by the swap contract. ' +
          'Import a supported token via the token selector.'
        );
      }
      throw new Error(reason || 'Contract call failed');
    }

    throw err;
  }

  let reserveInWei = 0n;
  let reserveOutWei = 0n;
  let isFixedRate = false;

  if (tokenIn.isNative || tokenOut.isNative) {
    const fixedRateToken = tokenIn.isNative ? tokenOut.address : tokenIn.address;
    try {
      const fixedRate = await swapContract.fixedRateTokensPerNative(fixedRateToken) as bigint;
      isFixedRate = fixedRate > 0n;
    } catch {
      isFixedRate = false;
    }
  }

  if (amountOutWei <= 0n) {
    if (isFixedRate) {
      throw new Error(
        'No fixed-rate treasury liquidity is available for this pair. ' +
        `Ask the contract owner to fund ${tokenOut.symbol}.`
      );
    }

    throw new Error(
      'No liquidity available for this pair. Add liquidity to the ' +
      `${tokenIn.symbol}/${tokenOut.symbol} pool before swapping.`
    );
  }

  try {
    [reserveInWei, reserveOutWei] = await swapContract.getReserves(tokenIn.address, tokenOut.address) as [bigint, bigint];
  } catch {
    // Non-critical — price impact will just show 0
  }

  const amountOut = toDisplayAmount(amountOutWei, tokenOut.decimals);
  const fee = toDisplayAmount(feeWei, tokenIn.decimals);

  let priceImpact = '0.00';
  if (!isFixedRate && reserveInWei > 0n && reserveOutWei > 0n && amountInNum > 0) {
    const reserveIn = Number.parseFloat(ethers.formatUnits(reserveInWei, tokenIn.decimals));
    const reserveOut = Number.parseFloat(ethers.formatUnits(reserveOutWei, tokenOut.decimals));
    const spotPrice = reserveOut / reserveIn;
    const executionPrice = Number.parseFloat(amountOut) / amountInNum;

    if (Number.isFinite(spotPrice) && spotPrice > 0 && Number.isFinite(executionPrice)) {
      const impact = Math.max(0, ((spotPrice - executionPrice) / spotPrice) * 100);
      priceImpact = impact.toFixed(2);
    }
  }

  const minimumReceivedWei = (amountOutWei * BigInt(10000 - slippageBps)) / 10000n;
  const minimumReceived = toDisplayAmount(minimumReceivedWei, tokenOut.decimals);
  
  return {
    amountOut,
    fee,
    priceImpact,
    minimumReceived,
    isFixedRate,
  };
};

export const executeSwap = async (
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  minimumExpectedAmountOut: string,
  options?: SwapExecutionOptions
): Promise<{ txHash: string; success: boolean }> => {
  const amountInNum = Number.parseFloat(amountIn);
  if (!Number.isFinite(amountInNum) || amountInNum <= 0) {
    throw new Error('Invalid swap input amount');
  }

  const expectedOutNum = Number.parseFloat(minimumExpectedAmountOut);
  if (!Number.isFinite(expectedOutNum) || expectedOutNum <= 0) {
    throw new Error('Invalid expected output amount');
  }

  await ensureCorrectNetwork();

  const address = await getWalletAddress();
  if (!address) {
    throw new Error('Wallet is not connected');
  }

  const ethereum = requireEthereumProvider();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  const contractAddress = getSwapContractAddress();
  const swapContract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, signer);

  // Auto-register tokens on the contract if needed
  await ensureTokensRegistered([tokenIn, tokenOut], signer);

  const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
  const minimumExpectedOutWei = ethers.parseUnits(minimumExpectedAmountOut, tokenOut.decimals);

  const isNativeIn = tokenIn.isNative || tokenIn.address.toLowerCase() === NATIVE_ZKLTC_PLACEHOLDER_ADDRESS.toLowerCase();

  // ERC-20 tokens need allowance check + approval; native tokens skip this
  if (!isNativeIn) {
    options?.onStatusChange?.('checking-allowance');
    const tokenInContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
    const currentAllowance = await tokenInContract.allowance(signerAddress, contractAddress) as bigint;

    if (currentAllowance < amountInWei) {
      options?.onStatusChange?.('approving');
      const approvalStrategy = options?.approvalStrategy ?? 'exact';
      const approvalAmount = approvalStrategy === 'infinite' ? ethers.MaxUint256 : amountInWei;
      const approveTx = await tokenInContract.approve(contractAddress, approvalAmount);
      const approveReceipt = await approveTx.wait();
      if (!approveReceipt || approveReceipt.status !== 1) {
        throw new Error('Approval transaction failed');
      }
    }
  }

  const currentQuote = await swapContract.getSwapQuote(tokenIn.address, tokenOut.address, amountInWei) as [bigint, bigint];
  const currentOutWei = currentQuote[0];

  // Protect users from stale quotes before broadcasting.
  if (currentOutWei < minimumExpectedOutWei) {
    throw new Error('Quote moved below minimum expected output. Refresh quote and try again.');
  }

  options?.onStatusChange?.('swapping');

  // Send msg.value for native token swaps, 0 for ERC-20
  const txOverrides = isNativeIn ? { value: amountInWei } : {};
  const tx = await swapContract.swap(
    tokenIn.address,
    tokenOut.address,
    amountInWei,
    minimumExpectedOutWei,
    txOverrides
  );
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


// ── Auto-registration helper ──

/**
 * Checks whether each token is registered on the swap contract.
 * If the connected wallet is the contract owner, any unregistered tokens
 * are automatically registered before proceeding.
 */
const ensureTokensRegistered = async (
  tokens: Token[],
  signer: ethers.Signer,
): Promise<void> => {
  const contractAddress = getSwapContractAddress();
  const swapContract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, signer);
  const signerAddress = ethers.getAddress(await signer.getAddress());
  let contractOwner: string | null = null;

  for (const token of tokens) {
    // Check if already supported — if the view call fails, assume not supported
    let isSupported = false;
    try {
      isSupported = await swapContract.supportedTokens(token.address) as boolean;
    } catch {
      // View call failed (RPC issue, missing code, etc.) — proceed to try registration
      isSupported = false;
    }
    if (isSupported) continue;

    if (!contractOwner) {
      contractOwner = ethers.getAddress((await swapContract.owner()) as string);
    }

    if (signerAddress !== contractOwner) {
      throw new Error(
        `${token.symbol} is not registered on the swap contract. ` +
        'Ask the contract owner to register this token.'
      );
    }

    // Attempt auto-registration — will revert if the signer is not the owner
    try {
      const tx = await swapContract.addSupportedToken(token.address, token.symbol);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error(`Failed to register ${token.symbol} on the swap contract.`);
      }
    } catch (err: unknown) {
      // If the signer is not the owner, the contract will revert
      const reason = getErrorReason(err);
      if (reason.includes('Only owner')) {
        throw new Error(
          `${token.symbol} is not registered on the swap contract and your wallet is not the contract owner. ` +
          'Ask the contract owner to register this token.'
        );
      }
      // "Token already supported" means it was registered between our check and now — safe to continue
      if (reason.includes('already supported')) {
        continue;
      }
      throw err;
    }
  }
};


// ── Liquidity functions ──

export type LiquidityStatus = 'approving-a' | 'approving-b' | 'adding';

export const executeAddLiquidity = async (
  tokenA: Token,
  tokenB: Token,
  amountA: string,
  amountB: string,
  onStatus?: (status: LiquidityStatus) => void,
  approvalStrategy: ApprovalStrategy = 'exact'
): Promise<{ txHash: string; success: boolean }> => {
  const amountANum = Number.parseFloat(amountA);
  const amountBNum = Number.parseFloat(amountB);
  if (!Number.isFinite(amountANum) || amountANum <= 0) {
    throw new Error('Invalid amount for ' + tokenA.symbol);
  }
  if (!Number.isFinite(amountBNum) || amountBNum <= 0) {
    throw new Error('Invalid amount for ' + tokenB.symbol);
  }

  await ensureCorrectNetwork();

  const ethereum = requireEthereumProvider();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  const contractAddress = getSwapContractAddress();
  const swapContract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, signer);

  // Auto-register tokens on the contract if needed
  await ensureTokensRegistered([tokenA, tokenB], signer);

  const amountAWei = ethers.parseUnits(amountA, tokenA.decimals);
  const amountBWei = ethers.parseUnits(amountB, tokenB.decimals);

  const isNativeA = tokenA.isNative || tokenA.address.toLowerCase() === NATIVE_ZKLTC_PLACEHOLDER_ADDRESS.toLowerCase();
  const isNativeB = tokenB.isNative || tokenB.address.toLowerCase() === NATIVE_ZKLTC_PLACEHOLDER_ADDRESS.toLowerCase();

  // Approve ERC-20 tokens (skip for native)
  if (!isNativeA) {
    onStatus?.('approving-a');
    const tokenAContract = new ethers.Contract(tokenA.address, ERC20_ABI, signer);
    const allowanceA = await tokenAContract.allowance(signerAddress, contractAddress) as bigint;
    if (allowanceA < amountAWei) {
      const approvalAmount = approvalStrategy === 'infinite' ? ethers.MaxUint256 : amountAWei;
      const approveTx = await tokenAContract.approve(contractAddress, approvalAmount);
      const receipt = await approveTx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error(`${tokenA.symbol} approval failed`);
      }
    }
  }

  if (!isNativeB) {
    onStatus?.('approving-b');
    const tokenBContract = new ethers.Contract(tokenB.address, ERC20_ABI, signer);
    const allowanceB = await tokenBContract.allowance(signerAddress, contractAddress) as bigint;
    if (allowanceB < amountBWei) {
      const approvalAmount = approvalStrategy === 'infinite' ? ethers.MaxUint256 : amountBWei;
      const approveTx = await tokenBContract.approve(contractAddress, approvalAmount);
      const receipt = await approveTx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error(`${tokenB.symbol} approval failed`);
      }
    }
  }

  onStatus?.('adding');

  // Send msg.value if one token is native
  let nativeValue = 0n;
  if (isNativeA) nativeValue = amountAWei;
  if (isNativeB) nativeValue = amountBWei;

  const tx = await swapContract.addLiquidity(
    tokenA.address,
    tokenB.address,
    amountAWei,
    amountBWei,
    { value: nativeValue }
  );
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error('Add liquidity transaction failed');
  }

  return { txHash: tx.hash, success: true };
};
