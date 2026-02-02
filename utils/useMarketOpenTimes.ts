import { useEffect, useState } from 'react';

const API_KEY = '94200850ee23473c98c21d8ab76db933';

export interface MarketOpenTime {
  symbol: string;
  name: string;
  opening_time: string;
  timezone: string;
}

async function fetchMarketOpen(symbol: string): Promise<MarketOpenTime | null> {
  try {
    const url = `https://api.twelvedata.com/exchange?symbol=${symbol}&apikey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.opening_time && data.timezone) {
      return {
        symbol,
        name: data.name,
        opening_time: data.opening_time,
        timezone: data.timezone,
      };
    }
    return null;
  } catch (err) {
    return null;
  }
}

export function useMarketOpenTimes() {
  const [nyse, setNyse] = useState<MarketOpenTime | null>(null);
  const [hkex, setHkex] = useState<MarketOpenTime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchMarketOpen('NYSE'),
      fetchMarketOpen('HKEX'),
    ]).then(([nyseData, hkexData]) => {
      setNyse(nyseData);
      setHkex(hkexData);
      setLoading(false);
    });
  }, []);

  return { nyse, hkex, loading };
}
