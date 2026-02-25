import { Candle, FVGType, SMCZone, ZoneType, IndicatorConfig } from '../types';

export const detectSMCZones = (candles: Candle[], config: IndicatorConfig): SMCZone[] => {
  const zones: SMCZone[] = [];
  const { lookback, mitigationDetection } = config;

  if (candles.length < 5) return [];

  const startIdx = Math.max(2, candles.length - lookback);
  
  // Track Highs and Lows for BOS
  let lastHigh = candles[startIdx].high;
  let lastLow = candles[startIdx].low;

  for (let i = startIdx; i < candles.length - 1; i++) {
    const cPrev2 = candles[i - 2];
    const cPrev1 = candles[i - 1];
    const cCurr = candles[i];
    const cNext = candles[i + 1];

    if (!cPrev1 || !cCurr || !cNext) continue;

    // --- 1. DETECTION: FVG (Fair Value Gap) ---
    // Bullish FVG
    if (cPrev1.high < cNext.low) {
      const zone: SMCZone = {
        id: `fvg-bull-${cCurr.time}`,
        type: ZoneType.FVG,
        sentiment: FVGType.BULLISH,
        top: cNext.low,
        bottom: cPrev1.high,
        startTime: cCurr.time,
        endTime: cCurr.time,
        mitigated: false,
        label: 'FVG'
      };

      if (mitigationDetection) {
        for (let j = i + 2; j < candles.length; j++) {
          if (candles[j].low <= zone.bottom) {
            zone.mitigated = true;
            zone.mitigationTime = candles[j].time;
            break;
          }
        }
      }
      if (config.drawFilled || !zone.mitigated) zones.push(zone);

      // --- 2. DETECTION: ORDER BLOCK (OB) ---
      // A Bullish OB is often the last bearish candle before a strong move that created this FVG
      if (cPrev1.close < cPrev1.open) {
        zones.push({
          id: `ob-bull-${cPrev1.time}`,
          type: ZoneType.ORDER_BLOCK,
          sentiment: FVGType.BULLISH,
          top: cPrev1.high,
          bottom: cPrev1.low,
          startTime: cPrev1.time,
          endTime: cPrev1.time,
          mitigated: false,
          label: 'OB'
        });
      }
    }

    // Bearish FVG
    if (cPrev1.low > cNext.high) {
      const zone: SMCZone = {
        id: `fvg-bear-${cCurr.time}`,
        type: ZoneType.FVG,
        sentiment: FVGType.BEARISH,
        top: cPrev1.low,
        bottom: cNext.high,
        startTime: cCurr.time,
        endTime: cCurr.time,
        mitigated: false,
        label: 'FVG'
      };

      if (mitigationDetection) {
        for (let j = i + 2; j < candles.length; j++) {
          if (candles[j].high >= zone.top) {
            zone.mitigated = true;
            zone.mitigationTime = candles[j].time;
            break;
          }
        }
      }
      if (config.drawFilled || !zone.mitigated) zones.push(zone);

      // Bearish OB: Last bullish candle before this move
      if (cPrev1.close > cPrev1.open) {
        zones.push({
          id: `ob-bear-${cPrev1.time}`,
          type: ZoneType.ORDER_BLOCK,
          sentiment: FVGType.BEARISH,
          top: cPrev1.high,
          bottom: cPrev1.low,
          startTime: cPrev1.time,
          endTime: cPrev1.time,
          mitigated: false,
          label: 'OB'
        });
      }
    }

    // --- 3. DETECTION: BOS (Break of Structure) ---
    if (cCurr.close > lastHigh) {
        zones.push({
            id: `bos-bull-${cCurr.time}`,
            type: ZoneType.BOS,
            sentiment: FVGType.BULLISH,
            top: cCurr.high,
            bottom: lastHigh,
            startTime: cCurr.time,
            endTime: cCurr.time,
            mitigated: false,
            label: 'BOS'
        });
        lastHigh = cCurr.high;
    } else if (cCurr.close < lastLow) {
        zones.push({
            id: `bos-bear-${cCurr.time}`,
            type: ZoneType.BOS,
            sentiment: FVGType.BEARISH,
            top: lastLow,
            bottom: cCurr.low,
            startTime: cCurr.time,
            endTime: cCurr.time,
            mitigated: false,
            label: 'BOS'
        });
        lastLow = cCurr.low;
    }
    
    // Update local highs/lows for next iteration
    if (cCurr.high > lastHigh) lastHigh = cCurr.high;
    if (cCurr.low < lastLow) lastLow = cCurr.low;
  }

  return zones;
};
