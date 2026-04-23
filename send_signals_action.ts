import 'dotenv/config';
import * as fs from 'fs';
import { sendTelegramSignal, sendTelegramAnalysis } from './services/telegramService';
import { collectSnapshot } from './scripts/collect_snapshot';
import { fetchCorrelationData, fetchMarketBreadth, fetchRealData, calculateVolumePressure, detectOpeningGap, fetchCurrentPrice, fetchYahooChartPriceChange } from './services/dataService';
import { SUPPORTED_ASSETS } from './types';
import { spawnSync } from 'child_process';


type Snapshot = {
  quote?: number | null;
  indices?: { symbol: string; price?: number; change?: number }[];
  volume?: { buyPercent?: number; sellPercent?: number };
  breadth?: { summary?: { advancing?: number; declining?: number } };
  gap?: { percent?: number };
};

type TradingViewIndexEntry = {
  price?: number;
  change?: number;
};

type SnapshotCompanyEntry = {
  ticker?: string;
  symbol?: string;
  change?: number;
  status?: string;
  volume?: number;
};

const loadCompaniesSnapshotEntries = (assetSymbol: string): SnapshotCompanyEntry[] => {
  const paths = ['companies_snapshot.json', 'public/companies_snapshot.json'];
  for (const file of paths) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const entries = raw?.indices?.[assetSymbol];
      if (Array.isArray(entries) && entries.length > 0) return entries;
    } catch {
      // tenta o proximo arquivo
    }
  }
  return [];
};

const buildBreadthFromCompaniesSnapshot = (assetSymbol: string) => {
  const entries = loadCompaniesSnapshotEntries(assetSymbol)
    .map((entry: SnapshotCompanyEntry) => {
      const change = typeof entry.change === 'number' ? entry.change : 0;
      const status = change < 0 ? 'SELL' : 'BUY';
      const symbol = String(entry.ticker ?? entry.symbol ?? '');
      return symbol ? { symbol, change, status } : null;
    })
    .filter(Boolean) as { symbol: string; change: number; status: 'BUY' | 'SELL' }[];

  if (entries.length === 0) return null;

  const advancing = entries.filter(entry => entry.change > 0).length;
  const declining = entries.filter(entry => entry.change < 0).length;

  return {
    summary: {
      advancing,
      declining,
      total: entries.length
    },
    details: entries
  };
};

const calculateRealVolumeFromCompanies = (assetSymbol: string) => {
  const entries = loadCompaniesSnapshotEntries(assetSymbol);
  if (entries.length === 0) return null;

  let buyVolume = 0;
  let sellVolume = 0;

  entries.forEach((entry: SnapshotCompanyEntry) => {
    const volume = typeof entry.volume === 'number' && !Number.isNaN(entry.volume) ? entry.volume : 0;
    const change = typeof entry.change === 'number' ? entry.change : 0;

    if (change > 0) buyVolume += volume;
    else if (change < 0) sellVolume += volume;
  });

  const total = buyVolume + sellVolume;
  if (total <= 0) return null;

  return {
    buyPercent: (buyVolume / total) * 100,
    sellPercent: (sellVolume / total) * 100,
    total
  };
};

const SNAPSHOT_CHANGE_SYMBOLS: Record<string, string> = {
  '^VIX': '^VIX',
  'VIX': '^VIX',
  '^GSPC': '^GSPC',
  'US500': '^GSPC',
  'S&P 500': '^GSPC',
  '^IXIC': '^IXIC',
  'US100': '^IXIC',
  'NASDAQ': '^IXIC',
  'DX-Y.NYB': 'DX-Y.NYB',
  'DXY': 'DX-Y.NYB',
  '^VHSI': '^VHSI',
  'VHSI': '^VHSI',
  '^N225': '^N225',
  'NIKKEI': '^N225',
  '000001.SS': '000001.SS',
  'SSE': '000001.SS',
  'USDJPY=X': 'USDJPY=X',
  'USDJPY': 'USDJPY=X',
  'CNH=X': 'CNH=X',
  'CNH': 'CNH=X'
};

const INDEX_SNAPSHOT_KEYS: Record<string, string[]> = {
  '^VIX': ['VIX'],
  'VIX': ['VIX'],
  '^GSPC': ['US500', 'S&P 500'],
  'US500': ['US500', 'S&P 500'],
  'S&P 500': ['US500', 'S&P 500'],
  '^IXIC': ['US100', 'NASDAQ'],
  'US100': ['US100', 'NASDAQ'],
  'NASDAQ': ['US100', 'NASDAQ'],
  'DX-Y.NYB': ['DXY'],
  'DXY': ['DXY'],
  '^VHSI': ['VHSI'],
  'VHSI': ['VHSI'],
  '^N225': ['JP225', 'NIKKEI', 'NIKKEI225'],
  'JP225': ['JP225', 'NIKKEI', 'NIKKEI225'],
  'NIKKEI': ['JP225', 'NIKKEI', 'NIKKEI225'],
  '000001.SS': ['000001.SS', 'SSE'],
  'SSE': ['000001.SS', 'SSE'],
  'USDJPY=X': ['USDJPY=X', 'USDJPY'],
  'USDJPY': ['USDJPY=X', 'USDJPY'],
  'CNH=X': ['CNH=X', 'CNH'],
  'CNH': ['CNH=X', 'CNH'],
  'US30': ['US30'],
  'HK50': ['HK50'],
  '^TNX': ['^TNX'],
  'GOLD': ['GOLD'],
  'WTI': ['WTI']
};

