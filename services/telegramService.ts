// Adiciona declaração global para evitar erro TS
declare global {
  interface Window {
    __UBUNTU_TRADER_SIGNAL_DATA__?: any;
  }
}

import * as fs from 'fs';

function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[name]) return process.env[name];
    if (name.startsWith('VITE_')) {
      const noPrefix = name.replace(/^VITE_/, '');
      if (process.env[noPrefix]) return process.env[noPrefix];
    } else {
      const withPrefix = 'VITE_' + name;
      if (process.env[withPrefix]) return process.env[withPrefix];
    }
  }
  return undefined;
}

const resolveBackendUrl = (): string | undefined => {
  const url = getEnvVar('VITE_BACKEND_URL') || getEnvVar('BACKEND_URL');
  if (!url) return undefined;
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const resolveTelegramCreds = () => {
  const botToken = getEnvVar('VITE_TELEGRAM_BOT_TOKEN') || getEnvVar('TELEGRAM_BOT_TOKEN');
  const chatId = getEnvVar('VITE_TELEGRAM_CHAT_ID') || getEnvVar('TELEGRAM_CHAT_ID');
  return { botToken, chatId };
};

const resolveMessagePath = (): string => {
  const p = getEnvVar('SIGNAL_TEXT_PATH') || getEnvVar('VITE_SIGNAL_TEXT_PATH');
  return p && p.trim().length > 0 ? p : 'signal_message.txt';
};

const writeMessageToFile = (message: string): string => {
  const path = resolveMessagePath();
  try {
    fs.writeFileSync(path, message, 'utf-8');
  } catch (err) {
    console.warn('[TELEGRAM] Falha ao gravar mensagem em txt:', err);
  }
  return path;
};

const fmtPct = (v: any) => {
  const num = parseFloat(String(v));
  if (Number.isNaN(num)) return String(v ?? '-');
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const fmtNum = (v: any) => {
  const num = parseFloat(String(v));
  if (Number.isNaN(num)) return String(v ?? '-');
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const fmtInt = (v: any) => {
  const num = parseFloat(String(v));
  if (Number.isNaN(num)) return String(v ?? '-');
  return num.toFixed(0);
};

export const sendTelegramSignal = async (
  assetSymbol: string,
  signal: string,
  strength: string,
  score: number,
  context?: {
    quote?: number | string | null;
    quoteChange?: number | string | null;
    indices?: Record<string, number | string>;
    volumeBuy?: number | string;
    volumeSell?: number | string;
    breadthAdv?: number | string;
    breadthDec?: number | string;
    gap?: number | string;
  }
): Promise<void> => {
  if (signal === 'NEUTRO') {
    console.log(`[${new Date().toISOString()}] Sinal neutro, nenhuma mensagem enviada ao Telegram.`);
    return;
  }
  const toNum = (v: any): number => {
    const num = parseFloat(String(v).replace(/[^0-9\-\.]/g, ''));
    return Number.isNaN(num) ? 0 : num;
  };

    const isBuy = signal === 'COMPRA'; // This line determines if the signal is a buy signal

  const quote = context?.quote ?? '-';
  const quoteChange = context?.quoteChange ?? undefined;
  const indices = context?.indices ?? {};
  const volumeBuy = context?.volumeBuy ?? '-';
  const volumeSell = context?.volumeSell ?? '-';
  const breadthAdv = context?.breadthAdv ?? '-';
  const breadthDec = context?.breadthDec ?? '-';
  const gap = context?.gap ?? '-';

  // US set
  const vix = indices.VIX ?? '-';
  const sp500 = indices.SP500 ?? indices['S&P 500'] ?? '-';
  const nasdaq = indices.NASDAQ ?? indices['NASDAQ'] ?? '-';
  const russell = indices.RUT ?? indices['RUSSELL'] ?? '-';
  const tnx = indices.TNX ?? indices['10Y'] ?? '-';
  const dxy = indices.DXY ?? '-';

  // HK set
  const vhsi = indices.VHSI ?? '-';
  const cnh = indices.CNH ?? indices['USD/CNH'] ?? '-';
  const nikkei = indices.NIKKEI ?? '-';
  const sse = indices.SSE ?? '-';
  const us500 = indices.US500 ?? indices['US500'] ?? '-';
  const usdjpy = indices.USDJPY ?? indices['USD/JPY'] ?? '-';
  const dxyHK = indices.DXY ?? '-';

  const vixMood = toNum(vix) < 0 ? '😌' : '⚠️';
  const vhsiMood = toNum(vhsi) < 0 ? '😱' : '⚠️';

  const impact = (value: any, preferPositive: boolean) => {
    const num = toNum(value);
    if (Number.isNaN(num)) return '⚠️';
    if (num === 0) return '⚖️';
    return preferPositive ? (num > 0 ? '✅' : '❌') : (num < 0 ? '✅' : '❌');
  };

  const volumeResumo = isBuy
    ? `📈 Volume comprador dominante (${fmtInt(volumeBuy)}% compra)`
    : `📉 Volume vendedor dominante (${fmtInt(volumeSell)}% venda)`;
  const vixResumo = assetSymbol === 'US30'
    ? `${vixMood} VIX em ${toNum(vix) < 0 ? 'queda' : 'alta'} (${fmtPct(vix)})`
    : `${vhsiMood} VHSI em ${toNum(vhsi) < 0 ? 'queda' : 'alta'} (${fmtPct(vhsi)})`;
  const breadthResumo = score > 0
    ? `🟢 Breadth positivo (${breadthAdv} alta, ${breadthDec} baixa)`
    : `🔴 Breadth negativo (${breadthAdv} alta, ${breadthDec} baixa)`;
  const gapNum = toNum(gap);
  const gapBias = Number.isNaN(gapNum)
    ? ''
    : gapNum > 0
      ? ' (favorável à compra)'
      : gapNum < 0
        ? ' (favorável à venda)'
        : ' (neutro)';
  const gapResumo = `🕳️ Gap de abertura: ${fmtPct(gap)}${gapBias}`;

  const quoteLine = quoteChange !== undefined && quoteChange !== null && quoteChange !== ''
    ? `Cotação: ${fmtNum(quote)} (${fmtPct(quoteChange)})`
    : `Cotação: ${fmtNum(quote)}`;

  let message = '';

  const arrow = isBuy ? '🔺' : '🔻';
  const signalText = `${arrow} ${signal}`;

  if (assetSymbol === 'HK50') {
    message = [
      '🕒 ABERTURA',
      '',
      `🇭🇰 HK50: Sinal de ${signalText} ${strength}`,
      `Score institucional: ${score > 0 ? '+' : ''}${score}`,
      quoteLine,
      '',
      '🌎 Índices globais:',
      `🥇 VHSI: ${fmtPct(vhsi)} ${vhsiMood} ${impact(vhsi, !isBuy)}`,
      `🇨🇳 CNH (USD/CNH): ${fmtPct(cnh)} ${impact(cnh, !isBuy)}`,
      `🇯🇵 Nikkei 225: ${fmtPct(nikkei)} ${impact(nikkei, isBuy)}`,
      `🇨🇳 SSE: ${fmtPct(sse)} ${impact(sse, isBuy)}`,
      `🇺🇸 US500: ${fmtPct(us500)} ${impact(us500, isBuy)}`,
      `🇺🇸 USD/JPY: ${fmtPct(usdjpy)} ${impact(usdjpy, !isBuy)}`,
      `💵 DXY: ${fmtPct(dxyHK)} ${impact(dxyHK, !isBuy)}`,
      '',
      '📊 Resumo:',
      `- ${volumeResumo}`,
      `- ${vixResumo}`,
      `- ${breadthResumo}`,
      `- ${gapResumo}`,
      '',
      '⚡️ Siga as zonas SMC/FGV para melhor entrada.'
    ].join('\n');
  } else {
    message = [
      '🕒 ABERTURA',
      '',
      `🇺🇸 US30: Sinal de ${signalText} ${strength}`,
      `Score institucional: ${score > 0 ? '+' : ''}${score}`,
      quoteLine,
      '',
      '🌎 Índices globais:',
      `🥇 VIX: ${fmtPct(vix)} ${vixMood} ${impact(vix, !isBuy)}`,
      `🇺🇸 S&P 500: ${fmtPct(sp500)} ${impact(sp500, isBuy)}`,
      `🇺🇸 NASDAQ: ${fmtPct(nasdaq)} ${impact(nasdaq, isBuy)}`,
      `💵 DXY: ${fmtPct(dxy)} ${impact(dxy, !isBuy)}`,
      `🇺🇸 10Y: ${fmtPct(tnx)} ${impact(tnx, !isBuy)}`,
      `🇺🇸 Russell 2000: ${fmtPct(russell)} ${impact(russell, isBuy)}`,
      '',
      '📊 Resumo:',
      `- ${volumeResumo}`,
      `- ${vixResumo}`,
      `- ${breadthResumo}`,
      `- ${gapResumo}`,
      '',
      '⚡️ Siga as zonas SMC/FGV para melhor entrada.'
    ].join('\n');
  }

  try {
    const messageFile = writeMessageToFile(message);
    try {
      message = fs.readFileSync(messageFile, 'utf-8');
    } catch (err) {
      console.warn('[TELEGRAM] Não foi possível reler o TXT, usando mensagem em memória:', err);
    }

    const backendUrl = resolveBackendUrl();
    const { botToken, chatId } = resolveTelegramCreds();
    const now = new Date().toISOString();
    let sent = false;
    const errors: string[] = [];

    if (backendUrl) {
      try {
        const response = await fetch(`${backendUrl}/api/send-telegram`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: message }),
        });
        const data = await response.json();
        if (data?.ok) {
          console.log(`[${now}] Mensagem enviada pelo backend (${backendUrl})`, { response: data });
          sent = true;
        } else {
          errors.push(`Backend respondeu erro: ${data?.error || 'desconhecido'}`);
        }
      } catch (err: any) {
        errors.push(`Falha no backend: ${err?.message || err}`);
      }
    } else {
      errors.push('Backend URL não configurada');
    }

    if (!sent && botToken && chatId) {
      try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const payload = { chat_id: chatId, text: message, parse_mode: 'Markdown' };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data?.ok) {
          console.log(`[${now}] Mensagem enviada diretamente ao Telegram (fallback)`, { response: data });
          sent = true;
        } else {
          errors.push(`Telegram API erro: ${data?.description || 'desconhecido'}`);
        }
      } catch (err: any) {
        errors.push(`Falha no fallback Telegram: ${err?.message || err}`);
      }
    } else if (!sent) {
      errors.push('Credenciais do Telegram ausentes para fallback');
    }

    if (!sent) {
      console.error(`[${now}] Não foi possível enviar a mensagem para o Telegram`, { errors, message });
    }
  } catch (error) {
    const now = new Date().toISOString();
    console.error(`[${now}] Erro inesperado ao tentar enviar sinal`, error, { message });
  }
};

