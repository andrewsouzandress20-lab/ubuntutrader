import 'dotenv/config';
import * as fs from 'fs';
import { sendTelegramSignal2 } from './services/telegramService2.js';

async function sendSignalFromSnapshot(assetSymbol: string, label: string) {
  const file = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
  if (!fs.existsSync(file)) {
    console.error(`[SNAPSHOT] Arquivo não encontrado: ${file}`);
    return;
  }
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const score = snapshot.breadth.summary.advancing - snapshot.breadth.summary.declining;
  await sendTelegramSignal2(
    assetSymbol,
    'COMPRA',
    'FORTE',
    score
  );
  console.log(`[SINAL] Sinal enviado para ${assetSymbol} usando snapshot ${label}`);
}

(async () => {
  const label = process.argv[2] || 'open';
  await sendSignalFromSnapshot('US30', label);
  await sendSignalFromSnapshot('HK50', label);
})();