let tradingViewIndexSnapshotCache: Record<string, TradingViewIndexEntry> | null = null;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/,/g, ''));
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const resolveSnapshotLookupKeys = (symbols: string | string[]): string[] => {
  const requested = Array.isArray(symbols) ? symbols : [symbols];
  return Array.from(
    new Set(
      requested.flatMap(symbol => {
        const canonical = SNAPSHOT_CHANGE_SYMBOLS[symbol];
        const direct = INDEX_SNAPSHOT_KEYS[symbol] || [symbol];
        const canonicalKeys = canonical ? (INDEX_SNAPSHOT_KEYS[canonical] || [canonical]) : [];
        return [...direct, ...canonicalKeys, symbol, canonical].filter(Boolean) as string[];
      })
    )
  );
};

const loadTradingViewIndexSnapshot = (): Record<string, TradingViewIndexEntry> => {
  if (tradingViewIndexSnapshotCache) return tradingViewIndexSnapshotCache;
  const file = 'indices_snapshot.json';
  if (!fs.existsSync(file)) {
    tradingViewIndexSnapshotCache = {};
    return tradingViewIndexSnapshotCache;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const indices = raw?.indices ?? {};
    const out: Record<string, TradingViewIndexEntry> = {};
    Object.entries(indices).forEach(([symbol, data]: [string, any]) => {
      out[symbol] = {
        price: toNumber(data?.price),
        change: toNumber(data?.change)
      };
    });
    tradingViewIndexSnapshotCache = out;
    return out;
  } catch (error) {
    console.warn('[TV SNAPSHOT] Falha ao ler indices_snapshot.json:', error);
    tradingViewIndexSnapshotCache = {};
    return tradingViewIndexSnapshotCache;
  }
};

const getIndexSnapshotEntry = (symbols: string | string[]): TradingViewIndexEntry | null => {
  const snapshot = loadTradingViewIndexSnapshot();
  const keys = resolveSnapshotLookupKeys(symbols);
  for (const key of keys) {
    const entry = snapshot[key];
    if (!entry) continue;
    if (entry.change !== undefined || entry.price !== undefined) return entry;
  }
  return null;
};

const enrichSnapshotIndexChanges = async (snapshot: Snapshot): Promise<boolean> => {
  if (!snapshot.indices || snapshot.indices.length === 0) return false;

  const tradingViewSnapshot = loadTradingViewIndexSnapshot();
  let changed = false;

  snapshot.indices = snapshot.indices.map(entry => {
    if (typeof entry.change === 'number' && !Number.isNaN(entry.change)) return entry;
    const rawEntry = getIndexSnapshotEntry(entry.symbol);
    if (typeof rawEntry?.change === 'number' && !Number.isNaN(rawEntry.change)) {
      changed = true;
      return { ...entry, change: rawEntry.change, price: entry.price ?? rawEntry.price };
    }
    if (entry.price === undefined && typeof rawEntry?.price === 'number' && !Number.isNaN(rawEntry.price)) {
      changed = true;
      return { ...entry, price: rawEntry.price };
    }
    return entry;
  });

  const yahooSymbols = Array.from(
    new Set(
      snapshot.indices
        .filter(entry => entry.change === undefined || entry.change === null || Number.isNaN(entry.change))
        .map(entry => SNAPSHOT_CHANGE_SYMBOLS[entry.symbol] || entry.symbol)
    )
  );

  if (yahooSymbols.length === 0) return false;

  const changes = await Promise.all(
    yahooSymbols.map(async symbol => ({
      symbol,
      result: await fetchYahooChartPriceChange(symbol)
    }))
  );

  const changeMap = new Map<string, number>();
  changes.forEach(({ symbol, result }) => {
    if (typeof result.change === 'number' && !Number.isNaN(result.change)) {
      changeMap.set(symbol, result.change);
    }
  });

  snapshot.indices = snapshot.indices.map(entry => {
    if (typeof entry.change === 'number' && !Number.isNaN(entry.change)) return entry;
    const yahooSymbol = SNAPSHOT_CHANGE_SYMBOLS[entry.symbol] || entry.symbol;
    const yahooChange = changeMap.get(yahooSymbol);
    if (yahooChange === undefined) return entry;
    changed = true;
    return { ...entry, change: yahooChange };
  });

  return changed;
};

