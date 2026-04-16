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
    logoUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=100&h=100&fit=crop',
    isNative: true,
  },
];

export const getTokenByAddress = (address: string): Token | undefined => {
  return LITEFORGE_TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase());
};

export const getTokenBySymbol = (symbol: string): Token | undefined => {
  return LITEFORGE_TOKENS.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
};
