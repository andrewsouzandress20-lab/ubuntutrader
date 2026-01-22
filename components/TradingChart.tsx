
import React, { useRef, useEffect, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { Candle, Asset, GapData, SMCZone, ZoneType, FVGType } from '../types';

interface Props {
  candles: Candle[];
  asset: Asset;
  utcOffset: number;
  gap: GapData;
  zones: SMCZone[];
  loading: boolean;
}

const TradingChart: React.FC<Props> = ({ candles, asset, utcOffset, gap, zones, loading }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const initialLoadRef = useRef(true);

  const offsetInSeconds = utcOffset * 3600;

  useEffect(() => {
    initialLoadRef.current = true;
  }, [asset.symbol]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#020617' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: '#0f172a' },
        horzLines: { color: '#0f172a' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#4f46e5', labelBackgroundColor: '#4f46e5', width: 1 },
        horzLine: { color: '#4f46e5', labelBackgroundColor: '#4f46e5', width: 1 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
      }
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision: asset.decimals,
        minMove: 1 / Math.pow(10, asset.decimals),
      },
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    setIsReady(true);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth, 
          height: chartContainerRef.current.clientHeight 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    const drawOverlays = () => {
      if (!canvasRef.current || !chartRef.current || !seriesRef.current || candles.length === 0) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const canvas = canvasRef.current;
      const currentWidth = chartContainerRef.current?.clientWidth || 0;
      const currentHeight = chartContainerRef.current?.clientHeight || 0;
      
      if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
        canvas.width = currentWidth;
        canvas.height = currentHeight;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const timeScale = chartRef.current.timeScale();
      const priceScale = seriesRef.current;

      // Draw Opening Gap (Keep it subtle)
      if (gap.type !== 'none' && gap.startIndex !== undefined && gap.prevClose && gap.openPrice) {
        const firstCandleTime = (candles[gap.startIndex].time + offsetInSeconds) as Time;
        const xGap = timeScale.timeToCoordinate(firstCandleTime);
        const pg1 = priceScale.priceToCoordinate(gap.prevClose);
        const pg2 = priceScale.priceToCoordinate(gap.openPrice);

        if (xGap !== null && pg1 !== null && pg2 !== null) {
          ctx.fillStyle = gap.type === 'up' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
          ctx.fillRect(xGap - 40, Math.min(pg1, pg2), canvas.width - xGap + 40, Math.abs(pg1 - pg2));
          ctx.strokeStyle = gap.type === 'up' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(xGap - 50, pg1);
          ctx.lineTo(canvas.width, pg1);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    };

    const interval = setInterval(drawOverlays, 100);
    chart.timeScale().subscribeVisibleTimeRangeChange(drawOverlays);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      chart.remove();
    };
  }, [asset.symbol, gap, zones, offsetInSeconds, candles.length]);

  useEffect(() => {
    if (seriesRef.current && chartRef.current) {
      if (candles.length === 0) {
        seriesRef.current.setData([]);
        return;
      }
      
      const formattedData = candles.map(c => ({
        time: (c.time + offsetInSeconds) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      
      seriesRef.current.setData(formattedData);
      
      if (initialLoadRef.current && formattedData.length > 0) {
        chartRef.current.timeScale().fitContent();
        initialLoadRef.current = false;
      }
    }
  }, [candles, offsetInSeconds]);

  return (
    <div className="relative w-full h-full bg-[#020617]">
        <div ref={chartContainerRef} className="w-full h-full" />
        <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none w-full h-full z-10" />
        
        {(loading || !isReady) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-md z-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-indigo-500/20 rounded-full"></div>
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] text-center animate-pulse">Sincronizando Dados</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{asset.symbol} - {asset.name}</span>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TradingChart;
