import React from 'react';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { formatAddress } from '../utils/web3';

interface WalletConnectProps {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({
  address,
  connected,
  connecting,
  onConnect,
  onDisconnect,
}) => {
  if (connected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#262626] rounded-xl border border-[#2F2F2F]">
          <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
          <span className="text-sm font-mono text-[#FFFFFF]">{formatAddress(address)}</span>
        </div>
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 px-4 py-2 bg-[#262626] hover:bg-[#2F2F2F] text-[#FFFFFF] rounded-xl border border-[#2F2F2F] transition-all duration-200 hover:scale-105"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Disconnect</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#9E7FFF] to-[#38bdf8] hover:from-[#8B6FE6] hover:to-[#2BA5D9] text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
    >
      {connecting ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <Wallet className="w-5 h-5" />
          <span>Connect Wallet</span>
        </>
      )}
    </button>
  );
};
