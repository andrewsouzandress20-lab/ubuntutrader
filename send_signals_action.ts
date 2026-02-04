import 'dotenv/config';
import * as fs from 'fs';
import { sendTelegramSignal, sendTelegramAnalysis } from './services/telegramService.ts';


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

// Função para enviar análise detalhada usando snapshot
async function sendAnalysisFromSnapshot(assetSymbol: string, label: string) {
  const file = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
  if (!fs.existsSync(file)) {
    console.error(`[SNAPSHOT] Arquivo não encontrado: ${file}`);
    return;
  }
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
  // Aqui você pode customizar a mensagem de análise detalhada
  const message = `Análise detalhada para ${assetSymbol} (${label}):\n\n` + JSON.stringify(snapshot, null, 2);
  await sendTelegramAnalysis(message);
  console.log(`[ANALISE] Análise enviada para ${assetSymbol} usando snapshot ${label}`);
}


// Se o argumento for "analysis", envia análise detalhada, senão envia sinal padrão
(async () => {
  const label = process.argv[2] || 'open';
  const mode = process.argv[3] || 'signal';
  if (mode === 'analysis') {
    await sendAnalysisFromSnapshot('US30', label);
    await sendAnalysisFromSnapshot('HK50', label);
  } else {
    await sendSignalFromSnapshot('US30', label);
    await sendSignalFromSnapshot('HK50', label);
  }
})();
