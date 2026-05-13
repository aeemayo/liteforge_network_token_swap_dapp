/**
 * Fixed-rate exchange registry for all zkLTC pairs.
 *
 * Each entry maps a token address (lowercased) to the number of that token
 * received per 1 zkLTC.  The inverse (selling token → zkLTC) is derived as
 * `1 / rate`.
 *
 * Example:  If TOKEN_A rate is 1000, then:
 *   • Buying:  1 zkLTC → 1 000 TOKEN_A
 *   • Selling: 1 TOKEN_A → 0.001 zkLTC
 *
 * To add a new token, simply add its address + rate here.
 * Rates are maintained off-chain; the smart contract still settles the swap
 * but the frontend enforces the fixed price via `minAmountOut`.
 */

export interface FixedRate {
  /** How many units of the token you get for 1 zkLTC */
  tokensPerZkLTC: number;
}

/**
 * Registry keyed by **lowercased** token address.
 * Populate this with every ERC-20 token that should trade at a fixed rate
 * against zkLTC.
 *
 * NOTE: You can also load these from an API or env vars in the future.
 *       For now we keep them as a simple in-code map so the DApp works
 *       without an external config endpoint.
 */
const FIXED_RATE_REGISTRY: Record<string, FixedRate> = {
  // ──────────────────────────────────────────────────────────────────────
  // Add your token addresses (lowercased) and rates below.
  // Example:
  // '0xabc...def': { tokensPerZkLTC: 500 },
  // ──────────────────────────────────────────────────────────────────────
};

// ── Public helpers ──────────────────────────────────────────────────────

const NATIVE_ZKLTC_PLACEHOLDER = '0x0000000000000000000000000000000000000001';

const isNativeAddress = (addr: string): boolean =>
  addr.toLowerCase() === NATIVE_ZKLTC_PLACEHOLDER.toLowerCase();

/**
 * Look up the fixed rate for a zkLTC ↔ token pair.
 * Returns `null` if no fixed rate is configured for this token.
 */
export const getFixedRateForPair = (
  tokenInAddress: string,
  tokenOutAddress: string,
): FixedRate | null => {
  const inLower = tokenInAddress.toLowerCase();
  const outLower = tokenOutAddress.toLowerCase();

  // One side must be zkLTC native for a fixed rate to apply.
  if (!isNativeAddress(inLower) && !isNativeAddress(outLower)) {
    return null;
  }

  // Determine the ERC-20 side.
  const erc20Address = isNativeAddress(inLower) ? outLower : inLower;
  return FIXED_RATE_REGISTRY[erc20Address] ?? null;
};

/**
 * Check whether this pair has a fixed rate configured.
 */
export const hasFixedRate = (
  tokenInAddress: string,
  tokenOutAddress: string,
): boolean => getFixedRateForPair(tokenInAddress, tokenOutAddress) !== null;

/**
 * Compute the output amount for a fixed-rate zkLTC swap.
 *
 * @param tokenInAddress  Address of the token being sold
 * @param tokenOutAddress Address of the token being bought
 * @param amountIn        Human-readable input amount (e.g. "1.5")
 * @param feeBps          Fee in basis points (default 30 = 0.30%)
 *
 * @returns `{ amountOut, fee }` as human-readable strings, or `null` if
 *          no fixed rate is configured.
 */
export const computeFixedRateQuote = (
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  feeBps: number = 30,
): { amountOut: string; fee: string } | null => {
  const rate = getFixedRateForPair(tokenInAddress, tokenOutAddress);
  if (!rate) return null;

  const inputAmount = parseFloat(amountIn);
  if (!Number.isFinite(inputAmount) || inputAmount <= 0) return null;

  const inLower = tokenInAddress.toLowerCase();
  const isBuying = isNativeAddress(inLower); // zkLTC → Token

  // Deduct fee from input
  const feeAmount = inputAmount * (feeBps / 10_000);
  const netInput = inputAmount - feeAmount;

  let outputAmount: number;

  if (isBuying) {
    // Spending zkLTC → receiving tokens
    outputAmount = netInput * rate.tokensPerZkLTC;
  } else {
    // Selling tokens → receiving zkLTC
    outputAmount = netInput / rate.tokensPerZkLTC;
  }

  return {
    amountOut: outputAmount.toFixed(6),
    fee: feeAmount.toFixed(6),
  };
};

/**
 * Utility: register or update a fixed rate at runtime (e.g. from an admin panel).
 * This only persists in-memory for the current session.
 */
export const setFixedRate = (tokenAddress: string, tokensPerZkLTC: number): void => {
  FIXED_RATE_REGISTRY[tokenAddress.toLowerCase()] = { tokensPerZkLTC };
};

/**
 * Utility: remove a fixed rate at runtime.
 */
export const removeFixedRate = (tokenAddress: string): void => {
  delete FIXED_RATE_REGISTRY[tokenAddress.toLowerCase()];
};

/**
 * Get all currently registered fixed rates.
 */
export const getAllFixedRates = (): ReadonlyMap<string, FixedRate> => {
  return new Map(Object.entries(FIXED_RATE_REGISTRY));
};
