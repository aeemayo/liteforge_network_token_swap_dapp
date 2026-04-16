import { useEffect, useMemo, useState } from 'react';
import { Token, LITEFORGE_TOKENS } from '../utils/tokens';
import { getTokenMetadata } from '../utils/web3';

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

export const useTokens = () => {
  const [customTokens, setCustomTokens] = useState<Token[]>([]);
  const [addingToken, setAddingToken] = useState(false);

  useEffect(() => {
    setCustomTokens(parseStoredTokens());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_TOKENS_STORAGE_KEY, JSON.stringify(customTokens));
  }, [customTokens]);

  const availableTokens = useMemo(() => {
    return [...LITEFORGE_TOKENS, ...customTokens];
  }, [customTokens]);

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
    addCustomToken,
    addingToken,
  };
};
