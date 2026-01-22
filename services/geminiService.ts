
import { GoogleGenAI } from "@google/genai";
import { Candle, Asset, CorrelationData, EconomicEvent } from "../types";

export const analyzeMarket = async (
  candles: Candle[], 
  asset: Asset, 
  correlations: CorrelationData[] = [],
  events: EconomicEvent[] = [],
  context: string = "Standard",
  extraData: { score: number, bullFVG: number, bearFVG: number }
): Promise<{ text: string, sources?: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  if (candles.length === 0) return { text: "Nenhum dado disponível para análise." };
  
  const currentPrice = candles[candles.length - 1].close;
  const priceChange = ((currentPrice - candles[0].close) / candles[0].close) * 100;

  const corrContext = correlations.map(c => 
    `${c.name}: ${c.change.toFixed(2)}% (${c.correlation === 'positive' ? 'Correlação Direta' : 'Inversa'})`
  ).join('\n');

  const prompt = `
    Como um analista financeiro sênior e estrategista de Smart Money Concepts (SMC), analise ${asset.name} (${asset.symbol}) AGORA.
    
    DADOS TÉCNICOS DETECTADOS PELO SISTEMA:
    - Preço Atual: ${currentPrice.toFixed(asset.decimals)}
    - Score Institucional Interno: ${extraData.score} (Escala -100 a +100)
    - Zonas FVG Ativas: ${extraData.bullFVG} de Alta vs ${extraData.bearFVG} de Baixa
    - Variação Recente: ${priceChange.toFixed(2)}%
    
    ESTRUTURA DE CORRELAÇÕES:
    ${corrContext}
    
    SUA TAREFA:
    1. Use a busca do Google para verificar notícias de ÚLTIMA HORA (Bloomberg, Reuters, Investing) sobre ${asset.symbol} e eventos macro (FED, inflação, dados da China se for HK50).
    2. Com base no conflito/confluência entre o Score Interno (${extraData.score}) e as notícias reais, forneça uma RECOMENDAÇÃO OBRIGATÓRIA.
    
    FORMATO DE RESPOSTA EXIGIDO:
    ---
    SINAL INSTITUCIONAL: [COMPRA / VENDA / NEUTRO]
    CONFIANÇA: [0-100%]
    
    SET-UP SUGERIDO (SMC):
    - ENTRADA: [Preço sugerido baseado em mitigação de FVG ou OB]
    - STOP LOSS: [Nível de invalidação técnica]
    - ALVO (Take Profit): [Próxima zona de liquidez]
    
    RACIONAL ESTRATÉGICO:
    [Explique brevemente a confluência entre SMC e o Macro atual em Português-BR]
    ---
    
    Seja extremamente técnico e direto. Use termos como Liquidez, Mitigação, Order Block e Imbalanço.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "Análise indisponível no momento.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, sources };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { text: "Erro ao processar análise em tempo real. Verifique a conexão com o servidor de IA." };
  }
};
