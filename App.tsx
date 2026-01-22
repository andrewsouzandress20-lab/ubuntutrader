
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Candle, Asset, SUPPORTED_ASSETS, Timeframe, TIMEFRAMES, UTC_OFFSETS, CorrelationData, MarketBreadthSummary, BreadthCompanyDetails, VolumePressure, GapData, EconomicEvent, SMCZone, FVGType, ZoneType } from './types';
import { fetchRealData, fetchCorrelationData, fetchMarketBreadth, calculateVolumePressure, detectOpeningGap, fetchEconomicEvents, fetchCurrentPrice } from './services/dataService';
import { sendTelegramSignal } from './services/telegramService';
import { detectSMCZones } from './utils/fvgDetector';
import TradingChart from './components/TradingChart';

const App: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(SUPPORTED_ASSETS[1]); 
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [utcOffset, setUtcOffset] = useState<number>(-3);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [breadthSummary, setBreadthSummary] = useState<MarketBreadthSummary>({ advancing: 0, declining: 0, total: 30 });
  const [breadthDetails, setBreadthDetails] = useState<BreadthCompanyDetails[]>([]);
  const [isBreadthModalOpen, setIsBreadthModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [volumePressure, setVolumePressure] = useState<VolumePressure>({ buyPercent: 50, sellPercent: 50, total: 0 });
  const [gap, setGap] = useState<GapData>({ value: 0, percent: 0, type: 'none' });
  
  const [loading, setLoading] = useState(true);
  const [lastSignalSentIndex, setLastSignalSentIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      // Logic for server time update if needed, otherwise can be removed.
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getScoreLabel = useCallback((s: number) => {
    if (s > 0) return "COMPRA";
    if (s < 0) return "VENDA";
    return "NEUTRO";
  }, []);

  const getStrengthLabel = useCallback((s: number) => {
    const absScore = Math.abs(s);
    if (absScore === 0) return "---";
    if (absScore > 70) return "FORTE";
    if (absScore > 35) return "MODERADA";
    return "FRACA";
  }, []);

  // FIX: Moved `smcZones` declaration before `institutionalScore` as `institutionalScore` depends on it.
  const smcZones = useMemo(() => detectSMCZones(candles, { lookback: 150, mitigationDetection: true, drawFilled: true }), [candles]);

  const institutionalScore = useMemo(() => {
    let score = 0;
    const volumeScore = (volumePressure.buyPercent - 50) * 2;
    score += volumeScore * 0.20;
    const breadthRatio = breadthSummary.advancing / (breadthSummary.total || 1);
    const breadthScore = (breadthRatio - 0.5) * 200;
    score += breadthScore * 0.20;
    if (correlations.length > 0) {
      const avgCorr = correlations.reduce((acc, c) => {
        const factor = c.correlation === 'positive' ? 1 : -1;
        return acc + (c.change * factor);
      }, 0) / correlations.length;
      const correlationScore = Math.max(-100, Math.min(100, avgCorr * 50));
      score += correlationScore * 0.20;
    }
    const bullFVGs = smcZones.filter(z => z.type === ZoneType.FVG && z.sentiment === FVGType.BULLISH && !z.mitigated).length;
    const bearFVGs = smcZones.filter(z => z.type === ZoneType.FVG && z.sentiment === FVGType.BEARISH && !z.mitigated).length;
    const fvgBalance = bullFVGs - bearFVGs;
    const smcScore = Math.max(-100, Math.min(100, fvgBalance * 20));
    score += smcScore * 0.20;
    if (events.length > 0) {
      const sentimentMap = { 'POSITIVE': 100, 'NEUTRAL': 0, 'NEGATIVE': -100 };
      const eventScore = events.reduce((acc, e) => acc + sentimentMap[e.sentiment], 0) / events.length;
      score += eventScore * 0.20;
    }
    return Math.round(score);
  }, [volumePressure, breadthSummary, correlations, smcZones, events]);


  const loadData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setLoading(true);
    try {
      const [candleData, corrData, breadthRes, eventData, currentPrice] = await Promise.all([
        fetchRealData(selectedAsset, timeframe),
        fetchCorrelationData(selectedAsset.symbol),
        fetchMarketBreadth(selectedAsset.symbol),
        fetchEconomicEvents(),
        fetchCurrentPrice(selectedAsset)
      ]);
      
      setCorrelations(corrData);
      setBreadthSummary(breadthRes.summary);
      setBreadthDetails(breadthRes.details);
      setEvents(eventData);
      
      if (candleData.length > 0) {
        if (currentPrice) {
          candleData[candleData.length - 1].close = currentPrice;
        }
        setCandles(candleData);
        setVolumePressure(calculateVolumePressure(candleData));
        setGap(detectOpeningGap(candleData, selectedAsset));
      }
    } catch (err) {
      console.error("Data load failed:", err);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [selectedAsset, timeframe]);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 30000); 
    return () => clearInterval(interval);
  }, [selectedAsset, timeframe, loadData]);
  
  // Efeito para enviar sinal do Telegram na abertura
  useEffect(() => {
    if (gap.type !== 'none' && gap.startIndex && gap.startIndex !== lastSignalSentIndex) {
      console.log(`Nova abertura de mercado detectada para ${selectedAsset.symbol}. Agendando sinal...`);
      setLastSignalSentIndex(gap.startIndex);

      const signalTimer = setTimeout(() => {
        const score = institutionalScore;
        const signalLabel = getScoreLabel(score);
        const strengthLabel = getStrengthLabel(score);
        
        console.log(`Enviando sinal para Telegram: ${selectedAsset.symbol} | ${signalLabel} | ${strengthLabel} | ${score}`);
        
        sendTelegramSignal(selectedAsset.symbol, signalLabel, strengthLabel, score);
      }, 4000);

      return () => clearTimeout(signalTimer);
    }
  }, [gap, institutionalScore, selectedAsset.symbol, lastSignalSentIndex, getScoreLabel, getStrengthLabel]);

  const getSentimentStyles = (sentiment: EconomicEvent['sentiment']) => {
    switch (sentiment) {
      case 'POSITIVE': return { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400' };
      case 'NEGATIVE': return { border: 'border-rose-500/30', bg: 'bg-rose-500/5', text: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-400' };
      default: return { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400' };
    }
  };

  const now = Math.floor(Date.now() / 1000);
  const pastEvents = events.filter(e => e.time <= now).sort((a, b) => b.time - a.time);
  const futureEvents = events.filter(e => e.time > now).sort((a, b) => a.time - b.time);

  return (
    <div className="flex flex-col h-screen bg-[#02040a] text-[#94a3b8] overflow-hidden font-['Inter'] selection:bg-indigo-500/30">
      
      <header className="h-[56px] bg-[#0d1226] border-b border-indigo-500/20 px-6 flex items-center justify-between shrink-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fas fa-microchip text-white text-sm"></i>
            </div>
            <div>
              <h1 className="text-[13px] font-black uppercase tracking-[0.15em] text-white leading-none">SENTINEL SMC FGV</h1>
              <span className="text-[9px] font-bold text-indigo-400 mt-1 block uppercase tracking-wider">
                PRO INSTITUTIONAL ENGINE <span className="text-emerald-400 ml-2 animate-pulse">● LIVE</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-[#050814] p-1 rounded-lg border border-slate-800">
            {SUPPORTED_ASSETS.map(a => (
              <button 
                key={a.symbol} 
                onClick={() => {
                  setSelectedAsset(a);
                  setLastSignalSentIndex(null); // Reseta o sinal ao trocar de ativo
                }}
                className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${selectedAsset.symbol === a.symbol ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {a.symbol}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        
        <aside className="w-[300px] bg-[#050814] border-r border-slate-800/40 p-5 overflow-y-auto custom-scrollbar flex flex-col gap-8 shrink-0 z-30">
          <section className="shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fluxo Institucional</h3>
              <i className="fas fa-layer-group text-indigo-500 text-[10px]"></i>
            </div>
            <div className="space-y-2">
              {correlations.map(c => (
                <div key={c.symbol} className="bg-[#0d1226] border border-slate-800/60 p-3 rounded-xl flex items-center justify-between group hover:border-indigo-500/40 transition-all cursor-default">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white group-hover:text-indigo-300 transition-colors">{c.name}</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">{c.correlation === 'positive' ? 'Direta' : 'Inversa'}</span>
                  </div>
                  <div className={`text-[11px] font-black jetbrains px-2 py-1 rounded-md ${c.change >= 0 ? 'text-emerald-400 bg-emerald-500/5' : 'text-rose-400 bg-rose-500/5'}`}>
                    {c.change >= 0 ? '+' : ''}{c.change.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-auto pt-4 border-t border-slate-800/40 shrink-0">
            <div className="text-[9px] font-medium text-slate-500 flex justify-between">
              <span>ESTADO DO TERMINAL</span>
              <span className="text-emerald-400 font-bold">CONECTADO</span>
            </div>
          </section>
        </aside>

        <div className="flex-1 flex flex-col bg-[#02040a] relative overflow-hidden">
          <div className="flex-1 relative">
            <TradingChart asset={selectedAsset} loading={loading} />
          </div>

          <div className="h-[105px] bg-[#0d1226] border-t border-indigo-500/20 flex items-center justify-center px-6 gap-6 shrink-0 z-20 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]">
             
             {/* SCORE INSTITUCIONAL */}
             <div className="flex items-center gap-4">
                <div className={`w-[56px] h-[56px] rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${institutionalScore >= 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'}`}>
                   <span className={`text-[19px] font-black jetbrains ${institutionalScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {institutionalScore > 0 ? '+' : ''}{institutionalScore}
                   </span>
                </div>
                <div className="flex flex-col justify-center gap-0.5 min-w-[70px]">
                   <div className="flex flex-col text-[10px] font-black text-slate-500 tracking-wider leading-tight">
                     <span>SCORE</span>
                     <span>INST.</span>
                   </div>
                   <span className={`text-[17px] font-black uppercase tracking-tight leading-none ${institutionalScore > 0 ? 'text-emerald-400' : institutionalScore < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                     {getScoreLabel(institutionalScore)}
                   </span>
                </div>
                <div className="bg-[#050814] border border-slate-800/60 w-[64px] h-[48px] rounded-xl flex flex-col items-center justify-center shadow-inner">
                   <span className={`text-[13px] font-black leading-none mb-0.5 jetbrains ${institutionalScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {Math.abs(institutionalScore)}%
                   </span>
                   <span className={`text-[8px] font-black uppercase leading-none ${institutionalScore >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                     {getStrengthLabel(institutionalScore)}
                   </span>
                </div>
             </div>

             <div className="h-10 w-[1px] bg-slate-800/50"></div>

             {/* COMPONENTES */}
             <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
                   COMPONENTES {selectedAsset.symbol === 'US30' ? 'DOW' : 'HK'}
                </span>
                <button 
                   onClick={() => setIsBreadthModalOpen(true)}
                   className="flex items-center gap-4 bg-[#050814] border border-slate-800/80 px-4 h-11 rounded-2xl hover:border-indigo-500/50 transition-all group shadow-inner"
                >
                   <div className="flex gap-4 items-center">
                      <div className="flex items-center gap-2">
                         <i className="fas fa-arrow-up text-[10px] text-emerald-500"></i>
                         <span className="text-[17px] font-black text-emerald-400 jetbrains leading-none">
                            {breadthSummary.advancing}
                         </span>
                      </div>
                      <div className="flex items-center gap-2">
                         <i className="fas fa-arrow-down text-[10px] text-rose-500"></i>
                         <span className="text-[17px] font-black text-rose-400 jetbrains leading-none">
                            {breadthSummary.declining}
                         </span>
                      </div>
                   </div>
                   <div className="h-5 w-[1px] bg-slate-800/80"></div>
                   <i className="fas fa-bars text-[12px] text-slate-600 group-hover:text-indigo-400 transition-colors"></i>
                </button>
             </div>

             <div className="h-10 w-[1px] bg-slate-800/50"></div>

             {/* VOLUME PRESSURE */}
             <div className="flex flex-col gap-2 min-w-[170px]">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">VOLUME PRESSURE</span>
                <div className="bg-[#050814] border border-slate-800/80 px-4 h-11 rounded-2xl shadow-inner flex flex-col justify-center gap-1.5">
                   <div className="flex justify-between items-center px-0.5">
                      <span className="text-[12px] font-black text-emerald-400 jetbrains leading-none">{volumePressure.buyPercent.toFixed(0)}%</span>
                      <span className="text-[12px] font-black text-rose-400 jetbrains leading-none">{volumePressure.sellPercent.toFixed(0)}%</span>
                   </div>
                   <div className="h-[5px] bg-slate-800/40 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${volumePressure.buyPercent}%` }}></div>
                      <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${volumePressure.sellPercent}%` }}></div>
                   </div>
                </div>
             </div>

             <div className="h-10 w-[1px] bg-slate-800/50"></div>

             {/* GAP DE ABERTURA */}
             <div className="flex flex-col gap-2 min-w-[150px]">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none text-right md:text-left">GAP DE ABERTURA</span>
                <div className={`bg-[#050814] border ${gap.type !== 'none' ? (gap.type === 'up' ? 'border-emerald-500/20' : 'border-rose-500/20') : 'border-slate-800/80'} px-4 h-11 rounded-2xl shadow-inner flex items-center justify-between`}>
                   <div className="flex items-center gap-2">
                      {gap.type !== 'none' ? (
                        <i className={`fas ${gap.type === 'up' ? 'fa-arrow-trend-up text-emerald-400' : 'fa-arrow-trend-down text-rose-400'} text-[12px]`}></i>
                      ) : (
                        <i className="fas fa-minus text-slate-600 text-[12px]"></i>
                      )}
                      <span className={`text-[14px] font-black jetbrains ${gap.type === 'up' ? 'text-emerald-400' : gap.type === 'down' ? 'text-rose-400' : 'text-slate-500'}`}>
                        {gap.type !== 'none' ? `${Math.abs(gap.percent).toFixed(2)}%` : '0.00%'}
                      </span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${gap.isFilled ? 'text-indigo-400' : (gap.type !== 'none' ? 'text-amber-500 animate-pulse' : 'text-slate-600')}`}>
                        {gap.type === 'none' ? 'SEM GAP' : (gap.isFilled ? 'PREENCHIDO' : 'ABERTO')}
                      </span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <aside className="w-[320px] bg-[#050814] border-l border-slate-800/40 flex flex-col shrink-0 overflow-hidden z-30 shadow-[-4px_0_200px_rgba(0,0,0,0.3)]">
           <div className="p-5 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="w-2 h-4 bg-indigo-500 rounded-sm"></span>
                  Feed de Eventos
                </h3>
                <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-slate-500 bg-[#0d1226] px-2 py-1 rounded-md hover:text-indigo-400 transition-colors">
                  Fonte: Forex Factory
                </a>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                 {pastEvents.length > 0 ? (
                   <div className="space-y-3">
                     {pastEvents.map((event) => {
                       const styles = getSentimentStyles(event.sentiment);
                       return (
                         <button 
                          key={event.id} 
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full text-left p-4 rounded-2xl border ${styles.bg} ${styles.border} relative group transition-all hover:scale-[1.02] active:scale-95 shadow-sm hover:shadow-indigo-500/10`}
                         >
                            <div className="flex justify-between items-center mb-1.5">
                               <span className={`text-[11px] font-black uppercase ${styles.text} tracking-tight leading-none`}>
                                  {event.title}
                               </span>
                               <span className="text-[9px] font-bold text-slate-500 jetbrains">{new Date(event.time * 1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', timeZone: 'America/Sao_Paulo'})}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 mb-3 leading-snug line-clamp-2">
                              {event.description}
                            </p>
                            <div className="flex justify-between items-center">
                               <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${styles.badge} tracking-wider`}>
                                  IMPACTO: {event.impact}
                               </span>
                            </div>
                         </button>
                       );
                     })}
                   </div>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full opacity-20 py-10">
                      <i className="fas fa-calendar-times text-3xl mb-4"></i>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-center">Nenhum evento relevante</p>
                   </div>
                 )}
              </div>

              {futureEvents.length > 0 && (
                <div className="pt-4 mt-4 border-t border-slate-800/40 shrink-0">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                    <span className="w-2 h-4 bg-amber-500 rounded-sm"></span>
                    Próximos Eventos
                  </h3>
                  <div className="space-y-2">
                    {futureEvents.map(event => (
                      <button 
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="w-full text-left p-3 rounded-xl border border-slate-800 bg-[#0d1226]/50 group transition-all hover:border-amber-500/40 hover:bg-[#0d1226]">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-300 group-hover:text-amber-400 transition-colors tracking-tight line-clamp-1">
                            {event.title}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 jetbrains bg-slate-800/50 px-2 py-0.5 rounded">
                            {new Date(event.time * 1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', timeZone: 'America/Sao_Paulo'})}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
           </div>
        </aside>

        {/* POPUP MODAL PARA NOTÍCIA */}
        {selectedEvent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-[#02040a]/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedEvent(null)}>
            <div 
              className={`bg-[#050814] border-2 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 ${getSentimentStyles(selectedEvent.sentiment).border}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded bg-[#0d1226] border tracking-[0.2em] w-fit ${getSentimentStyles(selectedEvent.sentiment).text} ${getSentimentStyles(selectedEvent.sentiment).border}`}>
                      {selectedEvent.impact} IMPACTO
                    </span>
                    <h2 className="text-2xl font-black text-white leading-tight mt-1 tracking-tight">
                      {selectedEvent.title}
                    </h2>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="w-10 h-10 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center text-slate-500">
                    <i className="fas fa-times text-xl"></i>
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#0d1226] p-6 rounded-2xl border border-slate-800 shadow-inner">
                    <p className="text-sm text-slate-300 leading-relaxed font-medium italic">
                      "{selectedEvent.description}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0d1226]/50 p-4 rounded-xl border border-slate-800/50">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">DATA EVENTO</span>
                      <span className="text-xs font-bold text-white jetbrains">
                        {new Date(selectedEvent.time * 1000).toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'})}
                      </span>
                    </div>
                    <div className="bg-[#0d1226]/50 p-4 rounded-xl border border-slate-800/50">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">HORÁRIO</span>
                      <span className="text-xs font-bold text-white jetbrains">
                        {new Date(selectedEvent.time * 1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', timeZone: 'America/Sao_Paulo'})}
                      </span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border flex items-center gap-4 ${getSentimentStyles(selectedEvent.sentiment).bg} ${getSentimentStyles(selectedEvent.sentiment).border}`}>
                    <i className={`fas ${selectedEvent.sentiment === 'POSITIVE' ? 'fa-chart-line text-emerald-500' : selectedEvent.sentiment === 'NEGATIVE' ? 'fa-chart-area text-rose-500' : 'fa-minus text-amber-500'} text-xl`}></i>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">SENTIMENTO IA</span>
                      <span className={`text-sm font-black ${getSentimentStyles(selectedEvent.sentiment).text}`}>
                        {selectedEvent.sentiment === 'POSITIVE' ? 'ALTISTA / BULLISH' : selectedEvent.sentiment === 'NEGATIVE' ? 'BAIXISTA / BEARISH' : 'NEUTRO / LATERAL'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="h-14 bg-[#0d1226] border-t border-slate-800/60 px-8 flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">SENTINEL NEWS TERMINAL v3</span>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors"
                >
                  FECHAR JANELA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POPUP MODAL PARA COMPONENTES */}
        {isBreadthModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#02040a]/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsBreadthModalOpen(false)}>
              <div 
                className="bg-[#050814] border border-slate-800 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                 <div className="h-16 bg-[#0d1226] border-b border-slate-800 px-8 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                       <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-600/20">
                          <i className="fas fa-th-large text-white text-xs"></i>
                       </div>
                       <h3 className="text-[13px] font-black text-white uppercase tracking-[0.2em]">
                          {selectedAsset.symbol === 'US30' ? 'Componentes Dow Jones 30' : 'Componentes Hang Seng 50'}
                       </h3>
                    </div>
                    
                    <div className="flex items-center gap-8">
                       <div className="flex items-center gap-6 text-[11px] font-black jetbrains">
                          <span className="text-emerald-500 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                            ↑ {breadthSummary.advancing} Alta
                          </span>
                          <span className="text-rose-500 px-3 py-1 bg-rose-500/10 rounded-full border border-rose-500/20">
                            ↓ {breadthSummary.declining} Baixa
                          </span>
                       </div>
                       <button 
                          onClick={() => setIsBreadthModalOpen(false)}
                          className="w-10 h-10 rounded-full hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-400 hover:text-white"
                       >
                          <i className="fas fa-times text-lg"></i>
                       </button>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                       {breadthDetails.map(ticker => (
                          <div key={ticker.symbol} className={`p-4 rounded-xl border flex flex-col justify-between h-24 transition-all duration-300 ${ticker.change >= 0 ? 'bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/10 hover:border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/10 hover:bg-rose-500/10 hover:border-rose-500/30'}`}>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ticker.symbol.replace('.HK', '')}</span>
                             <div className="flex items-end justify-between">
                                <span className={`text-[16px] font-black jetbrains ${ticker.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                   {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}%
                                </span>
                                <i className={`fas ${ticker.change >= 0 ? 'fa-chart-line text-emerald-500/30' : 'fa-chart-area text-rose-500/30'} text-2xl`}></i>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
                 
                 <div className="h-12 bg-[#0d1226] border-t border-slate-800 px-8 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.3em]">Institutional Grade Heatmap Analysis</span>
                 </div>
              </div>
           </div>
        )}
      </main>

      <footer className="h-8 bg-[#02040a] border-t border-slate-800/40 flex items-center justify-between px-8 text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-indigo-500"></div> SCM Engine: V3.8.2-PRO</span>
          <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-indigo-500"></div> Inst. Score Engine: V4</span>
        </div>
        <div className="text-slate-500">NY SENTINEL © 2025 INSTITUTIONAL ACCESS</div>
      </footer>
    </div>
  );
};

export default App;