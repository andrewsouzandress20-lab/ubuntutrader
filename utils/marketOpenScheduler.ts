import cron from 'node-cron';
import { sendTelegramSignal } from '../services/telegramService.js';

const API_KEY = '94200850ee23473c98c21d8ab76db933';
const NYSE_SYMBOL = 'NYSE';
const HKEX_SYMBOL = 'HKEX';

// Função para buscar horário de abertura do mercado
async function getMarketOpenTime(symbol: string): Promise<string | null> {
  try {
    const url = `https://api.twelvedata.com/exchange?symbol=${symbol}&apikey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    // Exemplo de resposta: { "name": "NYSE", "opening_time": "09:30", "timezone": "America/New_York" }
    if (data && data.opening_time && data.timezone) {
      return `${data.opening_time}|${data.timezone}`;
    }
    return null;
  } catch (err) {
    console.error('Erro ao buscar horário de abertura:', err);
    return null;
  }
}

// Agenda o envio do sinal para 5 segundos após a abertura
async function scheduleMarketSignal(assetSymbol: string, marketSymbol: string) {
  const openInfo = await getMarketOpenTime(marketSymbol);
  if (!openInfo) {
    console.error(`Não foi possível obter horário de abertura para ${assetSymbol}`);
    return;
  }
  const [openTime, timezone] = openInfo.split('|');
  const [hour, minute] = openTime.split(':').map(Number);
  // Agenda para 5 segundos após a abertura
  cron.schedule(`5 ${minute} ${hour} * * 1-5`, async () => {
    console.log(`Disparando sinal de abertura para ${assetSymbol} às ${openTime} (${timezone})`);
    await sendTelegramSignal(assetSymbol, 'COMPRA', 'FORTE', 10); // Ajuste conforme sua lógica
  }, {
    timezone
  });
  console.log(`Agendado sinal de abertura para ${assetSymbol} às ${openTime} (${timezone})`);
}

// Agenda diariamente às 00:01 para buscar e agendar os sinais do dia
cron.schedule('1 0 * * 1-5', async () => {
  await scheduleMarketSignal('US30', NYSE_SYMBOL);
  await scheduleMarketSignal('HK50', HKEX_SYMBOL);
});

console.log('Market Open Scheduler iniciado!');
