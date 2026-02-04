import 'dotenv/config';
import { SUPPORTED_ASSETS } from '../types.js';
import { fetchCurrentPrice, fetchCorrelationData, fetchMarketBreadth, fetchRealData, calculateVolumePressure, detectOpeningGap } from '../services/dataService.js';
import * as fs from 'fs';
async function collectSnapshot(assetSymbol, label) {
    const asset = SUPPORTED_ASSETS.find(a => a.symbol === assetSymbol);
    if (!asset)
        throw new Error('Ativo não suportado: ' + assetSymbol);
    const candles = await fetchRealData(asset, '1m');
    const quote = await fetchCurrentPrice(asset);
    const indices = await fetchCorrelationData(assetSymbol);
    const breadth = await fetchMarketBreadth(assetSymbol);
    const volume = calculateVolumePressure(candles);
    const gap = detectOpeningGap(candles, asset);
    const snapshot = {
        timestamp: new Date().toISOString(),
        asset: assetSymbol,
        label,
        quote,
        indices,
        breadth,
        volume,
        gap
    };
    const outPath = `snapshots/${assetSymbol.toLowerCase()}_${label}.json`;
    fs.mkdirSync('snapshots', { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
    console.log(`[SNAPSHOT] Dados salvos em ${outPath}`);
}
(async () => {
    const label = process.argv[2] || 'open';
    await collectSnapshot('US30', label);
    await collectSnapshot('HK50', label);
})();
