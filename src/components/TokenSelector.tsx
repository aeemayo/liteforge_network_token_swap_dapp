import React, { useState } from 'react';
import { Search, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { Token } from '../utils/tokens';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onSelect: (token: Token) => void;
  tokens: Token[];
  onAddToken: (tokenAddress: string, logoUrl?: string) => Promise<void>;
  addingToken: boolean;
  excludeToken?: Token | null;
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedToken,
  onSelect,
  tokens,
  onAddToken,
  addingToken,
  excludeToken,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [tokenAddressInput, setTokenAddressInput] = useState('');
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [addTokenError, setAddTokenError] = useState<string | null>(null);

  const filteredTokens = tokens.filter(
    token =>
      token.address !== excludeToken?.address &&
      (token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleAddToken = async () => {
    if (!tokenAddressInput.trim()) {
      setAddTokenError('Token address is required');
      return;
    }

    try {
      setAddTokenError(null);
      await onAddToken(tokenAddressInput.trim(), logoUrlInput.trim());
      setTokenAddressInput('');
      setLogoUrlInput('');
      setShowAddForm(false);
      setSearchQuery('');
    } catch (err) {
      setAddTokenError(err instanceof Error ? err.message : 'Failed to add token');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 bg-[#262626] hover:bg-[#2F2F2F] rounded-xl border border-[#2F2F2F] transition-all duration-200 min-w-[160px]"
      >
        {selectedToken ? (
          <>
            <img
              src={selectedToken.logoUrl}
              alt={selectedToken.symbol}
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 text-left">
              <div className="text-[#FFFFFF] font-semibold">{selectedToken.symbol}</div>
              <div className="text-xs text-[#A3A3A3]">{selectedToken.name}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 text-[#A3A3A3]">Select token</div>
        )}
        <ChevronDown className={`w-5 h-5 text-[#A3A3A3] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 left-0 right-0 bg-[#262626] rounded-xl border border-[#2F2F2F] shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-[#2F2F2F]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]" />
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#171717] text-[#FFFFFF] rounded-lg border border-[#2F2F2F] focus:outline-none focus:border-[#9E7FFF]"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {filteredTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleSelect(token)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2F2F2F] transition-colors"
                >
                  <img
                    src={token.logoUrl}
                    alt={token.symbol}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 text-left">
                    <div className="text-[#FFFFFF] font-semibold">{token.symbol}</div>
                    <div className="text-sm text-[#A3A3A3]">{token.name}</div>
                  </div>
                </button>
              ))}
              {filteredTokens.length === 0 && (
                <div className="px-4 py-8 text-center text-[#A3A3A3]">
                  No tokens found
                </div>
              )}
            </div>

            <div className="border-t border-[#2F2F2F] p-3 space-y-3">
              <button
                onClick={() => {
                  setShowAddForm((prev) => !prev);
                  setAddTokenError(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#171717] hover:bg-[#1f1f1f] rounded-lg border border-[#2F2F2F] text-sm text-[#A3A3A3]"
              >
                <Plus className="w-4 h-4" />
                Add token by address
              </button>

              {showAddForm && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tokenAddressInput}
                    onChange={(e) => setTokenAddressInput(e.target.value)}
                    placeholder="Token contract address"
                    className="w-full px-3 py-2 bg-[#171717] text-[#FFFFFF] rounded-lg border border-[#2F2F2F] focus:outline-none focus:border-[#9E7FFF]"
                  />
                  <input
                    type="text"
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                    placeholder="Logo URL (optional)"
                    className="w-full px-3 py-2 bg-[#171717] text-[#FFFFFF] rounded-lg border border-[#2F2F2F] focus:outline-none focus:border-[#9E7FFF]"
                  />

                  {addTokenError && <p className="text-xs text-[#ef4444]">{addTokenError}</p>}

                  <button
                    onClick={handleAddToken}
                    disabled={addingToken}
                    className="w-full px-3 py-2 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {addingToken ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding token...
                      </>
                    ) : (
                      'Add Token'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
