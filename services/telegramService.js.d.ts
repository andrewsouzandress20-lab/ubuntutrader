export declare const sendTelegramSignal: (
  assetSymbol: string,
  signal: string,
  strength: string,
  score: number,
  context?: {
    quote?: number | string | null;
    indices?: Record<string, number | string>;
    volumeBuy?: number | string;
    volumeSell?: number | string;
    breadthAdv?: number | string;
    breadthDec?: number | string;
    gap?: number | string;
  }
) => Promise<void>;

export declare const sendTelegramAnalysis: (message: string) => Promise<void>;
