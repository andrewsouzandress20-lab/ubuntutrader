import React, { useEffect, useState } from 'react';

interface SuggestionBannerProps {
  isMarketOpen: boolean;
  marketData: any; // Substitua por um tipo mais específico se possível
}

const getSuggestion = (marketData: any) => {
  // Lógica simplificada: analisa os dados e retorna sugestão
  // Aqui você pode integrar a análise dos componentes: índices, volume, gap, empresas, eventos, etc.
  // Exemplo fictício:
  if (!marketData) return null;

  let bias = 'neutro';
  let zone = 'SCM';

  if (marketData.volume > 1000000 && marketData.gap > 0) {
    bias = 'compra';
    zone = 'FVG';
  } else if (marketData.volume > 1000000 && marketData.gap < 0) {
    bias = 'venda';
    zone = 'SCM';
  }

  // Adapte a lógica conforme necessário
  return { bias, zone };
};


const SuggestionBanner: React.FC<SuggestionBannerProps> = ({ isMarketOpen, marketData }) => {
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<{ bias: string; zone: string } | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isMarketOpen) {
      timer = setTimeout(() => {
        const result = getSuggestion(marketData);
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
        <span role='img' aria-label='relogio'>⏳</span> Aguardando abertura da bolsa...
      </div>
    );
  }

  // Após abertura, mas antes dos 5s
  if (isMarketOpen && !showSuggestion) {
    return (
      <div className="text-indigo-400 text-[13px] md:text-[13px] sm:text-[12px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-indigo-700/40 animate-pulse w-full max-w-[420px] text-center">
        <span role='img' aria-label='analise'>🤖</span> Analisando cenário de abertura...
      </div>
    );
  }

  // Após 5s da abertura
  if (showSuggestion && suggestion) {
    return (
      <div className="text-amber-400 text-[14px] md:text-[14px] sm:text-[13px] font-bold tracking-wide px-6 py-2 sm:px-2 sm:py-1 rounded bg-[#181e2a] border border-amber-500/40 w-full max-w-[420px] text-center">
        <span role='img' aria-label='luz'>💡</span> Sugestão: Viés de <b>{suggestion.bias.toUpperCase()}</b> na zona <b>{suggestion.zone}</b>.
      </div>
    );
  }
  return null;
};

export default SuggestionBanner;
