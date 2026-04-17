import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { SWAP_CONTRACT_ABI, getSwapContractAddress } from '../utils/web3';
import { Token } from '../utils/tokens';

export interface AnalyticsData {
  /** Total on-chain liquidity units (contract's totalLiquidity) */
  totalLiquidity: string;
  /** Sum of all swap amountIn values in the last ~24 h (in native-token units) */
  volume24h: string;
  /** Count of all Swap events ever emitted */
  totalSwaps: number;
  /** Count of Swap events in the last ~24 h */
  swaps24h: number;
  /** Number of active pools (pairs with non-zero reserves) */
  activePools: number;
  /** Total value locked across all pairs expressed in native-token units */
  tvlNative: string;
}

const EMPTY: AnalyticsData = {
  totalLiquidity: '0',
  volume24h: '0',
  totalSwaps: 0,
  swaps24h: 0,
  activePools: 0,
  tvlNative: '0',
};

const NATIVE_PLACEHOLDER = '0x0000000000000000000000000000000000000001';

/** Approximately 24 h worth of blocks (assuming ~2 s block time on Liteforge) */
const BLOCKS_PER_24H = Math.ceil((24 * 60 * 60) / 2);

/** Format a number for display */
export const formatStatValue = (value: number): string => {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(2) + 'K';
  if (value >= 1) return value.toFixed(2);
  if (value > 0) return value.toFixed(4);
  return '0';
};

export const useAnalytics = (
  connected: boolean,
  tokens: Token[],
) => {
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetch = async () => {
      if (!connected || !window.ethereum) {
        if (active) setData(EMPTY);
        return;
      }

      let contractAddress: string;
      try {
        contractAddress = getSwapContractAddress();
      } catch {
        if (active) setData(EMPTY);
        return;
      }

      try {
        if (active) setLoading(true);
        const provider = new ethers.BrowserProvider(window.ethereum);

        // Verify contract exists
        const code = await provider.getCode(contractAddress);
        if (code === '0x') {
          if (active) setData(EMPTY);
          return;
        }

        const contract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, provider);

        // ── 1. Total liquidity from contract state ──
        let totalLiqWei = 0n;
        try {
          totalLiqWei = (await contract.totalLiquidity()) as bigint;
        } catch {
          // Older contract may not have this
        }

        // ── 2. Query Swap events ──
        const latestBlock = await provider.getBlockNumber();
        // All-time swaps (scan from block 0 – on smaller chains this is fine)
        let allSwapEvents: ethers.EventLog[] = [];
        let recentSwapEvents: ethers.EventLog[] = [];

        try {
          const swapFilter = contract.filters.Swap();

          // Fetch all swap events — use chunked fetching for large ranges
          const allLogs = await contract.queryFilter(swapFilter, 0, latestBlock);
          allSwapEvents = allLogs.filter((l): l is ethers.EventLog => l instanceof ethers.EventLog);

          // Recent (last ~24h)
          const fromBlock24h = Math.max(0, latestBlock - BLOCKS_PER_24H);
          recentSwapEvents = allSwapEvents.filter(
            (e) => e.blockNumber >= fromBlock24h,
          );
        } catch {
          // Event query may fail on some RPC providers — gracefully degrade
        }

        // Sum 24h volume (amountIn is arg index 3)
        let volume24hWei = 0n;
        for (const evt of recentSwapEvents) {
          try {
            const amountIn = evt.args[3] as bigint;
            volume24hWei += amountIn;
          } catch {
            // skip malformed event
          }
        }

        // ── 3. Active pools & TVL from reserves ──
        let activePools = 0;
        let tvlNativeWei = 0n;

        if (tokens.length >= 2) {
          for (let i = 0; i < tokens.length; i++) {
            for (let j = i + 1; j < tokens.length; j++) {
              try {
                const [rA, rB] = (await contract.getReserves(
                  tokens[i].address,
                  tokens[j].address,
                )) as [bigint, bigint];

                if (rA > 0n && rB > 0n) {
                  activePools++;

                  // If one side is native, count both sides as value
                  // (the native side = direct value, ERC-20 side ≈ same value by AMM invariant)
                  const isNativeA = tokens[i].address.toLowerCase() === NATIVE_PLACEHOLDER.toLowerCase();
                  const isNativeB = tokens[j].address.toLowerCase() === NATIVE_PLACEHOLDER.toLowerCase();

                  if (isNativeA) {
                    // rA is native, rB is token ≈ rA value, so TVL ≈ 2 × rA
                    tvlNativeWei += rA * 2n;
                  } else if (isNativeB) {
                    tvlNativeWei += rB * 2n;
                  } else {
                    // Both ERC-20 — we don't have a price oracle, just count raw reserves
                    tvlNativeWei += rA + rB;
                  }
                }
              } catch {
                // pair doesn't exist
              }
            }
          }
        }

        if (active) {
          setData({
            totalLiquidity: ethers.formatUnits(totalLiqWei, 18),
            volume24h: ethers.formatUnits(volume24hWei, 18),
            totalSwaps: allSwapEvents.length,
            swaps24h: recentSwapEvents.length,
            activePools,
            tvlNative: ethers.formatUnits(tvlNativeWei, 18),
          });
        }
      } catch {
        if (active) setData(EMPTY);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetch();

    // Refresh every 30 seconds
    const intervalId = window.setInterval(() => void fetch(), 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [connected, tokens]);

  return { analytics: data, analyticsLoading: loading };
};
