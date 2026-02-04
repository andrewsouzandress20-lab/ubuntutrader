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
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env[name]) {
    return import.meta.env[name];
  }
  return undefined;
}

export const sendTelegramSignal2 = async (
  assetSymbol: string,
  signal: string,
  strength: string,
  score: number
) => {
  // ...código original da função sendTelegramSignal...
  // Para simplificar, apenas um log:
  console.log(`[MOCK] Enviando sinal para ${assetSymbol} (${signal}, ${strength}, score: ${score})`);
};
