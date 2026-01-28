import React from 'react';

interface Props {
  analysis: string;
}


function getMainSignalColor(analysis: string) {
  // Procura a linha do sinal final
  const lines = analysis.split('\n').map(l => l.trim()).filter(Boolean);
  const finalLine = lines.reverse().find(l => l.includes('SINAL FINAL:')) || '';
  if (/COMPRA/i.test(finalLine)) return 'text-green-400 border-green-500/40';
  if (/VENDA/i.test(finalLine)) return 'text-red-400 border-red-500/40';
  if (/MODERADA|MODERADO|FORTE/i.test(analysis)) return 'text-yellow-300 border-yellow-400/40';
  if (/NEUTRO|AGUARDANDO/i.test(finalLine)) return 'text-white border-slate-400/40';
  return 'text-amber-400 border-amber-500/40';
}

const MarketAnalysisHeader: React.FC<Props> = ({ analysis }) => {
  const colorClass = getMainSignalColor(analysis);
  return (
    <div className="w-full flex flex-col items-center justify-center py-2">
      <div className={`text-[13px] md:text-[14px] sm:text-[13px] font-mono tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] w-full max-w-[600px] text-center whitespace-pre-line border ${colorClass}`}>
        {analysis}
      </div>
    </div>
  );
};

export default MarketAnalysisHeader;
