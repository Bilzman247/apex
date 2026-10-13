'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Localize } from '@deriv-com/translations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Footer } from '@/components/custom/footer';
import { Header } from '@/components/custom/header';
import { LoginPromptDialog } from '@/components/custom/login-prompt-dialog';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import { SymbolSelector } from '@/components/custom/symbol-selector';
import { CurrentPriceDisplay } from '@/components/current-price-display';
import { ThemeToggle } from '@/components/custom/theme-toggle';
import { toast } from 'sonner';
import { Bot, Play, Square, Smartphone, ShieldAlert, Activity, Shield } from 'lucide-react';

import type {
  AuthState,
  DerivAccount,
  ActiveSymbol,
  ProposalInfo,
  BuyResult,
  DerivWS,
  Tick,
} from '@deriv/core';
import type { Direction, DurationSelectUnit, DurationOption, OpenPosition } from '../lib/types';
import type { RiseFallAppConfig } from '../lib/app-config';
import { cn } from '@/lib/utils';

const MOBILE_BREAKPOINT = 768;

export interface RiseFallViewProps {
  authState: AuthState;
  accounts: DerivAccount[];
  activeAccount: DerivAccount | null;
  onLogin: () => Promise<void>;
  onSignUp: () => Promise<void>;
  onLogout: () => void;
  onSwitchAccount: (accountId: string) => Promise<void>;

  ws: DerivWS | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  symbols: ActiveSymbol[];
  activeSymbol: ActiveSymbol | null;
  selectSymbol: (symbol: string) => void;
  prices?: number[];
  currentTick?: Tick | null;
  pipSize?: number;

  direction: Direction;
  setDirection: (direction: Direction) => void;
  allowEquals: boolean;
  setAllowEquals: (value: boolean) => void;
  stake: string;
  setStake: (value: string) => void;
  duration: number;
  setDuration: (value: number) => void;
  durationOptions: DurationOption[];
  durationUnit: DurationSelectUnit;
  setDurationUnit: (unit: DurationSelectUnit) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  endTime: string;
  setEndTime: (time: string) => void;
  proposal: ProposalInfo | null;
  buyContract: () => Promise<void>;
  isBuying: boolean;
  buyResult: BuyResult | null;
  buyError: string | null;
  clearBuyResult: () => void;

  openPositions: OpenPosition[];
  sellContract: (contractId: number, bidPrice: string) => Promise<void>;
  sellingId: number | null;

  logoSrc?: string;
  appName?: string;
  showAppName?: boolean;
  appConfig?: RiseFallAppConfig;
  editMode?: boolean;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  rearrangeMode?: boolean;
  onReorder?: (order: RiseFallAppConfig['order']) => void;
}

