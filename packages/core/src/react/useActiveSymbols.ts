'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DerivWS } from '../ws';
import type { ActiveSymbol, ContractsForResponse, ContractInfo, DurationLimits } from '../types';
import { pickDefaultSymbol } from '../utils/pick-default-symbol';

const SYMBOL_PARAM = 'symbol';

function readSymbolFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get(SYMBOL_PARAM) ?? undefined;
}

function writeSymbolToUrl(symbol: string): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.set(SYMBOL_PARAM, symbol);
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, '', next);
}

const INSTANT_FALLBACK_SYMBOLS = [
  { underlying_symbol: '1HZ100V', underlying_symbol_name: 'Volatility 100 (1s) Index', exchange_is_open: 1, submarket: 'random_index', market: 'synthetic_index', pip_size: 2, is_trading_suspended: 0 },
  { underlying_symbol: 'R_10', underlying_symbol_name: 'Volatility 10 Index', exchange_is_open: 1, submarket: 'random_index', market: 'synthetic_index', pip_size: 2, is_trading_suspended: 0 },
  { underlying_symbol: 'R_25', underlying_symbol_name: 'Volatility 25 Index', exchange_is_open: 1, submarket: 'random_index', market: 'synthetic_index', pip_size: 2, is_trading_suspended: 0 },
  { underlying_symbol: 'R_50', underlying_symbol_name: 'Volatility 50 Index', exchange_is_open: 1, submarket: 'random_index', market: 'synthetic_index', pip_size: 2, is_trading_suspended: 0 },
  { underlying_symbol: 'R_75', underlying_symbol_name: 'Volatility 75 Index', exchange_is_open: 1, submarket: 'random_index', market: 'synthetic_index', pip_size: 2, is_trading_suspended: 0 },
  { underlying_symbol: 'R_100', underlying_symbol_name: 'Volatility 100 Index', exchange_is_open: 1, submarket: 'random_index', market: 'synthetic_index', pip_size: 2, is_trading_suspended: 0 },
  { underlying_symbol: 'frxEURUSD', underlying_symbol_name: 'EUR/USD', exchange_is_open: 1, submarket: 'major_pairs', market: 'forex', pip_size: 5, is_trading_suspended: 0 },
] as unknown as ActiveSymbol[];

interface UseActiveSymbolsReturn {
  symbols: ActiveSymbol[];
  activeSymbol: ActiveSymbol | null;
  selectSymbol: (symbol: string) => void;
  contracts: ContractInfo[];
  contractsAvailable: boolean;
  durationLimits: DurationLimits;
  defaultStake: number;
  isLoading: boolean;
}

export function useActiveSymbols(
  ws: DerivWS | null,
  isConnected: boolean,
  contractTypes: string[]
): UseActiveSymbolsReturn {
  const [symbols, setSymbols] = useState<ActiveSymbol[]>(INSTANT_FALLBACK_SYMBOLS);
  const [activeSymbol, setActiveSymbol] = useState<ActiveSymbol | null>(INSTANT_FALLBACK_SYMBOLS[0]);
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [contractsAvailable, setContractsAvailable] = useState(true);
  const [durationLimits, setDurationLimits] = useState<DurationLimits>({ min: 1, max: 10, unit: 't' });
  const [defaultStake, setDefaultStake] = useState<number>(10);

  const loadContractsFor = useCallback(async (wsInstance: DerivWS, symbol: ActiveSymbol) => {
    try {
      const response = await wsInstance.send<ContractsForResponse>({
        contracts_for: symbol.underlying_symbol,
      });

      const filtered = response.contracts_for?.available?.filter(
        (c) => contractTypes.includes(c.contract_type)
      ) ?? [];
      setContracts(filtered);
      setContractsAvailable(filtered.length > 0);

      if (filtered.length > 0) {
        const contract = filtered[0];
        const minMatch = contract.min_contract_duration.match(/^(\d+)/);
        const maxMatch = contract.max_contract_duration.match(/^(\d+)/);
        const unit = contract.min_contract_duration.replace(/^\d+/, '');
        const min = minMatch ? parseInt(minMatch[1], 10) : 1;
        const max = maxMatch ? parseInt(maxMatch[1], 10) : 10;
        setDurationLimits({ min, max, unit });
        setDefaultStake(contract.default_stake);
      }
    } catch {
      // Keep defaults if contracts_for fails
    }
  }, [contractTypes]);

  const selectSymbol = useCallback((underlyingSymbol: string) => {
    const symbol = symbols.find((s) => s.underlying_symbol === underlyingSymbol);
    if (!symbol || symbol.underlying_symbol === activeSymbol?.underlying_symbol) return;

    setActiveSymbol(symbol);
    writeSymbolToUrl(symbol.underlying_symbol);
    if (ws && isConnected) {
      loadContractsFor(ws, symbol).catch(() => {});
    }
  }, [ws, isConnected, symbols, activeSymbol, loadContractsFor]);

  useEffect(() => {
    if (!ws || !isConnected) return;
    let disposed = false;

    async function fetchSymbols() {
      try {
        const response = await ws!.send<{ active_symbols: ActiveSymbol[] }>({
          active_symbols: 'full',
          contract_type: contractTypes,
        });
        if (disposed) return;

        const allSymbols = response.active_symbols;
        if (allSymbols && allSymbols.length > 0) {
          setSymbols(allSymbols);
          const chosen = pickDefaultSymbol(allSymbols, readSymbolFromUrl());
          setActiveSymbol(chosen);
          writeSymbolToUrl(chosen.underlying_symbol);

          await loadContractsFor(ws!, chosen);
        }
      } catch {
        // Fallback to instant symbols if live fetch fails
      }
    }

    fetchSymbols();
    return () => { disposed = true; };
  }, [ws, isConnected, contractTypes, loadContractsFor]);

  return {
    symbols,
    activeSymbol,
    selectSymbol,
    contracts,
    contractsAvailable,
    durationLimits,
    defaultStake,
    isLoading: false,
  };
}
