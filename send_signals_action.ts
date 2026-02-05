import 'dotenv/config';
import * as fs from 'fs';
import { sendTelegramSignal, sendTelegramAnalysis } from './services/telegramService.js';


type Snapshot = {
  quote?: number | null;
  indices?: { symbol: string; price?: number; change?: number }[];
  volume?: { buyPercent?: number; sellPercent?: number };
  breadth?: { summary?: { advancing?: number; declining?: number } };
  gap?: { percent?: number };
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
  '^TNX': 'TNX',
  '^RUT': 'RUT'
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
      const priceRaw = (data as any)?.price;
      if (priceRaw === null || priceRaw === undefined) return;
      const num = parseFloat(String(priceRaw).replace(/,/g, ''));
      if (!Number.isNaN(num)) out[key] = num;
    });
    return out;
  } catch (error) {
    console.warn('[TV SNAPSHOT] Falha ao ler indices_snapshot.json:', error);
    return {};
  }
};

const mapIndices = (snapshot: Snapshot, map: Record<string, string>): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!snapshot.indices) return out;
  snapshot.indices.forEach(entry => {
    const key = map[entry.symbol];
    if (key && typeof entry.price === 'number') out[key] = entry.price;
  });
  return out;
};

const getChange = (snapshot: Snapshot, symbols: string | string[]): number | null => {
  const list = Array.isArray(symbols) ? symbols : [symbols];
  const found = snapshot.indices?.find(i => list.includes(i.symbol));
  return typeof found?.change === 'number' ? found.change : null;
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
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

  const indicesListUS = ['^GSPC', '^IXIC', '^RUT'];
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

const buildAnalysisMessage = (assetSymbol: string, label: string, snapshot: Snapshot) => {
  const { total, parts } = computeScore(assetSymbol, snapshot);
  const signal = resolveSignal(total);
  const strength = resolveStrength(total);

  const volumeBuy = snapshot.volume?.buyPercent ?? null;
  const volumeSell = snapshot.volume?.sellPercent ?? null;
  const adv = snapshot.breadth?.summary?.advancing ?? 0;
  const dec = snapshot.breadth?.summary?.declining ?? 0;
  const gapPercent = snapshot.gap?.percent ?? null;
  const dxyChange = getChange(snapshot, 'DX-Y.NYB');
  const volIndexChange = assetSymbol === 'HK50'
    ? getChange(snapshot, '^VHSI')
    : getChange(snapshot, '^VIX');
  const labelText = label === 'preopen' ? 'PRÉ-ABERTURA' : label.toUpperCase();

  const headerAsset = assetSymbol === 'HK50' ? '🇭🇰 HK50' : '🇺🇸 US30';
  const volIndexName = assetSymbol === 'HK50' ? 'VHSI' : 'VIX';

  const indexSummary = () => {
    const relevant = assetSymbol === 'HK50'
      ? ['^N225', '000001.SS', '^GSPC']
      : ['^GSPC', '^IXIC', '^RUT'];
    let pos = 0; let neg = 0; const labels: string[] = [];
    relevant.forEach(sym => {
      const change = getChange(snapshot, sym);
      if (change === null) return;
      if (change > 0) pos += 1; else if (change < 0) neg += 1;
      labels.push(`${sym}: ${formatPercent(change)}`);
    });
    const direction = pos === neg ? '⚖️ Neutro' : pos > neg ? '🟢 Risk-on' : '🔴 Risk-off';
    return `${direction} (${pos}↑ / ${neg}↓) | ${labels.join(' · ')}`;
  };

  const lines = [
    `🧠 ${labelText} • ${headerAsset}`,
    `Sinal institucional: ${signal === 'NEUTRO' ? '⚖️ NEUTRO' : signal === 'COMPRA' ? '🔺 COMPRA' : '🔻 VENDA'} ${strength} (score ${total > 0 ? '+' : ''}${total})`,
    snapshot.quote ? `Cotação: ${snapshot.quote}` : 'Cotação: -',
    '',
    'Checklist rápido:',
    `- Volume: ${volumeBuy !== null && volumeSell !== null ? `${volumeBuy.toFixed(1)}% compra vs ${volumeSell.toFixed(1)}% venda` : 'dados indisponíveis'} ${parts.volume > 0 ? '🟢' : parts.volume < 0 ? '🔴' : '⚖️'}`,
    `- ${volIndexName}: ${formatPercent(volIndexChange)} ${parts.volIndex > 0 ? '😌 Queda favorece compra' : parts.volIndex < 0 ? '⚠️ Alta pressiona venda' : 'sem dado'}`,
    `- Breadth: ${adv} alta x ${dec} baixa ${parts.breadth > 0 ? '🟢' : parts.breadth < 0 ? '🔴' : '⚖️'}`,
    `- Índices chave: ${indexSummary()}`,
    `- DXY: ${formatPercent(dxyChange)} ${parts.dxy > 0 ? '🟢 Risk-on' : parts.dxy < 0 ? '🔴 Risk-off' : 'sem dado'}`,
    `- Gap de abertura: ${gapPercent !== null ? formatPercent(gapPercent) : '-'} ${parts.gap === 0 ? '⚖️ neutro' : parts.gap > 0 ? '🟢 a favor de compra' : '🔴 a favor de venda'}`,
    '',
    'Decisão:',
    signal === 'NEUTRO'
      ? '⚖️ Neutro — aguarde confirmação de preço/volume.'
      : `${signal === 'COMPRA' ? '🔺 Fluxo comprador alinhado' : '🔻 Fluxo vendedor alinhado'} | Força: ${strength}`,
    '⚡️ Siga as zonas SMC/FVG para melhor entrada.'
  ];

  return { message: lines.join('\n'), signal, strength, score: total };
};

async function sendSignalFromSnapshot(assetSymbol: string, label: string) {
  const file = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
  if (!fs.existsSync(file)) {
    console.error(`[SNAPSHOT] Arquivo não encontrado: ${file}`);
    return;
  }
  const snapshot: Snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const indicesMap = assetSymbol === 'HK50' ? INDEX_MAP_HK50 : INDEX_MAP_US30;
  const tvIndices = loadTradingViewIndices();

  const { total: score } = computeScore(assetSymbol, snapshot);
  const signal = resolveSignal(score);
  const strength = resolveStrength(score);

  if (signal === 'NEUTRO') {
    console.log(`[SINAL] Score neutro para ${assetSymbol} (${label}), nada enviado.`);
    return;
  }

  await sendTelegramSignal(
    assetSymbol,
    signal,
    strength,
    score,
    {
      quote: snapshot.quote ?? undefined,
        // TradingView (11h30) tem prioridade; se não vier, usamos Yahoo do snapshot atual
        indices: { ...mapIndices(snapshot, indicesMap), ...tvIndices },
      volumeBuy: snapshot.volume?.buyPercent,
      volumeSell: snapshot.volume?.sellPercent,
      breadthAdv: snapshot.breadth?.summary?.advancing,
      breadthDec: snapshot.breadth?.summary?.declining,
      gap: snapshot.gap?.percent
    }
  );
  console.log(`[SINAL] Sinal enviado para ${assetSymbol} usando snapshot ${label}`);

}

// Função para enviar análise detalhada usando snapshot
async function sendAnalysisFromSnapshot(assetSymbol: string, label: string) {
  const file = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
  if (!fs.existsSync(file)) {
    console.error(`[SNAPSHOT] Arquivo não encontrado: ${file}`);
    return;
  }
  const snapshot: Snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { message, score, signal, strength } = buildAnalysisMessage(assetSymbol, label, snapshot);
  await sendTelegramAnalysis(message);
  console.log(`[ANALISE] (${assetSymbol}) ${label} | sinal ${signal} ${strength} (score ${score}) enviado.`);
}


// Se o argumento for "analysis", envia análise detalhada, senão envia sinal padrão
(async () => {
  const label = process.argv[2] || 'open';
  const mode = process.argv[3] || (label === 'preopen' ? 'analysis' : 'signal');
  if (mode === 'analysis') {
    await sendAnalysisFromSnapshot('US30', label);
    await sendAnalysisFromSnapshot('HK50', label);
  } else {
    await sendSignalFromSnapshot('US30', label);
    await sendSignalFromSnapshot('HK50', label);
  }
})();