const ensureSnapshotData = async (assetSymbol: string, snapshot: Snapshot, snapshotPath?: string): Promise<Snapshot> => {
  const asset = SUPPORTED_ASSETS.find(a => a.symbol === assetSymbol);
  if (!asset) return snapshot;

  let tvIndices = loadTradingViewIndices();
  let tvQuote = loadTradingViewQuote(assetSymbol);
  if (!tvIndices || Object.keys(tvIndices).length === 0 || tvQuote === undefined) {
    ensureTvSnapshot();
    tvIndices = loadTradingViewIndices();
    tvQuote = loadTradingViewQuote(assetSymbol);
  }
  let changed = false;

  const liveIndices = buildTvCorrelation(assetSymbol, tvIndices);
  if (liveIndices.length > 0) {
    const currentSerialized = JSON.stringify(snapshot.indices ?? []);
    const liveSerialized = JSON.stringify(liveIndices);
    if (currentSerialized !== liveSerialized) {
      snapshot.indices = liveIndices as any;
      changed = true;
    }
  }

  if (tvQuote !== undefined && tvQuote !== null && snapshot.quote !== tvQuote) {
    snapshot.quote = tvQuote;
    changed = true;
  }


  if (!snapshot.indices || snapshot.indices.length === 0) {
    // Prioridade: TradingView
    const tvFallback = buildTvCorrelation(assetSymbol, tvIndices);
    if (tvFallback.length > 0) {
      snapshot.indices = tvFallback as any;
      changed = true;
    }
    // Não faz fallback para Yahoo, nem mescla, nem busca change externo
  }

  if (snapshot.indices && snapshot.indices.length > 0) {
    const indicesChanged = await enrichSnapshotIndexChanges(snapshot);
    changed = changed || indicesChanged;
  }

  const breadthSummary = snapshot.breadth?.summary;
  const breadthEmpty = breadthSummary && breadthSummary.advancing === 0 && breadthSummary.declining === 0;
  if (!snapshot.breadth || !snapshot.breadth.summary || breadthEmpty) {
    try {
      const breadth = await fetchMarketBreadth(assetSymbol);
      snapshot.breadth = breadth as any;
      changed = true;
    } catch (err) {
      console.warn('[SNAPSHOT] Falha ao buscar breadth:', err);
    }
  }

  const needVolume = !snapshot.volume || snapshot.volume.buyPercent === undefined || snapshot.volume.sellPercent === undefined;
  if (needVolume) {
    try {
      const candles = await fetchRealData(asset, '1m');
      if (needVolume) {
        snapshot.volume = calculateVolumePressure(candles) as any;
        changed = true;
      }
    } catch (err) {
      console.warn('[SNAPSHOT] Falha ao buscar candles para volume/gap:', err);
    }
  }

  if (snapshot.quote === undefined || snapshot.quote === null) {
    // Prioridade: TradingView
    let quote: number | null | undefined = tvQuote;
    if (quote === undefined || quote === null) {
      try {
        quote = await fetchCurrentPrice(asset);
      } catch (err) {
        console.warn('[SNAPSHOT] Falha ao buscar cotação Yahoo:', err);
      }
      // Ainda vazio? tenta refazer TV uma vez
      if (quote === null || quote === undefined) {
        ensureTvSnapshot();
        tvQuote = loadTradingViewQuote(assetSymbol);
        quote = tvQuote ?? quote;
      }
    }
    if (quote !== null && quote !== undefined) {
      snapshot.quote = quote;
      changed = true;
    }
  }

  if (changed && snapshotPath) {
    try {
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    } catch (err) {
      console.warn('[SNAPSHOT] Falha ao atualizar snapshot enriquecido:', err);
    }
  }

  return snapshot;
};

// Atualiza sempre os campos críticos antes de enviar a mensagem,
// evitando reutilizar volume/breadth/gap antigos do snapshot salvo.
const refreshCriticalSnapshotFields = async (assetSymbol: string, snapshot: Snapshot, snapshotPath?: string): Promise<Snapshot> => {
  ensureCriticalSources(assetSymbol);

  const asset = SUPPORTED_ASSETS.find(a => a.symbol === assetSymbol);
  if (!asset) return snapshot;

  let changed = false;

  const companiesBreadth = buildBreadthFromCompaniesSnapshot(assetSymbol);
  if (companiesBreadth?.summary) {
    snapshot.breadth = companiesBreadth as any;
    changed = true;
  }

  try {
    if (!companiesBreadth?.summary) {
      const breadth = await fetchMarketBreadth(assetSymbol);
      snapshot.breadth = breadth as any;
      changed = true;
    }
  } catch (err) {
    console.warn('[SNAPSHOT] Falha ao atualizar breadth em tempo real:', err);
  }

  const companyVolume = calculateRealVolumeFromCompanies(assetSymbol);
  if (companyVolume) {
    snapshot.volume = companyVolume as any;
    changed = true;
  }

  try {
    if (!companyVolume) {
      let candles = await fetchAssetCandlesFromYahoo(assetSymbol);
      if (!Array.isArray(candles) || candles.length < 20) {
        candles = await fetchRealData(asset, '1m');
      }

      if (Array.isArray(candles) && candles.length > 0) {
        snapshot.volume = calculateVolumePressure(candles) as any;
        changed = true;
      }
    }
  } catch (err) {
    console.warn('[SNAPSHOT] Falha ao atualizar volume em tempo real:', err);
  }

  if (changed && snapshotPath) {
    try {
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    } catch (err) {
      console.warn('[SNAPSHOT] Falha ao persistir atualização crítica do snapshot:', err);
    }
  }

  return snapshot;
};

