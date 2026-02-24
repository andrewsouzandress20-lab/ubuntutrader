import os
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime, timezone



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


def fetch_vhsi_from_hsi_official():
    """Busca VHSI direto do site oficial (HSI) via JSON estático.

    Usa o arquivo chart-rebased para pegar o último valor disponível
    (previousClose) e, se possível, o último ponto da curva rebased.
    """
    url = 'https://www.hsi.com.hk/data/eng/index-series/volatilityindex/chart-rebased.json'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            print(f'[LOG] VHSI HSI oficial HTTP {resp.status_code}')
            return None
        data = resp.json()
        series_list = data.get('indexSeriesList') or []
        if not series_list:
            return None
        idx = series_list[0].get('indexList') or []
        if not idx:
            return None
        item = idx[0]

        # Primeiro tenta previousClose; se não existir, tenta indexValue ou último ponto do índice rebased
        price = item.get('previousClose')
        if price is None:
            price = item.get('indexValue')

        # Usa último ponto das curvas rebased como fallback final
        if price is None:
            for key in ('indexLevels-1m', 'indexLevels-3m', 'indexLevels-6m', 'indexLevels-1y'):
                levels = item.get(key)
                if levels:
                    last = levels[-1]
                    if isinstance(last, (list, tuple)) and len(last) >= 2:
                        price = last[1]
                        break

        if price is None:
            return None
        try:
            return float(str(price).replace(',', ''))
        except ValueError:
            return None
    except Exception as exc:
        print(f'[LOG] Falha no VHSI via HSI oficial: {exc}')
        return None

def fetch_index_price(url):
    try:
        print(f'[LOG] Tentando buscar preço no TradingView: {url}')
        resp = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        # O preço geralmente está em um span com data-symbol-price
        price_tag = soup.find('div', {'data-symbol-price': True})
        if not price_tag:
            # fallback: pegar o primeiro valor grande
            price_tag = soup.find('div', class_='tv-symbol-price-quote__value')
        if price_tag:
            print(f'[LOG] Preço encontrado no TradingView: {price_tag.text.strip()}')
            return price_tag.text.strip()
        # fallback: buscar qualquer número grande
        for span in soup.find_all('span'):
            if span.text.replace('.', '', 1).replace(',', '', 1).isdigit():
                print(f'[LOG] Preço encontrado no TradingView (span): {span.text.strip()}')
                return span.text.strip()
        print(f'[LOG] Não foi possível encontrar preço no TradingView.')
        return None
    except Exception as e:
        print(f'[LOG] Erro ao buscar {url} no TradingView: {e}')
        return None

def main():
    snapshot = {'timestamp': datetime.now(timezone.utc).isoformat(), 'indices': {}}

    for name, url in INDICES.items():
        print(f'Coletando {name}...')
        price = None
        # Busca preço apenas no TradingView, sem fallback
        if name == 'VHSI':
            price = fetch_vhsi_from_hsi_official()
        else:
            price = fetch_index_price(url)
        if price is not None:
            # Sempre grava como número
            try:
                price_num = float(str(price).replace(',', ''))
            except Exception:
                price_num = price
            snapshot['indices'][name] = price_num
        else:
            print(f'[LOG] Não foi possível coletar preço real para {name} no TradingView. Não será salvo.')

    with open('indices_snapshot.json', 'w') as f:
        json.dump(snapshot, f, indent=2)
    with open('public/indices_snapshot.json', 'w') as f:
        json.dump(snapshot, f, indent=2)
    print('Dados salvos em indices_snapshot.json')

   
if __name__ == '__main__':
    main()
