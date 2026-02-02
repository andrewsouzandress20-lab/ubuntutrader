// Scheduler em TypeScript para envio automático de sinal de abertura


import fetch from 'node-fetch';
// @ts-ignore
globalThis.fetch = fetch;

import cron from 'node-cron';
import { sendTelegramSignal } from './services/telegramService';

console.log('==============================');
console.log('Scheduler de sinal de abertura INICIADO!');
console.log('Data/Hora:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
console.log('==============================');

let us30Sent = false;
let hk50Sent = false;

// Consulta status dos mercados a cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  console.log('Verificando status dos mercados...');
  try {
    const res = await fetch('https://globalmarkettimes.com/api/markets/status');
    const data = await res.json();
    // US30 (NYSE)
    const us30 = data.find((m: any) => m.symbol === 'NYSE');
    if (us30 && us30.status === 'open' && !us30Sent) {
      console.log('Abertura detectada: US30 (NYSE)');
      await sendTelegramSignal('US30', 'COMPRA', 'FORTE', 10); // Ajuste lógica conforme necessário
      us30Sent = true;
    }
    if (us30 && us30.status === 'closed') {
      us30Sent = false;
    }
    // HK50 (HKEX)
    const hk50 = data.find((m: any) => m.symbol === 'HKEX');
    if (hk50 && hk50.status === 'open' && !hk50Sent) {
      console.log('Abertura detectada: HK50 (HKEX)');
      await sendTelegramSignal('HK50', 'COMPRA', 'FORTE', 10); // Ajuste lógica conforme necessário
      hk50Sent = true;
    }
    if (hk50 && hk50.status === 'closed') {
      hk50Sent = false;
    }
  } catch (err) {
    console.error('Erro ao consultar status dos mercados:', err);
  }
});

cron.schedule('30 11 * * 1-5', async () => {
  console.log('------------------------------');
  console.log('Disparando sinal de abertura automático...');
  console.log('Data/Hora disparo:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  // Preencha os dados conforme sua lógica ou fonte de dados
  const assetSymbol = 'US30';
  const signal = 'COMPRA'; // ou 'VENDA', conforme análise
  const strength = 'FORTE';
  const score = 10; // Exemplo
  await sendTelegramSignal(assetSymbol, signal, strength, score);
  console.log('Sinal de abertura enviado!');
  console.log('------------------------------');
});
