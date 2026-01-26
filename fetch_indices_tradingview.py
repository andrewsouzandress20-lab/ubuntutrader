import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime


# Lista completa de índices e ativos usados no projeto
INDICES = {
    'US30': 'https://www.tradingview.com/symbols/DJI/',
    'US500': 'https://www.tradingview.com/symbols/SPX/',
    'US100': 'https://www.tradingview.com/symbols/NDX/',
    'VIX': 'https://www.tradingview.com/symbols/CBOE-VIX/',
    'DXY': 'https://www.tradingview.com/symbols/TVC-DXY/',
    'HK50': 'https://www.tradingview.com/symbols/HKEX-HSI/',
    'JP225': 'https://www.tradingview.com/symbols/TVC-NIKKEI225/',
    'CN50': 'https://www.tradingview.com/symbols/SGX-CN50/',
    'GOLD': 'https://www.tradingview.com/symbols/TVC-GOLD/',
    'WTI': 'https://www.tradingview.com/symbols/TVC-USOIL/',
    'VHSI': 'https://www.tradingview.com/symbols/HKEX-VHSI/',
    'CNH=X': 'https://www.tradingview.com/symbols/FX_IDC-CNHUSD/',
    '000001.SS': 'https://www.tradingview.com/symbols/SSE-000001/',
    'USDJPY=X': 'https://www.tradingview.com/symbols/FX_IDC-USDJPY/',
    '^TNX': 'https://www.tradingview.com/symbols/TVC-US10Y/',
    '^RUT': 'https://www.tradingview.com/symbols/AMEX-RUT/'
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def fetch_index_price(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        # O preço geralmente está em um span com data-symbol-price
        price_tag = soup.find('div', {'data-symbol-price': True})
        if not price_tag:
            # fallback: pegar o primeiro valor grande
            price_tag = soup.find('div', class_='tv-symbol-price-quote__value')
        if price_tag:
            return price_tag.text.strip()
        # fallback: buscar qualquer número grande
        for span in soup.find_all('span'):
            if span.text.replace('.', '', 1).replace(',', '', 1).isdigit():
                return span.text.strip()
        return None
    except Exception as e:
        print(f'Erro ao buscar {url}: {e}')
        return None

def main():
    snapshot = {'timestamp': datetime.utcnow().isoformat() + 'Z', 'indices': {}}
    for name, url in INDICES.items():
        print(f'Coletando {name}...')
        price = fetch_index_price(url)
        snapshot['indices'][name] = {'price': price, 'url': url}
    # Salva na raiz e na pasta pública do frontend
    with open('indices_snapshot.json', 'w') as f:
        json.dump(snapshot, f, indent=2)
    try:
        import shutil
        shutil.copyfile('indices_snapshot.json', 'public/indices_snapshot.json')
        print('Snapshot também salvo em public/indices_snapshot.json')
    except Exception as e:
        print('Aviso: não foi possível salvar em public/indices_snapshot.json:', e)
    print('Dados salvos em indices_snapshot.json')

if __name__ == '__main__':
    main()
