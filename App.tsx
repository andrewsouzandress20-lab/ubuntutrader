
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Candle, Asset, SUPPORTED_ASSETS, Timeframe, TIMEFRAMES, UTC_OFFSETS, CorrelationData, MarketBreadthSummary, BreadthCompanyDetails, VolumePressure, GapData, EconomicEvent, SMCZone, FVGType, ZoneType } from './types';
import { analyzeMarket } from './services/geminiService';
import { fetchRealData, fetchCorrelationData, fetchMarketBreadth, calculateVolumePressure, detectOpeningGap, fetchEconomicEvents } from './services/dataService';
import { detectSMCZones } from './utils/fvgDetector';
import TradingChart from './components/TradingChart';

const App: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(SUPPORTED_ASSETS[0]);
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [utcOffset, setUtcOffset] = useState<number>(-3); // Default UTC-3 (BR)
  const [candles, setCandles] = useState<Candle[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [breadthSummary, setBreadthSummary] = useState<MarketBreadthSummary>({ advancing: 0, declining: 0, total: 0 });
  const [breadthDetails, setBreadthDetails] = useState<BreadthCompanyDetails[]>([]);
  const [volumePressure, setVolumePressure] = useState<VolumePressure>({ buyPercent: 50, sellPercent: 50, total: 0 });
  const [gap, setGap] = useState<GapData>({ value: 0, percent: 0, type: 'none' });
  
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState<number>(0);
  const [serverTime, setServerTime] = useState<string>('');
  
  // Modal states
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [searchBreadth, setSearchBreadth] = useState('');

  // Real-time clock for header
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false });
      setServerTime(timeStr);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setLoading(true);
    const start = Date.now();
    try {
      const [candleData, corrData, breadthRes, eventData] = await Promise.all([
        fetchRealData(selectedAsset, timeframe),
        fetchCorrelationData(selectedAsset.symbol),
        fetchMarketBreadth(selectedAsset.symbol),
        fetchEconomicEvents()
      ]);
      
      setLatency(Date.now() - start);
      setCorrelations(corrData);
      setBreadthSummary(breadthRes.summary);
      setBreadthDetails(breadthRes.details);
      setEvents(eventData);
      
      if (candleData.length > 0) {
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

  const smcZones = useMemo(() => {
    return detectSMCZones(candles, { lookback: 200, mitigationDetection: true, drawFilled: true });
  }, [candles]);

  const bullImbalances = useMemo(() => smcZones.filter(z => z.sentiment === FVGType.BULLISH && !z.mitigated).length, [smcZones]);
  const bearImbalances = useMemo(() => smcZones.filter(z => z.sentiment === FVGType.BEARISH && !z.mitigated).length, [smcZones]);

  // MARKET STRENGTH CALCULATION
  const marketStrength = useMemo(() => {
    let score = 0;

    // 1. Breadth Factor (Max 35 points)
    const breadthRatio = breadthSummary.advancing / (breadthSummary.total || 1);
    score += (breadthRatio - 0.5) * 70;

    // 2. Volume Pressure Factor (Max 25 points)
    score += (volumePressure.buyPercent - 50) * 0.5;

    // 3. Correlation Factor (Max 30 points)
    correlations.forEach(c => {
      const impact = c.change * (c.correlation === 'positive' ? 1 : -1);
      score += Math.max(-10, Math.min(10, impact * 2));
    });

    // 4. Gap Factor (Max 10 points)
    if (gap.type !== 'none') {
      score += gap.type === 'up' ? 10 : -10;
    }

    const absScore = Math.abs(score);
    const normalizedScore = Math.min(100, Math.round(absScore));
    
    let direction: 'COMPRA' | 'VENDA' | 'NEUTRO' = 'NEUTRO';
    let color = 'text-slate-400';
    let borderColor = 'border-slate-800';
    let bgColor = 'bg-slate-800/40';
    let label = 'INDEFINIDO';

    if (score > 5) {
      direction = 'COMPRA';
      color = 'text-emerald-500';
      borderColor = 'border-emerald-500/40';
      bgColor = 'bg-emerald-500/5';
    } else if (score < -5) {
      direction = 'VENDA';
      color = 'text-rose-500';
      borderColor = 'border-rose-500/40';
      bgColor = 'bg-rose-500/5';
    }

    if (normalizedScore >= 70) label = 'FORTE';
    else if (normalizedScore >= 30) label = 'MODERADO';
    else label = 'FRACO';

    return { direction, color, bgColor, borderColor, value: normalizedScore, label, raw: score };
  }, [breadthSummary, volumePressure, correlations, gap]);

  const handleManualAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeMarket(candles, selectedAsset, correlations, events, "Deep Institutional Analysis");
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const filteredBreadth = useMemo(() => {
    return breadthDetails.filter(d => d.symbol.toLowerCase().includes(searchBreadth.toLowerCase()));
  }, [breadthDetails, searchBreadth]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-slate-300 overflow-hidden font-['Inter'] selection:bg-indigo-500/30">
      
      {/* HEADER */}
      <header className="h-14 bg-[#0d1226] border-b border-slate-800/50 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fas fa-shield-halved text-white text-sm"></i>
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-widest text-white leading-none">Sentinel Pro V3.8</h1>
              <span className="text-[9px] font-bold text-slate-500 mt-0.5 block">NYSE: {serverTime} <span className="text-emerald-500 ml-1">● LIVE FEED ACTIVE</span></span>
            </div>
          </div>
        </div>

        {/* Real-time Bias Meter in Header */}
        <div className={`flex items-center gap-4 px-4 py-1.5 rounded border border-slate-800 ${marketStrength.bgColor} shadow-inner`}>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bias Monitor</span>
            <div className="flex items-center gap-2">
                <span className={`text-[11px] font-black jetbrains ${marketStrength.color}`}>{marketStrength.direction}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-slate-900/50 border border-slate-800 ${marketStrength.color}`}>
                    {marketStrength.value}% {marketStrength.label}
                </span>
            </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#151b33] border border-slate-800 rounded px-2 py-1">
             <i className="fas fa-globe text-[10px] text-slate-500 mr-2"></i>
             <select 
              value={utcOffset} 
              onChange={(e) => setUtcOffset(Number(e.target.value))}
              className="bg-transparent text-[10px] font-bold text-slate-300 outline-none cursor-pointer"
             >
               {UTC_OFFSETS.map(o => <option key={o.value} value={o.value} className="bg-[#0d1226]">{o.label}</option>)}
             </select>
          </div>

          <div className="flex bg-[#151b33] p-0.5 rounded border border-slate-800">
            {TIMEFRAMES.map(tf => (
              <button 
                key={tf.value} 
                onClick={() => setTimeframe(tf.value)}
                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${timeframe === tf.value ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="relative">
             <select 
              value={selectedAsset.symbol} 
              onChange={(e) => setSelectedAsset(SUPPORTED_ASSETS.find(a => a.symbol === e.target.value)!)}
              className="bg-[#151b33] border border-slate-800 text-white text-[10px] rounded px-3 py-1.5 font-bold outline-none cursor-pointer hover:bg-[#1c2445] appearance-none pr-8"
             >
               {SUPPORTED_ASSETS.map(a => <option key={a.symbol} value={a.symbol} className="bg-[#0d1226]">{a.symbol} - {a.name}</option>)}
             </select>
             <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-slate-500 pointer-events-none"></i>
          </div>

          <button 
            onClick={handleManualAnalysis} 
            disabled={isAnalyzing}
            className="h-8 px-4 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black uppercase text-white transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
          >
            {isAnalyzing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>} Analyze
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR: Market Sentiment */}
        <aside className="w-[280px] bg-[#0d1226]/50 border-r border-slate-800/40 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-6 shrink-0">
          
          {/* Institutional Strength Gauge - Refined */}
          <section>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Institutional Force</h3>
            <div className="bg-[#151b33]/40 border border-slate-800/50 p-6 rounded-lg flex flex-col items-center">
                <div className="relative w-36 h-36 flex items-center justify-center">
                    {/* Circle Gauge with improved viewbox and stroke */}
                    <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                        <circle cx="70" cy="70" r="62" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-800/50" />
                        <circle cx="70" cy="70" r="62" stroke="currentColor" strokeWidth="10" fill="transparent" 
                            strokeDasharray={389.55} 
                            strokeDashoffset={389.55 - (389.55 * marketStrength.value) / 100}
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ${marketStrength.direction === 'COMPRA' ? 'text-emerald-500' : marketStrength.direction === 'VENDA' ? 'text-rose-500' : 'text-slate-600'}`} 
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                        <span className={`text-2xl font-black jetbrains leading-tight ${marketStrength.color}`}>{marketStrength.value}%</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-[-2px]">{marketStrength.label}</span>
                    </div>
                </div>
                
                {/* Bias Box - Matching Screenshot */}
                <div className={`mt-6 w-full py-2.5 rounded border ${marketStrength.borderColor} ${marketStrength.bgColor} flex items-center justify-center gap-2 transition-all duration-500`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${marketStrength.color}`}>
                        Institutional Bias: {marketStrength.direction}
                    </span>
                </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Market Sentiment</h3>
              <i className="fas fa-chart-line text-indigo-500 text-[10px]"></i>
            </div>
            <div className="space-y-2">
              {correlations.map(c => (
                <div key={c.symbol} className="bg-[#151b33]/40 border border-slate-800/50 p-3 rounded-lg flex items-center justify-between hover:bg-[#151b33]/60 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white">{c.name}</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">{c.correlation === 'positive' ? 'Direct' : 'Inverse'}</span>
                  </div>
                  <span className={`text-[11px] font-black jetbrains ${c.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {c.change >= 0 ? '+' : ''}{c.change.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedAsset.symbol === 'US30' ? 'Dow Breath (30)' : 'HK Breath (50)'}</h3>
              <button 
                onClick={() => setIsDetailsModalOpen(true)}
                className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase flex items-center gap-1"
              >
                Details <i className="fas fa-external-link-alt"></i>
              </button>
            </div>
            <div className="bg-[#151b33]/40 border border-slate-800/50 p-4 rounded-lg">
              <div className="flex justify-between mb-3 px-2">
                <div className="text-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Buy</span>
                  <span className="text-lg font-black text-emerald-500 jetbrains">{breadthSummary.advancing}</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Sell</span>
                  <span className="text-lg font-black text-rose-500 jetbrains">{breadthSummary.declining}</span>
                </div>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(breadthSummary.advancing / (breadthSummary.total || 1)) * 100}%` }}></div>
                <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${(breadthSummary.declining / (breadthSummary.total || 1)) * 100}%` }}></div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Volume Pressure</h3>
            <div className="bg-[#151b33]/40 border border-slate-800/50 p-4 rounded-lg">
               <div className="flex justify-between text-[9px] font-black uppercase mb-2">
                  <span className="text-emerald-500">Bull {volumePressure.buyPercent.toFixed(0)}%</span>
                  <span className="text-rose-500">Bear {volumePressure.sellPercent.toFixed(0)}%</span>
               </div>
               <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${volumePressure.buyPercent}%` }}></div>
                  <div className="h-full bg-rose-500" style={{ width: `${volumePressure.sellPercent}%` }}></div>
               </div>
            </div>
          </section>

        </aside>

        {/* CENTER: CHART + STATUS PANEL */}
        <div className="flex-1 flex flex-col bg-[#050814] overflow-hidden relative">
          
          <div className="flex-1 relative">
            <TradingChart 
              candles={candles} 
              asset={selectedAsset} 
              utcOffset={utcOffset} 
              gap={gap} 
              zones={smcZones} 
              loading={loading}
            />
          </div>

          {/* BOTTOM STATUS BAR */}
          <div className="h-24 bg-[#0d1226]/80 backdrop-blur-md border-t border-slate-800/50 flex items-center px-6 gap-8 shrink-0 z-20">
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">NYSE Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse-slow"></div>
                  <span className="text-[11px] font-black text-white">LIVE</span>
                </div>
             </div>
             
             <div className="h-8 w-px bg-slate-800"></div>

             <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Bull Imbalances</span>
                <span className="text-xl font-black text-emerald-500 jetbrains">{bullImbalances}</span>
             </div>

             <div className="h-8 w-px bg-slate-800"></div>

             <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Bear Imbalances</span>
                <span className="text-xl font-black text-rose-500 jetbrains">{bearImbalances}</span>
             </div>

             <div className="h-8 w-px bg-slate-800"></div>

             <div className="flex flex-col ml-auto">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Stream Lag</span>
                <span className="text-[11px] font-black text-emerald-500 jetbrains">{latency}ms</span>
             </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Economic & Intelligence */}
        <aside className="w-[320px] bg-[#0d1226]/50 border-l border-slate-800/40 flex flex-col shrink-0">
           
           {/* Economic Sentinel */}
           <div className="p-4 border-b border-slate-800/40 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                   <div className="w-4 h-4 rounded bg-indigo-600/20 flex items-center justify-center border border-indigo-500/40">
                      <i className="fas fa-calendar-check text-[8px] text-indigo-400"></i>
                   </div>
                   Economic Sentinel
                </h3>
                <span className="text-[8px] font-bold text-slate-500 uppercase">Impact Logic</span>
              </div>

              <div className="space-y-3">
                {events.length === 0 ? (
                  <div className="p-4 text-center opacity-30 text-[10px] font-bold">No High Impact Events</div>
                ) : (
                  events.map(event => (
                    <div key={event.id} className="bg-[#151b33]/40 border border-slate-800/50 p-3 rounded-lg relative overflow-hidden group">
                       <div className={`absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase rounded-bl ${
                         event.sentiment === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-500' : 
                         event.sentiment === 'NEGATIVE' ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-700 text-slate-300'
                       }`}>
                         {event.sentiment}
                       </div>
                       <div className="flex items-center gap-2 mb-2">
                         <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                           event.impact === 'HIGH' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
                         }`}>
                           {event.impact}
                         </span>
                         <span className="text-[9px] font-bold text-slate-400">{new Date(event.time * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       </div>
                       <h4 className="text-[11px] font-black text-white mb-1">{event.title}</h4>
                       <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{event.description}</p>
                    </div>
                  ))
                )}
              </div>
           </div>

           {/* Sentinel Intelligence */}
           <div className="p-4 h-[350px] bg-[#090d1a] overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <i className="fas fa-brain text-indigo-500 text-xs"></i>
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Sentinel Intelligence</h3>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar text-[10px] text-slate-400 leading-relaxed font-medium">
                 {isAnalyzing ? (
                   <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                      <div className="w-8 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 animate-[loading_1.5s_infinite_linear]"></div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Processing Market Data...</span>
                   </div>
                 ) : aiAnalysis ? (
                   <div className="space-y-3 whitespace-pre-wrap">
                      {aiAnalysis}
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-30">
                      <i className="fas fa-microchip text-3xl mb-3"></i>
                      <p className="font-bold uppercase tracking-widest">Institutional Sentiment Engine Ready. <br/> Press "Analyze" to begin scan.</p>
                   </div>
                 )}
              </div>
           </div>
        </aside>
      </main>

      {/* FOOTER */}
      <footer className="h-8 bg-[#0a0f1e] border-t border-slate-800/50 flex items-center justify-between px-6 text-[9px] font-black uppercase tracking-widest text-slate-500">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2"><i className="fas fa-circle text-[6px] text-indigo-500"></i> Event Engine: Synchronized</span>
          <span className="flex items-center gap-2"><i className="fas fa-bolt text-[6px] text-indigo-500"></i> Institutional Momentum: Calibrated</span>
        </div>
        <div className="flex items-center gap-2">
          <span>NY Sentinel Pro</span>
          <span className="text-slate-700">|</span>
          <span className="text-white">V3.8 Platinum</span>
        </div>
      </footer>

      {/* DETAILS MODAL */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-20">
          <div className="absolute inset-0 bg-[#050814]/80 backdrop-blur-xl" onClick={() => setIsDetailsModalOpen(false)}></div>
          <div className="relative w-full max-w-4xl max-h-full bg-[#0d1226] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#0d1226]">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-widest">{selectedAsset.symbol} Market Breadth</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Institutional Order Flow Distribution</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search asset..."
                    className="bg-[#151b33] border border-slate-800 rounded-lg px-4 py-2 text-xs font-bold text-white placeholder-slate-600 outline-none w-48 focus:border-indigo-500 transition-colors"
                    value={searchBreadth}
                    onChange={(e) => setSearchBreadth(e.target.value)}
                  />
                  <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600"></i>
                </div>
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredBreadth.length > 0 ? filteredBreadth.map((company) => (
                  <div key={company.symbol} className="bg-[#151b33]/30 border border-slate-800/60 p-3 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-white tracking-tight">{company.symbol}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        company.status === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {company.status}
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                       <div className="flex flex-col">
                         <span className="text-[8px] font-black text-slate-600 uppercase">Change</span>
                         <span className={`text-[11px] font-black jetbrains ${company.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                           {company.change >= 0 ? '+' : ''}{company.change.toFixed(2)}%
                         </span>
                       </div>
                       <div className={`w-1 h-6 rounded-full ${company.status === 'BUY' ? 'bg-emerald-500/40' : 'bg-rose-500/40'}`}></div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-20">
                     <i className="fas fa-search text-4xl mb-4"></i>
                     <p className="text-xs font-black uppercase">No assets found matching your search</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#090d1a] border-t border-slate-800 flex items-center justify-between text-[10px] font-black uppercase text-slate-600">
               <div className="flex gap-4">
                 <span>Advancing: <span className="text-emerald-500">{breadthSummary.advancing}</span></span>
                 <span>Declining: <span className="text-rose-500">{breadthSummary.declining}</span></span>
               </div>
               <span>Sentinel Engine V3.8</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-in {
          animation: fade-in-zoom 0.3s ease-out;
        }
        @keyframes fade-in-zoom {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default App;
