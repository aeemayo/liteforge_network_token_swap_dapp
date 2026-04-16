import React, { useEffect, useState } from 'react';
import { Droplets, TrendingUp, Loader2 } from 'lucide-react';
import { Token } from '../utils/tokens';
import { ethers } from 'ethers';

interface PoolPair {
  tokenA: Token;
  tokenB: Token;
  reserveA: string;
  reserveB: string;
  hasLiquidity: boolean;
}

interface LiquidityPoolProps {
  tokens: Token[];
  connected: boolean;
}

const SWAP_CONTRACT_ABI = [
  'function getReserves(address tokenA, address tokenB) view returns (uint256 reserveA, uint256 reserveB)',
];

const getSwapContractAddress = (): string | null => {
  const address = import.meta.env.VITE_SWAP_CONTRACT_ADDRESS;
  return address || null;
};

export const LiquidityPool: React.FC<LiquidityPoolProps> = ({ tokens, connected }) => {
  const [pools, setPools] = useState<PoolPair[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchReserves = async () => {
      if (!connected || tokens.length < 2 || !window.ethereum) {
        if (active) setPools([]);
        return;
      }

      const contractAddress = getSwapContractAddress();
      if (!contractAddress) {
        if (active) setPools([]);
        return;
      }

      try {
        if (active) setLoading(true);

        const provider = new ethers.BrowserProvider(window.ethereum);

        // Check contract exists
        const code = await provider.getCode(contractAddress);
        if (code === '0x') {
          if (active) setPools([]);
          return;
        }

        const swapContract = new ethers.Contract(contractAddress, SWAP_CONTRACT_ABI, provider);

        // Generate all unique pairs
        const pairs: PoolPair[] = [];
        for (let i = 0; i < tokens.length; i++) {
          for (let j = i + 1; j < tokens.length; j++) {
            const tokenA = tokens[i];
            const tokenB = tokens[j];

            try {
              const [reserveAWei, reserveBWei] = await swapContract.getReserves(
                tokenA.address,
                tokenB.address
              ) as [bigint, bigint];

              const reserveA = Number.parseFloat(
                ethers.formatUnits(reserveAWei, tokenA.decimals)
              );
              const reserveB = Number.parseFloat(
                ethers.formatUnits(reserveBWei, tokenB.decimals)
              );

              pairs.push({
                tokenA,
                tokenB,
                reserveA: reserveA > 0 ? formatPoolAmount(reserveA) : '0',
                reserveB: reserveB > 0 ? formatPoolAmount(reserveB) : '0',
                hasLiquidity: reserveA > 0 && reserveB > 0,
              });
            } catch {
              // Pair might not exist on contract — still show it
              pairs.push({
                tokenA,
                tokenB,
                reserveA: '0',
                reserveB: '0',
                hasLiquidity: false,
              });
            }
          }
        }

        if (active) setPools(pairs);
      } catch {
        if (active) setPools([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchReserves();

    const intervalId = window.setInterval(() => {
      void fetchReserves();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [tokens, connected]);

  if (!connected || tokens.length < 2) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mt-8">
      <div className="flex items-center gap-3 mb-6">
        <Droplets className="w-6 h-6 text-[#9E7FFF]" />
        <h2 className="text-2xl font-bold text-[#FFFFFF]">Liquidity Pools</h2>
        {loading && <Loader2 className="w-4 h-4 text-[#A3A3A3] animate-spin" />}
      </div>

      {pools.length === 0 && !loading && (
        <div className="bg-[#262626] rounded-xl border border-[#2F2F2F] p-8 text-center text-[#A3A3A3]">
          No token pairs available yet.
        </div>
      )}

      <div className="grid gap-4">
        {pools.map((pool) => (
          <div
            key={`${pool.tokenA.address}-${pool.tokenB.address}`}
            className="bg-[#262626] rounded-xl border border-[#2F2F2F] p-6 backdrop-blur-xl bg-opacity-80 hover:border-[#9E7FFF] transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <img
                    src={pool.tokenA.logoUrl}
                    alt={pool.tokenA.symbol}
                    className="w-10 h-10 rounded-full border-2 border-[#262626] bg-[#171717]"
                  />
                  <img
                    src={pool.tokenB.logoUrl}
                    alt={pool.tokenB.symbol}
                    className="w-10 h-10 rounded-full border-2 border-[#262626] bg-[#171717]"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#FFFFFF]">
                    {pool.tokenA.symbol}/{pool.tokenB.symbol}
                  </h3>
                  <p className="text-sm text-[#A3A3A3]">AMM Pool</p>
                </div>
              </div>
              <div className="text-right">
                {pool.hasLiquidity ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#10b981] bg-opacity-10 rounded-full">
                    <div className="w-2 h-2 bg-[#10b981] rounded-full" />
                    <span className="text-sm font-semibold text-[#10b981]">Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#f59e0b] bg-opacity-10 rounded-full">
                    <div className="w-2 h-2 bg-[#f59e0b] rounded-full" />
                    <span className="text-sm font-semibold text-[#f59e0b]">No Liquidity</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[#171717] rounded-lg border border-[#2F2F2F]">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-[#9E7FFF]" />
                  <span className="text-xs text-[#A3A3A3]">{pool.tokenA.symbol} Reserve</span>
                </div>
                <div className="text-lg font-bold text-[#FFFFFF] font-mono">
                  {pool.reserveA}
                </div>
              </div>

              <div className="p-3 bg-[#171717] rounded-lg border border-[#2F2F2F]">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
                  <span className="text-xs text-[#A3A3A3]">{pool.tokenB.symbol} Reserve</span>
                </div>
                <div className="text-lg font-bold text-[#FFFFFF] font-mono">
                  {pool.reserveB}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatPoolAmount(value: number): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  if (value >= 1) {
    return value.toFixed(2);
  }
  return value.toFixed(6);
}
