
import React, { useEffect, useRef } from 'react';
import { Asset } from '../types';

interface Props {
  asset: Asset;
  loading: boolean;
}

const TradingChart: React.FC<Props> = ({ asset }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = `tv_chart_main_container`;

  useEffect(() => {
    let timer: number;
    
    const initWidget = () => {
      if (typeof (window as any).TradingView !== 'undefined' && containerRef.current) {
        // Limpa o container interno para garantir re-inicialização limpa
        containerRef.current.innerHTML = '';
        
        const internalContainer = document.createElement('div');
        internalContainer.id = widgetId;
        internalContainer.style.width = '100%';
        internalContainer.style.height = '100%';
        containerRef.current.appendChild(internalContainer);

        // Usando o símbolo direto conforme solicitado pelo usuário
        const targetSymbol = asset.symbol;

        try {
          new (window as any).TradingView.widget({
            "autosize": true,
            "symbol": targetSymbol,
            "interval": "5",
            "timezone": "America/Sao_Paulo",
            "theme": "dark",
            "style": "1",
            "locale": "br",
            "toolbar_bg": "#0d1226",
            "enable_publishing": false,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "save_image": false,
            "container_id": widgetId,
            "backgroundColor": "#02040a",
            "gridColor": "rgba(30, 41, 59, 0.05)",
            "withdateranges": true,
            "hide_legend": false,
            "details": false,
            "hotlist": false,
            "calendar": false,
            "show_popup_button": true,
            "popup_width": "1000",
            "popup_height": "650",
            "studies": [
              "STD;Fair_Value_Gap"
            ],
            "overrides": {
                "paneProperties.background": "#02040a",
                "paneProperties.vertGridProperties.color": "rgba(30, 41, 59, 0.1)",
                "paneProperties.horzGridProperties.color": "rgba(30, 41, 59, 0.1)",
                "mainSeriesProperties.candleStyle.upColor": "#10b981",
                "mainSeriesProperties.candleStyle.downColor": "#ef4444",
                "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
                "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
                "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
                "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444"
            }
          });
        } catch (e) {
          console.error("TradingView Widget Error:", e);
        }
      } else {
        // Tenta novamente caso o script tv.js ainda esteja carregando
        timer = window.setTimeout(initWidget, 300);
      }
    };

    initWidget();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [asset.symbol]); // Re-executa sempre que o símbolo mudar

  return (
    <div className="w-full h-full bg-[#02040a] relative" ref={containerRef}>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 bg-[#02040a] z-0">
        <i className="fas fa-circle-notch fa-spin text-xl mb-3 text-indigo-500/50"></i>
        <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Conectando Terminal TradingView ({asset.symbol})...</span>
      </div>
    </div>
  );
};

export default TradingChart;
