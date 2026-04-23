
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Asset {
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number;
  decimals: number;
  symbolYahoo?: string;
}

export interface CorrelationData {
  symbol: string;
  name: string;
  price?: number;
  change?: number;
  correlation: 'positive' | 'negative';
  info?: string;
}

export interface MarketBreadthSummary {
  advancing: number;
  declining: number;
  total: number;
}

export interface BreadthCompanyDetails {
  symbol: string;
  change: number;
  status: 'BUY' | 'SELL';
}

export interface VolumePressure {
  buyPercent: number;
  sellPercent: number;
  total: number;
}

export interface GapData {
  value: number;
  percent: number;
  type: 'up' | 'down' | 'none';
  startIndex?: number;
  prevClose?: number;
  openPrice?: number;
  isFilled?: boolean;
}

export interface EconomicEvent {
  id: string;
  time: number;
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  description: string;
}

export interface EntryRecommendation {
  price: number;
  type: 'BUY' | 'SELL' | 'NONE';
  zoneType: string;
  target: number;
  stopLoss: number;
}

// --- SMC Detection Types ---
export enum ZoneType {
  FVG = 'FVG',
  ORDER_BLOCK = 'ORDER_BLOCK',
  BOS = 'BOS'
}

export enum FVGType {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH'
}

export interface SMCZone {
  id: string;
  type: ZoneType;
  sentiment: FVGType;
  top: number;
  bottom: number;
  startTime: number;
  endTime: number;
  mitigated: boolean;
  mitigationTime?: number;
  label: string;
}

export interface IndicatorConfig {
  lookback: number;
  mitigationDetection: boolean;
  drawFilled: boolean;
}

export const SUPPORTED_ASSETS: Asset[] = [
  { symbol: 'HK50', name: 'Hang Seng Index', basePrice: 16500, volatility: 0.0035, decimals: 2 },
  { symbol: 'US30', name: 'Dow Jones 30', basePrice: 39500, volatility: 0.0025, decimals: 2 },
];

export const TIMEFRAMES: { label: string; value: Timeframe; seconds: number }[] = [
  { label: '1m', value: '1m', seconds: 60 },
  { label: '5m', value: '5m', seconds: 300 },
  { label: '15m', value: '15m', seconds: 900 },
  { label: '1h', value: '1h', seconds: 3600 },
  { label: '4h', value: '4h', seconds: 14400 },
  { label: '1d', value: '1d', seconds: 86400 },
];

export const UTC_OFFSETS = [
  { label: 'UTC -5 (NY)', value: -5 },
  { label: 'UTC -3 (BR)', value: -3 },
  { label: 'UTC 0 (GMT)', value: 0 },
  { label: 'UTC +8 (HK)', value: 8 },
];

export const DOW_30_TICKERS = [
  'AAPL', 'AMGN', 'AMZN', 'AXP', 'BA', 'CAT', 'CRM', 'CSCO', 'CVX', 'DIS',
  'DOW', 'GS', 'HD', 'HON', 'IBM', 'INTC', 'JNJ', 'JPM', 'KO', 'MCD',
  'MMM', 'MRK', 'MSFT', 'NKE', 'PG', 'TRV', 'UNH', 'V', 'VZ', 'WMT'
];

export const HK_50_TICKERS = [
  '0001.HK', '0002.HK', '0003.HK', '0005.HK', '0006.HK', '0011.HK', '0012.HK', '0016.HK', '0017.HK', '0027.HK',
  '0066.HK', '0101.HK', '0175.HK', '0241.HK', '0267.HK', '0288.HK', '0386.HK', '0388.HK', '0669.HK', '0688.HK', 
  '0700.HK', '0762.HK', '0823.HK', '0857.HK', '0883.HK', '0939.HK', '0941.HK', '0960.HK', '0968.HK', '0981.HK', 
  '0992.HK', '1038.HK', '1044.HK', '1088.HK', '1093.HK', '1109.HK', '1113.HK', '1177.HK', '1211.HK', '1299.HK', 
  '1398.HK', '1810.HK', '1928.HK', '2020.HK', '2313.HK', '2318.HK', '2319.HK', '2331.HK', '2382.HK', '2388.HK', 
  '2628.HK', '2688.HK', '3690.HK', '3968.HK', '3988.HK', '9618.HK', '9633.HK', '9888.HK', '9988.HK', '9999.HK'
];
