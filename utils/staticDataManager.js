// Gerencia congelamento e fallback dos dados dos ativos
// Congela os dados por 15min após coleta especial, depois volta ao Yahoo
const STATIC_KEY = 'static_indices_snapshot';
const STATIC_TIMESTAMP_KEY = 'static_indices_timestamp';
const STATIC_DURATION_MS = 15 * 60 * 1000; // 15 minutos
export function setStaticIndicesSnapshot(snapshot) {
    localStorage.setItem(STATIC_KEY, JSON.stringify(snapshot));
    localStorage.setItem(STATIC_TIMESTAMP_KEY, Date.now().toString());
}
export function getStaticIndicesSnapshot() {
    const ts = localStorage.getItem(STATIC_TIMESTAMP_KEY);
    if (!ts)
        return null;
    const age = Date.now() - parseInt(ts, 10);
    if (age > STATIC_DURATION_MS) {
        localStorage.removeItem(STATIC_KEY);
        localStorage.removeItem(STATIC_TIMESTAMP_KEY);
        return null;
    }
    const data = localStorage.getItem(STATIC_KEY);
    if (!data)
        return null;
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
export function clearStaticIndicesSnapshot() {
    localStorage.removeItem(STATIC_KEY);
    localStorage.removeItem(STATIC_TIMESTAMP_KEY);
}
