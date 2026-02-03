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

  // Monta análise detalhada
  let analysis = `\n[ANÁLISE DETALHADA ${assetSymbol}]\n`;
  analysis += `Cotação: ${snapshot.quote}\n`;
  analysis += `Gap: ${snapshot.gap}\n`;
  analysis += `Volume: ${snapshot.volume} | Buy: ${snapshot.volumeBuy} | Sell: ${snapshot.volumeSell}\n`;
  analysis += `Breadth: ${snapshot.breadth.summary.advancing} em alta, ${snapshot.breadth.summary.declining} em baixa\n`;
  if (snapshot.indices) {
    analysis += 'Índices:\n';
    for (const [k, v] of Object.entries(snapshot.indices)) {
      analysis += `- ${k}: ${(v as any).price ?? v}\n`;
    }
  }
  // Envia análise detalhada
  const { sendTelegramAnalysis } = await import('./services/telegramService');
  await sendTelegramAnalysis(analysis);
  console.log(`[ANÁLISE] Análise detalhada enviada para ${assetSymbol}`);
}

(async () => {
  const label = process.argv[2] || 'open';
  await sendSignalFromSnapshot('US30', label);
  await sendSignalFromSnapshot('HK50', label);
})();
