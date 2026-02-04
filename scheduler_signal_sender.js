// Scheduler para enviar sinal 5 segundos após abertura dos mercados
import * as fs from 'fs';
import * as path from 'path';
import cron from 'node-cron';
import { sendTelegramSignal } from './services/telegramService.js';
const MARKET_FILE = path.resolve(__dirname, 'public/market_open_times.json');
function getOpenTimes() {
    const raw = fs.readFileSync(MARKET_FILE, 'utf-8');
    return JSON.parse(raw);
}
function scheduleSignal(assetSymbol, openTime) {
    const [hour, minute] = openTime.split(':').map(Number);
    // Agenda para 5 segundos após o horário
    cron.schedule(`5 ${minute} ${hour} * * 1-5`, async () => {
        console.log(`Enviando sinal de abertura para ${assetSymbol} às ${openTime} BRT`);
        // Aqui você pode coletar os dados e definir a lógica do sinal
        await sendTelegramSignal(assetSymbol, 'COMPRA', 'FORTE', 10); // Ajuste conforme sua lógica
    }, {
        timezone: 'America/Sao_Paulo'
    });
    console.log(`Agendado sinal para ${assetSymbol} às ${openTime} BRT`);
}
function main() {
    const times = getOpenTimes();
    scheduleSignal('US30', times.US30.opening_time);
    scheduleSignal('HK50', times.HK50.opening_time);
}
main();
