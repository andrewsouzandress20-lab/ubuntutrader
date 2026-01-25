
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Candle, Asset, SUPPORTED_ASSETS, Timeframe, TIMEFRAMES, UTC_OFFSETS, CorrelationData, MarketBreadthSummary, BreadthCompanyDetails, VolumePressure, GapData, EconomicEvent, SMCZone, FVGType, ZoneType } from './types';
import { fetchRealData, fetchCorrelationData, fetchMarketBreadth, calculateVolumePressure, detectOpeningGap, fetchEconomicEvents, fetchCurrentPrice } from './services/dataService';
import { sendTelegramSignal } from './services/telegramService';
import { detectSMCZones } from './utils/fvgDetector';

import TradingChart from './components/TradingChart';
import MqlCalendarWidget from './components/MqlCalendarWidget';
import MacroHeaderAlert from './components/MacroHeaderAlert';
import GeminiSignalHeader from './components/GeminiSignalHeader';
import SuggestionBanner from './components/SuggestionBanner';

const App: React.FC = () => {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 600);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(SUPPORTED_ASSETS[1]); 
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [breadthSummary, setBreadthSummary] = useState<MarketBreadthSummary>({ advancing: 0, declining: 0, total: 30 });
  const [breadthDetails, setBreadthDetails] = useState<BreadthCompanyDetails[]>([]);
  const [isBreadthModalOpen, setIsBreadthModalOpen] = useState(false);
  const [volumePressure, setVolumePressure] = useState<VolumePressure>({ buyPercent: 50, sellPercent: 50, total: 0 });
  const [gap, setGap] = useState<GapData>({ value: 0, percent: 0, type: 'none' });
  
  const [loading, setLoading] = useState(true);
  const [lastAutoSignalDate, setLastAutoSignalDate] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const getScoreLabel = useCallback((s: number) => {
    if (Math.abs(s) <= 15) return "NEUTRO";
    return s > 0 ? "COMPRA" : "VENDA";
  }, []);

  const getStrengthLabel = useCallback((s: number) => {
    const absScore = Math.abs(s);
    if (absScore <= 15) return "AGUARDANDO";
    if (absScore > 70) return "FORTE";
    if (absScore > 40) return "MODERADA";
    return "FRACA";
  }, []);

  const smcZones = useMemo(() => detectSMCZones(candles, { lookback: 150, mitigationDetection: true, drawFilled: true }), [candles]);

  const institutionalScore = useMemo(() => {
    let score = 0;
    score += (volumePressure.buyPercent - 50) * 0.70;
    const breadthRatio = breadthSummary.advancing / (breadthSummary.total || 1);
    score += (breadthRatio - 0.5) * 70;
    const bullFVGs = smcZones.filter(z => z.type === ZoneType.FVG && z.sentiment === FVGType.BULLISH && !z.mitigated).length;
    const bearFVGs = smcZones.filter(z => z.type === ZoneType.FVG && z.sentiment === FVGType.BEARISH && !z.mitigated).length;
    score += (bullFVGs - bearFVGs) * 6;
    return Math.round(Math.max(-100, Math.min(100, score)));
  }, [volumePressure, breadthSummary, smcZones]);

  const marketStatus = useMemo(() => {
    const hrs = currentTime.getHours();
    const mins = currentTime.getMinutes();
    const timeVal = hrs * 60 + mins;
    const usOpen = 10 * 60 + 30;
    const usClose = 17 * 60;
    const hkOpen = 22 * 60 + 30;
    const hkClose = 5 * 60;
    return { isUSOpen: timeVal >= usOpen && timeVal <= usClose, isHKOpen: timeVal >= hkOpen || timeVal <= hkClose };
  }, [currentTime]);

  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      
      const dateKey = `${now.toISOString().split('T')[0]}-${selectedAsset.symbol}`;
      
      const isUS30Opening = selectedAsset.symbol === 'US30' && hours === 10 && minutes === 30 && seconds === 5;
      const isHK50Opening = selectedAsset.symbol === 'HK50' && hours === 22 && minutes === 30 && seconds === 5;

      if ((isUS30Opening || isHK50Opening) && lastAutoSignalDate !== dateKey) {
        const signal = getScoreLabel(institutionalScore);
        const strength = getStrengthLabel(institutionalScore);
        
        if (signal !== 'NEUTRO') {
          sendTelegramSignal(selectedAsset.symbol, signal, strength, institutionalScore);
          setLastAutoSignalDate(dateKey);
        }
      }
    }, 1000);
    return () => clearInterval(clockInterval);
  }, [selectedAsset, institutionalScore, lastAutoSignalDate, getScoreLabel, getStrengthLabel]);

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
        if (currentPrice) candleData[candleData.length - 1].close = currentPrice;
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

  // Dados agregados para sugestão
  const suggestionData = useMemo(() => ({
    volume: candles.length > 0 ? candles[candles.length - 1].volume || 0 : 0,
    gap: gap.value,
    gapType: gap.type,
    breadth: breadthSummary,
    volumePressure,
    institutionalScore,
    smcZones,
    events,
    correlations,
    asset: selectedAsset,
  }), [candles, gap, breadthSummary, volumePressure, institutionalScore, smcZones, events, correlations, selectedAsset]);

  // Detecta abertura do mercado do ativo selecionado
  const isMarketOpen = useMemo(() => {
    if (selectedAsset.symbol === 'US30') return marketStatus.isUSOpen;
    if (selectedAsset.symbol === 'HK50') return marketStatus.isHKOpen;
    return false;
  }, [selectedAsset, marketStatus]);

  if (isMobile) {
    // Dados dinâmicos
    const score = institutionalScore;
    const scoreLabel = getScoreLabel(score);
    const scoreColor = scoreLabel === 'COMPRA' ? '#4ade80' : scoreLabel === 'VENDA' ? '#ff5a5a' : '#fbbf24';
    const gapColor = gap.type === 'up' ? '#4ade80' : gap.type === 'down' ? '#ff5a5a' : '#fbbf24';
    const gapValue = gap.type !== 'none' ? `${Math.abs(gap.percent).toFixed(2)}%` : 'Sem Gap';
    const advancing = breadthSummary.advancing;
    const declining = breadthSummary.declining;
    const assetName = selectedAsset.symbol;
    const buyPercent = volumePressure.buyPercent.toFixed(0);
    const sellPercent = volumePressure.sellPercent.toFixed(0);
    // Agenda econômica
    // Filtra eventos válidos (data e título)
    const agenda = events.filter(ev => {
      // Considera inválido se a data não for um número de data válido ou se o título estiver vazio
      const dateObj = new Date(ev.date);
      return ev.title && !isNaN(dateObj.getTime());
    }).slice(0,2);
    return (
      <div className="main-mobile">
        {/* Header com abas e horários */}
        <header className="header-mobile">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px'}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
              <h1 style={{fontSize:'1rem',fontWeight:'bold',color:'#fff',letterSpacing:'0.1em',marginBottom:2}}>UBUNTU TRADER</h1>
              <span style={{fontSize:'0.7rem',color:'#b3b3c6',fontWeight:600}}>ANÁLISE FUNDAMENTALISTA</span>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button
                style={{
                  background: selectedAsset.symbol === 'HK50' ? '#23243a' : '#23243a',
                  color: selectedAsset.symbol === 'HK50' ? '#fff' : '#b3b3c6',
                  border: selectedAsset.symbol === 'HK50' ? '2px solid #4f46e5' : 'none',
                  borderRadius: 8,
                  padding: '4px 14px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  marginRight: 4
                }}
                onClick={() => setSelectedAsset(SUPPORTED_ASSETS.find(a => a.symbol === 'HK50') || SUPPORTED_ASSETS[0])}
              >
                HK50
              </button>
              <button
                style={{
                  background: selectedAsset.symbol === 'US30' ? '#23243a' : '#23243a',
                  color: selectedAsset.symbol === 'US30' ? '#fff' : '#b3b3c6',
                  border: selectedAsset.symbol === 'US30' ? '2px solid #4f46e5' : 'none',
                  borderRadius: 8,
                  padding: '4px 14px',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
                onClick={() => setSelectedAsset(SUPPORTED_ASSETS.find(a => a.symbol === 'US30') || SUPPORTED_ASSETS[1])}
              >
                US30
              </button>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',padding:'0 16px',marginTop:6}}>
            <div style={{fontSize:'0.8rem',color:'#fff',fontWeight:600}}>SESSÃO NY (US30)</div>
            <div style={{fontSize:'0.8rem',color:'#fff',fontWeight:600}}>SESSÃO HK (HK50)</div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',padding:'0 16px',marginTop:2}}>
            <div style={{fontSize:'0.75rem',color:'#fff'}}>ABRE: <span style={{color:'#ffe600'}}>11:30 BRT</span> (UTC-3)</div>
            <div style={{fontSize:'0.75rem',color:'#fff'}}>ABRE: <span style={{color:'#ffe600'}}>22:30 BRT</span> (UTC-3)</div>
          </div>
        </header>
        {/* Banner de sugestão/alerta */}
        <div className="suggestion-banner-mobile">
          <span role="img" aria-label="alerta">⏳</span> Aguardando abertura da bolsa...
        </div>
        {/* Card principal com score, volume, gap, componentes */}
        <div style={{background:'#23243a',borderRadius:16,margin:'16px 8px 0 8px',padding:'18px 12px 10px 12px',boxShadow:'0 2px 12px #0004'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1}}>
              <div style={{color:score < 0 ? '#ff5a5a' : score > 0 ? '#4ade80' : '#fbbf24',fontWeight:'bold',fontSize:'1.5rem',lineHeight:1}}>{score > 0 ? '+' : ''}{score}</div>
              <div style={{fontSize:'0.85rem',color:'#fff',fontWeight:700,marginTop:2}}>VIÉS SMC</div>
              <div style={{fontSize:'1.1rem',fontWeight:900,color:score < 0 ? '#ff5a5a' : score > 0 ? '#4ade80' : '#fbbf24',marginTop:2}}>{scoreLabel}</div>
              <div style={{fontSize:'0.8rem',color:'#b3b3c6',fontWeight:600,marginTop:2}}>CONFIANÇA: {getStrengthLabel(score)}</div>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <div style={{fontSize:'0.8rem',color:'#b3b3c6',fontWeight:600}}>VOLUME</div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                <span style={{color:'#4ade80',fontWeight:'bold',fontSize:'1rem'}}>{buyPercent}% <span style={{fontSize:'1rem'}}>▲</span></span>
                <span style={{color:'#f87171',fontWeight:'bold',fontSize:'1rem'}}>{sellPercent}% <span style={{fontSize:'1rem'}}>▼</span></span>
              </div>
              <div style={{width:'90%',height:8,background:'#23243a',borderRadius:8,marginTop:6,display:'flex',overflow:'hidden'}}>
                <div style={{height:'100%',background:'linear-gradient(90deg,#4ade80,#22d3ee)',width:`${buyPercent}%`,transition:'width 0.5s'}}></div>
                <div style={{height:'100%',background:'linear-gradient(90deg,#f87171,#fbbf24)',width:`${sellPercent}%`,transition:'width 0.5s'}}></div>
              </div>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <div style={{fontSize:'0.8rem',color:'#b3b3c6',fontWeight:600}}>ESTRUTURA GAP</div>
              <div style={{color:gapColor,fontWeight:'bold',fontSize:'1.1rem',marginTop:2}}>{gapValue}</div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:18,borderTop:'1px solid #23243a',paddingTop:10}}>
            <div style={{color:'#4ade80',fontWeight:'bold',fontSize:'1.1rem',textAlign:'center',flex:1}}>{advancing}<div style={{fontSize:'0.7rem',color:'#b3b3c6',fontWeight:600}}>ALTA</div></div>
            <div style={{height:32,width:1,background:'#23243a',margin:'0 12px'}}></div>
            <div style={{color:'#f87171',fontWeight:'bold',fontSize:'1.1rem',textAlign:'center',flex:1}}>{declining}<div style={{fontSize:'0.7rem',color:'#b3b3c6',fontWeight:600}}>BAIXA</div></div>
          </div>
          <div style={{fontSize:'0.8rem',color:'#b3b3c6',fontWeight:600,marginTop:6}}>COMPONENTES US30</div>
        </div>
        {/* Fluxo Global - acima do gráfico */}
        <section className="global-flow-mobile" style={{marginTop: '24px', marginBottom: '0'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px 0 18px',marginBottom:8}}>
            <span style={{fontSize:'1rem',color:'#b3b3c6',fontWeight:700,letterSpacing:'0.1em'}}>FLUXO GLOBAL</span>
            <span style={{color:'#4f46e5',fontSize:'1.1rem'}}><i className="fas fa-globe"></i></span>
          </div>
          {correlations && correlations.length > 0 ? (
            correlations.map((corr, idx) => (
              <div className="card-mobile" key={corr.symbol}
                style={{margin:'12px 12px 0 12px',background:'#181a20',border:'1.5px solid #23243a',boxShadow:'0 1.5px 6px #0002'}}>
                <div>
                  <div style={{fontWeight:700}}>{corr.name}</div>
                  <div style={{fontSize:'0.8rem',color:'#b3b3c6'}}>{corr.correlation === 'positive' ? 'DIRETA' : 'INVERSA'}</div>
                </div>
                <span style={{color:corr.change < 0 ? '#f87171' : '#4ade80',fontWeight:700,fontSize:'1.1rem'}}>{corr.change >= 0 ? '+' : ''}{corr.change.toFixed(2)}%</span>
              </div>
            ))
          ) : (
            <div style={{color:'#b3b3c6',textAlign:'center',margin:'24px 0',fontWeight:600}}>Nenhum dado disponível para o fluxo global.</div>
          )}
        </section>
        {/* Gráfico e agenda */}
        <section className="chart-panel-mobile">
          <div style={{background:'#23243a',borderRadius:12,padding:8,minHeight:380,color:'#fff',fontSize:'0.9rem',textAlign:'center',boxShadow:'0 1px 4px #0002',height:'380px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <TradingChart asset={selectedAsset} loading={loading} />
          </div>
        </section>
        <section className="economic-agenda-mobile">
          <div style={{padding:'10px 12px 0 12px',fontSize:'0.9rem',color:'#b3b3c6',fontWeight:700,letterSpacing:'0.1em'}}>AGENDA ECONÔMICA TRADAYS <span style={{float:'right',fontSize:'0.8em',color:'#ffe600',fontWeight:600}}>MQL5 SYNC</span></div>
          {agenda.length === 0 && (
            <div className="agenda-row-mobile">Nenhum evento econômico encontrado.</div>
          )}
          {agenda.map((ev, idx) => (
            <div className="agenda-row-mobile" key={idx}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{color:'#ffe600',fontWeight:700}}>{new Date(ev.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span style={{color:'#b3b3c6',fontWeight:600}}>{ev.time}</span>
              </div>
              <div style={{fontSize:'0.8rem',color:'#fff',marginTop:2}}>{ev.title}</div>
            </div>
          ))}
        </section>
        {/* Rodapé */}
        <footer style={{fontSize:'0.7rem',color:'#888',textAlign:'center',margin:'12px 0',letterSpacing:'0.1em',fontWeight:600}}>
          DEVELOPER BY ANDRE SOUZA<br/>
          IMPORTANTE ENTRAR NA ABERTURA CONFORME AS ZONAS DE LIQUIDEZ EXEMPLO: SMC/FVG/ETC...
        </footer>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-screen bg-[#02040a] text-[#94a3b8] overflow-hidden font-['Inter'] selection:bg-indigo-500/30 desktop-only">
      <header className="h-[56px] bg-[#0d1226] border-b border-indigo-500/20 px-6 flex items-center justify-between shrink-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fas fa-microchip text-white text-sm"></i>
            </div>
            <div>
              <h1 className="text-[13px] font-black uppercase tracking-[0.15em] text-white leading-none">UBUNTU TRADER</h1>
              <span className="text-[8px] font-bold text-slate-500 mt-1 block uppercase tracking-wider">análise fundamentalista</span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-slate-800"></div>

          <div className="flex items-center gap-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Sessão NY (US30)</span>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${marketStatus.isUSOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                <span className="text-[10px] font-black text-white jetbrains tracking-tight">ABRE: 11:30 BRT (UTC-3)</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Sessão HK (HK50)</span>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${marketStatus.isHKOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                <span className="text-[10px] font-black text-white jetbrains tracking-tight">ABRE: 22:30 BRT (UTC-3)</span>
              </div>
            </div>
          </div>
        </div>

        {/* SUGESTÃO IA CENTRALIZADA NO HEADER */}
        <div className="flex flex-1 justify-center px-2 md:px-6 lg:px-10 min-w-0">
          <div className="flex w-full justify-center items-center min-w-0">
            <SuggestionBanner isMarketOpen={isMarketOpen} marketData={suggestionData} />
          </div>
        </div>
        {/* Se quiser manter o GeminiSignalHeader, pode deixar abaixo ou remover */}
        {/*
        <GeminiSignalHeader 
          candles={candles}
          asset={selectedAsset}
          correlations={correlations}
          events={events}
          smcZones={smcZones}
          institutionalScore={institutionalScore}
        />
        */}

        <div className="flex items-center gap-6">
          <div className="flex bg-[#050814] p-1 rounded-lg border border-slate-800">
            {SUPPORTED_ASSETS.map(a => (
              <button 
                key={a.symbol} 
                onClick={() => setSelectedAsset(a)}
                className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${selectedAsset.symbol === a.symbol ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {a.symbol}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <aside className="w-[280px] bg-[#050814] border-r border-slate-800/40 p-5 overflow-y-auto no-scrollbar flex flex-col gap-8 shrink-0 z-30">
          <section className="shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fluxo Global</h3>
              <i className="fas fa-globe text-indigo-500 text-[10px]"></i>
            </div>
            <div className="space-y-2">
              {correlations.map(c => (
                <div key={c.symbol} className="bg-[#0d1226] border border-slate-800/60 p-3 rounded-xl flex items-center justify-between hover:border-indigo-500/40 transition-all group">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white group-hover:text-indigo-400 transition-colors">{c.name}</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">{c.correlation === 'positive' ? 'Direta' : 'Inversa'}</span>
                  </div>
                  <div className={`text-[11px] font-black jetbrains ${c.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {c.change >= 0 ? '+' : ''}{c.change.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="flex-1 flex flex-col bg-[#02040a] relative overflow-hidden">
          <div className="flex-1 relative">
            <TradingChart asset={selectedAsset} loading={loading} />
          </div>

          <div className="h-[105px] bg-[#0d1226]/95 backdrop-blur-md border-t border-indigo-500/20 flex items-stretch shrink-0 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
             <div className="w-[250px] border-r border-slate-800/40 flex items-center px-6 gap-4">
                <div className={`w-[58px] h-[58px] rounded-xl flex items-center justify-center border-2 transition-all duration-700 shadow-lg ${institutionalScore >= 0 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-rose-500/10'}`}>
                   <span className="text-[22px] font-black jetbrains">
                     {institutionalScore > 0 ? '+' : ''}{institutionalScore}
                   </span>
                </div>
                <div className="flex flex-col justify-center leading-none">
                   <span className="text-[9px] font-black text-slate-500 tracking-[0.1em] mb-1.5 uppercase">Viés SMC</span>
                   <span className={`text-[20px] font-black uppercase tracking-tight leading-none ${getScoreLabel(institutionalScore) === 'COMPRA' ? 'text-emerald-400' : getScoreLabel(institutionalScore) === 'VENDA' ? 'text-rose-400' : 'text-slate-500'}`}>
                     {getScoreLabel(institutionalScore)}
                   </span>
                   <span className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Confiança: {getStrengthLabel(institutionalScore)}</span>
                </div>
             </div>

             <div className="flex-1 border-r border-slate-800/40 flex flex-col justify-center px-8 gap-2">
                <div className="flex justify-between items-end px-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">VOLUME</span>
                  <div className="flex gap-4 text-[11px] font-black jetbrains">
                    <span className="text-emerald-400">{volumePressure.buyPercent.toFixed(0)}% <i className="fas fa-caret-up"></i></span>
                    <span className="text-rose-400">{volumePressure.sellPercent.toFixed(0)}% <i className="fas fa-caret-down"></i></span>
                  </div>
                </div>
                <div className="h-[8px] bg-[#050814] border border-white/5 rounded-full overflow-hidden flex shadow-inner">
                   <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000" style={{ width: `${volumePressure.buyPercent}%` }}></div>
                   <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-1000" style={{ width: `${volumePressure.sellPercent}%` }}></div>
                </div>
             </div>

             <div className="w-[180px] border-r border-slate-800/40 flex flex-col justify-center px-6 gap-2 bg-[#050814]/30">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none text-center">Estrutura GAP</span>
                <div className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border transition-all ${gap.type !== 'none' ? (gap.type === 'up' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-rose-500/30 bg-rose-500/5 text-rose-400') : 'border-white/5 bg-[#050814] text-slate-600'}`}>
                   <i className={`fas ${gap.type === 'up' ? 'fa-arrow-trend-up' : gap.type === 'down' ? 'fa-arrow-trend-down' : 'fa-minus'} text-xs`}></i>
                   <span className="text-[14px] font-black jetbrains uppercase tracking-tight">
                     {gap.type !== 'none' ? `${Math.abs(gap.percent).toFixed(2)}%` : 'Sem Gap'}
                   </span>
                </div>
             </div>

             <button 
                onClick={() => setIsBreadthModalOpen(true)}
                className="w-[300px] flex flex-col justify-center px-8 gap-2 group hover:bg-indigo-500/5 transition-all relative overflow-hidden"
             >
                <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 group-hover:text-indigo-500 transition-all">
                  <i className="fas fa-search-plus text-[10px]"></i>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none text-center">Componentes {selectedAsset.symbol}</span>
                <div className="flex items-center justify-between px-2">
                   <div className="flex flex-col items-center">
                     <span className="text-[18px] font-black text-emerald-400 jetbrains">{breadthSummary.advancing}</span>
                     <span className="text-[7px] font-bold text-slate-600 uppercase">ALTA</span>
                   </div>
                   <div className="w-[1px] h-6 bg-slate-800"></div>
                   <div className="flex flex-col items-center">
                     <span className="text-[18px] font-black text-rose-400 jetbrains">{breadthSummary.declining}</span>
                     <span className="text-[7px] font-bold text-slate-600 uppercase">BAIXA</span>
                   </div>
                </div>
             </button>
          </div>
        </div>

        <aside className="w-[380px] bg-[#050814] border-l border-slate-800/40 flex flex-col shrink-0 overflow-hidden z-30 shadow-2xl">
           <div className="p-5 flex-1 flex flex-col overflow-hidden gap-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-3">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full"></span>
                  Agenda Econômica Tradays
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[8px] font-black text-slate-500">MQL5 SYNC</span>
                </div>
              </div>
              
              <MqlCalendarWidget />
           </div>
        </aside>

        {isBreadthModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-[#02040a]/90 backdrop-blur-xl" onClick={() => setIsBreadthModalOpen(false)}>
            <div className="bg-[#050814] border border-indigo-500/30 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="p-8 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <i className="fas fa-dna text-indigo-500"></i>
                    DNA DO ÍNDICE: {selectedAsset.symbol}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correlação Técnica por Ativo</p>
                </div>
                <button onClick={() => setIsBreadthModalOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-slate-400">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-[#02040a]/40">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {breadthDetails.map((company) => (
                    <div 
                      key={company.symbol} 
                      className={`p-4 rounded-xl border flex flex-col gap-2 transition-all hover:scale-[1.02] ${company.change >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] font-black text-white">{company.symbol.split('.')[0]}</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${company.change >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {company.status}
                        </span>
                      </div>
                      <div className={`text-[13px] font-black jetbrains ${company.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {company.change >= 0 ? '+' : ''}{company.change.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-[#0d1226] border-t border-slate-800 flex justify-between items-center shrink-0">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Sentinel Engine V4.0 @ Yahoo Finance</span>
                <button 
                  onClick={() => setIsBreadthModalOpen(false)}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-lg transition-all"
                >
                  FECHAR ANALYTICS
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="h-6 bg-[#02040a] border-t border-slate-800/40 flex items-center justify-between px-8 text-[7px] font-black uppercase tracking-[0.5em] text-slate-700">
        <div className="flex gap-8">
           <span>developer by ANDRE SOUZA</span>
           <span>importante entrar na abertura conforme as zonas de liquidez exemplo: SMC/FGV/ETC...</span>
        </div>
        <div className="text-slate-500">UBUNTU TRADER © 2026</div>
      </footer>
    </div>
  );
};

export default App;
