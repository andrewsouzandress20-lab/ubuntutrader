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


function getScoreLabel(score: number) {
  if (score > 0) return 'COMPRA';
  if (score < 0) return 'VENDA';
  return 'NEUTRO';
}

function getStrengthLabel(score: number) {
  if (Math.abs(score) > 10) return 'FORTE';
  if (Math.abs(score) > 5) return 'MODERADA';
  if (Math.abs(score) > 0) return 'FRACA';
  return 'AGUARDANDO';
}

const GeminiSignalHeader: React.FC<Props> = ({ candles, asset, correlations, events, smcZones, institutionalScore }) => {
  return (
    <div className="w-full flex flex-col items-center justify-center py-2">
      <div className="text-amber-400 text-[16px] md:text-[16px] sm:text-[15px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-amber-500/40 w-full max-w-[420px] text-center">
        <span role='img' aria-label='bot'>🤖</span> <span role='img' aria-label='luz'>💡</span> {institutionalScore > 0 ? '+' : ''}{institutionalScore} {getScoreLabel(institutionalScore)}<br />
        Confiança: <b>{getStrengthLabel(institutionalScore)}</b>
      </div>
    </div>
  );
};

export default GeminiSignalHeader;
