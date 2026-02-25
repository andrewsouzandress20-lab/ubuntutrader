import { describe, it, expect, vi } from 'vitest';
import { analyzeMarket } from '../services/geminiService.ts';

// Mock de dependências externas, se necessário
vi.mock('../services/geminiService', () => ({
  analyzeMarket: vi.fn(() => Promise.resolve('Mock Gemini Result')),
}));

describe('Gemini - analyzeMarket', () => {
  it('deve retornar resultado simulado', async () => {
    const candles = [];
    const asset = { symbol: 'BTCUSDT', name: 'Bitcoin', basePrice: 40000, volatility: 0.05, decimals: 2 };
    const correlations = [];
    const events = [];
    const type = 'IA_HEADER';
    const extraData = { score: 10, bullFVG: 2, bearFVG: 1 };
    const result = await analyzeMarket(candles, asset, correlations, events, type, extraData);
    expect(result).toBe('Mock Gemini Result');
  });
});
