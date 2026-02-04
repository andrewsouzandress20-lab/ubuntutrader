// Função utilitária para ler JSON local
export async function fetchLocalJson(file) {
    try {
        const response = await fetch(file + '?t=' + Date.now()); // cache bust
        if (!response.ok)
            return null;
        return await response.json();
    }
    catch (e) {
        console.error('Erro ao ler arquivo local:', file, e);
        return null;
    }
}
