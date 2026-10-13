'use client';

import { useEffect, useState } from 'react';
import { LiveRiseFall } from '../components/live-rise-fall';
import { normalizeAppConfig, type RiseFallAppConfig } from '../lib/app-config';

/**
 * Deployed app. Reads the no-code config injected at deploy time
 * (public/app-config.json). When present, the configurable control styles/order
 * are applied; when absent, the standard Rise/Fall app renders unchanged.
 */
export default function RiseFallPage() {
  const [config, setConfig] = useState<RiseFallAppConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    fetch(`${base}/app-config.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setConfig(normalizeAppConfig(data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <LiveRiseFall appConfig={config ?? undefined} />;
}
