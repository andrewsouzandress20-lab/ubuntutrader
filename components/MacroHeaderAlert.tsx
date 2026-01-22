
import React from 'react';
import { EconomicEvent, Asset } from '../types';

interface Props {
  events: EconomicEvent[];
  selectedAsset: Asset;
}

const MacroHeaderAlert: React.FC<Props> = ({ events, selectedAsset }) => {
  // Filtra eventos relevantes para o ativo e que ainda vão acontecer ou acabaram de acontecer
  const now = Date.now() / 1000;
  const relevantEvents = events.filter(e => {
    const isUSD = e.title.includes('USD');
    const isChina = e.title.includes('CNY') || e.title.includes('HKD');
    
    // US30 reage a USD. HK50 reage a China/HKD e USD.
    const isRelevant = selectedAsset.symbol === 'US30' ? isUSD : (isUSD || isChina);
    const isRecent = e.time > now - 3600 && e.time < now + 21600; // Próximas 6h ou última 1h
    
    return isRelevant && e.impact === 'HIGH';
  });

  const nextEvent = relevantEvents[0];

  if (!nextEvent) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Macroestabilidade: Baixa Volatilidade</span>
      </div>
    );
  }

  // Lógica simples de sentimento macro para índices
  // Geralmente notícias de inflação/juros (CPI, Rates) altas são negativas para índices.
  const isNegative = nextEvent.title.includes('CPI') || nextEvent.title.includes('Rate') || nextEvent.title.includes('Inflation');
  
  return (
    <div className={`flex items-center gap-3 px-4 py-1.5 rounded-lg border animate-pulse ${isNegative ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
      <div className="flex items-center gap-2">
        <i className={`fas fa-triangle-exclamation ${isNegative ? 'text-rose-500' : 'text-amber-500'} text-[10px]`}></i>
        <span className="text-[10px] font-black text-white uppercase truncate max-w-[150px]">
          {nextEvent.title.split('(')[0]}
        </span>
      </div>
      
      <div className="h-4 w-[1px] bg-white/10"></div>
      
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-bold text-slate-400 uppercase">Impacto:</span>
        <span className={`text-[9px] font-black uppercase ${isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
          {isNegative ? 'BAIXISTA (⬇)' : 'VOLÁTIL (↕)'}
        </span>
      </div>
    </div>
  );
};

export default MacroHeaderAlert;
