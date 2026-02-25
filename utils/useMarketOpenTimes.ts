import { useEffect, useState } from 'react';

export interface MarketOpenTime {
  symbol: string;
  name: string;
  opening_time: string;
  timezone: string;
}

/**
 * Usa apenas o JSON local versionado (public/market_open_times.json)
 * para evitar expor chaves de API no bundle.
 */
async function fetchLocalOpenTimes(): Promise<Record<string, MarketOpenTime>> {
  const res = await fetch('/market_open_times.json');
  if (!res.ok) throw new Error('Falha ao carregar horários locais');
  return res.json();
}

export function useMarketOpenTimes() {
  const [nyse, setNyse] = useState<MarketOpenTime | null>(null);
  const [hkex, setHkex] = useState<MarketOpenTime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLocalOpenTimes()
      .then(data => {
        setNyse(data.NYSE || null);
        setHkex(data.HKEX || null);
      })
      .catch(() => {
        setNyse(null);
        setHkex(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { nyse, hkex, loading };
}
