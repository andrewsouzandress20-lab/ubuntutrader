// Adiciona declaração global para evitar erro TS
declare global {
  interface Window {
    __UBUNTU_TRADER_SIGNAL_DATA__?: any;
  }
}

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
  // Vite (browser) - ignorado no backend
  // No backend, use apenas process.env
  return undefined;
}

export const sendTelegramSignal2 = async (
  assetSymbol: string,
  signal: string,
  strength: string,
  score: number
) => {
    // Implement the real signal sending logic here
    // For example, you might want to send a request to a Telegram API
    console.log(`[SINAL] Enviando sinal para ${assetSymbol} (${signal}, ${strength}, score: ${score})`);
};
