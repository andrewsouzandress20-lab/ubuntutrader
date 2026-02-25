import 'dotenv/config';
import { sendTelegramSignal } from './services/telegramService';

(async () => {
  await sendTelegramSignal('US30', 'COMPRA', 'FORTE', 10);
  console.log('Teste de envio de mensagem para o Telegram finalizado.');
})();
