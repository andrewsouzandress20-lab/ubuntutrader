// Scheduler em TypeScript para envio automático de sinal de abertura


import cron from 'node-cron';
import { sendTelegramSignal } from './services/telegramService.js';
import { SUPPORTED_ASSETS, Timeframe } from './types.js';
import { fetchCurrentPrice, fetchCorrelationData, fetchMarketBreadth, fetchRealData, calculateVolumePressure, detectOpeningGap } from './services/dataService.js';
import * as fs from 'fs';
import * as path from 'path';

console.log('==============================');
console.log('🚦 UBUNTUTRADER SCHEDULER INICIADO!');
console.log('Data/Hora:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
console.log('Ambiente:', process.env.NODE_ENV || 'desconhecido');
console.log('Backend URL:', process.env.VITE_BACKEND_URL || 'não definido');
console.log('Telegram Chat ID:', process.env.VITE_TELEGRAM_CHAT_ID ? 'definido' : 'não definido');
console.log('==============================');


// Lê horários de abertura do arquivo JSON (compatível ES Modules)
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const MARKET_FILE = path.resolve(__dirname, 'market_open_times.json');
function getOpenTimes() {
  const raw = fs.readFileSync(MARKET_FILE, 'utf-8');
  return JSON.parse(raw);
}


// Agenda sinais de abertura conforme horários do arquivo JSON


async function collectAndSendSignal(assetSymbol: string) {
  try {
    const asset = SUPPORTED_ASSETS.find(a => a.symbol === assetSymbol);
    if (!asset) throw new Error('Ativo não suportado: ' + assetSymbol);

    // Coleta candles (1m timeframe, últimos 2 dias)
    const candles = await fetchRealData(asset, '1m');
    // Preço atual
    const quote = await fetchCurrentPrice(asset);
    // Índices globais
    const indices = await fetchCorrelationData(assetSymbol);
    // Breadth (avanço/queda das empresas)
    const breadth = await fetchMarketBreadth(assetSymbol);
    // Volume
    const volume = calculateVolumePressure(candles);
    // Gap de abertura
    const gap = detectOpeningGap(candles, asset);

    // Score institucional (exemplo: proporção de empresas em alta)
    const score = breadth.summary.advancing - breadth.summary.declining;

    // Log para debug
    console.log('[SINAL] Dados coletados:', {
      quote, indices, breadth, volume, gap, score
    });

    // Envia sinal para o Telegram
    await sendTelegramSignal(
      assetSymbol,
      'COMPRA', // ou lógica baseada nos dados
      'FORTE',  // ou lógica baseada nos dados
      score
    );
  } catch (err) {
    console.error('[SINAL] Erro ao coletar/enviar sinal:', err);
  }
}

function scheduleSignal(assetSymbol: string, openTime: string, days: string) {
  const [hour, minute] = openTime.split(':').map(Number);
  cron.schedule(`${minute} ${hour} * * ${days}`, async () => {
    console.log(`Enviando sinal de abertura para ${assetSymbol} às ${openTime} UTC`);
    await collectAndSendSignal(assetSymbol);
  }, {
    timezone: 'UTC'
  });
  console.log(`Agendado sinal para ${assetSymbol} às ${openTime} UTC nos dias ${days}`);
}


function main() {
  const times = getOpenTimes();
  // US30: segunda (1) a sexta (5)
  scheduleSignal('US30', times.US30.opening_time_utc, '1-5');
  // HK50: domingo (0) a quinta (4)
  scheduleSignal('HK50', times.HK50.opening_time_utc, '0-4');
}

main();


