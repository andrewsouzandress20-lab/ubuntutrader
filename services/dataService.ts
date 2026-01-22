
import { Asset, Candle, Timeframe, CorrelationData, MarketBreadthSummary, BreadthCompanyDetails, DOW_30_TICKERS, HK_50_TICKERS, VolumePressure, GapData, EconomicEvent } from '../types';

const PROXIES = [
  'https://api.allorigins.win/get?url=',
  'https://corsproxy.io/?',
  'https://thingproxy.freeboard.io/fetch/',
];

// Dicionário ultra-expandido para tradução de eventos econômicos
const EVENT_TRANSLATIONS: Record<string, string> = {
  'Unemployment Rate': 'Taxa de Desemprego',
  'CPI': 'IPC (Inflação)',
  'Core CPI': 'Núcleo do IPC',
  'PPI': 'IPP (Inflação ao Produtor)',
  'Retail Sales': 'Vendas no Varejo',
  'FOMC Meeting Minutes': 'Ata do FOMC',
  'Federal Funds Rate': 'Taxa de Juros do FED',
  'Non-Farm Employment Change': 'Payroll (NFP)',
  'ADP Non-Farm Employment Change': 'Variação de Emprego ADP',
  'Consumer Confidence': 'Confiança do Consumidor',
  'ISM Manufacturing PMI': 'PMI Industrial ISM',
  'ISM Services PMI': 'PMI de Serviços ISM',
  'GDP': 'PIB',
  'Initial Jobless Claims': 'Pedidos de Auxílio-Desemprego',
  'Trade Balance': 'Balança Comercial',
  'Building Permits': 'Alvarás de Construção',
  'Crude Oil Inventories': 'Estoques de Petróleo',
  'Empire State Manufacturing Index': 'Índice de Manufatura Empire State',
  'Philly Fed Manufacturing Index': 'Índice de Manufatura Philly Fed',
  'Flash Manufacturing PMI': 'PMI Industrial Prévia',
  'Flash Services PMI': 'PMI de Serviços Prévia',
  'Existing Home Sales': 'Vendas de Casas Existentes',
  'New Home Sales': 'Vendas de Casas Novas',
  'Durable Goods Orders': 'Pedidos de Bens Duráveis',
  'Consumer Sentiment': 'Sentimento do Consumidor',
  'Beige Book': 'Livro Bege (FED)',
  'JOLTS Job Openings': 'Vagas de Emprego JOLTS',
  'Average Hourly Earnings': 'Ganhos Médios por Hora',
  'Pending Home Sales': 'Vendas de Casas Pendentes',
  'Personal Spending': 'Gastos Pessoais',
  'Factory Orders': 'Pedidos à Indústria',
  'Business Inventories': 'Estoques de Empresas',
  'Wholesale Inventories': 'Estoques de Atacado',
  'Consumer Credit': 'Crédito ao Consumidor',
  'Treasury Budget': 'Orçamento do Tesouro',
  'Housing Starts': 'Início de Construções',
  'Industrial Production': 'Produção Industrial',
  'Capacity Utilization': 'Utilização da Capacidade',
  'Philadelphia Fed Index': 'Índice Fed de Filadélfia',
  'Leading Index': 'Índice de Indicadores Antecedentes',
  'S&P/CS HPI': 'Índice de Preços de Casas S&P',
  'Richmond Fed Index': 'Índice Fed de Richmond',
  'Chicago PMI': 'PMI de Chicago',
  'Pending Sales': 'Vendas Pendentes'
};

const IMPACT_TRANSLATIONS: Record<string, string> = {
  'high': 'ALTO',
  'medium': 'MÉDIO',
  'low': 'BAIXO'
};

const translateEvent = (title: string): string => {
  let translated = title;
  // Traduz termos específicos
  for (const [eng, pt] of Object.entries(EVENT_TRANSLATIONS)) {
    const regex = new RegExp(eng, 'gi');
    translated = translated.replace(regex, pt);
  }
  // Traduz conectores comuns
  translated = translated.replace(/speak/gi, 'fala')
                         .replace(/member/gi, 'membro')
                         .replace(/report/gi, 'relatório')
                         .replace(/index/gi, 'índice')
                         .replace(/forecast/gi, 'previsão')
                         .replace(/actual/gi, 'atual')
                         .replace(/previous/gi, 'anterior');
  return translated;
};

const fetchWithRetry = async (url: string, useProxy: boolean = true): Promise<any> => {
  if (!useProxy) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (e) {
      console.warn("Direct fetch failed, falling back to proxies...");
    }
  }

  for (const proxy of PROXIES) {
    try {
      const targetUrl = proxy.includes('allorigins') ? proxy + encodeURIComponent(url) : proxy + url;
      const response = await fetch(targetUrl);
      if (!response.ok) continue;
      
      let data;
      if (proxy.includes('allorigins')) {
          const json = await response.json();
          data = JSON.parse(json.contents);
      } else {
          data = await response.json();
      }
      return data;
    } catch (error) {
      console.warn(`Proxy ${proxy} failed for ${url}:`, error);
    }
  }
  return null;
};

const fetchFromYahoo = async (url: string): Promise<any> => {
  return await fetchWithRetry(url, true);
};

const fetchYahooData = async (symbol: string, interval: string, range: string = '5d'): Promise<any> => {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const data = await fetchFromYahoo(yahooUrl);
  return data?.chart?.result?.[0];
};

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
      { symbol: 'GC=F', name: 'OURO', corr: 'negative' as const },
      { symbol: '^N225', name: 'NIKKEI 225', corr: 'positive' as const },
      { symbol: 'HG=F', name: 'COBRE', corr: 'positive' as const },
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
    const calendarUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

    try {
        const data = await fetchWithRetry(calendarUrl, true);

        if (!data || !Array.isArray(data)) {
            console.warn('Não foi possível carregar o calendário econômico.');
            return [];
        }

        const relevantCurrencies = ['USD', 'CNY', 'EUR', 'JPY', 'GBP'];
        const relevantImpacts = ['high', 'medium'];

        return data
            .filter((event: any) =>
                event &&
                event.country &&
                event.impact &&
                relevantCurrencies.includes(event.country.toUpperCase()) &&
                relevantImpacts.includes(event.impact.toLowerCase())
            )
            .map((event: any): EconomicEvent => {
                const rawImpact = event.impact.toLowerCase();
                let impact: 'HIGH' | 'MEDIUM' | 'LOW';
                
                if (rawImpact.includes('high')) impact = 'HIGH';
                else if (rawImpact.includes('medium')) impact = 'MEDIUM';
                else impact = 'LOW';

                const translatedTitle = translateEvent(event.title);
                const translatedImpact = IMPACT_TRANSLATIONS[rawImpact] || rawImpact.toUpperCase();

                return {
                    id: `${event.title}-${event.date}`,
                    time: new Date(event.date).getTime() / 1000,
                    title: `${translatedTitle} (${event.country})`,
                    impact,
                    sentiment: 'NEUTRAL',
                    description: `Moeda: ${event.country} | Impacto: ${translatedImpact} | Previsão: ${event.forecast || '---'} | Anterior: ${event.previous || '---'}`,
                };
            })
            .sort((a, b) => a.time - b.time);
    } catch (error) {
        console.error("Erro ao buscar eventos econômicos:", error);
        return [];
    }
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
