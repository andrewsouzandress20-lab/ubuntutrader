
import { Candle, Asset, Timeframe, TIMEFRAMES } from '../types';

export const generateMockCandles = (count: number, asset: Asset, timeframe: Timeframe): Candle[] => {
  const candles: Candle[] = [];
  let currentPrice = asset.basePrice;
  const timeframeData = TIMEFRAMES.find(t => t.value === timeframe) || TIMEFRAMES[3];
  let currentTime = Math.floor(Date.now() / 1000) - count * timeframeData.seconds;

  for (let i = 0; i < count; i++) {
    const volatility = currentPrice * asset.volatility;
    const open = currentPrice;
    const close = currentPrice + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    candles.push({
      time: currentTime,
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
    currentTime += timeframeData.seconds;
  }

  return candles;
};

export const generateNextTick = (lastCandle: Candle, asset: Asset): Candle => {
  const volatility = lastCandle.close * (asset.volatility * 0.1);
  const change = (Math.random() - 0.5) * volatility;
  const newClose = lastCandle.close + change;
  
  return {
    ...lastCandle,
    close: newClose,
    high: Math.max(lastCandle.high, newClose),
    low: Math.min(lastCandle.low, newClose),
  };
};

export const injectFVGs = (candles: Candle[], asset: Asset): Candle[] => {
  const newCandles = [...candles];
  const bullStrength = asset.basePrice * 0.004;
  
  for (let i = 2; i < newCandles.length - 15; i += 20) {
    if (i + 2 >= newCandles.length) break;
    
    // Inject Bullish FVG
    newCandles[i].close = newCandles[i].open + bullStrength;
    newCandles[i].high = newCandles[i].close + (bullStrength * 0.1);
    newCandles[i].low = newCandles[i].open - (bullStrength * 0.1);
    
    // Gap candle (candle 2)
    newCandles[i+1].open = newCandles[i].close;
    newCandles[i+1].close = newCandles[i+1].open + bullStrength * 1.5;
    newCandles[i+1].high = newCandles[i+1].close + (bullStrength * 0.05);
    newCandles[i+1].low = newCandles[i+1].open - (bullStrength * 0.05);

    // Next candle (candle 3)
    newCandles[i+2].open = newCandles[i+1].close;
    newCandles[i+2].low = newCandles[i+2].open - (bullStrength * 0.1); 
  }
  return newCandles;
};
