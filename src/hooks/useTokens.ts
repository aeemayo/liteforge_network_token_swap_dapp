import { useEffect, useMemo, useState } from 'react';
import { Token, LITEFORGE_TOKENS } from '../utils/tokens';
import { getTokenMetadata, getWalletTrackedTokens } from '../utils/web3';

const CUSTOM_TOKENS_STORAGE_KEY = 'liteforge_custom_tokens';

const parseStoredTokens = (): Token[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(CUSTOM_TOKENS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is Token => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const maybe = item as Partial<Token>;
      return (
        typeof maybe.address === 'string' &&
        typeof maybe.symbol === 'string' &&
        typeof maybe.name === 'string' &&
        typeof maybe.decimals === 'number' &&
        typeof maybe.logoUrl === 'string'
      );
    });
  } catch {
    return [];
  }
};

export const useTokens = (connected: boolean, walletAddress: string | null, chainId: number | null) => {
  const [customTokens, setCustomTokens] = useState<Token[]>([]);
  const [walletTrackedTokens, setWalletTrackedTokens] = useState<Token[]>([]);
  const [addingToken, setAddingToken] = useState(false);

  useEffect(() => {
    setCustomTokens(parseStoredTokens());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_TOKENS_STORAGE_KEY, JSON.stringify(customTokens));
  }, [customTokens]);

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

    return () => {
      active = false;
    };
  }, [connected, walletAddress, chainId]);

  const availableTokens = useMemo(() => {
    const merged = [...LITEFORGE_TOKENS, ...walletTrackedTokens, ...customTokens];
    const seen = new Set<string>();

    return merged.filter((token) => {
      const key = token.address.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [customTokens, walletTrackedTokens]);

  const addCustomToken = async (address: string, logoUrl?: string) => {
    const normalizedAddress = address.trim().toLowerCase();
    const duplicate = availableTokens.some((token) => token.address.toLowerCase() === normalizedAddress);
    if (duplicate) {
      throw new Error('Token already exists in your list');
    }

    try {
      setAddingToken(true);
      const token = await getTokenMetadata(address.trim(), logoUrl?.trim());

      setCustomTokens((prev) => {
        const hasDuplicate = prev.some((item) => item.address.toLowerCase() === token.address.toLowerCase());
        if (hasDuplicate) {
          return prev;
        }

        return [...prev, token];
      });
    } finally {
      setAddingToken(false);
    }
  };

  return {
    availableTokens,
    customTokens,
    walletTrackedTokens,
    addCustomToken,
    addingToken,
  };
};
