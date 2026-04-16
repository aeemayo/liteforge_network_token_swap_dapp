import React, { useState } from 'react';
import { Plus, Loader2, CheckCircle2, AlertCircle, Droplets } from 'lucide-react';
import { Token } from '../utils/tokens';
import { executeAddLiquidity, LiquidityStatus, getTokenBalance, formatTokenAmount } from '../utils/web3';
import { TokenSelector } from './TokenSelector';

interface AddLiquidityProps {
  tokens: Token[];
  connected: boolean;
  walletAddress: string | null;
  onImportToken?: (token: Token) => void;
  onSuccess?: () => void;
}

export const AddLiquidity: React.FC<AddLiquidityProps> = ({
  tokens,
  connected,
  walletAddress,
  onImportToken,
  onSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [status, setStatus] = useState<LiquidityStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Balances
  const [balA, setBalA] = useState<string | null>(null);
  const [balB, setBalB] = useState<string | null>(null);

  const refreshBalance = async (token: Token | null, setter: (v: string | null) => void) => {
    if (!token || !walletAddress || !connected) {
      setter(null);
      return;
    }
    try {
      const bal = await getTokenBalance(token.address, walletAddress, token.decimals, token.isNative);
      setter(bal);
    } catch {
      setter(null);
    }
  };

  const handleSelectA = (token: Token) => {
    setTokenA(token);
    void refreshBalance(token, setBalA);
  };

  const handleSelectB = (token: Token) => {
    setTokenB(token);
    void refreshBalance(token, setBalB);
  };

  const handleSubmit = async () => {
    if (!tokenA || !tokenB || !amountA || !amountB) return;

    try {
      setSubmitting(true);
      setResult(null);
      const res = await executeAddLiquidity(tokenA, tokenB, amountA, amountB, setStatus);
      setResult({
        success: true,
        message: `Liquidity added! Tx: ${res.txHash.substring(0, 14)}...`,
      });
      setAmountA('');
      setAmountB('');
      void refreshBalance(tokenA, setBalA);
      void refreshBalance(tokenB, setBalB);
      onSuccess?.();
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to add liquidity',
      });
    } finally {
      setSubmitting(false);
      setStatus(null);
    }
  };

  const statusLabel = (() => {
    if (status === 'approving-a') return `Approving ${tokenA?.symbol}...`;
    if (status === 'approving-b') return `Approving ${tokenB?.symbol}...`;
    if (status === 'adding') return 'Adding liquidity...';
    return 'Processing...';
  })();

  const canSubmit =
    connected &&
    tokenA &&
    tokenB &&
    tokenA.address !== tokenB.address &&
    amountA &&
    amountB &&
    parseFloat(amountA) > 0 &&
    parseFloat(amountB) > 0 &&
    !submitting;

  if (!connected) return null;

  return (
    <div className="w-full max-w-4xl mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] hover:from-[#8B6FE6] hover:to-[#2BA5D9] text-white rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105"
      >
        <Plus className="w-4 h-4" />
        Add Liquidity
      </button>

      {isOpen && (
        <div className="mt-4 bg-[#262626] rounded-2xl border border-[#2F2F2F] p-6 backdrop-blur-xl bg-opacity-80">
          <div className="flex items-center gap-3 mb-4">
            <Droplets className="w-5 h-5 text-[#9E7FFF]" />
            <h3 className="text-lg font-bold text-[#FFFFFF]">Add Liquidity</h3>
          </div>
          <p className="text-sm text-[#A3A3A3] mb-5">
            Deposit equal value of two tokens to create or add to a liquidity pool.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Token A */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#A3A3A3]">Token A</label>
                {tokenA && balA && (
                  <span className="text-xs text-[#A3A3A3]">
                    Balance: {formatTokenAmount(balA, 4)}
                  </span>
                )}
              </div>
              <TokenSelector
                selectedToken={tokenA}
                onSelect={handleSelectA}
                tokens={tokens}
                excludeToken={tokenB}
                onImportToken={onImportToken}
              />
              <input
                type="number"
                placeholder="0.0"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                className="w-full px-4 py-3 bg-[#171717] text-xl text-[#FFFFFF] rounded-xl border border-[#2F2F2F] outline-none focus:border-[#9E7FFF] placeholder:text-[#A3A3A3]"
              />
            </div>

            {/* Token B */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#A3A3A3]">Token B</label>
                {tokenB && balB && (
                  <span className="text-xs text-[#A3A3A3]">
                    Balance: {formatTokenAmount(balB, 4)}
                  </span>
                )}
              </div>
              <TokenSelector
                selectedToken={tokenB}
                onSelect={handleSelectB}
                tokens={tokens}
                excludeToken={tokenA}
                onImportToken={onImportToken}
              />
              <input
                type="number"
                placeholder="0.0"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                className="w-full px-4 py-3 bg-[#171717] text-xl text-[#FFFFFF] rounded-xl border border-[#2F2F2F] outline-none focus:border-[#9E7FFF] placeholder:text-[#A3A3A3]"
              />
            </div>
          </div>

          {/* Status */}
          {submitting && (
            <div className="mb-4 p-3 bg-[#38bdf8] bg-opacity-10 border border-[#38bdf8] rounded-xl flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-[#38bdf8] animate-spin" />
              <span className="text-sm text-[#38bdf8]">{statusLabel}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`mb-4 p-3 rounded-xl border flex items-start gap-2 text-sm ${
              result.success
                ? 'bg-[#10b981] bg-opacity-10 border-[#10b981] text-[#10b981]'
                : 'bg-[#ef4444] bg-opacity-10 border-[#ef4444] text-[#ef4444]'
            }`}>
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span className="break-all">{result.message}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] hover:from-[#8B6FE6] hover:to-[#2BA5D9] text-white rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {statusLabel}
              </>
            ) : tokenA && tokenB && tokenA.address === tokenB.address ? (
              'Select different tokens'
            ) : !tokenA || !tokenB ? (
              'Select both tokens'
            ) : !amountA || !amountB ? (
              'Enter amounts'
            ) : (
              <>
                <Droplets className="w-4 h-4" />
                Add Liquidity
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
