'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { DerivWS } from '../ws';

export interface UseDerivWSOptions {
  url?: string;
  accountId?: string;
}

interface UseDerivWSReturn {
  ws: DerivWS | null;
  isConnected: boolean;
  isExhausted: boolean;
  error: string | null;
}

export function useDerivWS(options?: UseDerivWSOptions): UseDerivWSReturn {
  const { url, accountId } = options ?? {};

  const wsRef = useRef<DerivWS | null>(null);
  const listenersRef = useRef(new Set<() => void>());
  const [isConnected, setIsConnected] = useState(false);
  const [isExhausted, setIsExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const getSnapshot = useCallback(() => wsRef.current, []);

  const isAuthenticated = url !== undefined;
  const reconnectKey = isAuthenticated ? `auth:${accountId ?? 'unknown'}` : 'public';

  useEffect(() => {
    let disposed = false;

    const instance = new DerivWS(url);
    wsRef.current = instance;
    listenersRef.current.forEach((l) => l());

    const unsubscribeState = instance.onConnectionStateChange((connected) => {
      if (!disposed) {
        setIsConnected(connected);
        if (connected) setError(null);
      }
    });

    const unsubscribeExhausted = instance.onReconnectExhausted(() => {
      if (!disposed) setIsExhausted(true);
    });

    instance.connect().catch((err) => {
      if (!disposed) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    });

    const listeners = listenersRef.current;
    return () => {
      disposed = true;
      setIsConnected(false);
      setIsExhausted(false);
      unsubscribeState();
      unsubscribeExhausted();
      instance.disconnect();
      wsRef.current = null;
      listeners.forEach((l) => l());
    };
  }, [reconnectKey]);

  useEffect(() => {
    if (url && wsRef.current) {
      wsRef.current.updateUrl(url);
    }
  }, [url]);

  const ws = useSyncExternalStore(subscribe, getSnapshot, () => null);

  return { ws, isConnected, isExhausted, error };
}
