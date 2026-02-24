import os
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

                    return float(raw)
    """Tenta coletar VHSI direto da página do Investing.com (scraping leve)."""
    pass
                except ValueError:
                    pass
            # fallback: regex direto no HTML
            import re
            match = re.search(r'data-test="instrument-price-last"[^>]*>([^<]+)<', resp.text)
            if match:
                raw = match.group(1).strip().replace('\xa0', '').replace(',', '')
                try:
                    return float(raw)
                except ValueError:
                    pass
        except Exception as exc:
            print(f'[LOG] Falha no fallback Investing VHSI ({url}): {exc}')
    return None



            return price
        closes = result[0].get('indicators', {}).get('quote', [{}])[0].get('close', [])
        for val in reversed(closes):
            if isinstance(val, (int, float)):
                return val
        return None
    except Exception as exc:
        print(f'[LOG] Falha no fallback chart Yahoo para {symbol}: {exc}')
        return None


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
    snapshot = {'timestamp': datetime.utcnow().isoformat() + 'Z', 'indices': {}}
    # Mapas para fallback
    google_map = {
        'US30': '.DJI',
        'US500': '.INX',
        'US100': '.IXIC',
        'VIX': '.VIX',
        'DXY': 'DX-Y.NYB',
        'HK50': 'HSI:INDEXHANGSENG',
        'JP225': 'N225:INDEXNIKKEI',
        'GOLD': 'XAUUSD:CUR',
        'WTI': 'CL.1:NYM',
        # Google nem sempre tem VHSI; mantemos só para eventual disponibilidade
        'VHSI': 'VHSI:INDEXHANGSENG',
    }
    yahoo_map = {
        'US30': '^DJI',
        'US500': '^GSPC',
        'US100': '^IXIC',
        'VIX': '^VIX',
        'DXY': 'DX-Y.NYB',
        'HK50': '^HSI',
        'JP225': '^N225',
        'GOLD': 'GC=F',
        'WTI': 'CL=F',
        'VHSI': '^VHSI',
    }
    for name, url in INDICES.items():
        print(f'Coletando {name}...')
        price = None

        # VHSI: tenta primeiro fonte oficial (mais confiável que TV)
        if name == 'VHSI':
            price = fetch_vhsi_from_hsi_official()
            if price is not None:
                print(f'[LOG] Preço encontrado no HSI oficial (VHSI): {price}')

        if price is None:
            price = fetch_index_price(url)
        if price is None:
            gsym = google_map.get(name)
            if gsym:
                print(f'[LOG] Tentando buscar preço no Google Finance para {name} ({gsym})...')
                price = fetch_google_finance(gsym)
                if price is not None:
                    print(f'[LOG] Preço encontrado no Google Finance: {price}')
                else:
                    print(f'[LOG] Não foi possível encontrar preço no Google Finance para {name}.')
        if price is None:
            ysym = yahoo_map.get(name)
            if ysym:
                print(f'[LOG] Tentando buscar preço no Yahoo Finance para {name} ({ysym})...')
                price = fetch_yahoo_quote(ysym)
                if price is not None:
                    print(f'[LOG] Preço encontrado no Yahoo Finance: {price}')
                else:
                    print(f'[LOG] Não foi possível encontrar preço no Yahoo Finance para {name}.')

        # Fallback final: endpoint de chart do Yahoo (pega regularMarketPrice ou último close)
        if price is None and name in ('VHSI', 'HK50', 'JP225'):
            ysym = yahoo_map.get(name)
            if ysym:
                print(f'[LOG] Tentando buscar preço no Yahoo Chart para {name} ({ysym})...')
                price = fetch_yahoo_chart_price(ysym)
                if price is not None:
                    print(f'[LOG] Preço encontrado no Yahoo Chart: {price}')
                else:
                    print(f'[LOG] Não foi possível encontrar preço no Yahoo Chart para {name}.')

        # Fallback específico para VHSI via Investing.com (scraping leve)
        if price is None and name == 'VHSI':
            print('[LOG] Tentando buscar preço no Investing.com para VHSI...')
            price = fetch_investing_vhsi()
            if price is not None:
                print(f'[LOG] Preço encontrado no Investing.com (VHSI): {price}')
            else:
                print('[LOG] Não foi possível encontrar preço no Investing.com para VHSI.')
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