/**
 * Envia uma análise detalhada para o Telegram.
 * @param message - Texto da análise detalhada.
 */
export const sendTelegramAnalysis = async (message: string): Promise<void> => {
  try {
    const messageFile = writeMessageToFile(message);
    try {
      message = fs.readFileSync(messageFile, 'utf-8');
    } catch (err) {
      console.warn('[TELEGRAM] Não foi possível reler o TXT (analysis), usando mensagem em memória:', err);
    }

    const backendUrl = resolveBackendUrl();
    const { botToken, chatId } = resolveTelegramCreds();
    const now = new Date().toISOString();
    let sent = false;
    const errors: string[] = [];

    if (backendUrl) {
      try {
        const response = await fetch(`${backendUrl}/api/send-telegram`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: message }),
        });
        const data = await response.json();
        if (data?.ok) {
          console.log(`[${now}] Análise enviada pelo backend (${backendUrl})`, { response: data });
          sent = true;
        } else {
          errors.push(`Backend respondeu erro: ${data?.error || 'desconhecido'}`);
        }
      } catch (err: any) {
        errors.push(`Falha no backend: ${err?.message || err}`);
      }
    } else {
      errors.push('Backend URL não configurada');
    }

    if (!sent && botToken && chatId) {
      try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const payload = { chat_id: chatId, text: message, parse_mode: 'Markdown' };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data?.ok) {
          console.log(`[${now}] Análise enviada diretamente ao Telegram (fallback)`, { response: data });
          sent = true;
        } else {
          errors.push(`Telegram API erro: ${data?.description || 'desconhecido'}`);
        }
      } catch (err: any) {
        errors.push(`Falha no fallback Telegram: ${err?.message || err}`);
      }
    } else if (!sent) {
      errors.push('Credenciais do Telegram ausentes para fallback');
    }

    if (!sent) {
      console.error(`[${now}] Não foi possível enviar a análise para o Telegram`, { errors, message });
    }
  } catch (error) {
    const now = new Date().toISOString();
    console.error(`[${now}] Erro inesperado ao tentar enviar análise`, error, { message });
  }
};
