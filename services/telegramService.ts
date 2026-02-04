// Adiciona declaração global para evitar erro TS
declare global {
  interface Window {
    __UBUNTU_TRADER_SIGNAL_DATA__?: any;
  }
}
// Função para obter variáveis de ambiente de forma compatível (Vite ou Node.js)

function getEnvVar(name: string): string | undefined {
  // Node.js (prioritário para execução local e testes)
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
  // Vite (browser) - ignorado no backend
  // No backend, use apenas process.env
  return undefined;
}



/**
 * Envia uma mensagem de sinal de trade para um canal do Telegram.
 * @param assetSymbol - Símbolo do ativo (ex: US30).
 * @param signal - A direção do sinal ('COMPRA', 'VENDA', 'NEUTRO').
 * @param strength - A força do sinal ('FORTE', 'MODERADA', 'FRACA').
 * @param score - O score institucional numérico.
 */
export const sendTelegramSignal = async (
  assetSymbol: string,
  signal: string,
  strength: string,
  score: number
): Promise<void> => {
  if (signal === 'NEUTRO') {
    console.log(`[${new Date().toISOString()}] Sinal neutro, nenhuma mensagem enviada ao Telegram.`);
    return;
  }


  // Buscar dados extras para a mensagem (cotação, índices, volume, breadth, gap)
  let quote = '-';
  let indices: any = {};
  let volume = '-';
  let volumeBuy = '-';
  let volumeSell = '-';
  let breadthAdv = '-';
  let breadthDec = '-';
  let gap = '-';

  // Índices globais para US30
  let vix = '-';
  let dxy = '-';
  let tnx = '-';
  let russell = '-';
  let sp500 = '-';
  let nasdaq = '-';
  let vixEmoji = '';

  // Índices globais para HK50
  let vhsi = '-';
  let cnh = '-';
  let nikkei = '-';
  let sse = '-';
  let us500 = '-';
  let usdjpy = '-';
  let dxy_hk = '-';
  let vhsiEmoji = '';

  if (typeof window !== 'undefined' && window.__UBUNTU_TRADER_SIGNAL_DATA__) {
    const data = window.__UBUNTU_TRADER_SIGNAL_DATA__;
    quote = data.quote || '-';
    indices = data.indices || {};
    volume = data.volume || '-';
    volumeBuy = data.volumeBuy || '-';
    volumeSell = data.volumeSell || '-';
    breadthAdv = data.breadthAdv || '-';
    breadthDec = data.breadthDec || '-';
    gap = data.gap || '-';

    // US30
    vix = indices.VIX !== undefined ? indices.VIX : '-';
    dxy = indices.DXY !== undefined ? indices.DXY : '-';
    tnx = indices.TNX !== undefined ? indices.TNX : '-';
    russell = indices.RUT !== undefined ? indices.RUT : '-';
    sp500 = indices.SP500 !== undefined ? indices.SP500 : '-';
    nasdaq = indices.NASDAQ !== undefined ? indices.NASDAQ : '-';
    vixEmoji = parseFloat(String(vix)) < 0 ? '😌' : '⚠️';

    // HK50
    vhsi = indices.VHSI !== undefined ? indices.VHSI : '-';
    cnh = indices.CNH !== undefined ? indices.CNH : '-';
    nikkei = indices.NIKKEI !== undefined ? indices.NIKKEI : '-';
    sse = indices.SSE !== undefined ? indices.SSE : '-';
    us500 = indices.US500 !== undefined ? indices.US500 : '-';
    usdjpy = indices.USDJPY !== undefined ? indices.USDJPY : '-';
    dxy_hk = indices.DXY !== undefined ? indices.DXY : '-';
    vhsiEmoji = parseFloat(String(vhsi)) < 0 ? '😱' : '⚠️';
  }

  let message = '';
  // Função utilitária para positivo/negativo
  const pos = '✅';
  const neg = '❌';

  // Garantir que todos os valores são numéricos para comparação
  const n = (v: any) => {
    const num = parseFloat(String(v).replace(/[^0-9\-\.]/g, ''));
    return isNaN(num) ? 0 : num;
  };
  // US30: lógica de impacto
  const vixPos = (signal === 'COMPRA' ? n(vix) < 0 : n(vix) > 0) ? pos : neg;
  const sp500Pos = (signal === 'COMPRA' ? n(sp500) > 0 : n(sp500) < 0) ? pos : neg;
  const nasdaqPos = (signal === 'COMPRA' ? n(nasdaq) > 0 : n(nasdaq) < 0) ? pos : neg;
  const dxyPos = (signal === 'COMPRA' ? n(dxy) < 0 : n(dxy) > 0) ? pos : neg;
  const tnxPos = (signal === 'COMPRA' ? n(tnx) < 0 : n(tnx) > 0) ? pos : neg;
  const russellPos = (signal === 'COMPRA' ? n(russell) > 0 : n(russell) < 0) ? pos : neg;
  // HK50: lógica de impacto
  const vhsiPos = (signal === 'COMPRA' ? n(vhsi) < 0 : n(vhsi) > 0) ? pos : neg;
  const cnhPos = (signal === 'COMPRA' ? n(cnh) < 0 : n(cnh) > 0) ? pos : neg;
  const nikkeiPos = (signal === 'COMPRA' ? n(nikkei) > 0 : n(nikkei) < 0) ? pos : neg;
  const ssePos = (signal === 'COMPRA' ? n(sse) > 0 : n(sse) < 0) ? pos : neg;
  const us500Pos = (signal === 'COMPRA' ? n(us500) > 0 : n(us500) < 0) ? pos : neg;
  const usdjpyPos = (signal === 'COMPRA' ? n(usdjpy) < 0 : n(usdjpy) > 0) ? pos : neg;
  const dxyhkPos = (signal === 'COMPRA' ? n(dxy_hk) < 0 : n(dxy_hk) > 0) ? pos : neg;

  // Resumo
  const volumeResumo = signal === 'COMPRA'
    ? `📈 Volume comprador dominante (${volumeBuy} compra) ${n(volumeBuy) > n(volumeSell) ? pos : neg}`
    : `📉 Volume vendedor dominante (${volumeSell} venda) ${n(volumeSell) > n(volumeBuy) ? pos : neg}`;
  const vixResumo = assetSymbol === 'US30'
    ? `${n(vix) < 0 ? '😌 VIX em queda' : '⚠️ VIX em alta'} (${vix}) ${vixPos}`
    : `${n(vhsi) < 0 ? '😱 VHSI em queda' : '⚠️ VHSI em alta'} (${vhsi}) ${vhsiPos}`;
  const breadthResumo = score > 0
    ? `🟢 Breadth positivo (${breadthAdv} alta, ${breadthDec} baixa) ${pos}`
    : `🔴 Breadth negativo (${breadthAdv} alta, ${breadthDec} baixa) ${neg}`;
  const gapResumo = `🕳️ Gap de abertura: ${gap} ${(signal === 'COMPRA' ? n(gap) > 0 : n(gap) < 0) ? pos : neg}`;

  if (assetSymbol === 'HK50') {
    // Mensagem para HK50
    message = [
      '🕒 ABERTURA',
      '',
      `🇭🇰 HK50: Sinal de ${signal === 'COMPRA' ? '🔺 COMPRA' : '🔻 VENDA'} ${strength}`,
      `Score institucional: ${score > 0 ? '+' : ''}${score}`,
      `Cotação: ${quote}`,
      '',
      '🌎 Índices globais:',
      `🥇 VHSI: ${vhsi} ${vhsiEmoji} ${vhsiPos}`,
      `🇨🇳 CNH (USD/CNH): ${cnh} ${cnhPos}`,
      `🇯🇵 Nikkei 225: ${nikkei} ${nikkeiPos}`,
      `🇨🇳 SSE: ${sse} ${ssePos}`,
      `🇺🇸 US500: ${us500} ${us500Pos}`,
      `🇺🇸 USD/JPY: ${usdjpy} ${usdjpyPos}`,
      `💵 DXY: ${dxy_hk} ${dxyhkPos}`,
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
    // Mensagem para US30 (default)
    message = [
      '🕒 ABERTURA',
      '',
      `🇺🇸 US30: Sinal de ${signal === 'COMPRA' ? '🔺 COMPRA' : '🔻 VENDA'} ${strength}`,
      `Score institucional: ${score > 0 ? '+' : ''}${score}`,
      `Cotação: ${quote}`,
      '',
      '🌎 Índices globais:',
      `🥇 VIX: ${vix} ${vixEmoji} ${vixPos}`,
      `🇺🇸 S&P 500: ${sp500} ${sp500Pos}`,
      `🇺🇸 NASDAQ: ${nasdaq} ${nasdaqPos}`,
      `💵 DXY: ${dxy} ${dxyPos}`,
      `🇺🇸 10Y: ${tnx} ${tnxPos}`,
      `🇺🇸 Russell 2000: ${russell} ${russellPos}`,
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
    const backendUrl = getEnvVar('VITE_BACKEND_URL') || '';
    const response = await fetch(`${backendUrl}/api/send-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });
    const data = await response.json();
    const now = new Date().toISOString();
    if (data.ok) {
      console.log(`[${now}] Sinal de abertura enviado com sucesso para o Telegram!`, { message, response: data });
    } else {
      console.error(`[${now}] Falha ao enviar sinal para o Telegram:`, data.error, { message, response: data });
    }
  } catch (error) {
    const now = new Date().toISOString();
    console.error(`[${now}] Erro na comunicação com o backend do Telegram:`, error, { message });
  }
};

/**
 * Envia uma análise detalhada para o Telegram.
 * @param message - Texto da análise detalhada.
 */
export const sendTelegramAnalysis = async (message: string): Promise<void> => {
  try {
    const backendUrl = getEnvVar('VITE_BACKEND_URL') || '';
    const response = await fetch(`${backendUrl}/api/send-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });
    const data = await response.json();
    const now = new Date().toISOString();
    if (data.ok) {
      console.log(`[${now}] Análise detalhada enviada com sucesso para o Telegram!`, { message, response: data });
    } else {
      console.error(`[${now}] Falha ao enviar análise para o Telegram:`, data.error, { message, response: data });
    }
  } catch (error) {
    const now = new Date().toISOString();
    console.error(`[${now}] Erro na comunicação com o backend do Telegram:`, error, { message });
  }
};
