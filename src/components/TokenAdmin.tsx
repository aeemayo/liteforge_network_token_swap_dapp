import React, { useEffect, useState } from 'react';
import { Settings, Plus, Loader2, CheckCircle2, AlertCircle, Shield, ArrowRightLeft, X } from 'lucide-react';
import { isContractOwner, isTokenSupported, registerSupportedToken, setFixedRate, getFixedRate } from '../utils/web3';
import { isEthereumAddress, Token } from '../utils/tokens';

interface TokenAdminProps {
  connected: boolean;
  walletAddress: string | null;
  tokens?: Token[];
}

interface TokenRate {
  token: Token;
  rate: string;
  loading: boolean;
}

export const TokenAdmin: React.FC<TokenAdminProps> = ({ connected, walletAddress, tokens = [] }) => {
  const [isOwner, setIsOwner] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [registering, setRegistering] = useState(false);
  const [checking, setChecking] = useState(false);
  const [alreadySupported, setAlreadySupported] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fixed-rate state
  const [rateTab, setRateTab] = useState<'register' | 'rates'>('register');
  const [tokenRates, setTokenRates] = useState<TokenRate[]>([]);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [settingRate, setSettingRate] = useState<string | null>(null);
  const [rateResult, setRateResult] = useState<{ success: boolean; message: string } | null>(null);

  // Check if user is contract owner
  useEffect(() => {
    if (!connected || !walletAddress) {
      setIsOwner(false);
      return;
    }

    let active = true;
    void isContractOwner(walletAddress).then((owner) => {
      if (active) setIsOwner(owner);
    });

    return () => { active = false; };
  }, [connected, walletAddress]);

  // Check if token is already supported when address changes
  useEffect(() => {
    if (!isEthereumAddress(tokenAddress)) {
      setAlreadySupported(null);
      return;
    }

    let active = true;
    setChecking(true);
    void isTokenSupported(tokenAddress.trim()).then((supported) => {
      if (active) {
        setAlreadySupported(supported);
        setChecking(false);
      }
    }).catch(() => {
      if (active) {
        setAlreadySupported(null);
        setChecking(false);
      }
    });

    return () => { active = false; };
  }, [tokenAddress]);

  // Fetch fixed rates for all non-native tokens when rates tab is active
  useEffect(() => {
    if (rateTab !== 'rates' || !isOwner || !connected) return;

    const nonNativeTokens = tokens.filter(t => !t.isNative && t.address.toLowerCase() !== '0x0000000000000000000000000000000000000001');

    let active = true;

    const fetchRates = async () => {
      const rates: TokenRate[] = [];
      for (const token of nonNativeTokens) {
        try {
          const rate = await getFixedRate(token.address);
          if (active) {
            rates.push({ token, rate, loading: false });
          }
        } catch {
          if (active) {
            rates.push({ token, rate: '0', loading: false });
          }
        }
      }
      if (active) {
        setTokenRates(rates);
        // Initialize inputs
        const inputs: Record<string, string> = {};
        for (const r of rates) {
          inputs[r.token.address] = r.rate !== '0' ? r.rate : '';
        }
        setRateInputs(inputs);
      }
    };

    void fetchRates();

    return () => { active = false; };
  }, [rateTab, isOwner, connected, tokens]);

  const handleRegister = async () => {
    if (!isEthereumAddress(tokenAddress) || !tokenSymbol.trim()) return;

    try {
      setRegistering(true);
      setResult(null);
      const res = await registerSupportedToken(tokenAddress.trim(), tokenSymbol.trim());
      setResult({
        success: true,
        message: `Token registered! Tx: ${res.txHash.substring(0, 10)}...`,
      });
      setTokenAddress('');
      setTokenSymbol('');
      setAlreadySupported(null);
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Registration failed',
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleSetRate = async (tokenAddr: string) => {
    const rateValue = rateInputs[tokenAddr] || '0';
    const rateNum = parseFloat(rateValue);

    if (rateValue !== '0' && (isNaN(rateNum) || rateNum < 0)) {
      setRateResult({ success: false, message: 'Invalid rate value' });
      return;
    }

    try {
      setSettingRate(tokenAddr);
      setRateResult(null);
      const res = await setFixedRate(tokenAddr, rateValue || '0');

      // Refresh the rate for this token
      const newRate = await getFixedRate(tokenAddr);
      setTokenRates(prev =>
        prev.map(tr =>
          tr.token.address === tokenAddr ? { ...tr, rate: newRate } : tr
        )
      );

      const tokenEntry = tokenRates.find(tr => tr.token.address === tokenAddr);
      const label = tokenEntry?.token.symbol || tokenAddr.substring(0, 10);

      if (rateValue === '0' || rateValue === '') {
        setRateResult({
          success: true,
          message: `Fixed rate removed for ${label}. AMM pricing restored. Tx: ${res.txHash.substring(0, 10)}...`,
        });
      } else {
        setRateResult({
          success: true,
          message: `Fixed rate set for ${label}: 1 zkLTC = ${rateValue} ${label}. Tx: ${res.txHash.substring(0, 10)}...`,
        });
      }
    } catch (err) {
      setRateResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to set rate',
      });
    } finally {
      setSettingRate(null);
    }
  };

  // Only show to contract owner
  if (!isOwner) return null;

  return (
    <div className="w-full max-w-lg mx-auto mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#262626] hover:bg-[#2F2F2F] rounded-xl border border-[#2F2F2F] transition-all duration-200 text-sm text-[#A3A3A3] hover:text-[#FFFFFF]"
      >
        <Settings className="w-4 h-4" />
        <span>Contract Admin</span>
        <Shield className="w-3 h-3 text-[#9E7FFF]" />
      </button>

      {isOpen && (
        <div className="mt-3 bg-[#262626] rounded-2xl border border-[#2F2F2F] p-5 backdrop-blur-xl bg-opacity-80">
          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 bg-[#171717] rounded-lg p-1">
            <button
              onClick={() => setRateTab('register')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all duration-200 ${
                rateTab === 'register'
                  ? 'bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] text-white'
                  : 'text-[#A3A3A3] hover:text-[#FFFFFF]'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Plus className="w-3 h-3" />
                Register Token
              </span>
            </button>
            <button
              onClick={() => setRateTab('rates')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all duration-200 ${
                rateTab === 'rates'
                  ? 'bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] text-white'
                  : 'text-[#A3A3A3] hover:text-[#FFFFFF]'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3" />
                Fixed Rates
              </span>
            </button>
          </div>

          {/* Register Token Tab */}
          {rateTab === 'register' && (
            <>
              <h3 className="text-sm font-semibold text-[#FFFFFF] mb-1">Register Supported Token</h3>
              <p className="text-xs text-[#A3A3A3] mb-4">
                Add an ERC-20 token to the swap contract so it can be traded.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#A3A3A3] mb-1 block">Token Contract Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-[#171717] text-[#FFFFFF] rounded-lg border border-[#2F2F2F] focus:outline-none focus:border-[#9E7FFF] text-sm font-mono"
                  />
                  {checking && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-[#A3A3A3]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking...
                    </div>
                  )}
                  {alreadySupported === true && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-[#10b981]">
                      <CheckCircle2 className="w-3 h-3" />
                      Already registered
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-[#A3A3A3] mb-1 block">Token Symbol</label>
                  <input
                    type="text"
                    placeholder="e.g. AE"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-[#171717] text-[#FFFFFF] rounded-lg border border-[#2F2F2F] focus:outline-none focus:border-[#9E7FFF] text-sm"
                  />
                </div>

                {result && (
                  <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                    result.success
                      ? 'bg-[#10b981] bg-opacity-10 border-[#10b981] text-[#10b981]'
                      : 'bg-[#ef4444] bg-opacity-10 border-[#ef4444] text-[#ef4444]'
                  }`}>
                    {result.success ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    )}
                    <span className="break-all">{result.message}</span>
                  </div>
                )}

                <button
                  onClick={handleRegister}
                  disabled={
                    !isEthereumAddress(tokenAddress) ||
                    !tokenSymbol.trim() ||
                    registering ||
                    alreadySupported === true
                  }
                  className="w-full py-2.5 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] hover:from-[#8B6FE6] hover:to-[#2BA5D9] text-white rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {registering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Register Token
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Fixed Rates Tab */}
          {rateTab === 'rates' && (
            <>
              <h3 className="text-sm font-semibold text-[#FFFFFF] mb-1">Fixed Exchange Rates</h3>
              <p className="text-xs text-[#A3A3A3] mb-4">
                Set a fixed rate for zkLTC pairs. Enter how many tokens 1 zkLTC should buy. Set to 0 or clear to use AMM pricing.
              </p>

              {tokenRates.length === 0 ? (
                <div className="text-center py-6 text-[#A3A3A3] text-sm">
                  <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No ERC-20 tokens registered yet.</p>
                  <p className="text-xs mt-1">Register a token first to set its rate.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tokenRates.map(({ token, rate }) => (
                    <div
                      key={token.address}
                      className="p-3 bg-[#171717] rounded-xl border border-[#2F2F2F]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={token.logoUrl}
                            alt={token.symbol}
                            className="w-5 h-5 rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/liteforge-logo.png';
                            }}
                          />
                          <span className="text-sm font-semibold text-[#FFFFFF]">{token.symbol}</span>
                          <span className="text-xs text-[#A3A3A3]">/ zkLTC</span>
                        </div>
                        {rate !== '0' ? (
                          <span className="text-xs px-2 py-0.5 bg-[#10b981] bg-opacity-20 text-[#10b981] rounded-full font-medium">
                            Fixed
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-[#A3A3A3] bg-opacity-20 text-[#A3A3A3] rounded-full font-medium">
                            AMM
                          </span>
                        )}
                      </div>

                      {rate !== '0' && (
                        <div className="text-xs text-[#A3A3A3] mb-2">
                          Current: <span className="text-[#10b981] font-mono">1 zkLTC = {parseFloat(rate).toFixed(6)} {token.symbol}</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="e.g. 100"
                            value={rateInputs[token.address] ?? ''}
                            onChange={(e) =>
                              setRateInputs(prev => ({
                                ...prev,
                                [token.address]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 bg-[#262626] text-[#FFFFFF] rounded-lg border border-[#2F2F2F] focus:outline-none focus:border-[#9E7FFF] text-sm font-mono pr-16"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A3A3A3]">
                            {token.symbol}
                          </span>
                        </div>
                        <button
                          onClick={() => handleSetRate(token.address)}
                          disabled={settingRate === token.address}
                          className="px-4 py-2 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] hover:from-[#8B6FE6] hover:to-[#2BA5D9] text-white rounded-lg font-semibold text-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {settingRate === token.address ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Set'
                          )}
                        </button>
                        {rate !== '0' && (
                          <button
                            onClick={() => {
                              setRateInputs(prev => ({ ...prev, [token.address]: '0' }));
                              void handleSetRate(token.address);
                            }}
                            disabled={settingRate === token.address}
                            className="px-2 py-2 bg-[#ef4444] bg-opacity-20 hover:bg-opacity-30 text-[#ef4444] rounded-lg text-xs transition-all duration-200 disabled:opacity-50"
                            title="Remove fixed rate"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {rateResult && (
                    <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                      rateResult.success
                        ? 'bg-[#10b981] bg-opacity-10 border-[#10b981] text-[#10b981]'
                        : 'bg-[#ef4444] bg-opacity-10 border-[#ef4444] text-[#ef4444]'
                    }`}>
                      {rateResult.success ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="break-all">{rateResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
