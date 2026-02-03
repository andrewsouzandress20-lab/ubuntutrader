// Scheduler em TypeScript para envio automático de sinal de abertura


import cron from 'node-cron';
import { sendTelegramSignal } from './services/telegramService.ts';
import fs from 'fs';
import path from 'path';

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

function scheduleSignal(assetSymbol: string, openTime: string, days: string) {
  const [hour, minute] = openTime.split(':').map(Number);
  cron.schedule(`${minute} ${hour} * * ${days}`, async () => {
    console.log(`Enviando sinal de abertura para ${assetSymbol} às ${openTime} UTC`);
    await sendTelegramSignal(assetSymbol, 'COMPRA', 'FORTE', 10); // Ajuste conforme sua lógica
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


