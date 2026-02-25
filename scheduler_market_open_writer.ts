// Script Node.js para atualizar o arquivo de horários de abertura diariamente
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.TWELVE_DATA_API_KEY || '';
const OUT_PATH = path.resolve(__dirname, 'public/market_open_times.json');

async function fetchMarketOpen(symbol: string) {
  const url = `https://api.twelvedata.com/exchange?symbol=${symbol}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

function convertToBRT(time: string, timezone: string) {
  // Exemplo: time = '09:30', timezone = 'America/New_York'
  // Converte para horário de Brasília (UTC-3)
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setUTCHours(hour, minute, 0, 0);
  // NYSE: America/New_York (UTC-5 ou UTC-4 no verão)
  // HKEX: Asia/Hong_Kong (UTC+8)
  // Usando Intl API para converter
  try {
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute));
    const brtDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const brtHour = brtDate.getHours().toString().padStart(2, '0');
    const brtMinute = brtDate.getMinutes().toString().padStart(2, '0');
    return `${brtHour}:${brtMinute}`;
  } catch {
    return time;
  }
}

async function main() {
  const nyse = await fetchMarketOpen('NYSE');
  const hkex = await fetchMarketOpen('HKEX');

  const nyseBRT = convertToBRT(nyse.opening_time, nyse.timezone);
  const hkexBRT = convertToBRT(hkex.opening_time, hkex.timezone);

  const out = {
    US30: {
      opening_time: nyseBRT,
      timezone: 'BRT'
    },
    HK50: {
      opening_time: hkexBRT,
      timezone: 'BRT'
    }
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log('Horários de abertura atualizados:', out);
}

main();
