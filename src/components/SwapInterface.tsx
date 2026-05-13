import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Loader2, AlertCircle, CheckCircle2, TrendingUp, Zap, Coins, Wallet, Settings, AlertTriangle } from 'lucide-react';
import { TokenSelector } from './TokenSelector';
import { useSwap } from '../hooks/useSwap';
import { formatTokenAmount, getExplorerTxUrl, getTokenBalance } from '../utils/web3';
import { Token } from '../utils/tokens';

type SwapDirection = 'buy' | 'sell';

interface SwapInterfaceProps {
  connected: boolean;
  walletAddress: string | null;
  tokens: Token[];
  onImportToken?: (token: Token) => void;
}

/** Returns the built-in native token (zkLTC) from the token list */
const findNativeToken = (tokens: Token[]): Token | null =>
  tokens.find((t) => t.isNative) ?? null;

export const SwapInterface: React.FC<SwapInterfaceProps> = ({
  connected,
  walletAddress,
  tokens,
  onImportToken,
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
    slippageBps,
    setSlippageBps,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    swap,
    switchTokens,
  } = useSwap();

  const [showSettings, setShowSettings] = useState(false);

  const [txHash, setTxHash] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [tokenInBalance, setTokenInBalance] = useState<string | null>(null);
  const [tokenOutBalance, setTokenOutBalance] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Direction: "buy" = native → token, "sell" = token → native
  const [direction, setDirection] = useState<SwapDirection>('buy');

  const nativeToken = useMemo(() => findNativeToken(tokens), [tokens]);

  // Non-native ERC-20 tokens the user can pick
  const selectableTokens = useMemo(
    () => tokens.filter((t) => !t.isNative),
    [tokens],
  );

  // The "other" token (the non-native side)
  const otherToken = direction === 'buy' ? tokenOut : tokenIn;

  // ── Bootstrap defaults when tokens arrive ──
  useEffect(() => {
    if (!nativeToken) return;

    if (direction === 'buy') {
      // native → token
      if (!tokenIn || tokenIn.address !== nativeToken.address) {
        setTokenIn(nativeToken);
      }
      if (!tokenOut && selectableTokens.length > 0) {
        setTokenOut(selectableTokens[0]);
      }
    } else {
      // token → native
      if (!tokenOut || tokenOut.address !== nativeToken.address) {
        setTokenOut(nativeToken);
      }
      if (!tokenIn && selectableTokens.length > 0) {
        setTokenIn(selectableTokens[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeToken, direction, tokens.length]);

  // ── Fetch balances ──
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
          tokenIn ? getTokenBalance(tokenIn.address, walletAddress, tokenIn.decimals, tokenIn.isNative) : Promise.resolve(null),
          tokenOut ? getTokenBalance(tokenOut.address, walletAddress, tokenOut.decimals, tokenOut.isNative) : Promise.resolve(null),
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

  // ── Handlers ──

  const handleDirectionChange = (newDir: SwapDirection) => {
    if (newDir === direction) return;
    setDirection(newDir);
    // Flip tokens & clear input
    switchTokens();
  };

  /** Called when the user picks a different token on the non-native side */
  const handleOtherTokenChange = (token: Token) => {
    if (direction === 'buy') {
      setTokenOut(token);
    } else {
      setTokenIn(token);
    }
  };

  const handleSwap = async () => {
    try {
      const result = await swap();
      setTxHash(result.txHash);
      setShowSuccess(true);
      setAmountIn('');
      setTimeout(() => setShowSuccess(false), 5000);
    } catch {
      // Error is handled by useSwap hook
    }
  };

  const handleMax = () => {
    if (!tokenInBalance) return;
    // Leave a small gas buffer for native token
    if (tokenIn?.isNative) {
      const maxVal = Math.max(0, parseFloat(tokenInBalance) - 0.005);
      setAmountIn(maxVal > 0 ? maxVal.toFixed(6) : '0');
    } else {
      setAmountIn(tokenInBalance);
    }
  };

  // ── Insufficient balance check ──
  const insufficientBalance = useMemo(() => {
    if (!amountIn || !tokenInBalance) return false;
    const inputVal = parseFloat(amountIn);
    const balVal = parseFloat(tokenInBalance);
    return !isNaN(inputVal) && !isNaN(balVal) && inputVal > balVal;
  }, [amountIn, tokenInBalance]);

  const canSwap = connected && tokenIn && tokenOut && amountIn && quote && !loading && !swapping && !insufficientBalance;
  const explorerUrl = txHash ? getExplorerTxUrl(txHash) : null;

  const pendingLabel = (() => {
    if (swapStatus === 'approving') return 'Approval transaction pending...';
    if (swapStatus === 'swapping') return 'Swap transaction pending...';
    if (swapStatus === 'checking-allowance') return 'Checking token allowance...';
    return 'Preparing transaction...';
  })();

  const directionLabel = direction === 'buy'
    ? `${nativeToken?.symbol ?? 'Native'} → ${otherToken?.symbol ?? 'Token'}`
    : `${otherToken?.symbol ?? 'Token'} → ${nativeToken?.symbol ?? 'Native'}`;

  return (
    <div className="w-full max-w-lg">
      <div className="bg-[#262626] rounded-2xl border border-[#2F2F2F] p-6 backdrop-blur-xl bg-opacity-80">

        {/* ── Direction Tabs ── */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => handleDirectionChange('buy')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
              direction === 'buy'
                ? 'bg-gradient-to-r from-[#9E7FFF]/20 to-[#38bdf8]/20 border border-[#9E7FFF]/40 text-[#FFFFFF] shadow-lg shadow-[#9E7FFF]/10'
                : 'bg-[#171717] border border-[#2F2F2F] text-[#A3A3A3] hover:text-[#FFFFFF] hover:border-[#9E7FFF]/30'
            }`}
          >
            <Coins className="w-4 h-4" />
            Buy Token
          </button>
          <button
            onClick={() => handleDirectionChange('sell')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
              direction === 'sell'
                ? 'bg-gradient-to-r from-[#f472b6]/20 to-[#9E7FFF]/20 border border-[#f472b6]/40 text-[#FFFFFF] shadow-lg shadow-[#f472b6]/10'
                : 'bg-[#171717] border border-[#2F2F2F] text-[#A3A3A3] hover:text-[#FFFFFF] hover:border-[#f472b6]/30'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Sell Token
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 rounded-xl text-[#A3A3A3] hover:text-[#FFFFFF] bg-[#171717] border border-[#2F2F2F] hover:border-[#9E7FFF]/30 transition-all duration-300"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* ── Settings Panel ── */}
        {showSettings && (
          <div className="mb-5 p-4 bg-[#171717] rounded-xl border border-[#2F2F2F] space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#A3A3A3]">Slippage Tolerance</span>
              <span className="text-sm text-[#FFFFFF]">{slippageBps / 100}%</span>
            </div>
            <div className="flex gap-2">
              {[10, 50, 100].map((bps) => (
                <button
                  key={bps}
                  onClick={() => setSlippageBps(bps)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    slippageBps === bps
                      ? 'bg-[#9E7FFF] text-white'
                      : 'bg-[#262626] text-[#A3A3A3] hover:bg-[#333] hover:text-white'
                  }`}
                >
                  {bps / 100}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Direction Badge ── */}
        <div className="flex items-center justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#171717] rounded-full border border-[#2F2F2F] text-xs text-[#A3A3A3]">
            <div className={`w-1.5 h-1.5 rounded-full ${direction === 'buy' ? 'bg-[#9E7FFF]' : 'bg-[#f472b6]'} animate-pulse`} />
            {directionLabel}
          </div>
        </div>

        {/* ── From Token ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#A3A3A3]">
              From
              {tokenIn?.isNative && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#9E7FFF]/20 text-[#9E7FFF] uppercase tracking-wide">
                  Native
                </span>
              )}
              {tokenIn && !tokenIn.isNative && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#38bdf8]/20 text-[#38bdf8] uppercase tracking-wide">
                  ERC-20
                </span>
              )}
            </label>
            {tokenIn && (
              <div className="flex items-center gap-2 text-sm text-[#A3A3A3]">
                <span>
                  Balance: {balancesLoading ? '...' : tokenInBalance ? formatTokenAmount(tokenInBalance, 4) : '0'}
                </span>
                {tokenInBalance && parseFloat(tokenInBalance) > 0 && (
                  <button
                    onClick={handleMax}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#9E7FFF]/20 text-[#9E7FFF] hover:bg-[#9E7FFF]/30 transition-colors uppercase tracking-wide"
                  >
                    Max
                  </button>
                )}
              </div>
            )}
          </div>
          <div className={`flex items-center gap-3 p-4 bg-[#171717] rounded-xl border transition-all duration-200 focus-within:border-[#9E7FFF]/50 ${
            insufficientBalance ? 'border-[#f59e0b]/50' : 'border-[#2F2F2F]'
          }`}>
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              disabled={!connected}
              className={`flex-1 bg-transparent text-2xl outline-none placeholder:text-[#A3A3A3] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                insufficientBalance ? 'text-[#f59e0b]' : 'text-[#FFFFFF]'
              }`}
            />
            {/* Native side is locked, ERC-20 side is selectable */}
            {direction === 'buy' ? (
              /* Buy mode: "From" is native — show locked native display */
              <div className="flex items-center gap-2 px-4 py-3 bg-[#262626] rounded-xl border border-[#2F2F2F] min-w-[160px]">
                {nativeToken && (
                  <>
                    <img src={nativeToken.logoUrl} alt={nativeToken.symbol} className="w-8 h-8 rounded-full ring-2 ring-[#9E7FFF]/30" />
                    <div className="flex-1 text-left">
                      <div className="text-[#FFFFFF] font-semibold">{nativeToken.symbol}</div>
                      <div className="text-xs text-[#A3A3A3]">Native</div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Sell mode: "From" is ERC-20 — show selector */
              <TokenSelector
                selectedToken={tokenIn}
                onSelect={handleOtherTokenChange}
                tokens={selectableTokens}
                excludeToken={tokenOut}
                onImportToken={onImportToken}
              />
            )}
          </div>

          {/* ── Insufficient Balance Inline Warning ── */}
          {insufficientBalance && (
            <div className="flex items-center gap-2 mt-1.5 px-1">
              <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0" />
              <span className="text-xs font-medium text-[#f59e0b]">
                Insufficient {tokenIn?.symbol} balance
              </span>
            </div>
          )}
        </div>

        {/* ── Switch Button ── */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={() => handleDirectionChange(direction === 'buy' ? 'sell' : 'buy')}
            className="group p-3 bg-[#262626] hover:bg-[#2F2F2F] rounded-xl border-4 border-[#171717] transition-all duration-300 hover:scale-110 hover:rotate-180"
          >
            <ArrowDownUp className={`w-5 h-5 transition-colors duration-300 ${direction === 'buy' ? 'text-[#9E7FFF]' : 'text-[#f472b6]'}`} />
          </button>
        </div>

        {/* ── To Token ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#A3A3A3]">
              To
              {tokenOut?.isNative && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#9E7FFF]/20 text-[#9E7FFF] uppercase tracking-wide">
                  Native
                </span>
              )}
              {tokenOut && !tokenOut.isNative && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#38bdf8]/20 text-[#38bdf8] uppercase tracking-wide">
                  ERC-20
                </span>
              )}
            </label>
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
            {direction === 'sell' ? (
              /* Sell mode: "To" is native — show locked native display */
              <div className="flex items-center gap-2 px-4 py-3 bg-[#262626] rounded-xl border border-[#2F2F2F] min-w-[160px]">
                {nativeToken && (
                  <>
                    <img src={nativeToken.logoUrl} alt={nativeToken.symbol} className="w-8 h-8 rounded-full ring-2 ring-[#9E7FFF]/30" />
                    <div className="flex-1 text-left">
                      <div className="text-[#FFFFFF] font-semibold">{nativeToken.symbol}</div>
                      <div className="text-xs text-[#A3A3A3]">Native</div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Buy mode: "To" is ERC-20 — show selector */
              <TokenSelector
                selectedToken={tokenOut}
                onSelect={handleOtherTokenChange}
                tokens={selectableTokens}
                excludeToken={tokenIn}
                onImportToken={onImportToken}
              />
            )}
          </div>
        </div>

        {/* ── Quote Details ── */}
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

        {/* ── Error Message (skip balance-related errors, handled inline) ── */}
        {error && !insufficientBalance && (
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

        {/* ── Success Message ── */}
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

        {/* ── Swap Button ── */}
        <button
          onClick={handleSwap}
          disabled={!canSwap}
          className={`w-full mt-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 text-white ${
            direction === 'buy'
              ? 'bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] hover:from-[#8B6FE6] hover:to-[#2BA5D9]'
              : 'bg-gradient-to-r from-[#f472b6] to-[#9E7FFF] hover:from-[#e060a0] hover:to-[#8B6FE6]'
          }`}
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
          ) : insufficientBalance ? (
            <>
              <AlertTriangle className="w-5 h-5" />
              Insufficient {tokenIn?.symbol} Balance
            </>
          ) : selectableTokens.length === 0 ? (
            'No Registered Tokens'
          ) : (
            <>
              {direction === 'buy' ? (
                <>
                  <Coins className="w-5 h-5" />
                  Buy {tokenOut?.symbol}
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  Sell {tokenIn?.symbol}
                </>
              )}
            </>
          )}
        </button>

        {/* ── No tokens hint ── */}
        {connected && selectableTokens.length === 0 && (
          <p className="mt-3 text-center text-xs text-[#A3A3A3]">
            No ERC-20 tokens registered yet. Use the Contract Admin panel to register tokens.
          </p>
        )}
      </div>
    </div>
  );
};
