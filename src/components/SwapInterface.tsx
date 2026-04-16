import React, { useEffect, useState } from 'react';
import { ArrowDownUp, Loader2, AlertCircle, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
import { TokenSelector } from './TokenSelector';
import { useSwap } from '../hooks/useSwap';
import { formatTokenAmount, getExplorerTxUrl, getTokenBalance } from '../utils/web3';
import { Token } from '../utils/tokens';

interface SwapInterfaceProps {
  connected: boolean;
  walletAddress: string | null;
  tokens: Token[];
  onAddToken: (tokenAddress: string, logoUrl?: string) => Promise<void>;
  addingToken: boolean;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({
  connected,
  walletAddress,
  tokens,
  onAddToken,
  addingToken,
}) => {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    quote,
    loading,
    swapping,
    swapStatus,
    error,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    swap,
    switchTokens,
  } = useSwap();

  const [txHash, setTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [tokenInBalance, setTokenInBalance] = useState<string | null>(null);
  const [tokenOutBalance, setTokenOutBalance] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchBalances = async () => {
      if (!connected || !walletAddress) {
        if (active) {
          setTokenInBalance(null);
          setTokenOutBalance(null);
          setBalancesLoading(false);
        }
        return;
      }

      try {
        setBalancesLoading(true);

        const [nextTokenInBalance, nextTokenOutBalance] = await Promise.all([
          tokenIn ? getTokenBalance(tokenIn.address, walletAddress, tokenIn.decimals) : Promise.resolve(null),
          tokenOut ? getTokenBalance(tokenOut.address, walletAddress, tokenOut.decimals) : Promise.resolve(null),
        ]);

        if (active) {
          setTokenInBalance(nextTokenInBalance);
          setTokenOutBalance(nextTokenOutBalance);
        }
      } catch {
        if (active) {
          setTokenInBalance(null);
          setTokenOutBalance(null);
        }
      } finally {
        if (active) {
          setBalancesLoading(false);
        }
      }
    };

    void fetchBalances();

    return () => {
      active = false;
    };
  }, [connected, walletAddress, tokenIn, tokenOut, showSuccess]);

  useEffect(() => {
    if (!tokenIn && tokens.length > 0) {
      setTokenIn(tokens[0]);
    }
  }, [tokenIn, tokens, setTokenIn]);

  const handleSwap = async () => {
    try {
      const result = await swap();
      setTxHash(result.txHash);
      setShowSuccess(true);
      setAmountIn('');
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      // Error is handled by useSwap hook
    }
  };

  const canSwap = connected && tokenIn && tokenOut && amountIn && quote && !loading && !swapping;
  const explorerUrl = txHash ? getExplorerTxUrl(txHash) : null;

  const pendingLabel = (() => {
    if (swapStatus === 'approving') {
      return 'Approval transaction pending...';
    }
    if (swapStatus === 'swapping') {
      return 'Swap transaction pending...';
    }
    if (swapStatus === 'checking-allowance') {
      return 'Checking token allowance...';
    }
    return 'Preparing transaction...';
  })();

  return (
    <div className="w-full max-w-lg">
      <div className="bg-[#262626] rounded-2xl border border-[#2F2F2F] p-6 backdrop-blur-xl bg-opacity-80">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#A3A3A3]">From</label>
            {tokenIn && (
              <div className="text-sm text-[#A3A3A3]">
                Balance: {balancesLoading ? '...' : tokenInBalance ? formatTokenAmount(tokenInBalance, 4) : '0'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 p-4 bg-[#171717] rounded-xl border border-[#2F2F2F]">
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              disabled={!connected}
              className="flex-1 bg-transparent text-2xl text-[#FFFFFF] outline-none placeholder:text-[#A3A3A3] disabled:opacity-50"
            />
            <TokenSelector
              selectedToken={tokenIn}
              onSelect={setTokenIn}
              tokens={tokens}
              onAddToken={onAddToken}
              addingToken={addingToken}
              excludeToken={tokenOut}
            />
          </div>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={switchTokens}
            disabled={!tokenIn || !tokenOut}
            className="p-3 bg-[#262626] hover:bg-[#2F2F2F] rounded-xl border-4 border-[#171717] transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <ArrowDownUp className="w-5 h-5 text-[#9E7FFF]" />
          </button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#A3A3A3]">To</label>
            {tokenOut && (
              <div className="text-sm text-[#A3A3A3]">
                Balance: {balancesLoading ? '...' : tokenOutBalance ? formatTokenAmount(tokenOutBalance, 4) : '0'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 p-4 bg-[#171717] rounded-xl border border-[#2F2F2F]">
            <input
              type="text"
              placeholder="0.0"
              value={loading ? '...' : quote?.amountOut || ''}
              disabled
              className="flex-1 bg-transparent text-2xl text-[#FFFFFF] outline-none placeholder:text-[#A3A3A3]"
            />
            <TokenSelector
              selectedToken={tokenOut}
              onSelect={setTokenOut}
              tokens={tokens}
              onAddToken={onAddToken}
              addingToken={addingToken}
              excludeToken={tokenIn}
            />
          </div>
        </div>

        {/* Quote Details */}
        {quote && !loading && (
          <div className="mt-4 p-4 bg-[#171717] rounded-xl border border-[#2F2F2F] space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#A3A3A3]">Rate</span>
              <span className="text-[#FFFFFF] font-mono">
                1 {tokenIn?.symbol} = {(parseFloat(quote.amountOut) / parseFloat(amountIn)).toFixed(6)} {tokenOut?.symbol}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#A3A3A3] flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Fee (0.3%)
              </span>
              <span className="text-[#FFFFFF] font-mono">{quote.fee} {tokenIn?.symbol}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#A3A3A3] flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Price Impact
              </span>
              <span className={`font-mono ${parseFloat(quote.priceImpact) > 1 ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>
                {quote.priceImpact}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#A3A3A3]">Minimum Received</span>
              <span className="text-[#FFFFFF] font-mono">{quote.minimumReceived} {tokenOut?.symbol}</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-[#ef4444] bg-opacity-10 border border-[#ef4444] rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#ef4444] flex-shrink-0" />
            <span className="text-sm text-[#ef4444]">{error}</span>
          </div>
        )}

        {swapping && (
          <div className="mt-4 p-4 bg-[#38bdf8] bg-opacity-10 border border-[#38bdf8] rounded-xl flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-[#38bdf8] animate-spin flex-shrink-0" />
            <span className="text-sm text-[#38bdf8]">{pendingLabel}</span>
          </div>
        )}

        {/* Success Message */}
        {showSuccess && txHash && (
          <div className="mt-4 p-4 bg-[#10b981] bg-opacity-10 border border-[#10b981] rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
              <span className="text-sm text-[#10b981] font-semibold">Swap Successful!</span>
            </div>
            <div className="text-xs text-[#A3A3A3] font-mono break-all">
              Tx: {txHash}
            </div>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-xs text-[#10b981] hover:text-[#34d399] underline"
              >
                View transaction on explorer
              </a>
            )}
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!canSwap}
          className="w-full mt-6 py-4 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] hover:from-[#8B6FE6] hover:to-[#2BA5D9] text-white rounded-xl font-semibold text-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {!connected ? (
            'Connect Wallet'
          ) : swapping ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Swapping...
            </>
          ) : !tokenIn || !tokenOut ? (
            'Select Tokens'
          ) : !amountIn ? (
            'Enter Amount'
          ) : (
            'Swap'
          )}
        </button>
      </div>
    </div>
  );
};
