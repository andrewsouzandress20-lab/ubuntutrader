
import React, { useEffect, useState } from 'react';

interface SuggestionBannerProps {
  isMarketOpen: boolean;
  marketData: any;
}

function calcInstitutionalScore(marketData: any) {
  if (!marketData) return { score: 0, bias: 'neutro', confidence: 'aguardando' };
  let scoreCompra = 0, scoreVenda = 0, pesoTotal = 0;

  // 1️⃣ VOLUME
  const volScore = marketData.volume > 1000000 ? (marketData.close > marketData.open ? 5 : -5) : 0;
  pesoTotal += Math.abs(volScore) > 0 ? 5 : 0;
  if (volScore > 0) scoreCompra += volScore; else if (volScore < 0) scoreVenda += Math.abs(volScore);

  // 2️⃣ VIX
  const vixScore = marketData.vix < 15 ? 3 : -3;
  pesoTotal += 3;
  if (vixScore > 0) scoreCompra += vixScore; else scoreVenda += Math.abs(vixScore);

  // 3️⃣ BREADTH
  const breadthScore = marketData.breadthAdv > marketData.breadthDec ? 3 : -3;
  pesoTotal += 3;
  if (breadthScore > 0) scoreCompra += breadthScore; else scoreVenda += Math.abs(breadthScore);

  // 4️⃣ ÍNDICES
  let indicesCompra = 0, indicesVenda = 0;
  ['US500','US100','^RUT','JP225','HK50'].forEach(sym => {
    const idx = marketData.indices?.[sym];
    if (idx !== undefined) {
      if (idx > 0) indicesCompra++; else if (idx < 0) indicesVenda++;
    }
  });
  let indicesScore = 0;
  if (indicesCompra > indicesVenda) indicesScore = 2;
  else if (indicesVenda > indicesCompra) indicesScore = -2;
  pesoTotal += 2;
  if (indicesScore > 0) scoreCompra += indicesScore; else if (indicesScore < 0) scoreVenda += Math.abs(indicesScore);

  // 5️⃣ DXY
  const dxyScore = marketData.dxyChange < 0 ? 2 : -2;
  pesoTotal += 2;
  if (dxyScore > 0) scoreCompra += dxyScore; else scoreVenda += Math.abs(dxyScore);

  // 6️⃣ GAP
  let gapScore = 0;
  if (Math.abs(marketData.gap) > 1) {
    gapScore = marketData.gap > 0 ? 2 : -2;
    pesoTotal += 2;
    if (gapScore > 0) scoreCompra += gapScore; else scoreVenda += Math.abs(gapScore);
  }

  // Finalização
  const totalScore = scoreCompra - scoreVenda;
  let bias = 'neutro';
  if (totalScore > 0) bias = 'compra';
  else if (totalScore < 0) bias = 'venda';
  let confidence = 'aguardando';
  if (Math.abs(totalScore) > 10) confidence = 'forte';
  else if (Math.abs(totalScore) > 5) confidence = 'moderada';
  else if (Math.abs(totalScore) > 0) confidence = 'fraca';
  return { score: totalScore, bias, confidence };
}



const SuggestionBanner: React.FC<SuggestionBannerProps> = ({ isMarketOpen, marketData }) => {
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<{ score: number; bias: string; confidence: string } | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isMarketOpen) {
      timer = setTimeout(() => {
        const result = calcInstitutionalScore(marketData);
        setSuggestion(result);
        setShowSuggestion(true);
      }, 5000);
    } else {
      setShowSuggestion(false);
      setSuggestion(null);
    }
    return () => clearTimeout(timer);
  }, [isMarketOpen, marketData]);

  // Antes da abertura
  if (!isMarketOpen) {
    return (
      <div className="text-slate-400 text-[13px] md:text-[13px] sm:text-[12px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-slate-700/40 w-full max-w-[420px] text-center">
        <span role='img' aria-label='bot'>🤖</span> <span role='img' aria-label='relogio'>⏳</span> Aguardando abertura da bolsa...
      </div>
    );
  }

  // Após abertura, mas antes dos 5s
  if (isMarketOpen && !showSuggestion) {
    return (
      <div className="text-indigo-400 text-[13px] md:text-[13px] sm:text-[12px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-indigo-700/40 animate-pulse w-full max-w-[420px] text-center">
        <span role='img' aria-label='bot'>🤖</span> Analisando cenário de abertura...
      </div>
    );
  }

  // Após 5s da abertura
  if (showSuggestion && suggestion) {
    return (
      <div className="text-amber-400 text-[14px] md:text-[14px] sm:text-[13px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-amber-500/40 w-full max-w-[420px] text-center">
        <span role='img' aria-label='bot'>🤖</span> <span role='img' aria-label='luz'>💡</span> <b>{suggestion.score}</b> <b>{suggestion.bias.toUpperCase()}</b> <br />
        Confiança: <b>{suggestion.confidence.toUpperCase()}</b>
      </div>
    );
  }
  return null;
};

export default SuggestionBanner;