export function RiseFallView({
  authState,
  accounts,
  activeAccount,
  onLogin,
  onSignUp,
  onLogout,
  onSwitchAccount,
  isConnected,
  error,
  symbols,
  activeSymbol,
  selectSymbol,
  prices = [],
  currentTick = null,
  pipSize = 2,
  direction,
  setDirection,
  stake,
  setStake,
  duration,
  setDuration,
  proposal,
  buyContract,
  isBuying,
  buyResult,
  clearBuyResult,
  logoSrc,
  appName,
  showAppName,
}: RiseFallViewProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean | null>(null);
  const [forceMobile, setForceMobile] = useState(false);

  // Auto Bot Settings State
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botStrategy, setBotStrategy] = useState<'rise' | 'fall' | 'alternate'>('rise');
  const [targetProfit, setTargetProfit] = useState('50');
  const [stopLoss, setStopLoss] = useState('50');
  const [useMartingale, setUseMartingale] = useState(true);
  const [martingaleFactor, setMartingaleFactor] = useState('2');
  const [botLogs, setBotLogs] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'win' | 'loss' }>>([]);
  const [totalBotProfit, setTotalBotProfit] = useState(0);
  const [tradesCount, setTradesCount] = useState({ wins: 0, losses: 0 });

  const currentStakeRef = useRef(stake);
  useEffect(() => {
    currentStakeRef.current = stake;
  }, [stake]);

  // Splash screen timer (6 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  // Mobile-only screen detector
  useEffect(() => {
    const checkWidth = () => {
      setIsMobileScreen(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const addLog = useCallback((text: string, type: 'info' | 'win' | 'loss' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setBotLogs(prev => [{ id: Math.random().toString(), time, text, type }, ...prev.slice(0, 19)]);
  }, []);

  // Auto Bot Trading Loop effect
  useEffect(() => {
    if (!isBotRunning || showSplash) return;

    if (authState !== 'authenticated') {
      setIsBotRunning(false);
      setShowLoginPrompt(true);
      return;
    }

    let active = true;
    const runBotCycle = async () => {
      if (!active || !isBotRunning) return;

      const tp = parseFloat(targetProfit) || 999999;
      const sl = parseFloat(stopLoss) || 999999;
      if (totalBotProfit >= tp) {
        setIsBotRunning(false);
        addLog(`Target Profit of $${tp} reached! Bot stopped.`, 'win');
        toast.success('Target Profit Reached!');
        return;
      }
      if (totalBotProfit <= -sl) {
        setIsBotRunning(false);
        addLog(`Stop Loss of $${sl} hit! Bot stopped.`, 'loss');
        toast.error('Stop Loss Hit!');
        return;
      }

      if (proposal && !isBuying && isConnected) {
        try {
          addLog(`Executing Auto Trade (${direction}) with stake $${stake}...`, 'info');
          await buyContract();
        } catch (err) {
          addLog(`Trade execution error: ${err instanceof Error ? err.message : 'Unknown'}`, 'loss');
        }
      }
    };

    const timer = setTimeout(runBotCycle, 3000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isBotRunning, showSplash, proposal, isBuying, isConnected, authState, totalBotProfit, targetProfit, stopLoss, direction, stake, buyContract, addLog]);

  // Track buy result for bot stats
  useEffect(() => {
    if (buyResult) {
      const profit = buyResult.payout - buyResult.buyPrice;
      const won = profit > 0;
      setTotalBotProfit(prev => prev + profit);
      setTradesCount(prev => ({
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
      }));
      addLog(`Trade resulted in $${profit.toFixed(2)} (${won ? 'WIN' : 'LOSS'})`, won ? 'win' : 'loss');

      if (useMartingale && !won) {
        const currentNum = parseFloat(stake) || 10;
        const factor = parseFloat(martingaleFactor) || 2;
        const nextStake = (currentNum * factor).toFixed(2);
        setStake(nextStake);
        addLog(`Martingale applied: Stake increased to $${nextStake}`, 'info');
      } else if (useMartingale && won) {
        setStake('10');
      }
      clearBuyResult();
    }
  }, [buyResult, useMartingale, martingaleFactor, stake, clearBuyResult, addLog, setStake]);

  // 6-Second Splash Screen
  if (showSplash) {
    const resolvedAppName = appName?.trim() || process.env.NEXT_PUBLIC_DERIV_APP_NAME?.trim() || 'G-squad Bot';
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-6 select-none animate-in fade-in duration-500 max-w-md mx-auto">
        <div className="flex flex-col items-center space-y-6 max-w-xs text-center">
          <div className="w-28 h-28 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center shadow-2xl overflow-hidden p-3">
            {logoSrc ? (
              <img src={logoSrc} alt="App Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-5xl font-extrabold text-primary">G</span>
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight">{resolvedAppName}</h1>
            <p className="text-xs text-muted-foreground font-medium">Advanced Automated Deriv Trading Engine</p>
          </div>
          <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-primary animate-[pulse_1s_infinite]" />
          </div>
          <button
            onClick={() => setShowSplash(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline pt-2"
          >
            Skip Splash
          </button>
        </div>
      </div>
    );
  }

  if (isMobileScreen === null) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isMobileScreen && !forceMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-lg border-border">
          <CardHeader className="space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Smartphone className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl font-bold">Mobile Device Only</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              G-squad Auto Trading Bot is designed and restricted exclusively for mobile smartphone devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-center gap-2 justify-center">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Please open this app on your mobile phone (&lt; 768px width).</span>
            </div>
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setForceMobile(true)}
            >
              Force View in Mobile Mode (Testing)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/50 bg-card shadow-2xl">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span>Connection Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 max-w-md mx-auto w-full border-x border-border/40 shadow-2xl">
      <Header
        authState={authState}
        accounts={accounts}
        activeAccount={activeAccount}
        onLogin={onLogin}
        onSignUp={onSignUp}
        onLogout={onLogout}
        onSwitchAccount={onSwitchAccount}
        logoSrc={logoSrc}
        appName={appName}
        showAppName={showAppName}
        actions={<ThemeToggle />}
      />

      <main className="flex-1 px-4 py-4 space-y-4 pb-20">
        <div className={cn(
          'p-4 rounded-2xl border flex items-center justify-between shadow-lg transition-all',
          isBotRunning ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'bg-card border-border/60'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-bold', isBotRunning ? 'bg-emerald-500 text-white animate-pulse' : 'bg-muted text-muted-foreground')}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auto Bot Status</p>
              <p className="text-base font-bold">{isBotRunning ? 'Running & Trading...' : 'Bot Stopped'}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (!isBotRunning && authState !== 'authenticated') {
                setShowLoginPrompt(true);
                return;
              }
              setIsBotRunning(!isBotRunning);
              addLog(isBotRunning ? 'Bot stopped by user' : 'Bot started successfully', 'info');
            }}
            className={cn(
              'rounded-full px-5 font-bold shadow-md',
              isBotRunning ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            )}
          >
            {isBotRunning ? (
              <span className="flex items-center gap-1.5"><Square className="w-3.5 h-3.5 fill-current" /> Stop</span>
            ) : (
              <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5 fill-current" /> Start Bot</span>
            )}
          </Button>
        </div>

        <Card className="border-border/60 bg-card/80 backdrop-blur-xl rounded-2xl shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Market Asset</span>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive')}>
                {isConnected ? 'Live' : 'Connecting'}
              </span>
            </div>
            <SymbolSelector
              symbols={symbols}
              activeSymbol={activeSymbol}
              onSymbolChange={selectSymbol}
              prices={prices}
              pipSize={pipSize}
            />
            <div className="pt-2 border-t border-border/40">
              <CurrentPriceDisplay
                tick={currentTick}
                prices={prices}
                activeSymbol={activeSymbol}
                pipSize={pipSize}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-card border border-border/60 text-center shadow-sm">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total P/L</p>
            <p className={cn('text-sm font-mono font-bold mt-0.5', totalBotProfit >= 0 ? 'text-emerald-500' : 'text-destructive')}>
              {totalBotProfit >= 0 ? '+' : ''}${totalBotProfit.toFixed(2)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border/60 text-center shadow-sm">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Wins</p>
            <p className="text-sm font-mono font-bold mt-0.5 text-emerald-500">{tradesCount.wins}</p>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border/60 text-center shadow-sm">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Losses</p>
            <p className="text-sm font-mono font-bold mt-0.5 text-destructive">{tradesCount.losses}</p>
          </div>
        </div>

        <Card className="border-border/60 bg-card/90 rounded-2xl shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span>Bot Strategy & Risk Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Trade Direction</Label>
              <Select
                value={botStrategy}
                onValueChange={(v: 'rise' | 'fall' | 'alternate') => {
                  setBotStrategy(v);
                  if (v === 'rise') setDirection('CALL');
                  if (v === 'fall') setDirection('PUT');
                }}
              >
                <SelectTrigger className="h-10 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rise">Always Rise (CALL)</SelectItem>
                  <SelectItem value="fall">Always Fall (PUT)</SelectItem>
                  <SelectItem value="alternate">Smart Alternate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Initial Stake ($)</Label>
                <Input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  min={0.35}
                  step="1"
                  className="h-10 font-mono font-bold bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Duration (Ticks)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setDuration(val);
                  }}
                  min={1}
                  max={10}
                  className="h-10 font-mono font-bold bg-muted/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Target Profit ($)</Label>
                <Input
                  type="number"
                  value={targetProfit}
                  onChange={(e) => setTargetProfit(e.target.value)}
                  className="h-10 font-mono font-bold bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Stop Loss ($)</Label>
                <Input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="h-10 font-mono font-bold bg-muted/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold cursor-pointer">Martingale Recovery</Label>
                <p className="text-[10px] text-muted-foreground">Multiply stake on loss</p>
              </div>
              <Switch
                checked={useMartingale}
                onCheckedChange={setUseMartingale}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card rounded-2xl shadow-sm">
          <CardHeader className="pb-2 border-b border-border/40">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Live Bot Activity Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="h-36 overflow-y-auto space-y-1.5 font-mono text-[11px]">
              {botLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Bot is idle. Tap Start Bot above.</p>
              ) : (
                botLogs.map((log) => (
                  <div key={log.id} className={cn(
                    'p-1.5 rounded flex items-center justify-between',
                    log.type === 'win' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    log.type === 'loss' ? 'bg-destructive/10 text-destructive' : 'bg-muted/40 text-muted-foreground'
                  )}>
                    <span className="truncate pr-2">{log.text}</span>
                    <span className="shrink-0 text-[10px] opacity-70">{log.time}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="mt-auto py-3 text-center border-t border-border/40 bg-card/60 backdrop-blur-sm">
        <Footer />
      </footer>

      <LoginPromptDialog
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        onLogin={onLogin}
        onSignUp={onSignUp}
      />
    </div>
  );
}
