import { Asset, Candle, Timeframe, CorrelationData, MarketBreadthSummary, BreadthCompanyDetails, DOW_30_TICKERS, HK_50_TICKERS, VolumePressure, GapData, EconomicEvent } from '../types.js';
import fs from 'fs';

// Dicionário simples para tradução de eventos comuns
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
  'Philly Fed Manufacturing Index': 'Índice de Manufatura Philly Fed'
};

const translateEvent = (title: string): string => {
  for (const [eng, pt] of Object.entries(EVENT_TRANSLATIONS)) {
    if (title.includes(eng)) return title.replace(eng, pt);
  }
  return title;
};

const fetchWithRetry = async (url: string): Promise<any> => {
  const request = async (u: string) => {
    return fetch(u, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ubuntutrader/1.0)'
      }
    });
  };

  try {
    let response = await request(url);
    if (response.ok) return await response.json();

    // Se Yahoo responder 401/403, tenta fallback em query2
    if ((response.status === 401 || response.status === 403) && url.includes('query1.finance.yahoo.com')) {
      const alt = url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
      console.warn(`Request failed (${response.status}), tentando fallback: ${alt}`);
      response = await request(alt);
      if (response.ok) return await response.json();
      console.warn(`Fallback também falhou: ${alt} -> ${response.status}`);
    } else {
      console.warn(`Request failed: ${url} -> ${response.status}`);
    }
  } catch (error) {
    console.warn(`Request error for ${url}:`, error);
  }
  return null;
};


// Simples wrapper para chamadas do Yahoo; hoje apenas requisita direto.
const fetchFromYahoo = async (url: string): Promise<any> => {
  return fetchWithRetry(url);
};

const fetchYahooData = async (symbol: string, interval: string, range: string = '5d'): Promise<any> => {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const data = await fetchFromYahoo(yahooUrl);
  return data?.chart?.result?.[0];
};

export const fetchYahooChartPriceChange = async (symbol: string): Promise<{ price: number | null; change: number | null }> => {
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const data = await fetchFromYahoo(chartUrl);
  const result = data?.chart?.result?.[0];
  if (!result) return { price: null, change: null };

  const closes = result.indicators?.quote?.[0]?.close ?? [];
  let lastClose: number | null = null;
  let prevClose: number | null = null;
  for (let i = closes.length - 1; i >= 0; i--) {
    const val = closes[i];
    if (typeof val === 'number' && !Number.isNaN(val)) {
      if (lastClose === null) {
        lastClose = val;
      } else {
        prevClose = val;
        break;
      }
    }
  }

  const metaPrice = result.meta?.regularMarketPrice;
  const price = typeof metaPrice === 'number' ? metaPrice : lastClose;
  const base = typeof result.meta?.chartPreviousClose === 'number' ? result.meta.chartPreviousClose : prevClose;
  let change: number | null = null;
  if (price !== null && base !== null && base !== 0 && !Number.isNaN(base)) {
    change = ((price - base) / base) * 100;
  }

  return { price: price ?? null, change };
};

