import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Função utilitária para cor de confiança
function getConfidenceColorClass(confidence) {
    switch (confidence) {
        case 'forte':
            return 'text-green-400 border-green-500/40';
        case 'moderada':
            return 'text-amber-400 border-amber-500/40';
        case 'fraca':
            return 'text-red-400 border-red-500/40';
        default:
            return 'text-white border-white/40';
    }
}
import React, { useEffect, useState } from 'react';
function calcInstitutionalScore(marketData) {
    if (!marketData)
        return { score: 0, bias: 'neutro', confidence: 'aguardando' };
    let scoreCompra = 0, scoreVenda = 0, pesoTotal = 0;
    // 1️⃣ VOLUME
    const volScore = marketData.volume > 1000000 ? (marketData.close > marketData.open ? 5 : -5) : 0;
    pesoTotal += Math.abs(volScore) > 0 ? 5 : 0;
    if (volScore > 0)
        scoreCompra += volScore;
    else if (volScore < 0)
        scoreVenda += Math.abs(volScore);
    // 2️⃣ VIX
    const vixScore = marketData.vix < 15 ? 3 : -3;
    pesoTotal += 3;
    if (vixScore > 0)
        scoreCompra += vixScore;
    else
        scoreVenda += Math.abs(vixScore);
    // 3️⃣ BREADTH
    const breadthScore = marketData.breadthAdv > marketData.breadthDec ? 3 : -3;
    pesoTotal += 3;
    if (breadthScore > 0)
        scoreCompra += breadthScore;
    else
        scoreVenda += Math.abs(breadthScore);
    // 4️⃣ ÍNDICES
    let indicesCompra = 0, indicesVenda = 0;
    ['US500', 'US100', '^RUT', 'JP225', 'HK50'].forEach(sym => {
        const idx = marketData.indices?.[sym];
        if (idx !== undefined) {
            if (idx > 0)
                indicesCompra++;
            else if (idx < 0)
                indicesVenda++;
        }
    });
    let indicesScore = 0;
    if (indicesCompra > indicesVenda)
        indicesScore = 2;
    else if (indicesVenda > indicesCompra)
        indicesScore = -2;
    pesoTotal += 2;
    if (indicesScore > 0)
        scoreCompra += indicesScore;
    else if (indicesScore < 0)
        scoreVenda += Math.abs(indicesScore);
    // 5️⃣ DXY
    const dxyScore = marketData.dxyChange < 0 ? 2 : -2;
    pesoTotal += 2;
    if (dxyScore > 0)
        scoreCompra += dxyScore;
    else
        scoreVenda += Math.abs(dxyScore);
    // 6️⃣ GAP
    let gapScore = 0;
    if (Math.abs(marketData.gap) > 1) {
        gapScore = marketData.gap > 0 ? 2 : -2;
        pesoTotal += 2;
        if (gapScore > 0)
            scoreCompra += gapScore;
        else
            scoreVenda += Math.abs(gapScore);
    }
    // Finalização
    const totalScore = scoreCompra - scoreVenda;
    let bias = 'neutro';
    if (totalScore > 0)
        bias = 'compra';
    else if (totalScore < 0)
        bias = 'venda';
    let confidence = 'aguardando';
    if (Math.abs(totalScore) > 10)
        confidence = 'forte';
    else if (Math.abs(totalScore) > 5)
        confidence = 'moderada';
    else if (Math.abs(totalScore) > 0)
        confidence = 'fraca';
    return { score: totalScore, bias, confidence };
}
const SuggestionBanner = ({ isMarketOpen, marketData }) => {
    const [showSuggestion, setShowSuggestion] = useState(false);
    const [suggestion, setSuggestion] = useState(null);
    useEffect(() => {
        let timer;
        if (isMarketOpen) {
            timer = setTimeout(() => {
                const result = calcInstitutionalScore(marketData);
                setSuggestion(result);
                setShowSuggestion(true);
            }, 5000);
        }
        else {
            setShowSuggestion(false);
            setSuggestion(null);
        }
        return () => clearTimeout(timer);
    }, [isMarketOpen, marketData]);
    // Antes da abertura
    if (!isMarketOpen) {
        return (_jsxs("div", { className: "text-slate-400 text-[13px] md:text-[13px] sm:text-[12px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-slate-700/40 w-full max-w-[420px] text-center", children: [_jsx("span", { role: 'img', "aria-label": 'bot', children: "\uD83E\uDD16" }), " ", _jsx("span", { role: 'img', "aria-label": 'relogio', children: "\u23F3" }), " Aguardando abertura da bolsa..."] }));
    }
    // Após abertura, mas antes dos 5s
    if (isMarketOpen && !showSuggestion) {
        return (_jsxs("div", { className: "text-indigo-400 text-[13px] md:text-[13px] sm:text-[12px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-indigo-700/40 animate-pulse w-full max-w-[420px] text-center", children: [_jsx("span", { role: 'img', "aria-label": 'bot', children: "\uD83E\uDD16" }), " Analisando cen\u00E1rio de abertura..."] }));
    }
    // Após 5s da abertura
    if (showSuggestion && suggestion) {
        return (_jsxs("div", { className: `text-[14px] md:text-[14px] sm:text-[13px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border w-full max-w-[420px] text-center ` +
                getConfidenceColorClass(suggestion.confidence), children: [_jsx("span", { role: 'img', "aria-label": 'bot', children: "\uD83E\uDD16" }), " ", _jsx("span", { role: 'img', "aria-label": 'luz', children: "\uD83D\uDCA1" }), " ", _jsx("b", { children: suggestion.score }), " ", _jsx("b", { children: suggestion.bias.toUpperCase() }), " ", _jsx("br", {}), "Confian\u00E7a: ", _jsx("b", { children: suggestion.confidence.toUpperCase() })] }));
    }
    return null;
};
export default SuggestionBanner;
