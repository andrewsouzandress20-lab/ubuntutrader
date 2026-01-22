
import { GoogleGenAI } from "@google/genai";
import { Candle, Asset, CorrelationData, EconomicEvent } from "../types";

export const analyzeMarket = async (
  candles: Candle[], 
  asset: Asset, 
  correlations: CorrelationData[] = [],
  events: EconomicEvent[] = [],
  context: string = "Standard"
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  if (candles.length === 0) return "Nenhum dado disponível para análise.";
  
  const currentPrice = candles[candles.length - 1].close;
  const priceChange = ((currentPrice - candles[0].close) / candles[0].close) * 100;

  const corrContext = correlations.map(c => 
    `${c.name}: ${c.change.toFixed(2)}% (${c.correlation === 'positive' ? 'Correlação Direta' : 'Inversa'})`
  ).join('\n');

  const eventContext = events.map(e => 
    `- ${e.title}: Impacto ${e.impact}. (${e.description})`
  ).join('\n');

  const prompt = `
    Como um analista financeiro sênior e estrategista macro, analise ${asset.name} (${asset.symbol}):
    Contexto da Análise: ${context}
    
    DADOS ATUAIS:
    - Preço Atual: ${currentPrice.toFixed(asset.decimals)}
    - Variação no Período: ${priceChange.toFixed(2)}%
    
    EVENTOS ECONÔMICOS RECENTES:
    ${eventContext || "Nenhum evento relevante detectado."}

    QUADRO MACRO E CORRELAÇÕES:
    ${corrContext}
    
    INSTRUÇÕES:
    1. Forneça um resumo executivo do sentimento atual do mercado para este ativo.
    2. Avalie o impacto das correlações (DXY, VIX, etc.) no preço atual.
    3. Sugira um viés de curto prazo (Alta, Baixa ou Neutro) baseado exclusivamente no sentimento macro e dados de volume.
    
    Forneça uma resposta curta, técnica e em Português (Brasil).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Análise indisponível no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao processar análise macroeconômica.";
  }
};
