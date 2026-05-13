import React, { useEffect, useState } from 'react';
import { Settings, Plus, Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { isContractOwner, isTokenSupported, registerSupportedToken } from '../utils/web3';
import { isEthereumAddress } from '../utils/tokens';

interface TokenAdminProps {
  connected: boolean;
  walletAddress: string | null;
}

export const TokenAdmin: React.FC<TokenAdminProps> = ({ connected, walletAddress }) => {
  const [isOwner, setIsOwner] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [registering, setRegistering] = useState(false);
  const [checking, setChecking] = useState(false);
  const [alreadySupported, setAlreadySupported] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
        </div>
      )}
    </div>
  );
};