type ScoreBreakdown = {
  volume: number;
  volIndex: number;
  breadth: number;
  indices: number;
  dxy: number;
  consensus: number;
};

const INDEX_MAP_US30: Record<string, string> = {
  '^VIX': 'VIX',
  '^GSPC': 'SP500',
  '^IXIC': 'NASDAQ',
  'DX-Y.NYB': 'DXY',
  'US30': 'US30',
  'US500': 'S&P 500',
  'US100': 'NASDAQ',
  'DXY': 'DXY',
  '10Y': '10Y',
  'RUSSELL2000': 'Russell 2000'
};

const INDEX_MAP_HK50: Record<string, string> = {
  '^VHSI': 'VHSI',
  'CNH=X': 'CNH',
  '^N225': 'NIKKEI',
  '000001.SS': 'SSE',
  '^GSPC': 'US500',
  'USDJPY=X': 'USDJPY',
  'DX-Y.NYB': 'DXY'
};

// Preferir preços coletados no TradingView (coleta de 11h30) e só cair para Yahoo se faltar
const TV_SYMBOL_MAP: Record<string, string> = {
  'VIX': 'VIX',
  'DXY': 'DXY',
  'VHSI': 'VHSI',
  'CNH=X': 'CNH',
  'USDJPY=X': 'USDJPY',
  '000001.SS': 'SSE',
  'US500': 'SP500',
  'US100': 'NASDAQ',
  'JP225': 'NIKKEI',
  'US30': 'US30',
  'HK50': 'HK50',
  '^TNX': 'TNX',
  '^RUT': 'RUT'
};

const SYMBOL_TO_TV_KEY: Record<string, string> = {
  '^VIX': 'VIX',
  'DX-Y.NYB': 'DXY',
  '^VHSI': 'VHSI',
  'CNH=X': 'CNH',
  'USDJPY=X': 'USDJPY',
  '000001.SS': 'SSE',
  '^GSPC': 'SP500',
  '^IXIC': 'NASDAQ',
  '^RUT': 'RUT',
  '^TNX': 'TNX',
  '^N225': 'NIKKEI'
};

const buildTvCorrelation = (assetSymbol: string, tv: Record<string, number>) => {
  const get = (key: string) => {
    const val = tv[key];
    return typeof val === 'number' && !Number.isNaN(val) ? val : undefined;
  };
  if (assetSymbol === 'HK50') {
    return [
      { symbol: '^VHSI', price: get('VHSI') },
      { symbol: 'CNH=X', price: get('CNH') },
      { symbol: '^N225', price: get('NIKKEI') },
      { symbol: '000001.SS', price: get('SSE') },
      { symbol: '^GSPC', price: get('SP500') },
      { symbol: 'USDJPY=X', price: get('USDJPY') },
      { symbol: 'DX-Y.NYB', price: get('DXY') }
    ].filter(e => e.price !== undefined);
  }
  return [
    { symbol: '^VIX', price: get('VIX') },
    { symbol: '^GSPC', price: get('SP500') },
    { symbol: '^IXIC', price: get('NASDAQ') },
    { symbol: 'DX-Y.NYB', price: get('DXY') }
  ].filter(e => e.price !== undefined);
};

let tvFetched = false;
const ensureTvSnapshot = () => {
  if (tvFetched) return;
  tvFetched = true;
  tradingViewIndexSnapshotCache = null;
  try {
    const res = spawnSync('python3', ['fetch_indices_tradingview.py'], { stdio: 'inherit' });
    if (res.status !== 0) console.warn('[TV] fetch_indices_tradingview.py retornou status', res.status);
  } catch (err) {
    console.warn('[TV] Falha ao executar fetch_indices_tradingview.py:', err);
  }
};

const refreshedCriticalSources: Partial<Record<string, boolean>> = {};
const ensureCriticalSources = (assetSymbol: string) => {
  if (refreshedCriticalSources[assetSymbol]) return;
  refreshedCriticalSources[assetSymbol] = true;

  if (assetSymbol === 'US30') {
    try {
      const companiesRes = spawnSync('python3', ['fetch_us30_companies_tradingview_api.py'], { stdio: 'inherit' });
      if (companiesRes.status !== 0) {
        console.warn('[SNAPSHOT] fetch_us30_companies_tradingview_api.py retornou status', companiesRes.status);
      }
      if (fs.existsSync('companies_snapshot.json')) {
        fs.copyFileSync('companies_snapshot.json', 'public/companies_snapshot.json');
      }
    } catch (err) {
      console.warn('[SNAPSHOT] Falha ao atualizar companies_snapshot do US30:', err);
    }
  }
};

