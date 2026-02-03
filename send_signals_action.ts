import 'dotenv/config';
import fs from 'fs';
import { sendTelegramSignal } from './services/telegramService.ts';


async function sendSignalFromSnapshot(assetSymbol: string, label: string) {
  const file = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
  if (!fs.existsSync(file)) {
    console.error(`[SNAPSHOT] Arquivo não encontrado: ${file}`);
    return;
  }
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
  // Score institucional (exemplo: proporção de empresas em alta)
  const score = snapshot.breadth.summary.advancing - snapshot.breadth.summary.declining;
  await sendTelegramSignal(
    assetSymbol,
    'COMPRA', // ou lógica baseada nos dados do snapshot
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
