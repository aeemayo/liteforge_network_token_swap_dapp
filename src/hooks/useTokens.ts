import { useEffect, useMemo, useState } from 'react';
import { Token, LITEFORGE_TOKENS } from '../utils/tokens';
import { getWalletTrackedTokens } from '../utils/web3';

export const useTokens = (connected: boolean, walletAddress: string | null, chainId: number | null) => {
  const [walletTrackedTokens, setWalletTrackedTokens] = useState<Token[]>([]);

  useEffect(() => {
    let active = true;

    const discoverWalletTokens = async () => {
      if (!connected || !walletAddress || !chainId) {
        if (active) {
          setWalletTrackedTokens([]);
        }
        return;
      }

      try {
        const discovered = await getWalletTrackedTokens();
        if (active) {
          setWalletTrackedTokens(discovered);
        }
      } catch {
        if (active) {
          setWalletTrackedTokens([]);
        }
      }
    };

    void discoverWalletTokens();

    const intervalId = window.setInterval(() => {
      void discoverWalletTokens();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [connected, walletAddress, chainId]);

  const availableTokens = useMemo(() => {
    const merged = [...LITEFORGE_TOKENS, ...walletTrackedTokens];
    const seen = new Set<string>();

    return merged.filter((token) => {
      const key = token.address.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [walletTrackedTokens]);

  return {
    availableTokens,
    walletTrackedTokens,
  };
};
