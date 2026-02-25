// Utilitário para buscar horários de abertura do arquivo local
export async function fetchMarketOpenTimes(): Promise<{
  US30: { opening_time: string; timezone: string };
  HK50: { opening_time: string; timezone: string };
}> {
  const res = await fetch('/market_open_times.json');
  return await res.json();
}
