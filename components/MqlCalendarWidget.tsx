
import React, { useEffect, useRef } from 'react';

const MqlCalendarWidget: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Evita múltiplas reinicializações se o componente for remontado rapidamente
    if (containerRef.current && containerRef.current.innerHTML === '') {
      // Criar o container do widget
      const widgetDiv = document.createElement('div');
      widgetDiv.id = 'economicCalendarWidget';
      widgetDiv.style.width = '100%';
      widgetDiv.style.height = '100%';
      containerRef.current.appendChild(widgetDiv);

      // Criar o script
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://www.tradays.com/c/js/widgets/calendar/widget.js?v=15';
      script.setAttribute('data-type', 'calendar-widget');
      
      // Configuração específica do usuário (incluindo theme: 1 para modo escuro)

      // Filtra para mostrar apenas eventos do dia em curso
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      script.innerHTML = JSON.stringify({
        "width": "100%",
        "height": "100%",
        "mode": "1",
        "fw": "html",
        "lang": "pt",
        "theme": 1,
        "date": dateStr
      });

      containerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-[#050814] rounded-2xl border border-slate-800/40">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-0 left-0 right-0 bg-[#0d1226]/90 backdrop-blur-md p-1 text-center border-t border-slate-800/40 z-10">
        <a 
          href="https://www.mql5.com/" 
          rel="noopener nofollow" 
          target="_blank" 
          className="text-[8px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
        >
          MQL5 Algo Trading Community
        </a>
      </div>
    </div>
  );
};

export default MqlCalendarWidget;
