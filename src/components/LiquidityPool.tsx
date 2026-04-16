import React from 'react';
import { Droplets, TrendingUp, Users, DollarSign } from 'lucide-react';

export const LiquidityPool: React.FC = () => {
  const pools = [
    {
      pair: 'ZKLTC/USDC',
      tvl: '$2,450,000',
      volume24h: '$850,000',
      apr: '45.2%',
      liquidity: '1.2M',
    },
    {
      pair: 'LFORGE/WETH',
      tvl: '$1,850,000',
      volume24h: '$620,000',
      apr: '38.5%',
      liquidity: '890K',
    },
    {
      pair: 'ZKLTC/LFORGE',
      tvl: '$1,200,000',
      volume24h: '$420,000',
      apr: '52.8%',
      liquidity: '650K',
    },
  ];

  return (
    <div className="w-full max-w-4xl mt-8">
      <div className="flex items-center gap-3 mb-6">
        <Droplets className="w-6 h-6 text-[#9E7FFF]" />
        <h2 className="text-2xl font-bold text-[#FFFFFF]">Liquidity Pools</h2>
      </div>

      <div className="grid gap-4">
        {pools.map((pool, index) => (
          <div
            key={index}
            className="bg-[#262626] rounded-xl border border-[#2F2F2F] p-6 backdrop-blur-xl bg-opacity-80 hover:border-[#9E7FFF] transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9E7FFF] to-[#38bdf8] border-2 border-[#262626]" />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#38bdf8] to-[#f472b6] border-2 border-[#262626]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#FFFFFF]">{pool.pair}</h3>
                  <p className="text-sm text-[#A3A3A3]">Automated Market Maker</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#10b981]">{pool.apr}</div>
                <div className="text-xs text-[#A3A3A3]">APR</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-[#171717] rounded-lg border border-[#2F2F2F]">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-[#9E7FFF]" />
                  <span className="text-xs text-[#A3A3A3]">TVL</span>
                </div>
                <div className="text-lg font-bold text-[#FFFFFF]">{pool.tvl}</div>
              </div>

              <div className="p-3 bg-[#171717] rounded-lg border border-[#2F2F2F]">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
                  <span className="text-xs text-[#A3A3A3]">24h Volume</span>
                </div>
                <div className="text-lg font-bold text-[#FFFFFF]">{pool.volume24h}</div>
              </div>

              <div className="p-3 bg-[#171717] rounded-lg border border-[#2F2F2F]">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-[#f472b6]" />
                  <span className="text-xs text-[#A3A3A3]">Liquidity</span>
                </div>
                <div className="text-lg font-bold text-[#FFFFFF]">{pool.liquidity}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
