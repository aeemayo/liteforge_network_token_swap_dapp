import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Token,
  LITEFORGE_TOKENS,
  loadCustomTokens,
  addCustomToken as persistCustomToken,
} from '../utils/tokens';
import { getWalletTrackedTokens } from '../utils/web3';

export const useTokens = (connected: boolean, walletAddress: string | null, chainId: number | null) => {
  const [walletTrackedTokens, setWalletTrackedTokens] = useState<Token[]>([]);
  const [customTokens, setCustomTokens] = useState<Token[]>(loadCustomTokens);
  const [syncing, setSyncing] = useState(false);

  // Immediate sync on wallet connection / account / chain change
  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!connected || !walletAddress || !chainId) {
        if (active) {
          setWalletTrackedTokens([]);
          setSyncing(false);
        }
        return;
      }

      try {
        if (active) setSyncing(true);
        const discovered = await getWalletTrackedTokens();
        if (active) setWalletTrackedTokens(discovered);
      } catch {
        if (active) setWalletTrackedTokens([]);
      } finally {
        if (active) setSyncing(false);
      }
    };

    void run();

    // Keep refreshing every 30 seconds so new contract tokens appear
    const intervalId = window.setInterval(() => {
      void run();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [connected, walletAddress, chainId]);

  const addCustomToken = useCallback((token: Token) => {
    const updated = persistCustomToken(token);
    setCustomTokens(updated);
  }, []);

  const availableTokens = useMemo(() => {
    const merged = [...LITEFORGE_TOKENS, ...customTokens, ...walletTrackedTokens];
    const seen = new Set<string>();

    return merged.filter((token) => {
      const key = token.address.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [walletTrackedTokens, customTokens]);

  return {
    availableTokens,
    walletTrackedTokens,
    customTokens,
    syncing,
    addCustomToken,
  };
};
