import 'dotenv/config';
import { collectAndSendSignal } from './scheduler.js';

(async () => {
  await collectAndSendSignal('US30');
  console.log('Teste de envio dinâmico de sinal para o Telegram finalizado.');
})();
