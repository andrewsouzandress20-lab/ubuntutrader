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
  const [iaResult, setIaResult] = useState<string>('Clique para analisar com IA');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);


  const handleOpenModal = () => {
    setShowModal(true);
    setLoading(true);
    setIaResult('Analisando IA...');
    const bullFVG = smcZones.filter(z => z.type === ZoneType.FVG && z.sentiment === FVGType.BULLISH && !z.mitigated).length;
    const bearFVG = smcZones.filter(z => z.type === ZoneType.FVG && z.sentiment === FVGType.BEARISH && !z.mitigated).length;
    analyzeMarket(candles, asset, correlations, events, 'IA_HEADER', { score: institutionalScore, bullFVG, bearFVG })
      .then(res => setIaResult(res.text))
      .catch(() => setIaResult('Erro ao consultar IA.'))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <button
        className="flex items-center gap-2 px-5 py-2 rounded-lg border border-indigo-700/40 bg-indigo-900/10 hover:bg-indigo-900/30 text-indigo-300 font-bold uppercase text-xs shadow transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
        onClick={handleOpenModal}
        title="Análise Profunda"
      >
        ANÁLISE PROFUNDA
      </button>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowModal(false)}>
          <div className="bg-[#181c2a] rounded-xl shadow-xl p-6 max-w-lg w-full border border-indigo-700/40 relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-3 text-slate-400 hover:text-white text-xl" onClick={() => setShowModal(false)}>&times;</button>
            <h2 className="text-lg font-bold text-indigo-400 mb-2 flex items-center gap-2"><i className="fas fa-robot" /> Análise Completa da IA</h2>
            <pre className="whitespace-pre-wrap text-slate-100 text-xs font-mono max-h-[60vh] overflow-y-auto">{iaResult}</pre>
          </div>
        </div>
      )}
    </>
  );
};

export default GeminiSignalHeader;
