
import { GoogleGenAI } from "@google/genai";
import { Candle, Asset, CorrelationData, EconomicEvent } from "../types.js";

export const analyzeMarket = async (
  candles: Candle[], 
  asset: Asset, 
  correlations: CorrelationData[] = [],
  events: EconomicEvent[] = [],
  context: string = "Standard",
  extraData: { score: number, bullFVG: number, bearFVG: number }
): Promise<{ text: string, sources?: any[] }> => {
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});


  
  if (candles.length === 0) return { text: "Nenhum dado disponível para análise." };
  
  const currentPrice = candles[candles.length - 1].close;
  const priceChange = ((currentPrice - candles[0].close) / candles[0].close) * 100;

  const corrContext = correlations.map(c => 
    `${c.name}: ${c.change.toFixed(2)}% (${c.correlation === 'positive' ? 'Correlação Direta' : 'Inversa'})`
  ).join('\n');

  const prompt = `
    Você é um analista financeiro sênior especializado em SMC. Sua missão é analisar ${asset.name} (${asset.symbol}) agora.
    
    DADOS TÉCNICOS:
    - Preço: ${currentPrice.toFixed(asset.decimals)}
    - Score Institucional: ${extraData.score}
    - Zonas FVG Ativas: Bull ${extraData.bullFVG} vs Bear ${extraData.bearFVG}
    
    CORRELAÇÕES:
    ${corrContext}
    
    INSTRUÇÃO OBRIGATÓRIA DE IDIOMA:
    - TODA a sua resposta deve ser em PORTUGUÊS-BR.
    - Se encontrar notícias em Inglês via Google Search, traduza e resuma para o Português.
    
    TAREFA:
    1. Pesquise notícias de ÚLTIMA HORA (últimas 24h) sobre ${asset.symbol} e o mercado macro.
    2. Combine a técnica (SMC) com o sentimento das notícias.
    
    FORMATO EXIGIDO (EM PORTUGUÊS):
    ---
    SINAL INSTITUCIONAL: [COMPRA / VENDA / NEUTRO]
    CONFIANÇA: [0-100%]
    
    ANÁLISE DE NOTÍCIAS (RESUMO PT-BR):
    [Resuma o que está acontecendo no mundo agora que afeta este ativo]
    
    SET-UP SMC:
    - ENTRADA: [Preço]
    - STOP: [Nível]
    - ALVO: [Nível]
    
    RACIONAL:
    [Explicação técnica e macro em português]
    ---
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
    return { text: "Erro ao processar análise em português. Verifique a chave de API." };
  }
};
