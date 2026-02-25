
const BOT_TOKEN = "7367907001:AAFEc8FwNIa6PNHd79rQ8uYNrzgfx2hTJc0";
const CHAT_ID = "603201843";

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
    console.log("Sinal neutro, nenhuma mensagem enviada ao Telegram.");
    return;
  }

*ANALISE A ZONA SMC/FGV PARA UMA ENTRADA MELHOR*
  // Buscar dados dos índices globais
  const { fetchCorrelationData } = await import('./dataService');
  const globalIndices = await fetchCorrelationData(assetSymbol);

  // Montar string dos índices globais
  const indicesMsg = globalIndices.map(idx => {
    let nome = idx.name;
    if (nome === 'S&P 500') nome = 'SP500';
    if (nome === 'NASDAQ') nome = 'NASDAQ';
    if (nome === 'VIX') nome = 'VIX';
    if (nome === 'DXY') nome = 'DXY';
    if (nome === 'NIKKEI 225') nome = '10Y'; // Ajuste se necessário
    if (nome === 'RUSSELL 2000') nome = 'RUSSELL 2000';
    return `${nome}: ${idx.price !== 0 ? idx.price : '⚠️ dado ausente'}`;
  }).join('\n');

  const message = `
🚨 **SINAL DE ABERTURA - SENTINEL PRO** 🚨
--------------------------------------
- **ATIVO:** \`${assetSymbol}\`
- **DIREÇÃO:** ${signal === 'COMPRA' ? '📈' : '📉'} **${signal}**
- **FORÇA:** **${strength}**
- **SCORE:** \`${score}\`
--------------------------------------
🌎 Índices globais:\n${indicesMsg}
--------------------------------------
*ANALISE A ZONA SMC/FGV PARA UMA ENTRADA MELHOR*
  `;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();
    if (data.ok) {
      console.log("Sinal de abertura enviado com sucesso para o Telegram!");
    } else {
      console.error("Falha ao enviar sinal para o Telegram:", data.description);
    }
  } catch (error) {
    console.error("Erro na comunicação com a API do Telegram:", error);
  }
};
