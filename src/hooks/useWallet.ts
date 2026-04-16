import { useState, useEffect } from 'react';
import { connectWallet, disconnectWallet, WalletState } from '../utils/web3';

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    chainId: null,
    connected: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    try {
      setConnecting(true);
      setError(null);
      const walletState = await connectWallet();
      setWallet(walletState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectWallet();
      setWallet({
        address: null,
        chainId: null,
        connected: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect wallet');
    }
  };

  return {
    wallet,
    connecting,
    error,
    connect,
    disconnect,
  };
};
