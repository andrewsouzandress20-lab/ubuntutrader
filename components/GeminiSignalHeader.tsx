import React, { useEffect, useState } from 'react';
import { Candle, Asset, CorrelationData, EconomicEvent, SMCZone, FVGType, ZoneType } from '../types';
import { analyzeMarket } from '../services/geminiService';

interface Props {
  candles: Candle[];
  asset: Asset;
  correlations: CorrelationData[];
  events: EconomicEvent[];
  smcZones: SMCZone[];
  institutionalScore: number;
}

const GeminiSignalHeader: React.FC<Props> = ({ candles, asset, correlations, events, smcZones, institutionalScore }) => {
  // ...removido botão e modal de análise profunda...

  return null;
};

export default GeminiSignalHeader;