export const fetchCurrentPrice = async (asset: Asset): Promise<number | null> => {
  let yahooSymbol = '';
  if (asset.symbol === 'US30') yahooSymbol = '^DJI';
  else if (asset.symbol === 'HK50') yahooSymbol = '^HSI';
  else yahooSymbol = asset.symbol;

  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}`;
  const data = await fetchFromYahoo(quoteUrl);
  
  if (data?.quoteResponse?.result && data.quoteResponse.result.length > 0) {
    const price = data.quoteResponse.result[0].regularMarketPrice;
    if (typeof price === 'number' && !Number.isNaN(price)) return price;
  }

  // Fallback para o endpoint de chart (menos bloqueado por rate limit)
  const chart = await fetchYahooChartPriceChange(yahooSymbol);
  return chart.price;
};

export const fetchCorrelationData = async (assetSymbol: string): Promise<CorrelationData[]> => {
  let targets: { symbol: string, name: string, correlation: 'positive' | 'negative', info?: string }[] = [];

  if (assetSymbol === 'HK50') {
    targets = [
      { symbol: '^VHSI', name: '🥇 VHSI (HK VIX) – PRINCIPAL', correlation: 'negative', info: 'Volatilidade local do Hang Seng\nDefine expansão, pânico ou consolidação\nGatilho real de movimento' },
      { symbol: 'CNH=X', name: '🥈 CNH (USD/CNH)', correlation: 'negative', info: 'Força ou fraqueza do yuan chinês\nImpacto direto no HK50\nFluxo de capital asiático' },
      { symbol: '^N225', name: '🥉 Nikkei 225', correlation: 'positive', info: 'Direção da Ásia no mesmo pregão\nConfirma ou invalida viés' },
      { symbol: '000001.SS', name: '4️⃣ Shanghai Composite (SSE)', correlation: 'positive', info: 'Sentimento do mercado chinês mainland\nConfirmação estrutural' },
      { symbol: '^GSPC', name: '5️⃣ US500 (fechamento do dia anterior)', correlation: 'positive', info: 'Herança de risco global\nInfluencia gap e abertura' },
      { symbol: 'USDJPY=X', name: '6️⃣ USD/JPY', correlation: 'negative', info: 'Risk-on / risk-off asiático\nApoio secundário' },
      { symbol: 'DX-Y.NYB', name: '7️⃣ DXY', correlation: 'negative', info: 'Fluxo global de dólar\nPeso menor, mas útil como filtro' },
    ];
  } else {
    targets = [
      { symbol: '^VIX', name: '🥇 VIX (CBOE) – PRINCIPAL', correlation: 'negative', info: 'Volatilidade do S&P 500\nGatilho de risco do mercado americano\nImpacto imediato no US30' },
      { symbol: '^GSPC', name: '🥈 S&P 500 (US500)', correlation: 'positive', info: 'Benchmark do mercado dos EUA\nDireção estrutural do dia\nConfirma viés do Dow' },
      { symbol: '^IXIC', name: '🥉 NASDAQ (US100)', correlation: 'positive', info: 'Apetite a risco / tecnologia\nConfirma ou diverge do US30' },
      { symbol: 'DX-Y.NYB', name: '4️⃣ DXY (Índice do Dólar)', correlation: 'negative', info: 'Fluxo de capital global\nFiltro secundário (risk-off)' },
      { symbol: '^TNX', name: '5️⃣ Treasury 10Y (US10Y)', correlation: 'negative', info: 'Custo do dinheiro\nPressão direta em ações' },
      { symbol: '^RUT', name: '6️⃣ Russell 2000 (US2000)', correlation: 'positive', info: 'Força da economia doméstica\nConfirmação de breadth' },
    ];
  }

  const symbols = targets.map(t => t.symbol).join(',');
  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
  const data = await fetchFromYahoo(quoteUrl);

  const quoteMap = new Map<string, any>();
  if (data?.quoteResponse?.result && data.quoteResponse.result.length > 0) {
    data.quoteResponse.result.forEach((q: any) => quoteMap.set(q.symbol, q));
  }

  const results: any[] = [];
  for (const target of targets) {
    const quote = quoteMap.get(target.symbol);
    let price = quote?.regularMarketPrice;
    let change = quote?.regularMarketChangePercent;

    if (price === null || price === undefined || Number.isNaN(price) || change === null || change === undefined || Number.isNaN(change)) {
      const fallback = await fetchYahooChartPriceChange(target.symbol);
      if (price === null || price === undefined || Number.isNaN(price)) price = fallback.price;
      if (change === null || change === undefined || Number.isNaN(change)) change = fallback.change;
    }

    results.push({
      symbol: target.symbol,
      name: target.name,
      // Se mesmo assim vier vazio, mantemos como undefined para permitir fill posterior no ensureSnapshot
      price: (price !== null && price !== undefined && !Number.isNaN(price)) ? price : undefined as any,
      change: (change !== null && change !== undefined && !Number.isNaN(change)) ? change : undefined as any,
      correlation: target.correlation,
      info: (target as any).info || ''
    });
  }

  return results;
};

export const fetchEconomicEvents = async (): Promise<EconomicEvent[]> => {
  const calendarUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

  try {
    const data = await fetchWithRetry(calendarUrl);

        if (!data || !Array.isArray(data)) {
            console.warn('Could not load economic calendar from primary source.');
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
                const impactUpper = event.impact.toUpperCase();
                let impact: 'HIGH' | 'MEDIUM' | 'LOW';
                
                if (impactUpper.includes('HIGH')) impact = 'HIGH';
                else if (impactUpper.includes('MEDIUM')) impact = 'MEDIUM';
                else impact = 'LOW';

                const translatedTitle = translateEvent(event.title);

                return {
                    id: `${event.title}-${event.date}`,
                    time: new Date(event.date).getTime() / 1000,
                    title: `${translatedTitle} (${event.country})`,
                    impact,
                    sentiment: 'NEUTRAL',
                    description: `Moeda: ${event.country} | Impacto: ${event.impact} | Previsão: ${event.forecast || '---'} | Anterior: ${event.previous || '---'}`,
                };
            })
            .sort((a, b) => a.time - b.time);
    } catch (error) {
        console.error("Error in fetchEconomicEvents:", error);
        return [];
    }
};

export const fetchMarketBreadth = async (assetSymbol: string): Promise<{ summary: MarketBreadthSummary, details: BreadthCompanyDetails[] }> => {
  let tickers = DOW_30_TICKERS;
  if (assetSymbol === 'HK50') tickers = HK_50_TICKERS;

  // 1) Tenta companies_snapshot.json do TradingView (prioridade)
  try {
    const file = fs.readFileSync('companies_snapshot.json', 'utf-8');
    const snapshot = JSON.parse(file);
    const indexKey = assetSymbol === 'HK50' ? 'HK50' : 'US30';
    const companies = snapshot?.indices?.[indexKey];
    if (Array.isArray(companies) && companies.length > 0) {
      const details: BreadthCompanyDetails[] = [];
      let advancing = 0;
      let declining = 0;
      let valid = 0;
      companies.forEach((c: any) => {
        if (typeof c.changePercent === 'number' && !Number.isNaN(c.changePercent)) {
          const change = c.changePercent;
          const status = change >= 0 ? 'BUY' : 'SELL';
          if (status === 'BUY') advancing++; else declining++;
          details.push({ symbol: c.ticker, change, status: status as 'BUY' | 'SELL' });
          valid++;
        }
      });
      if (valid > 0 && details.length > 0) {
        return {
          summary: { advancing, declining, total: details.length },
          details: details.sort((a, b) => b.change - a.change)
        };
      }
    }
  } catch (err) {
    // se arquivo não existir ou erro de parse, cai para Yahoo
  }

  // 2) Fallback Yahoo (quote) + chart (menos bloqueado)
  const symbols = tickers.join(',');
  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
  const data = await fetchFromYahoo(quoteUrl);
  const details: BreadthCompanyDetails[] = [];
  let advancing = 0;
  let declining = 0;

  const quoteMap = new Map<string, any>();
  if (data?.quoteResponse?.result && data.quoteResponse.result.length > 0) {
    data.quoteResponse.result.forEach((q: any) => quoteMap.set(q.symbol, q));
  }

  for (const ticker of tickers) {
    const quote = quoteMap.get(ticker);
    let change = quote?.regularMarketChangePercent;
    if (change === null || change === undefined || Number.isNaN(change)) {
      const fallback = await fetchYahooChartPriceChange(ticker);
      change = fallback.change;
    }
    if (change === null || change === undefined || Number.isNaN(change)) change = 0;
    const status = change >= 0 ? 'BUY' : 'SELL';
    if (status === 'BUY') advancing++; else declining++;
    details.push({ symbol: ticker, change, status: status as 'BUY' | 'SELL' });
  }

  const summary = { advancing, declining, total: details.length };
  const sorted = details.sort((a, b) => b.change - a.change);
  if (!Number.isFinite(summary.advancing) || !Number.isFinite(summary.declining) || summary.total === 0) {
    return fallbackEmptyBreadth(tickers);
  }

  return { summary, details: sorted };
};

// Se tudo falhar, devolve breadth neutro com tickers conhecidos para evitar payload vazio
export const fallbackEmptyBreadth = (tickers: string[]): { summary: MarketBreadthSummary, details: BreadthCompanyDetails[] } => {
  const details = tickers.map(t => ({ symbol: t, change: 0, status: 'BUY' as const }));
  return {
    summary: { advancing: tickers.length, declining: 0, total: tickers.length },
    details
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
