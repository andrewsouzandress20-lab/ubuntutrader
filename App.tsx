import { io } from 'socket.io-client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Candle, Asset, SUPPORTED_ASSETS, Timeframe, TIMEFRAMES, UTC_OFFSETS, CorrelationData, MarketBreadthSummary, BreadthCompanyDetails, VolumePressure, GapData, EconomicEvent, SMCZone, FVGType, ZoneType } from './types.js';
import { fetchRealData, fetchCorrelationData, fetchMarketBreadth, calculateVolumePressure, detectOpeningGap, fetchEconomicEvents, fetchCurrentPrice } from './services/dataService.js';
import { fetchLocalJson } from './utils/fetchLocalJson.js';
import { sendTelegramSignal, sendTelegramAnalysis } from './services/telegramService.js';
import { detectSMCZones } from './utils/fvgDetector.js';
import TradingChart from './components/TradingChart.js';
import MqlCalendarWidget from './components/MqlCalendarWidget.js';
import MacroHeaderAlert from './components/MacroHeaderAlert.js';
import GeminiSignalHeader from './components/GeminiSignalHeader.js';
import SuggestionBanner from './components/SuggestionBanner.js';

const App: React.FC = () => {
    // ...contador de usuários online removido...
  const [isMobile, setIsMobile] = React.useState(false);
  const clientSignalsEnabled = (() => {
    // Permite habilitar manualmente o envio de mensagens pelo cliente; desligado por padrão.
    // Precisa definir VITE_ENABLE_CLIENT_SIGNALS=true.
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ENABLE_CLIENT_SIGNALS === 'true') return true;
    if (typeof process !== 'undefined' && (process as any).env?.VITE_ENABLE_CLIENT_SIGNALS === 'true') return true;
    return false;
  })();

  // Startup telegram do frontend fica desabilitado por padrão para evitar envio indevido.
  React.useEffect(() => {
    if (!clientSignalsEnabled) return;
    const backendUrl = process.env.VITE_BACKEND_URL || '';
    if (!backendUrl) {
      console.warn('[TELEGRAM STARTUP] VITE_BACKEND_URL não definido');
      return;
    }
    const msg = '[STARTUP] UbuntuTrader bot rodando em ' + (typeof window !== 'undefined' ? window.location.href : 'ambiente desconhecido') + ' - ' + new Date().toLocaleString();
    fetch(`${backendUrl}/api/send-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg })
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          console.log('[TELEGRAM STARTUP] Mensagem de inicialização enviada para o Telegram com sucesso!');
        } else {
          console.error('[TELEGRAM STARTUP] Falha ao enviar mensagem de inicialização para o Telegram:', data.error || res.statusText);
        }
      })
      .catch(err => {
        console.error('[TELEGRAM STARTUP] Erro ao conectar backend Telegram:', err);
      });
  }, [clientSignalsEnabled]);
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
  const [indicesSnapshot, setIndicesSnapshot] = useState<any>(null);
  const [companiesSnapshot, setCompaniesSnapshot] = useState<any>(null);
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
    if (absScore > 70) return "FORTE";
    if (absScore > 40) return "MODERADA";
    return "FRACA";
  }, []);

  const smcZones = useMemo(() => detectSMCZones(candles, { lookback: 150, mitigationDetection: true, drawFilled: true }), [candles]);

  const institutionalScore = useMemo(() => {
    // Blocos de análise
    let scoreCompra = 0;
    let scoreVenda = 0;
    let pesoTotal = 0;
    let msg = '';

    // 1️⃣ VOLUME
    const volVar = candles.length > 0 ? ((candles[candles.length-1].close - candles[candles.length-1].open) / candles[candles.length-1].open) * 100 : 0;
    const volPressao = volumePressure.buyPercent > volumePressure.sellPercent ? 'COMPRADOR' : 'VENDEDOR';
    const volScore = volPressao === 'COMPRADOR' ? 5 : -5;
    pesoTotal += 5;
    if (volScore > 0) scoreCompra += volScore; else scoreVenda += Math.abs(volScore);
    msg += `🔹 🥇 1️⃣ VOLUME - FLUXO COMPRADOR/VENDEDOR\n\n`;
    msg += `⚖️ VOLUME COMPRADOR/VENDEDOR\nAbertura = ${candles.length > 0 ? candles[candles.length-1].open.toFixed(2) : '--'}, Fechamento = ${candles.length > 0 ? candles[candles.length-1].close.toFixed(2) : '--'}, Var = ${volVar.toFixed(2)}%\n`;
    msg += `${volPressao === 'COMPRADOR' ? '🟢' : '🔴'} Pressão: ${volPressao} (Volume = ${candles.length > 0 ? candles[candles.length-1].volume : '--'})\n`;
    msg += `💡 Fechou acima da abertura = ${volPressao === 'COMPRADOR' ? 'Compradores dominando = COMPRA US30' : 'Vendedores dominando = VENDA US30'}\n`;
    msg += `📊 Score Parcial [VOLUME]: ${volPressao === 'COMPRADOR' ? '+5.0 COMPRA' : '-5.0 VENDA'}\n\n`;

    // 2️⃣ VIX
    const vix = correlations.find(c => c.symbol === '^VIX' || c.symbol === 'VIX');
    let vixScore = 0;
    if (vix) {
      vixScore = vix.change < 0 ? 3 : -3;
      pesoTotal += 3;
      if (vixScore > 0) scoreCompra += vixScore; else scoreVenda += Math.abs(vixScore);
      msg += `🔹 🥈 2️⃣ VIX - CONFIRMAÇÃO RÁPIDA\n\n`;
      msg += `🔹 ÍNDICE DO MEDO - VIX\nVIX resultado: ${vix.change < 0 ? 'COMPRA 1 x VENDA 0' : 'COMPRA 0 x VENDA 1'}\n`;
      msg += `📊 Score Parcial [VIX]: ${vix.change < 0 ? '+3.0 COMPRA' : '-3.0 VENDA'}\n\n`;
    }

    // 3️⃣ DOW 30 - BREADTH
    const breadthScore = breadthSummary.advancing > breadthSummary.declining ? 3 : -3;
    pesoTotal += 3;
    if (breadthScore > 0) scoreCompra += breadthScore; else scoreVenda += Math.abs(breadthScore);
    msg += `🔹 🥉 3️⃣ DOW 30 - BREADTH INSTANTÂNEO\nDOW 30 resultado: COMPRA ${breadthSummary.advancing} x VENDA ${breadthSummary.declining}\n`;
    msg += `📊 Score Parcial [DOW 30]: ${breadthScore > 0 ? '+3.0 COMPRA' : '-3.0 VENDA'}\n\n`;

    // 4️⃣ ÍNDICES - ALINHAMENTO INTERMARKET
    let indicesCompra = 0, indicesVenda = 0;
    ['^GSPC','^IXIC','^RUT','JP225','HK50'].forEach(sym => {
      const idx = correlations.find(c => c.symbol === sym);
      if (idx) {
        if (idx.change > 0) indicesCompra++; else if (idx.change < 0) indicesVenda++;
      }
    });
    let indicesScore = 0;
    if (indicesCompra > indicesVenda) indicesScore = 2;
    else if (indicesVenda > indicesCompra) indicesScore = -2;
    pesoTotal += 2;
    if (indicesScore > 0) scoreCompra += indicesScore; else scoreVenda += Math.abs(indicesScore);
    msg += `🔹 4️⃣ ÍNDICES - ALINHAMENTO INTERMARKET\nÍNDICES resultado: COMPRA ${indicesCompra} x VENDA ${indicesVenda}\n`;
    msg += `📊 Score Parcial [ÍNDICES]: ${indicesScore > 0 ? '+2.0 COMPRA' : indicesScore < 0 ? '-2.0 VENDA' : 'NEUTRO'}\n\n`;

    // 5️⃣ DXY - FILTRO RÁPIDO
    const dxy = correlations.find(c => c.symbol === 'DXY' || c.symbol === 'DX-Y.NYB');
    let dxyScore = 0;
    if (dxy) {
      dxyScore = dxy.change < 0 ? 2 : -2;
      pesoTotal += 2;
      if (dxyScore > 0) scoreCompra += dxyScore; else scoreVenda += Math.abs(dxyScore);
      msg += `🔹 5️⃣ DXY - FILTRO RÁPIDO\nDXY resultado: ${dxy.change < 0 ? 'COMPRA' : 'VENDA'}\n`;
      msg += `📊 Score Parcial [DXY]: ${dxyScore > 0 ? '+2.0 COMPRA' : '-2.0 VENDA'}\n\n`;
    }

    // 6️⃣ GAP - SÓ SE GRANDE (>1%)
    let gapScore = 0;
    if (gap.type !== 'none' && Math.abs(gap.percent) > 1) {
      gapScore = gap.percent > 0 ? 2 : -2;
      pesoTotal += 2;
      if (gapScore > 0) scoreCompra += gapScore; else scoreVenda += Math.abs(gapScore);
      msg += `🔹 6️⃣ GAP - SÓ SE GRANDE (>1%)\nGAP DE ABERTURA – DOW JONES\nAbertura = ${gap.openPrice?.toFixed(2) || '--'}, Fechamento ontem = ${gap.prevClose?.toFixed(2) || '--'}, Gap = ${gap.percent?.toFixed(2) || '--'}%\n`;
      msg += `💡 GAP ${gap.percent > 0 ? 'POSITIVO' : 'NEGATIVO'} (${gap.percent?.toFixed(2)}%)\n`;
      msg += `📊 Score Parcial [GAP]: ${gapScore > 0 ? '+2.0 COMPRA' : '-2.0 VENDA'}\n\n`;
    } else {
      msg += `🔹 6️⃣ GAP - SÓ SE GRANDE (>1%)\nGAP DE ABERTURA – DOW JONES\nAbertura = ${gap.openPrice?.toFixed(2) || '--'}, Fechamento ontem = ${gap.prevClose?.toFixed(2) || '--'}, Gap = ${gap.percent?.toFixed(2) || '--'}%\n`;
      msg += `💡 GAP NEUTRO (${gap.percent?.toFixed(2) || '--'}%) = Sem direção clara\n`;
      msg += `📊 Score Parcial [GAP]: NEUTRO\n\n`;
    }

    // Finalização
    const totalScore = scoreCompra - scoreVenda;
    const pctCompra = pesoTotal > 0 ? (scoreCompra / pesoTotal) * 100 : 0;
    const pctVenda = pesoTotal > 0 ? (scoreVenda / pesoTotal) * 100 : 0;
    msg += `🔹 ⚡ FINALIZAÇÃO - DECISÃO SCALPING\nScore Ponderado: COMPRA=${scoreCompra.toFixed(1)} (${pctCompra.toFixed(1)}%) | VENDA=${scoreVenda.toFixed(1)} (${pctVenda.toFixed(1)}%)\nPeso Total: ${pesoTotal.toFixed(1)} | Margem Mínima: 10.0%\n🎯 DECISÃO FINAL: ${totalScore > 0 ? 'COMPRA' : totalScore < 0 ? 'VENDA' : 'NEUTRO'}\n💪 SINAL ${Math.abs(totalScore) > 5 ? 'FORTE' : 'FRACO'} (${Math.max(pctCompra, pctVenda).toFixed(1)}% de diferença)\n\n━━━━━━━━━━━━━━━━━━\n🚀 SINAL FINAL: ${totalScore > 0 ? '🔺 COMPRA' : totalScore < 0 ? '🔻 VENDA' : '⚖️ NEUTRO'}\n━━━━━━━━━━━━━━━━━━\n`;

    // Retorna score e mensagem
    return { score: totalScore, msg };
  }, [volumePressure, breadthSummary, gap, correlations, candles]);

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
    if (!clientSignalsEnabled) return;
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
        const { score, msg } = institutionalScore;
        if (score !== 0) {
          sendTelegramSignal(selectedAsset.symbol, score > 0 ? 'COMPRA' : 'VENDA', Math.abs(score) > 5 ? 'FORTE' : 'FRACO', score);
          setTimeout(() => {
            sendTelegramAnalysis(msg);
          }, 5000);
          setLastAutoSignalDate(dateKey);
        }
      }
    }, 1000);
    return () => clearInterval(clockInterval);
  }, [selectedAsset, institutionalScore, lastAutoSignalDate, clientSignalsEnabled]);

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

  // Carrega dados locais de índices e empresas
  useEffect(() => {
    // Função para verificar se está no período de congelamento especial
    const now = new Date();
    const openingTimes = [
      { symbol: 'US30', hour: 10, minute: 30 },
      { symbol: 'HK50', hour: 22, minute: 30 }
    ];
    const assetOpen = openingTimes.find(o => o.symbol === selectedAsset.symbol);
    let isSpecialWindow = false;
    if (assetOpen) {
      const openDate = new Date(now);
      openDate.setHours(assetOpen.hour, assetOpen.minute, 0, 0);
      const diffMin = Math.abs((now.getTime() - openDate.getTime()) / 60000);
      // 15min antes ou no ato da abertura
      isSpecialWindow = diffMin <= 15;
    }

    fetchLocalJson<any>('/indices_snapshot.json').then(setIndicesSnapshot);
    fetchLocalJson<any>('/companies_snapshot.json').then(setCompaniesSnapshot);


    // Durante a janela especial, prioriza snapshot TradingView
    if (isSpecialWindow && indicesSnapshot && indicesSnapshot.indices && indicesSnapshot.indices[selectedAsset.symbol]) {
      // Usa o snapshot TradingView para preço
      const price = parseFloat(indicesSnapshot.indices[selectedAsset.symbol].price);
      if (!isNaN(price)) {
        // Cria candle fake só para gap/score
        const candle = { time: Date.now() / 1000, open: price, high: price, low: price, close: price, volume: 0 };
        setCandles([candle]);
        setVolumePressure({ buyPercent: 50, sellPercent: 50, total: 0 });
        setGap({ value: 0, percent: 0, type: 'none' });
      }
    } else {
      // Fora da janela especial, só Yahoo
      fetchYahooOnly();
    }

    const interval = setInterval(() => {
      fetchLocalJson<any>('/indices_snapshot.json').then(setIndicesSnapshot);
      fetchLocalJson<any>('/companies_snapshot.json').then(setCompaniesSnapshot);
      if (isSpecialWindow) {
        loadData(false);
      } else {
        fetchYahooOnly();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedAsset, timeframe, loadData]);

  // Função para buscar só do Yahoo
  const fetchYahooOnly = useCallback(async () => {
    setLoading(true);
    try {
      const [candleData, corrData, breadthRes, eventData, currentPrice] = await Promise.all([
        fetchRealData(selectedAsset, timeframe), // Ajuste para garantir que só Yahoo
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
      console.error("Yahoo-only data load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAsset, timeframe]);

  // Dados agregados para sugestão
  const suggestionData = useMemo(() => {
    const lastCandle = candles.length > 0 ? candles[candles.length - 1] : { open: 0, close: 0, volume: 0 };
    // VIX e DXY
    const vix = correlations.find(c => c.symbol === '^VIX' || c.symbol === 'VIX');
    const dxy = correlations.find(c => c.symbol === 'DXY' || c.symbol === 'DX-Y.NYB');
    // Breadth
    const breadthAdv = breadthSummary.advancing || 0;
    const breadthDec = breadthSummary.declining || 0;
    // Indices
    const indices = {
      US500: correlations.find(c => c.symbol === '^GSPC')?.change || 0,
      US100: correlations.find(c => c.symbol === '^IXIC')?.change || 0,
      '^RUT': correlations.find(c => c.symbol === '^RUT')?.change || 0,
      JP225: correlations.find(c => c.symbol === 'JP225')?.change || 0,
      HK50: correlations.find(c => c.symbol === 'HK50')?.change || 0,
    };
    return {
      volume: lastCandle.volume,
      open: lastCandle.open,
      close: lastCandle.close,
      vix: vix?.change ?? 0,
      dxyChange: dxy?.change ?? 0,
      breadthAdv,
      breadthDec,
      indices,
      gap: gap.value,
      // outros campos se necessário
    };
  }, [candles, gap, breadthSummary, correlations]);

  // Detecta abertura do mercado do ativo selecionado
  const isMarketOpen = useMemo(() => {
    if (selectedAsset.symbol === 'US30') return marketStatus.isUSOpen;
    if (selectedAsset.symbol === 'HK50') return marketStatus.isHKOpen;
    return false;
  }, [selectedAsset, marketStatus]);

  // Estado global do modal de info dos índices
  const [modalInfo, setModalInfo] = React.useState<string|null>(null);

  // Exemplo de uso dos snapshots locais (pode ser adaptado para exibir no UI)
  // indicesSnapshot?.indices[selectedAsset.symbol]?.price
  // companiesSnapshot?.indices[selectedAsset.symbol] (array de empresas)

  // Função para ordenar os índices por prioridade
  const getOrderedCorrelations = (correlations: any[], assetSymbol: string) => {
    if (assetSymbol === 'HK50') {
      const priority = [
        '^VHSI', 'CNH=X', '^N225', '000001.SS', '^GSPC', 'USDJPY=X', 'DX-Y.NYB'
      ];
      return [
        ...priority.map(s => correlations.find(c => c.symbol === s)).filter(Boolean),
        ...correlations.filter(c => !priority.includes(c.symbol))
      ];
    } else if (assetSymbol === 'US30') {
      const priority = [
        '^VIX', '^GSPC', '^IXIC', 'DX-Y.NYB', '^TNX', '^RUT'
      ];
      return [
        ...priority.map(s => correlations.find(c => c.symbol === s)).filter(Boolean),
        ...correlations.filter(c => !priority.includes(c.symbol))
      ];
    }
    return correlations;
  };

  if (isMobile) {
    // Dados dinâmicos
    const score = institutionalScore.score;
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
                onClick={() => {
                  setSelectedAsset(SUPPORTED_ASSETS.find(a => a.symbol === 'HK50') || SUPPORTED_ASSETS[0]);
                  setTimeout(() => loadData(true), 10);
                }}
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
                onClick={() => {
                  setSelectedAsset(SUPPORTED_ASSETS.find(a => a.symbol === 'US30') || SUPPORTED_ASSETS[1]);
                  setTimeout(() => loadData(true), 10);
                }}
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
              {/* Removido Viés SMC */}
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
          <div style={{display:'flex',justifyContent:'center',marginTop:18}}>
            <button
              style={{
                fontSize:'1.15rem',
                color:'#ffe600',
                fontWeight:900,
                cursor:'pointer',
                textAlign:'center',
                letterSpacing:'0.12em',
                background:'#181a20',
                border:'2.5px solid #4f46e5',
                borderRadius:12,
                padding:'14px 32px',
                boxShadow:'0 2px 16px #0006',
                transition:'background 0.2s, color 0.2s',
                outline:'none',
              }}
              onClick={() => setIsBreadthModalOpen(true)}
              onMouseOver={e => e.currentTarget.style.background = '#23243a'}
              onMouseOut={e => e.currentTarget.style.background = '#181a20'}
            >
              COMPONENTES {selectedAsset.symbol}
            </button>
          </div>
        </div>
        {/* Modal de componentes para mobile */}
        {isBreadthModalOpen && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={(e)=>{if(e.target===e.currentTarget)setIsBreadthModalOpen(false);}}>
            <div style={{background:'#23243a',color:'#fff',borderRadius:16,padding:18,maxWidth:340,boxShadow:'0 2px 24px #000a',fontSize:'0.95rem',whiteSpace:'pre-line',textAlign:'left',position:'relative',width:'95vw',maxHeight:'80vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
              <button style={{position:'absolute',top:8,right:12,fontSize:18,color:'#ffe600',background:'none',border:'none',cursor:'pointer'}} onClick={()=>setIsBreadthModalOpen(false)}>×</button>
              <div style={{fontWeight:'bold',fontSize:'1.1rem',marginBottom:8}}>DNA DO ÍNDICE: {selectedAsset.symbol}</div>
              <div style={{fontSize:'0.8rem',color:'#b3b3c6',marginBottom:12}}>Correlação Técnica por Ativo</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {breadthDetails.map((company) => {
                  const change = typeof company.change === 'number' && !Number.isNaN(company.change) ? company.change : 0;
                  const status = company.status || (change >= 0 ? 'ALTA' : 'BAIXA');
                  return (
                  <div 
                    key={company.symbol} 
                    style={{padding:10,borderRadius:10,border:'1px solid #23243a',background:change>=0?'#22d3ee22':'#f8717122',display:'flex',flexDirection:'column',gap:4}}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:'0.95rem',fontWeight:'bold',color:'#fff'}}>{company.symbol.split('.')[0]}</span>
                      <span style={{fontSize:'0.7rem',fontWeight:'bold',padding:'2px 6px',borderRadius:6,background:change>=0?'#4ade80':'#f87171',color:'#23243a'}}>{status}</span>
                    </div>
                    <div style={{fontSize:'1rem',fontWeight:'bold',color:change>=0?'#4ade80':'#f87171'}}>{change>=0?'+':''}{change.toFixed(2)}%</div>
                  </div>
                );})}
              </div>
              <div style={{marginTop:16,textAlign:'right'}}>
                <button style={{padding:'8px 18px',background:'#4f46e5',color:'#fff',border:'none',borderRadius:8,fontWeight:'bold',fontSize:'0.9rem',cursor:'pointer'}} onClick={()=>setIsBreadthModalOpen(false)}>FECHAR</button>
              </div>
            </div>
          </div>
        )}
        {/* Fluxo Global - acima do gráfico */}
        <section className="global-flow-mobile" style={{marginTop: '24px', marginBottom: '0'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px 0 18px',marginBottom:8}}>
            <span style={{fontSize:'1rem',color:'#b3b3c6',fontWeight:700,letterSpacing:'0.1em'}}>FLUXO GLOBAL</span>
            <span style={{color:'#4f46e5',fontSize:'1.1rem'}}><i className="fas fa-globe"></i></span>
          </div>
          {correlations && correlations.length > 0 ? (
            getOrderedCorrelations(correlations, selectedAsset.symbol).map((corr, idx) => {
              const change = typeof corr.change === 'number' && !Number.isNaN(corr.change) ? corr.change : 0;
              return (
              <div className="card-mobile" key={corr.symbol}
                style={{margin:'12px 12px 0 12px',background:'#181a20',border:'1.5px solid #23243a',boxShadow:'0 1.5px 6px #0002',cursor:'pointer'}}
                onClick={() => setModalInfo((corr as any).info || 'Sem descrição.')}
              >
                <div>
                  <div style={{fontWeight:700}}>{corr.name}</div>
                  <div style={{fontSize:'0.8rem',color:'#b3b3c6'}}>{corr.correlation === 'positive' ? 'DIRETA' : 'INVERSA'}</div>
                </div>
                <span style={{color:change < 0 ? '#f87171' : '#4ade80',fontWeight:700,fontSize:'1.1rem'}}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
              </div>
            );})
          ) : (
            <div style={{color:'#b3b3c6',textAlign:'center',margin:'24px 0',fontWeight:600}}>Nenhum dado disponível para o fluxo global.</div>
          )}

          {modalInfo && (
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={(e)=>{if(e.target===e.currentTarget)setModalInfo(null);}}>
              <div style={{background:'#23243a',color:'#fff',borderRadius:16,padding:24,maxWidth:340,boxShadow:'0 2px 24px #000a',fontSize:'1rem',whiteSpace:'pre-line',textAlign:'left',position:'relative'}}>
                <button style={{position:'absolute',top:8,right:12,fontSize:18,color:'#ffe600',background:'none',border:'none',cursor:'pointer'}} onClick={()=>setModalInfo(null)}>×</button>
                {modalInfo}
              </div>
            </div>
          )}
        </section>
        {/* Gráfico e agenda */}
        <section className="chart-panel-mobile">
          <div style={{background:'#23243a',borderRadius:12,padding:8,minHeight:380,color:'#fff',fontSize:'0.9rem',textAlign:'center',boxShadow:'0 1px 4px #0002',height:'380px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <TradingChart asset={selectedAsset} loading={loading} />
          </div>
        </section>
        <section className="economic-agenda-mobile" style={{margin:'24px 0', textAlign:'center'}}>
          <button
            style={{
              padding:'14px 32px',
              background:'#23243a',
              color:'#ffe600',
              fontWeight:'bold',
              fontSize:'1.1rem',
              border:'2px solid #4f46e5',
              borderRadius:12,
              boxShadow:'0 2px 12px #0004',
              cursor:'pointer',
              letterSpacing:'0.1em'
            }}
            onClick={()=>setIsBreadthModalOpen('calendar')}
          >
            CALENDÁRIO ECONÔMICO
          </button>
        </section>

        {/* Pop-up do calendário econômico Tradays */}
        {isBreadthModalOpen === 'calendar' && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={(e)=>{if(e.target===e.currentTarget)setIsBreadthModalOpen(false);}}>
            <div style={{background:'#23243a',color:'#fff',borderRadius:20,padding:28,maxWidth:600,boxShadow:'0 2px 32px #000a',fontSize:'1.08rem',whiteSpace:'pre-line',textAlign:'left',position:'relative',width:'98vw',maxHeight:'92vh',overflowY:'auto', minHeight:'520px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}} onClick={e => e.stopPropagation()}>
              <button style={{position:'absolute',top:12,right:18,fontSize:24,color:'#ffe600',background:'none',border:'none',cursor:'pointer'}} onClick={()=>setIsBreadthModalOpen(false)}>×</button>
              <div style={{fontWeight:'bold',fontSize:'1.25rem',marginBottom:12, textAlign:'center'}}>CALENDÁRIO ECONÔMICO</div>
              <div style={{width:'100%', height:'700px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <div style={{width:'100%', height:'700px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <MqlCalendarWidget />
                </div>
              </div>
            </div>
          </div>
        )}
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
          institutionalScore={institutionalScore.score}
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
              {getOrderedCorrelations(correlations, selectedAsset.symbol).map(c => (
                <div key={c.symbol} className="bg-[#0d1226] border border-slate-800/60 p-3 rounded-xl flex items-center justify-between hover:border-indigo-500/40 transition-all group cursor-pointer"
                  onClick={() => setModalInfo((c as any).info || 'Sem descrição.')}
                >
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

            {modalInfo && (
              <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={(e)=>{if(e.target===e.currentTarget)setModalInfo(null);}}>
                <div style={{background:'#23243a',color:'#fff',borderRadius:16,padding:24,maxWidth:340,boxShadow:'0 2px 24px #000a',fontSize:'1rem',whiteSpace:'pre-line',textAlign:'left',position:'relative'}}>
                  <button style={{position:'absolute',top:8,right:12,fontSize:18,color:'#ffe600',background:'none',border:'none',cursor:'pointer'}} onClick={()=>setModalInfo(null)}>×</button>
                  {modalInfo}
                </div>
              </div>
            )}
          </section>
        </aside>

        <div className="flex-1 flex flex-col bg-[#02040a] relative overflow-hidden">
          <div className="flex-1 relative">
            <TradingChart asset={selectedAsset} loading={loading} />
          </div>

          <div className="h-[105px] bg-[#0d1226]/95 backdrop-blur-md border-t border-indigo-500/20 flex items-stretch shrink-0 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
             <div className="w-[250px] border-r border-slate-800/40 flex items-center px-6 gap-4">
                <div className={`w-[58px] h-[58px] rounded-xl flex items-center justify-center border-2 transition-all duration-700 shadow-lg ${institutionalScore.score >= 0 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-rose-500/10'}`}>
                   <span className="text-[22px] font-black jetbrains">
                     {institutionalScore.score > 0 ? '+' : ''}{institutionalScore.score}
                   </span>
                </div>
                <div className="flex flex-col justify-center leading-none">
                   {/* Removido Viés SMC */}
                   <span className={`text-[20px] font-black uppercase tracking-tight leading-none ${getScoreLabel(institutionalScore.score) === 'COMPRA' ? 'text-emerald-400' : getScoreLabel(institutionalScore.score) === 'VENDA' ? 'text-rose-400' : 'text-slate-500'}`}>
                     {getScoreLabel(institutionalScore.score)}
                   </span>
                   <span className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Confiança: {getStrengthLabel(institutionalScore.score)}</span>
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
              
              {/* Widget Investing.com */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <iframe
                  src="https://sslecal2.investing.com?ecoDayBackground=%23000000&ecoDayFontColor=%23000000&columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds&importance=3&features=datepicker,timezone&countries=25,6,37,5,35,43,4,72&calType=day&timeZone=12&lang=12"
                  width="320"
                  height="467"
                  frameBorder="0"
                  allowTransparency={true}
                  marginWidth="0"
                  marginHeight="0"
                  title="Calendário Econômico Investing.com"
                  style={{ borderRadius: 8, background: '#000', maxWidth: '100%' }}
                />
                <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: '#333333', textDecoration: 'none' }}>
                    Calendário Econômico fornecido por{' '}
                    <a
                      href="https://br.investing.com/"
                      rel="nofollow"
                      target="_blank"
                      style={{ fontSize: 11, color: '#06529D', fontWeight: 'bold' }}
                    >
                      Investing.com Brasil
                    </a>
                    , o portal líder financeiro.
                  </span>
                </div>
              </div>
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

              <div className="p-6 bg-[#0d1226] border-t border-slate-800 flex justify-end items-center shrink-0">
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
            {/* <span style={{color:'#ffe600'}}>🟢 Online: {onlineCount}</span> */}
          </div>
        <div className="text-slate-500">UBUNTU TRADER © 2026</div>
      </footer>
    </div>
  );
};

export default App;
