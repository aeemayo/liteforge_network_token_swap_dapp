import { Zap, Github, Twitter, MessageCircle, TrendingUp, Shield, Droplets, Loader2, CheckCircle } from 'lucide-react';
import { WalletConnect } from './components/WalletConnect';
import { SwapInterface } from './components/SwapInterface';
import { LiquidityPool } from './components/LiquidityPool';
import { AddLiquidity } from './components/AddLiquidity';
import { TokenAdmin } from './components/TokenAdmin';
import { useWallet } from './hooks/useWallet';
import { useTokens } from './hooks/useTokens';

function App() {
  const { wallet, connecting, error, connect, disconnect } = useWallet();
  const { availableTokens, syncing, addCustomToken } = useTokens(
    wallet.connected,
    wallet.address,
    wallet.chainId
  );

  return (
    <div className="min-h-screen bg-[#171717] text-[#FFFFFF] relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#9E7FFF] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#38bdf8] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#f472b6] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-4000" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[#2F2F2F] backdrop-blur-xl bg-[#171717] bg-opacity-80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] rounded-xl blur-lg opacity-50" />
                <div className="relative p-2 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] rounded-xl">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] bg-clip-text text-transparent">
                  Liteforge Swap
                </h1>
                <p className="text-xs text-[#A3A3A3]">Decentralized Exchange</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#swap" className="text-[#FFFFFF] hover:text-[#9E7FFF] transition-colors">
                Swap
              </a>
              <a href="#pools" className="text-[#A3A3A3] hover:text-[#9E7FFF] transition-colors">
                Pools
              </a>
              <a href="#analytics" className="text-[#A3A3A3] hover:text-[#9E7FFF] transition-colors">
                Analytics
              </a>
            </nav>

            <WalletConnect
              address={wallet.address}
              connected={wallet.connected}
              connecting={connecting}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#262626] rounded-full border border-[#2F2F2F] mb-6">
            <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
            <span className="text-sm text-[#A3A3A3]">Liteforge Network • Live</span>
          </div>
          {wallet.connected && syncing && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#262626] rounded-full border border-[#2F2F2F] mb-6 ml-2">
              <Loader2 className="w-3 h-3 text-[#9E7FFF] animate-spin" />
              <span className="text-sm text-[#A3A3A3]">Syncing tokens…</span>
            </div>
          )}
          {wallet.connected && !syncing && availableTokens.length > 1 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#262626] rounded-full border border-[#2F2F2F] mb-6 ml-2">
              <CheckCircle className="w-3 h-3 text-[#10b981]" />
              <span className="text-sm text-[#A3A3A3]">{availableTokens.length} tokens synced</span>
            </div>
          )}
          <h2 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-[#FFFFFF] via-[#9E7FFF] to-[#38bdf8] bg-clip-text text-transparent">
            Trade Tokens Instantly
          </h2>
          <p className="text-xl text-[#A3A3A3] max-w-2xl mx-auto">
            Swap zkLTC to any registered token — or sell tokens back for zkLTC — instantly on Liteforge
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-[#262626] rounded-xl border border-[#2F2F2F] backdrop-blur-xl bg-opacity-80">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-[#10b981]" />
              <span className="text-sm text-[#A3A3A3]">24h Volume</span>
            </div>
            <div className="text-3xl font-bold text-[#FFFFFF]">$4.2M</div>
            <div className="text-sm text-[#10b981] mt-1">+12.5%</div>
          </div>

          <div className="p-6 bg-[#262626] rounded-xl border border-[#2F2F2F] backdrop-blur-xl bg-opacity-80">
            <div className="flex items-center gap-3 mb-2">
              <Droplets className="w-5 h-5 text-[#38bdf8]" />
              <span className="text-sm text-[#A3A3A3]">Total Liquidity</span>
            </div>
            <div className="text-3xl font-bold text-[#FFFFFF]">$5.5M</div>
            <div className="text-sm text-[#10b981] mt-1">+8.3%</div>
          </div>

          <div className="p-6 bg-[#262626] rounded-xl border border-[#2F2F2F] backdrop-blur-xl bg-opacity-80">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-[#9E7FFF]" />
              <span className="text-sm text-[#A3A3A3]">Total Swaps</span>
            </div>
            <div className="text-3xl font-bold text-[#FFFFFF]">12,450</div>
            <div className="text-sm text-[#10b981] mt-1">+24.1%</div>
          </div>
        </div>

        {/* Token Admin (only visible to contract owner) */}
        <div className="flex justify-center mb-4">
          <TokenAdmin
            connected={wallet.connected}
            walletAddress={wallet.address}
          />
        </div>

        {/* Swap Interface */}
        <div id="swap" className="flex justify-center mb-12">
          <SwapInterface
            connected={wallet.connected}
            walletAddress={wallet.address}
            tokens={availableTokens}
            onImportToken={addCustomToken}
          />
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-10 p-4 bg-[#ef4444] bg-opacity-10 border border-[#ef4444] rounded-xl text-sm text-[#ef4444]">
            {error}
          </div>
        )}

        {/* Liquidity Pools */}
        <div id="pools" className="flex flex-col items-center">
          <LiquidityPool tokens={availableTokens} connected={wallet.connected} />
          <AddLiquidity
            tokens={availableTokens}
            connected={wallet.connected}
            walletAddress={wallet.address}
            onImportToken={addCustomToken}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#2F2F2F] mt-20 backdrop-blur-xl bg-[#171717] bg-opacity-80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] rounded-xl">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Liteforge Swap</span>
              </div>
              <p className="text-[#A3A3A3] mb-4">
                The leading decentralized exchange on the Liteforge network. Trade with confidence, earn with liquidity.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="p-2 bg-[#262626] hover:bg-[#2F2F2F] rounded-lg transition-colors">
                  <Twitter className="w-5 h-5 text-[#A3A3A3]" />
                </a>
                <a href="#" className="p-2 bg-[#262626] hover:bg-[#2F2F2F] rounded-lg transition-colors">
                  <Github className="w-5 h-5 text-[#A3A3A3]" />
                </a>
                <a href="#" className="p-2 bg-[#262626] hover:bg-[#2F2F2F] rounded-lg transition-colors">
                  <MessageCircle className="w-5 h-5 text-[#A3A3A3]" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Products</h3>
              <ul className="space-y-2 text-[#A3A3A3]">
                <li><a href="#" className="hover:text-[#9E7FFF] transition-colors">Swap</a></li>
                <li><a href="#" className="hover:text-[#9E7FFF] transition-colors">Liquidity</a></li>
                <li><a href="#" className="hover:text-[#9E7FFF] transition-colors">Analytics</a></li>
                <li><a href="#" className="hover:text-[#9E7FFF] transition-colors">Governance</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-[#A3A3A3]">
                <li><a href="#" className="hover:text-[#9E7FFF] transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-[#9E7FFF] transition-colors">Smart Contracts</a></li>
                <li><a href="#" className="hover:text-[#9E7FFF] transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-[#9E7FFF] transition-colors">Support</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#2F2F2F] mt-8 pt-8 text-center text-[#A3A3A3] text-sm">
            <p>© 2025 Liteforge Swap. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

export default App;
