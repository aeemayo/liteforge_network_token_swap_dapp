import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Token, isEthereumAddress } from '../utils/tokens';
import { getTokenMetadata } from '../utils/web3';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onSelect: (token: Token) => void;
  tokens: Token[];
  excludeToken?: Token | null;
  onImportToken?: (token: Token) => void;
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedToken,
  onSelect,
  tokens,
  excludeToken,
  onImportToken,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Address-based token import state
  const [importCandidate, setImportCandidate] = useState<Token | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const queryIsAddress = isEthereumAddress(searchQuery);

  // Already in the list?
  const addressAlreadyKnown = queryIsAddress
    ? tokens.some((t) => t.address.toLowerCase() === searchQuery.trim().toLowerCase())
    : false;

  // When the search query looks like an address that we don't already have, resolve it
  useEffect(() => {
    if (!queryIsAddress || addressAlreadyKnown) {
      setImportCandidate(null);
      setImportError(null);
      setImportLoading(false);
      return;
    }

    let active = true;
    const resolve = async () => {
      try {
        setImportLoading(true);
        setImportError(null);
        setImportCandidate(null);
        const token = await getTokenMetadata(searchQuery.trim());
        if (active) setImportCandidate(token);
      } catch (err) {
        if (active) setImportError(err instanceof Error ? err.message : 'Could not resolve token');
      } finally {
        if (active) setImportLoading(false);
      }
    };

    const debounce = setTimeout(resolve, 400);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [searchQuery, queryIsAddress, addressAlreadyKnown]);

  const filteredTokens = tokens.filter(
    token =>
      token.address !== excludeToken?.address &&
      (token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.address.toLowerCase() === searchQuery.toLowerCase())
  );

  const handleSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
    setSearchQuery('');
    setImportCandidate(null);
  };

  const handleImport = (token: Token) => {
    onImportToken?.(token);
    handleSelect(token);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 bg-[#262626] hover:bg-[#2F2F2F] rounded-xl border border-[#2F2F2F] transition-all duration-200 min-w-[160px]"
      >
        {selectedToken ? (
          <>
            <div className="relative">
              <img
                src={selectedToken.logoUrl}
                alt={selectedToken.symbol}
                className="w-8 h-8 rounded-full"
              />
              {selectedToken.isNative && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#9E7FFF] rounded-full flex items-center justify-center">
                  <span className="text-[6px] font-bold text-white">N</span>
                </div>
              )}
            </div>
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
          <div className="absolute top-full mt-2 left-0 right-0 bg-[#262626] rounded-xl border border-[#2F2F2F] shadow-2xl z-50 overflow-hidden min-w-[280px]">
            <div className="p-3 border-b border-[#2F2F2F]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]" />
                <input
                  type="text"
                  placeholder="Search or paste token address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#171717] text-[#FFFFFF] rounded-lg border border-[#2F2F2F] focus:outline-none focus:border-[#9E7FFF] text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {/* Import candidate when address pasted */}
              {queryIsAddress && !addressAlreadyKnown && (
                <div className="border-b border-[#2F2F2F]">
                  {importLoading && (
                    <div className="flex items-center gap-3 px-4 py-4 text-[#A3A3A3]">
                      <Loader2 className="w-5 h-5 animate-spin text-[#9E7FFF]" />
                      <span className="text-sm">Looking up token...</span>
                    </div>
                  )}
                  {importError && (
                    <div className="flex items-center gap-3 px-4 py-4 text-[#ef4444]">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{importError}</span>
                    </div>
                  )}
                  {importCandidate && !importLoading && (
                    <button
                      onClick={() => handleImport(importCandidate)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2F2F2F] transition-colors"
                    >
                      <img
                        src={importCandidate.logoUrl}
                        alt={importCandidate.symbol}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="flex-1 text-left">
                        <div className="text-[#FFFFFF] font-semibold">{importCandidate.symbol}</div>
                        <div className="text-sm text-[#A3A3A3]">{importCandidate.name}</div>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] rounded-lg text-xs font-semibold text-white">
                        <Plus className="w-3 h-3" />
                        Import
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Regular token list */}
              {filteredTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleSelect(token)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2F2F2F] transition-colors"
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={token.logoUrl}
                      alt={token.symbol}
                      className="w-10 h-10 rounded-full"
                    />
                    {token.isNative && (
                      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#9E7FFF] rounded-full flex items-center justify-center">
                        <span className="text-[7px] font-bold text-white">N</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[#FFFFFF] font-semibold">{token.symbol}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded tracking-wide uppercase ${
                        token.isNative
                          ? 'bg-[#9E7FFF]/20 text-[#9E7FFF]'
                          : 'bg-[#38bdf8]/20 text-[#38bdf8]'
                      }`}>
                        {token.isNative ? 'Native' : 'ERC-20'}
                      </span>
                    </div>
                    <div className="text-sm text-[#A3A3A3]">{token.name}</div>
                  </div>
                </button>
              ))}
              {filteredTokens.length === 0 && !queryIsAddress && (
                <div className="px-4 py-8 text-center text-[#A3A3A3]">
                  No tokens found
                </div>
              )}
              {filteredTokens.length === 0 && queryIsAddress && !importLoading && !importCandidate && !importError && (
                <div className="px-4 py-8 text-center text-[#A3A3A3] text-sm">
                  Paste a valid ERC-20 contract address to import a token
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
