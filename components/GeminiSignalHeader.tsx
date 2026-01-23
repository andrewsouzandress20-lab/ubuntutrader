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
  const [iaResult, setIaResult] = useState<string>('Analisando IA...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const bullFVG = smcZones.filter(z => z.type === ZoneType.FVG && z.sentiment === FVGType.BULLISH && !z.mitigated).length;
    const bearFVG = smcZones.filter(z => z.type === ZoneType.FVG && z.sentiment === FVGType.BEARISH && !z.mitigated).length;
    analyzeMarket(candles, asset, correlations, events, 'IA_HEADER', { score: institutionalScore, bullFVG, bearFVG })
      .then(res => {
        if (isMounted) setIaResult(res.text);
      })
      .catch(() => {
        if (isMounted) setIaResult('Erro ao consultar IA.');
      })
      .finally(() => setLoading(false));
    return () => { isMounted = false; };
  }, [candles, asset, correlations, events, smcZones, institutionalScore]);

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 rounded-lg border border-indigo-700/40 bg-indigo-900/10 animate-pulse">
      <i className="fas fa-robot text-indigo-400 text-[12px]" />
      <span className="text-[10px] font-black text-white uppercase truncate max-w-[300px]">
        {loading ? 'Analisando IA...' : iaResult}
      </span>
    </div>
  );
};

export default GeminiSignalHeader;
