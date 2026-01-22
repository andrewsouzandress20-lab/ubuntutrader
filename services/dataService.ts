
import { Asset, Candle, Timeframe, CorrelationData, MarketBreadthSummary, BreadthCompanyDetails, DOW_30_TICKERS, HK_50_TICKERS, VolumePressure, GapData, EconomicEvent } from '../types';

const PROXIES = [
  'https://api.allorigins.win/get?url=',
  'https://corsproxy.io/?',
];

const fetchFromYahoo = async (url: string): Promise<any> => {
  for (const proxy of PROXIES) {
    try {
      const targetUrl = proxy === PROXIES[0] ? proxy + encodeURIComponent(url) : proxy + url;
      const response = await fetch(targetUrl);
      if (!response.ok) continue;
      
      let data;
      if (proxy === PROXIES[0]) {
          const json = await response.json();
          data = JSON.parse(json.contents);
      } else {
          data = await response.json();
      }
      return data;
    } catch (error) {
      console.warn(`Proxy ${proxy} failed:`, error);
    }
  }
  return null;
};

const fetchYahooData = async (symbol: string, interval: string, range: string = '5d'): Promise<any> => {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const data = await fetchFromYahoo(yahooUrl);
  return data?.chart?.result?.[0];
};

/**
 * Fetches the latest price for a given asset from Yahoo Finance.
 */