const fetchAssetCandlesFromYahoo = async (assetSymbol: string): Promise<any[]> => {
  const yahooSymbol = assetSymbol === 'HK50' ? '^HSI' : '^DJI';
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=2d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=2d`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ubuntutrader/1.0)' }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      const ts = result?.timestamp;
      const q = result?.indicators?.quote?.[0];
      if (!Array.isArray(ts) || !q) continue;

      const candles = ts
        .map((time: number, i: number) => ({
          time,
          open: q.open?.[i],
          high: q.high?.[i],
          low: q.low?.[i],
          close: q.close?.[i],
          volume: q.volume?.[i]
        }))
        .filter((c: any) =>
          typeof c.time === 'number' &&
          typeof c.open === 'number' &&
          typeof c.high === 'number' &&
          typeof c.low === 'number' &&
          typeof c.close === 'number'
        );

      if (candles.length > 0) return candles;
    } catch {
      // tenta próxima URL
    }
  }

  return [];
};

const loadTradingViewIndices = (): Record<string, number> => {
  const indices = loadTradingViewIndexSnapshot();
  const out: Record<string, number> = {};
  Object.entries(indices).forEach(([sym, data]) => {
    const key = TV_SYMBOL_MAP[sym];
    if (!key) return;
    if (typeof data.price === 'number' && !Number.isNaN(data.price)) out[key] = data.price;
  });
  return out;
};

const loadTradingViewQuote = (assetSymbol: string): number | undefined => {
  const tv = loadTradingViewIndices();
  const key = assetSymbol.toUpperCase();
  const val = tv[key];
  return typeof val === 'number' && !Number.isNaN(val) ? val : undefined;
};

const mapIndices = (snapshot: Snapshot, map: Record<string, string>): Record<string, number | string> => {
  const out: Record<string, number | string> = {};
  if (!snapshot.indices) return out;
  snapshot.indices.forEach(entry => {
    const key = map[entry.symbol];
    if (!key) return;
    if (typeof entry.change === 'number') {
      out[key] = entry.change; // usar variação percentual quando disponível
    } else if (typeof entry.price === 'number') {
      out[key] = entry.price; // fallback para preço se não houver change
    }
  });
  return out;
};

const getChange = (snapshot: Snapshot, symbols: string | string[]): number | null => {
  const requested = Array.isArray(symbols) ? symbols : [symbols];
  const list = Array.from(
    new Set(
      requested.flatMap(symbol => {
        const mapped = SNAPSHOT_CHANGE_SYMBOLS[symbol];
        return mapped ? [symbol, mapped] : [symbol];
      })
    )
  );
  const found = snapshot.indices?.find(i => list.includes(i.symbol) || list.includes(SNAPSHOT_CHANGE_SYMBOLS[i.symbol] || ''));
  if (typeof found?.change === 'number') return found.change;
  const rawEntry = getIndexSnapshotEntry(requested);
  return typeof rawEntry?.change === 'number' ? rawEntry.change : null;
};

const tvPriceForSymbol = (symbol: string, tv: Record<string, number>): number | undefined => {
  const key = SYMBOL_TO_TV_KEY[symbol];
  const val = key ? tv[key] : undefined;
  return typeof val === 'number' && !Number.isNaN(val) ? val : undefined;
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
};

const formatPercentOrPrice = (symbol: string, change: number | null, tv: Record<string, number>): string => {
  if (change !== null && change !== undefined && !Number.isNaN(change)) {
    return `${change.toFixed(2)}%`;
  }
  const price = tvPriceForSymbol(symbol, tv);
  return price !== undefined ? `${price.toFixed(2)} (preço)` : '-';
};

const resolveSignal = (score: number): 'COMPRA' | 'VENDA' | 'NEUTRO' => {
  // Evita transformar conflito leve entre fatores em direção forçada.
  if (Math.abs(score) < 3) return 'NEUTRO';
  if (score > 0) return 'COMPRA';
  if (score < 0) return 'VENDA';
  return 'NEUTRO';
};

const resolveStrength = (score: number): 'FORTE' | 'MODERADA' | 'FRACA' => {
  const abs = Math.abs(score);
  if (abs < 3) return 'FRACA';
  if (abs >= 12) return 'FORTE';
  if (abs >= 7) return 'MODERADA';
  return 'FRACA';
};

const computeScore = (assetSymbol: string, snapshot: Snapshot): { total: number; parts: ScoreBreakdown } => {
  const volumeBuy = snapshot.volume?.buyPercent ?? null;
  const volumeSell = snapshot.volume?.sellPercent ?? null;
  const volumeScore = volumeBuy !== null && volumeSell !== null
    ? (volumeBuy > volumeSell ? 5 : volumeSell > volumeBuy ? -5 : 0)
    : 0;

  const volIndexChange = assetSymbol === 'HK50'
    ? getChange(snapshot, '^VHSI')
    : getChange(snapshot, '^VIX');
  const volIndexScore = volIndexChange !== null
    ? (volIndexChange < 0 ? 3 : volIndexChange > 0 ? -3 : 0)
    : 0;

  const adv = snapshot.breadth?.summary?.advancing ?? 0;
  const dec = snapshot.breadth?.summary?.declining ?? 0;
  const breadthScore = adv === dec ? 0 : adv > dec ? 3 : -3;

  const indicesListUS = ['^GSPC', '^IXIC'];
  const indicesListHK = ['^N225', '000001.SS', '^GSPC'];
  const chosenList = assetSymbol === 'HK50' ? indicesListHK : indicesListUS;
  let posIdx = 0;
  let negIdx = 0;
  chosenList.forEach(sym => {
    const val = getChange(snapshot, sym);
    if (val === null) return;
    if (val > 0) posIdx += 1; else if (val < 0) negIdx += 1;
  });
  const indicesScore = posIdx === negIdx ? 0 : posIdx > negIdx ? 2 : -2;

  const dxyChange = getChange(snapshot, 'DX-Y.NYB');
  const dxyScore = dxyChange !== null
    ? (dxyChange < 0 ? 2 : dxyChange > 0 ? -2 : 0)
    : 0;

  // Quando os filtros intermarket principais apontam todos na mesma direção,
  // o score final precisa refletir esse consenso para evitar inversão de leitura.
  let consensusScore = 0;
  if (volIndexScore > 0 && indicesScore > 0 && dxyScore > 0) consensusScore = 4;
  else if (volIndexScore < 0 && indicesScore < 0 && dxyScore < 0) consensusScore = -4;

  const total = volumeScore + volIndexScore + breadthScore + indicesScore + dxyScore + consensusScore;
  return {
    total,
    parts: {
      volume: volumeScore,
      volIndex: volIndexScore,
      breadth: breadthScore,
      indices: indicesScore,
      dxy: dxyScore,
      consensus: consensusScore
    }
  };
};

const buildAnalysisMessage = (assetSymbol: string, label: string, snapshot: Snapshot, tvIndices: Record<string, number>) => {
  const { total } = computeScore(assetSymbol, snapshot);
  const signal = resolveSignal(total);
  const strength = resolveStrength(total);
  const tradingViewSnapshot = loadTradingViewIndexSnapshot();

  const volumeBuy = snapshot.volume?.buyPercent ?? null;
  const volumeSell = snapshot.volume?.sellPercent ?? null;
  const adv = snapshot.breadth?.summary?.advancing ?? 0;
  const dec = snapshot.breadth?.summary?.declining ?? 0;
  const volIndexSymbol = assetSymbol === 'HK50' ? '^VHSI' : '^VIX';
  const labelText = 'ABERTURA';
  const headerAsset = assetSymbol === 'HK50' ? '🇭🇰 HK50' : '🇺🇸 US30';

  const fmtPct = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return `${value.toFixed(2).replace('.', ',')}%`;
  };

  const fmtPrice = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  };

  // Sempre usa TradingView (tvIndices) para os valores das mensagens
  const changeOrPrice = (symbol: string) => {
    // Busca preço diretamente de indices_snapshot.json
    const indicesRaw = JSON.parse(fs.readFileSync('indices_snapshot.json', 'utf-8')).indices;
    const price = indicesRaw[symbol]?.price;
    if (price !== undefined && price !== null && !Number.isNaN(price)) {
      return `${fmtPrice(price)} (preço)`;
    }
    return '⚠️ dado ausente';
  };

  const favorability = (symbol: string, prefer: 'pos' | 'neg') => {
    const change = getChange(snapshot, symbol);
    if (change === null || Number.isNaN(change)) return '⚠️ dado ausente';
    const desiredPos = prefer === 'pos';
    const ok = desiredPos ? change > 0 : change < 0;
    const check = ok ? '✅' : '❌';
    const word = ok ? 'favorável' : 'desfavorável';
    return `${check} (${word} para ${signal === 'NEUTRO' ? 'NEUTRO' : signal})`;
  };

  // Só exibe índices presentes no snapshot, sem buscar Yahoo ou ativos não relacionados
  // Mapeamento correto para indices_snapshot.json
  const relevantSymbols = assetSymbol === 'US30'
    ? [
        { symbol: 'VIX', label: '🥇 VIX' },
        { symbol: 'US500', label: '🇺🇸 S&P 500' },
        { symbol: 'US100', label: '🇺🇸 NASDAQ' },
        { symbol: 'DXY', label: '💵 DXY' }
      ]
    : [
        { symbol: 'VHSI', label: '🥇 VHSI' },
        { symbol: 'NIKKEI', label: '🇯🇵 Nikkei 225' },
        { symbol: 'SSE', label: '🇨🇳 SSE' },
        { symbol: 'US500', label: '🇺🇸 US500' },
        { symbol: 'USDJPY', label: '🇺🇸 USD/JPY' },
        { symbol: 'DXY', label: '💵 DXY' },
      ];

  const correlationMap: Record<string, 'positive' | 'negative'> = assetSymbol === 'US30'
    ? {
        VIX: 'negative',
        US500: 'positive',
        'S&P 500': 'positive',
        US100: 'positive',
        NASDAQ: 'positive',
        DXY: 'negative'
      }
    : {
        VHSI: 'negative',
        NIKKEI: 'positive',
        SSE: 'positive',
        US500: 'positive',
        USDJPY: 'negative',
        DXY: 'negative'
      };

  const indicatorLines = relevantSymbols.map(({ label, symbol }) => {
    // Busca variação percentual (change) do snapshot
    const change = getChange(snapshot, symbol);
    let favorText = '';
    if (change !== null && !Number.isNaN(change)) {
      const corr = correlationMap[symbol] || 'positive';
      let favor = false;
      if (signal === 'COMPRA') {
        favor = corr === 'positive' ? change > 0 : change < 0;
      } else if (signal === 'VENDA') {
        favor = corr === 'positive' ? change < 0 : change > 0;
      }
      const check = favor ? '✅' : '❌';
      const word = signal === 'NEUTRO' ? 'neutro' : favor ? 'favorável' : 'desfavorável';
      favorText = signal === 'NEUTRO' ? '⚖️ (neutro)' : `${check} (${word} para ${signal})`;
      return `${label}: ${fmtPct(change)} ${favorText}`;
    } else {
      const rawEntry = getIndexSnapshotEntry(symbol);
      const price = rawEntry?.price;
      favorText = '⚖️ (neutro)';
      return price !== undefined && price !== null && !Number.isNaN(price)
        ? `${label}: ${fmtPrice(price)} ${favorText}`
        : `${label}: ⚠️ dado ausente`;
    }
  });

  const volumeSummary = () => {
    if (volumeBuy === null || volumeSell === null) return 'Volume indisponível';
    const dom = volumeBuy > volumeSell ? 'comprador' : 'vendedor';
    const pct = volumeBuy > volumeSell ? volumeBuy : volumeSell;
    const arrow = dom === 'comprador' ? '📈' : '📉';
    return `${arrow} Volume ${dom} dominante (${pct.toFixed(1)}% ${dom === 'comprador' ? 'compra' : 'venda'})`;
  };

  const breadthSummary = () => {
    if (!adv && !dec) return 'Breadth indisponível';
    const pos = adv > dec;
    return `${pos ? '🟢 Breadth positivo' : adv === dec ? '⚖️ Breadth neutro' : '🔴 Breadth negativo'} (${adv} alta, ${dec} baixa)`;
  };

  const headerLine = '🧠 ABERTURA';
  const siteUrl = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://ubuntutrader.com.br/';

  const lines = [
    `${headerLine}`,
    '',
    (() => {
      let favor;
      if (signal === 'COMPRA') favor = 'favorável à compra';
      else if (signal === 'VENDA') favor = 'desfavorável à compra';
      else favor = 'neutro';
      return `${headerAsset}: Sinal de ${signal === 'NEUTRO' ? '⚖️ NEUTRO' : signal === 'COMPRA' ? '🔺 COMPRA' : '🔻 VENDA'} ${strength} (${favor})`;
    })(),
    `Score institucional: ${total > 0 ? '+' : ''}${total}`,
    `Cotação: ${fmtPrice(snapshot.quote ?? null)}`,
    '',
    '🌎 Índices globais:',
    ...indicatorLines,
    '',
    '📊 Resumo:',
    `- ${volumeSummary()}`,
    (() => {
      const change = getChange(snapshot, volIndexSymbol);
      if (change !== null && !Number.isNaN(change)) {
        return `- ⚠️ ${volIndexSymbol === '^VIX' ? 'VIX' : 'VHSI'}: ${fmtPct(change)}`;
      }
      const rawEntry = getIndexSnapshotEntry(volIndexSymbol);
      const price = rawEntry?.price;
      if (price !== undefined && price !== null && !Number.isNaN(price)) {
        return `- ⚠️ ${volIndexSymbol === '^VIX' ? 'VIX' : 'VHSI'}: ${fmtPrice(price)} (preço)`;
      }
      return `- ⚠️ ${volIndexSymbol === '^VIX' ? 'VIX' : 'VHSI'}: dado ausente`;
    })(),
    `- ${breadthSummary()}`,
    '',
    '⚡️ Siga as zonas SMC/FVG para melhor entrada.',
    '',
    `Acesse: ${siteUrl}`,
    '',
    'Para ver os dados detalhadamente!'
  ];

  return { message: lines.join('\n'), signal, strength, score: total };
};

async function sendSignalFromSnapshot(assetSymbol: string, label: string) {
  const file = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
  if (!fs.existsSync(file)) {
    console.warn(`[SNAPSHOT] Arquivo não encontrado (${file}); coletando agora...`);
    await collectSnapshot(assetSymbol, label);
  }
  if (!fs.existsSync(file)) {
    console.error(`[SNAPSHOT] Ainda não foi possível criar o snapshot: ${file}`);
    return;
  }
  let snapshot: Snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
  snapshot = await ensureSnapshotData(assetSymbol, snapshot, file);
  snapshot = await refreshCriticalSnapshotFields(assetSymbol, snapshot, file);
  // Usa apenas os dados coletados do TradingView
  const indicesMap = assetSymbol === 'HK50' ? INDEX_MAP_HK50 : INDEX_MAP_US30;
  const tvIndices = loadTradingViewIndices();
  const tvQuote = loadTradingViewQuote(assetSymbol);

  const { total: score } = computeScore(assetSymbol, snapshot);
  const signal = resolveSignal(score);
  const strength = resolveStrength(score);

  if (signal === 'NEUTRO') {
    console.log(`[SINAL] Score neutro para ${assetSymbol} (${label}), nada enviado.`);
    return;
  }

  // Monta contexto apenas com dados do indices_snapshot.json
  const indicesCtx = JSON.parse(fs.readFileSync('indices_snapshot.json', 'utf-8')).indices;

  await sendTelegramSignal(
    assetSymbol,
    signal,
    strength,
    score,
    {
      quote: tvQuote ?? snapshot.quote ?? undefined,
      indices: indicesCtx,
      volumeBuy: snapshot.volume?.buyPercent,
      volumeSell: snapshot.volume?.sellPercent,
      breadthAdv: snapshot.breadth?.summary?.advancing,
      breadthDec: snapshot.breadth?.summary?.declining
    }
  );
  console.log(`[SINAL] Sinal enviado para ${assetSymbol} usando snapshot ${label}`);

}

// Função para enviar análise detalhada usando snapshot
async function sendAnalysisFromSnapshot(assetSymbol: string, label: string) {
  const file = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
  if (!fs.existsSync(file)) {
    console.warn(`[SNAPSHOT] Arquivo não encontrado (${file}); coletando agora...`);
    await collectSnapshot(assetSymbol, label);
  }
  if (!fs.existsSync(file)) {
    console.error(`[SNAPSHOT] Ainda não foi possível criar o snapshot: ${file}`);
    return;
  }
  let snapshot: Snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
  snapshot = await ensureSnapshotData(assetSymbol, snapshot, file);
  snapshot = await refreshCriticalSnapshotFields(assetSymbol, snapshot, file);
  const tvIndices = loadTradingViewIndices();
  const tvQuote = loadTradingViewQuote(assetSymbol);
  if ((snapshot.quote === null || snapshot.quote === undefined) && tvQuote !== undefined) {
    snapshot.quote = tvQuote;
  }
  const { message, score, signal, strength } = buildAnalysisMessage(assetSymbol, label, snapshot, tvIndices);
  await sendTelegramAnalysis(message);
  console.log(`[ANALISE] (${assetSymbol}) ${label} | sinal ${signal} ${strength} (score ${score}) enviado.`);
}


const inferAssetsByTime = (): string[] => {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = fmt.format(now).split(':');
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  const minutesOfDay = hour * 60 + minute;

  // Janela HK50: 21:00-23:59 e 00:00-02:00 BRT
  const inHkNight = minutesOfDay >= 21 * 60 || minutesOfDay < 2 * 60;
  // Janela US30: 10:30-13:30 BRT (abrange pré 11h30)
  const inUsMorning = minutesOfDay >= 10 * 60 + 30 && minutesOfDay <= 13 * 60 + 30;

  if (inHkNight && !inUsMorning) return ['HK50'];
  if (inUsMorning && !inHkNight) return ['US30'];
  if (inUsMorning && inHkNight) return ['US30', 'HK50'];
  return ['US30']; // fallback seguro
};

// Se o argumento for "analysis", envia análise detalhada; permite selecionar ativos via TARGET_ASSETS="US30,HK50"
(async () => {
  const label = process.argv[2] || 'open';
  const mode = process.argv[3] || (label === 'preopen' ? 'analysis' : 'signal');
  // Permite selecionar ativos via env ou por inferência
  let assets: string[] = [];
  if (process.env.TARGET_ASSETS) {
    assets = process.env.TARGET_ASSETS.split(',').map(a => a.trim().toUpperCase());
  } else {
    assets = inferAssetsByTime();
  }

  for (const asset of assets) {
    if (mode === 'analysis') {
      await sendAnalysisFromSnapshot(asset, label);
    } else {
      await sendSignalFromSnapshot(asset, label);
    }
  }
})();
