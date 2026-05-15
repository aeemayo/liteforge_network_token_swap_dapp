import { useState, useEffect } from 'react';
import { Token } from '../utils/tokens';
import { getSwapQuote, executeSwap, ApprovalStrategy, SwapExecutionStatus, SwapQuote } from '../utils/web3';

export const useSwap = () => {
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapStatus, setSwapStatus] = useState<SwapExecutionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slippageBps, setSlippageBps] = useState<number>(50); // 0.5% default
  const [approvalStrategy, setApprovalStrategy] = useState<ApprovalStrategy>('exact');

  useEffect(() => {
    const fetchQuote = async () => {
      if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
        setQuote(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const swapQuote = await getSwapQuote(tokenIn, tokenOut, amountIn, slippageBps);
        setQuote(swapQuote);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch quote');
        setQuote(null);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [tokenIn, tokenOut, amountIn, slippageBps]);

  const swap = async () => {
    if (!tokenIn || !tokenOut || !amountIn || !quote) {
      throw new Error('Missing swap parameters');
    }

    try {
      setSwapping(true);
      setSwapStatus('checking-allowance');
      setError(null);
      const result = await executeSwap(tokenIn, tokenOut, amountIn, quote.minimumReceived, {
        onStatusChange: setSwapStatus,
        approvalStrategy,
      });
      
      if (!result.success) {
        throw new Error('Transaction failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Swap failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setSwapping(false);
      setSwapStatus(null);
    }
  };

  const switchTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn('');
    setQuote(null);
  };

  return {
    tokenIn,
    tokenOut,
    amountIn,
    quote,
    loading,
    swapping,
    swapStatus,
    error,
    slippageBps,
    approvalStrategy,
    setSlippageBps,
    setApprovalStrategy,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    swap,
    switchTokens,
  };
};
