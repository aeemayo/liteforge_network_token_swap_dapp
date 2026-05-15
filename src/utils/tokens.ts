export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
  balance?: string;
  isNative?: boolean;
}

export const LITEFORGE_TOKENS: Token[] = [
  {
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'zkLTC',
    name: 'zkLitecoin',
    decimals: 18,
    logoUrl: '/liteforge-logo.png',
    isNative: true,
  },
];

export const getTokenByAddress = (address: string): Token | undefined => {
  return LITEFORGE_TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase());
};

export const getTokenBySymbol = (symbol: string): Token | undefined => {
  return LITEFORGE_TOKENS.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
};

// ── Custom (user-imported) tokens persisted in localStorage ──

const CUSTOM_TOKENS_KEY = 'liteforge_custom_tokens';

export const loadCustomTokens = (): Token[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_TOKENS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCustomToken).map(normalizeCustomToken);
  } catch {
    return [];
  }
};

export const saveCustomTokens = (tokens: Token[]): void => {
  try {
    localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // localStorage may be full or disabled — silently ignore
  }
};

export const addCustomToken = (token: Token): Token[] => {
  const existing = loadCustomTokens();
  const duplicate = existing.some(
    (t) => t.address.toLowerCase() === token.address.toLowerCase()
  );
  if (duplicate) return existing;

  const updated = [...existing, token];
  saveCustomTokens(updated);
  return updated;
};

export const isEthereumAddress = (value: string): boolean => {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
};

const isValidCustomToken = (value: unknown): value is Token => {
  if (!value || typeof value !== 'object') return false;
  const token = value as Token;
  if (!isEthereumAddress(token.address)) return false;
  if (typeof token.symbol !== 'string' || token.symbol.trim().length === 0) return false;
  if (typeof token.name !== 'string' || token.name.trim().length === 0) return false;
  if (!Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 255) return false;
  return true;
};

const sanitizeLogoUrl = (logoUrl?: string): string => {
  if (!logoUrl) return '/liteforge-logo.png';
  if (logoUrl.startsWith('/')) return logoUrl;
  return '/liteforge-logo.png';
};

const normalizeCustomToken = (token: Token): Token => ({
  ...token,
  address: token.address.trim(),
  symbol: token.symbol.trim(),
  name: token.name.trim(),
  logoUrl: sanitizeLogoUrl(token.logoUrl),
});
