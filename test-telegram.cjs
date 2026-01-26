// test-telegram.cjs
// Teste de envio de mensagem para o Telegram usando TypeScript
// Necessário: npm install esbuild-register

process.env.VITE_TELEGRAM_BOT_TOKEN = '7367907001:AAFEc8FwNIa6PNHd79rQ8uYNrzgfx2hTJc0';
process.env.VITE_TELEGRAM_CHAT_ID = '603201843';

require('esbuild-register');
const telegram = require('./services/telegramService');

const mensagemHK50 = `🕒 [ABERTURA]

🇭🇰 HK50: Sinal de 🔻 VENDA FORTE  
Score institucional: -6  
Cotação: (aguardando abertura)

🌎 Índices globais:
🥇 VHSI: -0.93% 😱  
🇨🇳 CNH (USD/CNH): +0.83%  
🇯🇵 Nikkei 225: +0.67%  
🇨🇳 SSE: -0.14%  
🇺🇸 US500: +0.56%  
🇺🇸 USD/JPY: -0.61%  
💵 DXY: +0.74%  

📊 Resumo:
- 📉 Volume vendedor dominante (52% venda)
- 😱 VHSI em queda (-0.93%)
- 🔴 Breadth negativo (37 alta, 23 baixa)
- 🕳️ Gap de abertura: -0.02%

⚡️ Siga as zonas SMC/FGV para melhor entrada.`;

telegram.sendTelegramAnalysis(mensagemHK50);
