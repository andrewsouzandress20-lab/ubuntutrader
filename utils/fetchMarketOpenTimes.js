// Utilitário para buscar horários de abertura do arquivo local
export async function fetchMarketOpenTimes() {
    const res = await fetch('/market_open_times.json');
    return await res.json();
}