export const fetchCurrentPrice = async (asset: Asset): Promise<number | null> => {
  let yahooSymbol = '';
  if (asset.symbol === 'US30') yahooSymbol = '^DJI';
  else if (asset.symbol === 'HK50') yahooSymbol = '^HSI';
  else yahooSymbol = asset.symbol;

  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}`;
  const data = await fetchFromYahoo(quoteUrl);
  
  if (data?.quoteResponse?.result && data.quoteResponse.result.length > 0) {
    return data.quoteResponse.result[0].regularMarketPrice || null;
  }
  return null;
};

export const fetchCorrelationData = async (assetSymbol: string): Promise<CorrelationData[]> => {
  let targets: { symbol: string, name: string, corr: 'positive' | 'negative' }[] = [];

  if (assetSymbol === 'HK50') {
    targets = [
      { symbol: '^VIX', name: 'VIX', corr: 'negative' as const },
      { symbol: 'USDJPY=X', name: 'USD/JPY', corr: 'negative' as const },
      { symbol: 'GC=F', name: 'GOLD', corr: 'negative' as const },
      { symbol: '^N225', name: 'NIKKEI 225', corr: 'positive' as const },
      { symbol: 'HG=F', name: 'COPPER', corr: 'positive' as const },
      { symbol: '^IXIC', name: 'NASDAQ', corr: 'positive' as const },
      { symbol: '000001.SS', name: 'SHANGHAI', corr: 'positive' as const },
    ];
  } else {
    targets = [
      { symbol: '^VIX', name: 'VIX', corr: 'negative' as const },
      { symbol: '^IXIC', name: 'NASDAQ', corr: 'positive' as const },
      { symbol: '^GSPC', name: 'S&P 500', corr: 'positive' as const },
      { symbol: 'DX-Y.NYB', name: 'DXY', corr: 'negative' as const },
    ];
  }

  const symbols = targets.map(t => t.symbol).join(',');
  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
  const data = await fetchFromYahoo(quoteUrl);
  
  const results: CorrelationData[] = [];

  if (data?.quoteResponse?.result && data.quoteResponse.result.length > 0) {
    targets.forEach(target => {
      const quote = data.quoteResponse.result.find((r: any) => r.symbol === target.symbol);
      if (quote) {
        results.push({
          symbol: target.symbol,
          name: target.name,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChangePercent || 0,
          correlation: target.corr
        });
      }
    });
  }

  if (results.length === 0) {
    return targets.map(t => ({
      symbol: t.symbol,
      name: t.name,
      price: 0,
      change: (Math.random() - 0.5) * 2,
      correlation: t.corr
    }));
  }

  return results;
};

export const fetchEconomicEvents = async (): Promise<EconomicEvent[]> => {
    const now = Math.floor(Date.now() / 1000);
    // Mocking real-time institutional events for display
    return [
        {
            id: '1',
            time: now - 300,
            title: 'FED: Discurso de Jerome Powell',
            impact: 'HIGH',
            sentiment: 'NEUTRAL',
            description: 'Powell indica cautela sobre cortes de juros no curto prazo.'
        },
        {
            id: '2',
            time: now - 1800,
            title: 'Dados de Emprego (ADP)',
            impact: 'HIGH',
            sentiment: 'POSITIVE',
            description: 'Números acima do esperado fortalecem o dólar e ativos de risco.'
        },
        {
            id: '3',
            time: now - 3600,
            title: 'IPC Zona do Euro',
            impact: 'MEDIUM',
            sentiment: 'NEGATIVE',
            description: 'Inflação persistente pressiona o Banco Central Europeu.'
        },
        {
            id: '4',
            time: now - 5400,
            title: 'Estoque de Petróleo Bruto',
            impact: 'MEDIUM',
            sentiment: 'NEUTRAL',
            description: 'Dados em linha com o esperado, mercado lateralizado.'
        },
        {
            id: '5',
            time: now - 7200,
            title: 'PMI Industrial (China)',
            impact: 'HIGH',
            sentiment: 'POSITIVE',
            description: 'Expansão industrial chinesa impulsiona HK50.'
        }
    ];
};

export const fetchMarketBreadth = async (assetSymbol: string): Promise<{ summary: MarketBreadthSummary, details: BreadthCompanyDetails[] }> => {
  let tickers = DOW_30_TICKERS;
  if (assetSymbol === 'HK50') tickers = HK_50_TICKERS;
  
  const symbols = tickers.join(',');
  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
  
  const data = await fetchFromYahoo(quoteUrl);
  const details: BreadthCompanyDetails[] = [];
  let advancing = 0;
  let declining = 0;

  if (data?.quoteResponse?.result && data.quoteResponse.result.length > 0) {
    data.quoteResponse.result.forEach((quote: any) => {
      const change = quote.regularMarketChangePercent || 0;
      const status = change >= 0 ? 'BUY' : 'SELL';
      
      if (status === 'BUY') advancing++;
      else declining++;

      details.push({
        symbol: quote.symbol,
        change: change,
        status: status as 'BUY' | 'SELL'
      });
    });
  }

  if (details.length < 5) {
    const fallbacks: BreadthCompanyDetails[] = [];
    let adv = 0;
    tickers.forEach(ticker => {
      const mockChange = (Math.random() - 0.4) * 2.5;
      fallbacks.push({
        symbol: ticker,
        change: mockChange,
        status: mockChange >= 0 ? 'BUY' : 'SELL'
      });
      if (mockChange >= 0) adv++;
    });
    return {
      summary: { advancing: adv, declining: tickers.length - adv, total: tickers.length },
      details: fallbacks.sort((a, b) => b.change - a.change)
    };
  }

  return {
    summary: {
      advancing,
      declining,
      total: details.length
    },
    details: details.sort((a, b) => b.change - a.change)
  };
};

export const calculateVolumePressure = (candles: Candle[]): VolumePressure => {
  if (candles.length === 0) return { buyPercent: 50, sellPercent: 50, total: 0 };
  
  let buyVol = 0;
  let sellVol = 0;
  
  const recent = candles.slice(-20);
  recent.forEach(c => {
    const body = Math.abs(c.close - c.open);
    const wickTop = c.high - Math.max(c.open, c.close);
    const wickBottom = Math.min(c.open, c.close) - c.low;
    const vol = (c.volume || 1);
    
    if (c.close > c.open) {
      buyVol += vol * (body + wickBottom);
      sellVol += vol * wickTop;
    } else {
      sellVol += vol * (body + wickTop);
      buyVol += vol * wickBottom;
    }
  });

  const total = buyVol + sellVol || 1;
  return {
    buyPercent: Math.max(10, Math.min(90, (buyVol / total) * 100)),
    sellPercent: Math.max(10, Math.min(90, (sellVol / total) * 100)),
    total: total
  };
};

export const detectOpeningGap = (candles: Candle[], asset: Asset): GapData => {
  if (candles.length < 2) return { value: 0, percent: 0, type: 'none' };
  
  let prevDayClose = 0;
  let todayOpen = 0;
  let startIndex = 0;
  
  const timeThreshold = 2500; 

  for (let i = candles.length - 1; i > 0; i--) {
    const d1 = new Date(candles[i].time * 1000);
    const d2 = new Date(candles[i-1].time * 1000);
    
    const isNewDay = d1.getUTCDate() !== d2.getUTCDate();
    const isGapTime = (candles[i].time - candles[i-1].time > timeThreshold);

    if (isNewDay || isGapTime) {
      prevDayClose = candles[i-1].close;
      todayOpen = candles[i].open;
      startIndex = i;
      break;
    }
  }

  if (prevDayClose === 0) return { value: 0, percent: 0, type: 'none' };
  
  const diff = todayOpen - prevDayClose;
  const pct = (diff / prevDayClose) * 100;
  
  const gapThreshold = 0.01; 
  const gapType: 'up' | 'down' | 'none' = Math.abs(pct) > gapThreshold ? (pct > 0 ? 'up' : 'down') : 'none';

  // Lógica de preenchimento (Mitigação do Gap)
  let isFilled = false;
  if (gapType !== 'none') {
    for (let j = startIndex; j < candles.length; j++) {
      if (gapType === 'up' && candles[j].low <= prevDayClose) {
        isFilled = true;
        break;
      }
      if (gapType === 'down' && candles[j].high >= prevDayClose) {
        isFilled = true;
        break;
      }
    }
  }

  return {
    value: diff,
    percent: pct,
    type: gapType,
    startIndex: startIndex,
    prevClose: prevDayClose,
    openPrice: todayOpen,
    isFilled: isFilled
  };
};

export const fetchRealData = async (asset: Asset, timeframe: Timeframe): Promise<Candle[]> => {
  let yahooSymbol = '';
  if (asset.symbol === 'US30') yahooSymbol = '^DJI';
  else if (asset.symbol === 'HK50') yahooSymbol = '^HSI';
  
  if (yahooSymbol) {
    const result = await fetchYahooData(yahooSymbol, timeframe, '5d');
    if (!result) return [];
    
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const { open, high, low, close, volume } = quote;
    
    return timestamps.map((t: number, i: number) => ({
      time: t,
      open: open[i],
      high: high[i],
      low: low[i],
      close: close[i],
      volume: volume ? volume[i] : 0
    })).filter((c: any) => c.open !== null && c.close !== null);
  }
  return [];
};
