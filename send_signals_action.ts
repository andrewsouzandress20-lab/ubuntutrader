import 'dotenv/config';
import * as fs from 'fs';
import { sendTelegramSignal, sendTelegramAnalysis } from './services/telegramService.js';
import { collectSnapshot } from './scripts/collect_snapshot.js';
import { fetchCorrelationData, fetchMarketBreadth, fetchRealData, calculateVolumePressure, detectOpeningGap, fetchCurrentPrice, fetchYahooChartPriceChange } from './services/dataService.js';
import { SUPPORTED_ASSETS } from './types.js';
import { spawnSync } from 'child_process';


type Snapshot = {
  quote?: number | null;
  indices?: { symbol: string; price?: number; change?: number }[];
  volume?: { buyPercent?: number; sellPercent?: number };
  breadth?: { summary?: { advancing?: number; declining?: number } };
  gap?: { percent?: number };
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


  // Corrige: se indices for objeto, converte para array de objetos com campo symbol
  if (snapshot.indices && !Array.isArray(snapshot.indices)) {
    snapshot.indices = Object.entries(snapshot.indices).map(([symbol, data]) => {
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return { symbol, ...data };
      } else {
        return { symbol, value: data };
      }
    });
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
  const needGap = !snapshot.gap || snapshot.gap.percent === undefined;
  if (needVolume || needGap) {
    try {
      const candles = await fetchRealData(asset, '1m');
      if (needVolume) {
        snapshot.volume = calculateVolumePressure(candles) as any;
        changed = true;
      }
      if (needGap) {
        const gapData = detectOpeningGap(candles, asset);
        snapshot.gap = { percent: gapData.percent } as any;
        changed = true;
      }
    } catch (err) {
      console.warn('[SNAPSHOT] Falha ao buscar candles para volume/gap:', err);
    }
  }

  if (snapshot.quote === undefined || snapshot.quote === null) {
    // Prioridade: TradingView
    let quote = tvQuote;
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

type ScoreBreakdown = {
  volume: number;
  volIndex: number;
  breadth: number;
  indices: number;
  dxy: number;
  gap: number;
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
  try {
    const res = spawnSync('python3', ['fetch_indices_tradingview.py'], { stdio: 'inherit' });
    if (res.status !== 0) console.warn('[TV] fetch_indices_tradingview.py retornou status', res.status);
  } catch (err) {
    console.warn('[TV] Falha ao executar fetch_indices_tradingview.py:', err);
  }
};

const loadTradingViewIndices = (): Record<string, number> => {
  const file = 'indices_snapshot.json';
  if (!fs.existsSync(file)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const indices = raw?.indices ?? {};
    const out: Record<string, number> = {};
    Object.entries(indices).forEach(([sym, data]: any) => {
      const key = TV_SYMBOL_MAP[sym];
      if (!key) return;
      let priceRaw = (data as any)?.price;
      if (priceRaw === null || priceRaw === undefined) return;
      // Corrige: converte string para número
      if (typeof priceRaw === 'string') priceRaw = parseFloat(priceRaw.replace(/,/g, ''));
      if (typeof priceRaw === 'number' && !Number.isNaN(priceRaw)) out[key] = priceRaw;
    });
    return out;
  } catch (error) {
    console.warn('[TV SNAPSHOT] Falha ao ler indices_snapshot.json:', error);
    return {};
  }
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
  // Adiciona aliases para garantir que encontra o símbolo correto
  const aliasMap: Record<string, string[]> = {
    'VIX': ['VIX', '^VIX'],
    '^VIX': ['VIX', '^VIX'],
    'US500': ['US500', '^GSPC', 'S&P 500'],
    '^GSPC': ['US500', '^GSPC', 'S&P 500'],
    'US100': ['US100', '^IXIC', 'NASDAQ'],
    '^IXIC': ['US100', '^IXIC', 'NASDAQ'],
    'DXY': ['DXY', 'DX-Y.NYB'],
    'DX-Y.NYB': ['DXY', 'DX-Y.NYB'],
  };
  let list = Array.isArray(symbols) ? symbols : [symbols];
  // Expande aliases
  list = list.flatMap(sym => aliasMap[sym] || [sym]);
  const found = snapshot.indices?.find(i => list.includes(i.symbol));
  return typeof found?.change === 'number' ? found.change : null;
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
  if (score > 0) return 'COMPRA';
  if (score < 0) return 'VENDA';
  return 'NEUTRO';
};

const resolveStrength = (score: number): 'FORTE' | 'MODERADA' | 'FRACA' => {
  const abs = Math.abs(score);
  if (abs >= 12) return 'FORTE';
  if (abs >= 7) return 'MODERADA';
  return 'FRACA';
};

const computeScore = (assetSymbol: string, snapshot: Snapshot): { total: number; parts: ScoreBreakdown } => {
  const volumeBuy = snapshot.volume?.buyPercent ?? null;
  const volumeSell = snapshot.volume?.sellPercent ?? null;
  const volumeScore = volumeBuy !== null && volumeSell !== null
    ? (volumeBuy > volumeSell ? 5 : -5)
    : 0;

  const volIndexChange = assetSymbol === 'HK50'
    ? getChange(snapshot, '^VHSI')
    : getChange(snapshot, '^VIX');
  const volIndexScore = volIndexChange !== null ? (volIndexChange < 0 ? 3 : -3) : 0;

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
  const dxyScore = dxyChange !== null ? (dxyChange < 0 ? 2 : -2) : 0;

  const gapPercent = snapshot.gap?.percent ?? null;
  const gapScore = gapPercent !== null && Math.abs(gapPercent) > 1
    ? (gapPercent > 0 ? 2 : -2)
    : 0;

  const total = volumeScore + volIndexScore + breadthScore + indicesScore + dxyScore + gapScore;
  return {
    total,
    parts: {
      volume: volumeScore,
      volIndex: volIndexScore,
      breadth: breadthScore,
      indices: indicesScore,
      dxy: dxyScore,
      gap: gapScore
    }
  };
};

const buildAnalysisMessage = (assetSymbol: string, label: string, snapshot: Snapshot, tvIndices: Record<string, number>) => {
  // ...existing code...
  const { total } = computeScore(assetSymbol, snapshot);
  const signal = resolveSignal(total);
  const strength = resolveStrength(total);

  const volumeBuy = snapshot.volume?.buyPercent ?? null;
  const volumeSell = snapshot.volume?.sellPercent ?? null;
  const adv = snapshot.breadth?.summary?.advancing ?? 0;
  const dec = snapshot.breadth?.summary?.declining ?? 0;
  const gapPercent = snapshot.gap?.percent ?? null;
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

  // Leitura das empresas do US30 (companies_snapshot.json)
  let us30Companies: { ticker: string; name: string; change?: number }[] = [];
  let us30Resumo = '';
  if (assetSymbol === 'US30') {
    try {
      const path = './companies_snapshot.json';
      const exists = fs.existsSync(path);
      console.log(`[DEBUG] companies_snapshot.json exists: ${exists}`);
      if (exists) {
        const companiesRaw = JSON.parse(fs.readFileSync(path, 'utf-8'));
        console.log('[DEBUG] companies_snapshot.json conteúdo:', JSON.stringify(companiesRaw, null, 2));
        if (companiesRaw?.indices?.US30) {
          us30Companies = companiesRaw.indices.US30.map((c: any) => ({ ticker: c.ticker, name: c.name, change: c.change }));
          console.log(`[DEBUG] us30Companies carregadas: ${us30Companies.length}`);
          // Resumo empresas em alta x baixa (compra x venda) para US30
          if (us30Companies.length > 0) {
            const emAlta = us30Companies.filter(c => typeof c.change === 'number' && c.change > 0).length;
            const emBaixa = us30Companies.filter(c => typeof c.change === 'number' && c.change < 0).length;
            us30Resumo = `Resumo US30: ${emAlta} em alta (compra) / ${emBaixa} em baixa (venda)`;
          }
        } else {
          console.warn('[DEBUG] Campo indices.US30 não encontrado em companies_snapshot.json');
        }
      } else {
        console.warn('[DEBUG] Arquivo companies_snapshot.json não encontrado no diretório atual');
      }
    } catch (err) {
      console.warn('[ANALYSIS] Falha ao ler companies_snapshot.json:', err);
    }
  }

  // ...existing code...
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

  const indicatorLines = relevantSymbols.map(({ label, symbol }) => {
    // Busca variação percentual (change) do snapshot
    const change = getChange(snapshot, symbol);
    if (change !== null && !Number.isNaN(change)) {
      // Determina favorabilidade
      const favor = (signal === 'COMPRA') ? (change > 0) : (change < 0);
      const check = favor ? '✅' : '❌';
      const word = favor ? 'favorável' : 'desfavorável';
      return `${label}: ${fmtPct(change)} ${check} (${word} para ${signal})`;
    } else {
      return `${label}: -`;
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

  const gapSummary = () => {
    if (gapPercent === null) return 'Gap de abertura: -';
    const bias = gapPercent > 0 ? 'favorável à compra' : gapPercent < 0 ? 'favorável à venda' : 'neutro';
    return `Gap de abertura: ${fmtPct(gapPercent)} (${bias})`;
  };

  const headerLine = '🧠 ABERTURA';
  const siteUrl = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://ubuntutrader.com.br/';

  const lines = [
    `${headerLine}`,
    '',
    us30Resumo,
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
    // Removido: lista de empresas do US30
    '',
    '📊 Resumo:',
    `- ${volumeSummary()}`,
    (() => {
      const change = getChange(snapshot, volIndexSymbol);
      if (change !== null && !Number.isNaN(change)) {
        return `- ⚠️ ${volIndexSymbol === '^VIX' ? 'VIX' : 'VHSI'}: ${fmtPct(change)}`;
      }
      return `- ⚠️ ${volIndexSymbol === '^VIX' ? 'VIX' : 'VHSI'}: -`;
    })(),
    `- ${breadthSummary()}`,
    `- 🕳️ ${gapSummary()}`,
    '',
    '⚡️ Siga as zonas SMC/FVG para melhor entrada.',
    '',
    `Acesse: ${siteUrl}`,
    '',
    'Para ver os dados detalhadamente!'
  ];

  // Always return the expected object
  return {
    message: lines.join('\n'),
    score: total,
    signal,
    strength
  };
}

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
  // Usa apenas os dados coletados do TradingView
  const indicesMap = assetSymbol === 'HK50' ? INDEX_MAP_HK50 : INDEX_MAP_US30;
  const tvIndices = loadTradingViewIndices();
  const tvQuote = loadTradingViewQuote(assetSymbol);

  // LOG: Mostrar snapshot bruto
  console.log(`[DEBUG] Snapshot lido (${assetSymbol}, ${label}):`, JSON.stringify(snapshot, null, 2));

  const { total: score } = computeScore(assetSymbol, snapshot);
  const signal = resolveSignal(score);
  const strength = resolveStrength(score);

  if (signal === 'NEUTRO') {
    console.log(`[SINAL] Score neutro para ${assetSymbol} (${label}), nada enviado.`);
    return;
  }

  // Monta contexto apenas com dados do indices_snapshot.json
  const indicesRaw = JSON.parse(fs.readFileSync('indices_snapshot.json', 'utf-8')).indices;
  const indicesCtx: Record<string, number | string> = {};
  Object.entries(indicesRaw).forEach(([key, value]: [string, any]) => {
    indicesCtx[key] = value.price;
  });

  const context = {
    quote: tvQuote ?? snapshot.quote ?? undefined,
    indices: indicesCtx,
    volumeBuy: snapshot.volume?.buyPercent,
    volumeSell: snapshot.volume?.sellPercent,
    breadthAdv: snapshot.breadth?.summary?.advancing,
    breadthDec: snapshot.breadth?.summary?.declining,
    gap: snapshot.gap?.percent
  };
  // LOG: Mostrar contexto enviado para o Telegram
  console.log(`[DEBUG] Contexto enviado para sendTelegramSignal (${assetSymbol}, ${label}):`, JSON.stringify(context, null, 2));
  await sendTelegramSignal(
    assetSymbol,
    signal,
    strength,
    score,
    context
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
  // Atualiza snapshot com dados atuais do TradingView
  const indicesRaw = JSON.parse(fs.readFileSync('indices_snapshot.json', 'utf-8')).indices;
  let snapshot: Snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
  snapshot.indices = [
    { symbol: 'VIX', price: indicesRaw['VIX']?.price, change: indicesRaw['VIX']?.change },
    { symbol: 'US500', price: indicesRaw['US500']?.price, change: indicesRaw['US500']?.change },
    { symbol: 'US100', price: indicesRaw['US100']?.price, change: indicesRaw['US100']?.change },
    { symbol: 'DXY', price: indicesRaw['DXY']?.price, change: indicesRaw['DXY']?.change }
  ].filter(e => e.price !== undefined);
  snapshot.quote = indicesRaw['US30']?.price ?? snapshot.quote;
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  // Garante enriquecimento e conversão correta
  snapshot = await ensureSnapshotData(assetSymbol, snapshot, file);
  const tvIndices: Record<string, number> = {};
  snapshot.indices.forEach((idx: any) => {
    if (idx.symbol && typeof idx.price === 'number') {
      tvIndices[idx.symbol] = idx.price;
    }
  });
  const { message, score, signal, strength } = buildAnalysisMessage(assetSymbol, label, snapshot, tvIndices);
  console.log('[OG TELEGRAM MESSAGE]\n' + message + '\n[END OG TELEGRAM MESSAGE]');
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
