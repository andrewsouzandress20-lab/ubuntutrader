// Adiciona declaração global para evitar erro TS
declare global {
  interface Window {
    __UBUNTU_TRADER_SIGNAL_DATA__?: any;
  }
}
    // Buscar dados dos índices globais
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

// In browser builds we avoid filesystem access; in server/CLI we don't need TXT persistence.
const writeMessageToFile = (_message: string): string | null => null;

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

const fmtOneDec = (v: any) => {
  const num = parseFloat(String(v));
  if (Number.isNaN(num)) return String(v ?? '-');
  return num.toFixed(1);
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

// ...existing code...
  // Montar string dos índices globais
  const indicesMsg = context?.indices
    ? Object.entries(context.indices).map(([nome, price]) => {
        if (nome === 'S&P 500') nome = 'SP500';
        if (nome === 'NASDAQ') nome = 'NASDAQ';
        if (nome === 'VIX') nome = 'VIX';
        if (nome === 'DXY') nome = 'DXY';
        if (nome === 'NIKKEI 225') nome = '10Y';
        if (nome === 'RUSSELL 2000') nome = 'RUSSELL 2000';
        return `${nome}: ${price !== 0 ? price : '⚠️ dado ausente'}`;
      }).join('\n')
    : '';

    // ...existing code...
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

  const impactText = (value: any, preferPositive: boolean, isBuyContext: boolean) => {
    const num = toNum(value);
    if (Number.isNaN(num)) return `(sem dado para ${isBuyContext ? 'COMPRA' : 'VENDA'})`;
    if (num === 0) return `(neutro para ${isBuyContext ? 'COMPRA' : 'VENDA'})`;
    const fav = preferPositive ? num > 0 : num < 0;
    const dir = isBuyContext ? 'COMPRA' : 'VENDA';
    return fav ? `(favorável para ${dir})` : `(desfavorável para ${dir})`;
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

  const siteUrl = getEnvVar('VITE_SITE_URL') || getEnvVar('SITE_URL') || 'https://ubuntutrader.com.br/';

  const quoteLine = quoteChange !== undefined && quoteChange !== null && quoteChange !== ''
    ? `Cotação: ${fmtNum(quote)} (${fmtPct(quoteChange)})`
    : `Cotação: ${fmtNum(quote)}`;

  let message = '';

  const arrow = isBuy ? '🔺' : '🔻';
  const signalText = `${arrow} ${signal}`;

  if (assetSymbol === 'HK50') {
    const hkVolumeLine = isBuy
      ? `- 📈 Volume comprador dominante (${fmtOneDec(volumeBuy)}% compra)`
      : `- 📉 Volume vendedor dominante (${fmtOneDec(volumeSell)}% venda)`;

    message = [
      '🧠 ABERTURA',
      '',
      `🇭🇰 HK50: Sinal de ${signalText} ${strength}`,
      `Score institucional: ${score > 0 ? '+' : ''}${score}`,
      quoteLine,
      '',
      '🌎 Índices globais:',
      `🥇 VHSI: ${vhsi?.changePctStr ?? '-'} ${vhsiMood} ${impact(vhsi, !isBuy)} ${impactText(vhsi, !isBuy, isBuy)}`,
      `🇨🇳 CNH (USD/CNH): ${cnh?.changePctStr ?? '-'} ${impact(cnh, !isBuy)} ${impactText(cnh, !isBuy, isBuy)}`,
      `🇯🇵 Nikkei 225: ${nikkei?.changePctStr ?? '-'} ${impact(nikkei, isBuy)} ${impactText(nikkei, isBuy, isBuy)}`,
      `🇨🇳 SSE: ${sse?.changePctStr ?? '-'} ${impact(sse, isBuy)} ${impactText(sse, isBuy, isBuy)}`,
      `🇺🇸 US500: ${us500?.changePctStr ?? '-'} ${impact(us500, isBuy)} ${impactText(us500, isBuy, isBuy)}`,
      `🇺🇸 USD/JPY: ${usdjpy?.changePctStr ?? '-'} ${impact(usdjpy, !isBuy)} ${impactText(usdjpy, !isBuy, isBuy)}`,
      `💵 DXY: ${dxyHK?.changePctStr ?? '-'} ${impact(dxyHK, !isBuy)} ${impactText(dxyHK, !isBuy, isBuy)}`,
      '',
      '📊 Resumo:',
      hkVolumeLine,
      `- ${vixResumo}`,
      `- ${breadthResumo}`,
      `- ${gapResumo}`,
      '',
      '⚡️ Siga as zonas SMC/FVG para melhor entrada.',
      '',
      `Acesse: ${siteUrl}`,
      '',
      'Para ver os dados detalhadamente!'
    ].join('\n');
  } else {
    const volumeLine = isBuy
      ? `- 📈 Volume comprador dominante (${fmtOneDec(volumeBuy)}% compra)`
      : `- 📉 Volume vendedor dominante (${fmtOneDec(volumeSell)}% venda)`;

    message = [
      '🧠 ABERTURA',
      '',
      `🇺🇸 US30: Sinal de ${signalText} ${strength}`,
      `Score institucional: ${score > 0 ? '+' : ''}${score}`,
      quoteLine,
      '',
      '🌎 Índices globais:',
      `🥇 VIX: ${vix?.changePctStr ?? '-'} ${vixMood} ${impact(vix, !isBuy)} ${impactText(vix, !isBuy, isBuy)}`,
      `🇺🇸 S&P 500: ${sp500?.changePctStr ?? '-'} ${impact(sp500, isBuy)} ${impactText(sp500, isBuy, isBuy)}`,
      `🇺🇸 NASDAQ: ${nasdaq?.changePctStr ?? '-'} ${impact(nasdaq, isBuy)} ${impactText(nasdaq, isBuy, isBuy)}`,
      `💵 DXY: ${dxy?.changePctStr ?? '-'} ${impact(dxy, !isBuy)} ${impactText(dxy, !isBuy, isBuy)}`,
      `🇺🇸 10Y: ${tnx?.changePctStr ?? '-'} ${impact(tnx, !isBuy)} ${impactText(tnx, !isBuy, isBuy)}`,
      `🇺🇸 Russell 2000: ${russell?.changePctStr ?? '-'} ${impact(russell, isBuy)} ${impactText(russell, isBuy, isBuy)}`,
      '',
      '📊 Resumo:',
      volumeLine,
      `- ${vixResumo}`,
      `- ${breadthResumo}`,
      `- ${gapResumo}`,
      '',
      '⚡️ Siga as zonas SMC/FVG para melhor entrada.',
      '',
      `Acesse: ${siteUrl}`,
      '',
      'Para ver os dados detalhadamente!'
    ].join('\n');
  }

  try {
    writeMessageToFile(message);

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
    writeMessageToFile(message);

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
