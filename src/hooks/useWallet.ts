import { useState, useEffect } from 'react';
import {
  connectWallet,
  disconnectWallet,
  getCurrentWalletState,
  subscribeWalletEvents,
  WalletState,
} from '../utils/web3';

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    chainId: null,
    connected: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const syncWallet = async () => {
      try {
        const state = await getCurrentWalletState();
        if (mounted) {
          setWallet(state);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to read wallet state');
        }
      }
    };

    void syncWallet();

    const unsubscribe = subscribeWalletEvents(
      (nextState) => {
        if (mounted) {
          setWallet(nextState);
          if (nextState.connected) {
            setError(null);
          }
        }
      },
      (message) => {
        if (mounted) {
          setError(message);
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

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
      setDisconnecting(true);
      await disconnectWallet();
      setWallet({
        address: null,
        chainId: null,
        connected: false,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect wallet');
    } finally {
      setDisconnecting(false);
    }
  };

  return {
    wallet,
    connecting,
    disconnecting,
    error,
    connect,
    disconnect,
  };
};
