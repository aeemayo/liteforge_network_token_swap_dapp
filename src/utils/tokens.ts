export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
  balance?: string;
}

export const LITEFORGE_TOKENS: Token[] = [
  {
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'ZKLTC',
    name: 'zkLitecoin',
    decimals: 18,
    logoUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=100&h=100&fit=crop',
  },
  {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'LFORGE',
    name: 'Liteforge Token',
    decimals: 18,
    logoUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=100&h=100&fit=crop',
  },
  {
    address: '0x0000000000000000000000000000000000000003',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoUrl: 'https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=100&h=100&fit=crop',
  },
  {
    address: '0x0000000000000000000000000000000000000004',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    logoUrl: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=100&h=100&fit=crop',
  },
  {
    address: '0x0000000000000000000000000000000000000005',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    logoUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=100&h=100&fit=crop',
  },
];

export const getTokenByAddress = (address: string): Token | undefined => {
  return LITEFORGE_TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase());
};

export const getTokenBySymbol = (symbol: string): Token | undefined => {
  return LITEFORGE_TOKENS.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
};
