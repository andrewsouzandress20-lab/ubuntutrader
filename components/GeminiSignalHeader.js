import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
function getScoreLabel(score) {
    if (score > 0)
        return 'COMPRA';
    if (score < 0)
        return 'VENDA';
    return 'NEUTRO';
}
function getStrengthLabel(score) {
    if (Math.abs(score) > 10)
        return 'FORTE';
    if (Math.abs(score) > 5)
        return 'MODERADA';
    if (Math.abs(score) > 0)
        return 'FRACA';
    return 'AGUARDANDO';
}
const GeminiSignalHeader = ({ candles, asset, correlations, events, smcZones, institutionalScore }) => {
    return (_jsx("div", { className: "w-full flex flex-col items-center justify-center py-2", children: _jsxs("div", { className: "text-amber-400 text-[16px] md:text-[16px] sm:text-[15px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-amber-500/40 w-full max-w-[420px] text-center", children: [_jsx("span", { role: 'img', "aria-label": 'bot', children: "\uD83E\uDD16" }), " ", _jsx("span", { role: 'img', "aria-label": 'luz', children: "\uD83D\uDCA1" }), " ", institutionalScore > 0 ? '+' : '', institutionalScore, " ", getScoreLabel(institutionalScore), _jsx("br", {}), "Confian\u00E7a: ", _jsx("b", { children: getStrengthLabel(institutionalScore) })] }) }));
};
export default GeminiSignalHeader;
