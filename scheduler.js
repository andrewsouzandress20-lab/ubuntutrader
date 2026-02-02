// Scheduler para envio automático de sinal de abertura
import cron from 'node-cron';
import { sendTelegramSignal } from './services/telegramService.js';

// Exemplo: agendar para 11:30 da manhã (horário de Brasília)
// Ajuste conforme necessário (formato cron: 'minuto hora dia mes diaSemana')
cron.schedule('30 11 * * 1-5', async () => {
  console.log('Disparando sinal de abertura automático...');
  // Preencha os dados conforme sua lógica ou fonte de dados
  const assetSymbol = 'US30';
  const signal = 'COMPRA'; // ou 'VENDA', conforme análise
  const strength = 'FORTE';
  const score = 10; // Exemplo
  await sendTelegramSignal(assetSymbol, signal, strength, score);
});

console.log('Scheduler de sinal de abertura iniciado!');
