
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

  const corrContext = correlations.map(c => 
    `${c.name}: ${c.change.toFixed(2)}% (${c.correlation === 'positive' ? 'Correlação Direta' : 'Inversa'})`
  ).join('\n');

  const prompt = `
    Você é um analista financeiro sênior especializado em SMC (Smart Money Concepts) e FVG (Fair Value Gap).
    Sua missão é analisar o ativo ${asset.name} (${asset.symbol}) agora.
    
    DADOS TÉCNICOS:
    - Preço Atual: ${currentPrice.toFixed(asset.decimals)}
    - Score Institucional Sentinel: ${extraData.score}
    - Zonas FVG Ativas: Alta (Bull) ${extraData.bullFVG} vs Baixa (Bear) ${extraData.bearFVG}
    
    CORRELAÇÕES DE MERCADO:
    ${corrContext}
    
    INSTRUÇÕES CRÍTICAS DE IDIOMA E FORMATO:
    - Responda EXCLUSIVAMENTE em PORTUGUÊS DO BRASIL.
    - Se encontrar notícias ou dados em Inglês via Google Search, você DEVE traduzir e resumir o conteúdo para Português.
    - Mantenha um tom profissional, técnico e direto ao ponto.
    
    TAREFA:
    1. Pesquise notícias globais de ÚLTIMA HORA (últimas 24h) que impactam o ${asset.symbol} e o sentimento macroeconômico.
    2. Combine a análise técnica de FVG/SMC com as notícias encontradas.
    3. Forneça um plano de trade coerente em português.
    
    ESTRUTURA DA RESPOSTA (RESPEITE OS CABEÇALHOS):
    ---
    SINAL INSTITUCIONAL: [COMPRA / VENDA / NEUTRO]
    CONFIANÇA DO MODELO: [0-100%]
    
    RESUMO DE NOTÍCIAS E MACRO (TRADUZIDO):
    [Escreva aqui o resumo das notícias e o impacto macroeconômico em português claro]
    
    ESTRATÉGIA SMC PROPOSTA:
    - PONTO DE ENTRADA: [Preço sugerido baseado em FVGs]
    - STOP LOSS: [Nível de proteção]
    - TAKE PROFIT: [Alvo técnico]
    
    RACIONAL TÉCNICO:
    [Explique em português o porquê desta análise unindo o Score Sentinel, as zonas FVG e o cenário de notícias]
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

    const text = response.text || "Análise institucional indisponível no momento.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, sources };
  } catch (error) {
    console.error("Erro no Gemini (IA):", error);
    return { text: "Ocorreu um erro ao processar a análise em português. Verifique a conexão ou a chave de API." };
  }
};
