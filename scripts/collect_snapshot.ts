import 'dotenv/config';
import { SUPPORTED_ASSETS, CorrelationData } from '../types.js';
import { fetchCurrentPrice, fetchCorrelationData, fetchMarketBreadth, fetchRealData, calculateVolumePressure, detectOpeningGap } from '../services/dataService.js';
import * as fs from 'fs';

const loadTradingViewSnapshot = (): Record<string, number> => {
  const file = 'indices_snapshot.json';
  if (!fs.existsSync(file)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const out: Record<string, number> = {};
    Object.entries(raw?.indices ?? {}).forEach(([sym, data]: any) => {
      const priceRaw = (data as any)?.price;
      if (priceRaw === null || priceRaw === undefined) return;
      const num = parseFloat(String(priceRaw).replace(/,/g, ''));
      if (!Number.isNaN(num)) out[sym] = num;
    });
    return out;
  } catch {
    return {};
  }
};

const tvLookup = (tv: Record<string, number>, sym: string): number | undefined => {
  if (sym in tv) return tv[sym];
  if (sym.startsWith('^') && sym.slice(1) in tv) return tv[sym.slice(1)];
  const alt: Record<string, string> = {
    '^GSPC': 'US500',
    '^IXIC': 'US100',
    'DX-Y.NYB': 'DXY',
    '^N225': 'JP225',
    '^VHSI': 'VHSI'
  };
  const mapped = alt[sym];
  if (mapped && mapped in tv) return tv[mapped];
  return undefined;
};

const fallbackQuoteFromTV = (assetSymbol: string, tv: Record<string, number>): number | null => {
  const val = tv[assetSymbol];
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
};

const fallbackCorrelationFromTV = (assetSymbol: string, tv: Record<string, number>): CorrelationData[] => {
  const pushIf = (list: CorrelationData[], sym: string, name: string, corr: 'positive' | 'negative') => {
    const val = tvLookup(tv, sym);
    if (typeof val === 'number' && !Number.isNaN(val)) {
      // sem variação disponível no snapshot do TradingView; deixa change indefinido
      list.push({ symbol: sym, name, price: val, change: undefined as any, correlation: corr });
    }
  };
  const list: CorrelationData[] = [];
  if (assetSymbol === 'HK50') {
    // Usar os mesmos símbolos esperados no restante do código (Yahoo-style)
    pushIf(list, '^VHSI', 'VHSI', 'negative');
    pushIf(list, 'CNH=X', 'CNH', 'negative');
    pushIf(list, '^N225', 'Nikkei', 'positive');
    pushIf(list, '000001.SS', 'SSE', 'positive');
    pushIf(list, '^GSPC', 'US500', 'positive');
    pushIf(list, 'USDJPY=X', 'USDJPY', 'negative');
    pushIf(list, 'DX-Y.NYB', 'DXY', 'negative');
  } else {
    pushIf(list, '^VIX', 'VIX', 'negative');
    pushIf(list, '^GSPC', 'S&P 500', 'positive');
    pushIf(list, '^IXIC', 'NASDAQ', 'positive');
    pushIf(list, 'DX-Y.NYB', 'DXY', 'negative');
    pushIf(list, '^TNX', 'TNX', 'negative');
    pushIf(list, '^RUT', 'RUT', 'positive');
  }
  return list;
};

const tvSnapshot = loadTradingViewSnapshot();

async function collectSnapshot(assetSymbol: string, label: string) {
  const asset = SUPPORTED_ASSETS.find(a => a.symbol === assetSymbol);
  if (!asset) throw new Error('Ativo não suportado: ' + assetSymbol);

  const candles = await fetchRealData(asset, '1m');
  const quoteYahoo = await fetchCurrentPrice(asset);
  const indicesYahoo = await fetchCorrelationData(assetSymbol);
  const breadth = await fetchMarketBreadth(assetSymbol);
  const volume = calculateVolumePressure(candles);
  const gap = detectOpeningGap(candles, asset);

  const tvQuote = fallbackQuoteFromTV(assetSymbol, tvSnapshot);
  const quote = tvQuote ?? quoteYahoo;
  const indicesTV = fallbackCorrelationFromTV(assetSymbol, tvSnapshot);
  const indices = indicesTV.length > 0 ? indicesTV : (indicesYahoo && indicesYahoo.length > 0 ? indicesYahoo : []);

  const snapshot = {
    timestamp: new Date().toISOString(),
    asset: assetSymbol,
    label,
    quote,
    indices,
    breadth,
    volume,
    gap
  };

  const outPath = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
  fs.mkdirSync('snapshots', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`[SNAPSHOT] Dados salvos em ${outPath}`);
}

(async () => {
  const label = process.argv[2] || 'open';
  await collectSnapshot('US30', label);
  await collectSnapshot('HK50', label);
})();
