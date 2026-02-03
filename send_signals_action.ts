import 'dotenv/config';
import { collectAndSendSignal } from './scheduler.ts';

(async () => {
  await collectAndSendSignal('US30');
  await collectAndSendSignal('HK50');
  console.log('Sinais enviados para US30 e HK50.');
})();
