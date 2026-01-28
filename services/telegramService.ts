// Função para obter variáveis de ambiente de forma compatível (Vite ou Node.js)

function getEnvVar(name: string): string | undefined {
  // Vite
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env[name]) {
    return import.meta.env[name];
  }
  // Node.js
  if (typeof process !== 'undefined' && process.env) {
    // Tenta buscar com e sem prefixo VITE_
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

  const message = `
🚨 **SINAL DE ABERTURA - SENTINEL PRO** 🚨
--------------------------------------
- **ATIVO:** \`${assetSymbol}\`
- **DIREÇÃO:** ${signal === 'COMPRA' ? '📈' : '📉'} **${signal}**
- **FORÇA:** **${strength}**
- **SCORE:** \`${score}\`
--------------------------------------
*ANALISE A ZONA SMC/FGV PARA UMA ENTRADA MELHOR*
  `;

  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const response = await fetch(`${backendUrl}/api/send-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });
    const data = await response.json();
    if (data.ok) {
      console.log("Sinal de abertura enviado com sucesso para o Telegram!");
    } else {
      console.error("Falha ao enviar sinal para o Telegram:", data.error);
    }
  } catch (error) {
    console.error("Erro na comunicação com o backend do Telegram:", error);
  }
};

/**
 * Envia uma análise detalhada para o Telegram.
 * @param message - Texto da análise detalhada.
 */
export const sendTelegramAnalysis = async (message: string): Promise<void> => {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const response = await fetch(`${backendUrl}/api/send-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message }),
    });
    const data = await response.json();
    if (data.ok) {
      console.log("Análise detalhada enviada com sucesso para o Telegram!");
    } else {
      console.error("Falha ao enviar análise para o Telegram:", data.error);
    }
  } catch (error) {
    console.error("Erro na comunicação com o backend do Telegram:", error);
  }
};
