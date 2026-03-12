
import requests
import json
from datetime import datetime, timezone




# Lista de índices e seus tickers para a API do TradingView
INDICES_TV = {
    'VIX': 'CBOE:VIX',
    'US500': 'SP:SPX',      # S&P 500
    'US100': 'NASDAQ:NDX',  # NASDAQ 100
    'DXY': 'TVC:DXY',
    'VHSI': 'HSI:VHSI',      # Hong Kong Volatility Index
    'CNH': 'FX_IDC:USDCNH', # USD/CNH
    'NIKKEI225': 'TVC:NI225', # Nikkei 225
    'SSE': 'SSE:000001',    # SSE Composite Index
    'USDJPY': 'FX_IDC:USDJPY' # USD/JPY
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

            return price_tag.text.strip()
            snapshot = {'timestamp': datetime.now(timezone.utc).isoformat(), 'indices': {}}
            # Monta lista de tickers para a API
            tickers = list(INDICES_TV.values())
            payload = {
                "symbols": {"tickers": tickers},
                "columns": ["name", "close", "change", "change_abs", "change_from_open", "change_from_open_abs", "volume"]
            }
            url = "https://scanner.tradingview.com/america/scan"
            r = requests.post(url, json=payload)
            data = r.json()["data"]
            # Mapear resultado para cada índice
            for idx, d in enumerate(data):
                tv_ticker = d["s"]
                # Descobre o nome do índice pelo ticker
                name = None
                for k, v in INDICES_TV.items():
                    if v == tv_ticker:
                        name = k
                        break
                if not name:
                    continue
                snapshot['indices'][name] = {
                    "price": d["d"][1],
                    "change": d["d"][2],
                    "changeAbs": d["d"][3],
                    "changeFromOpen": d["d"][4],
                    "changeFromOpenAbs": d["d"][5],
                    "volume": d["d"][6]
                }
            with open('indices_snapshot.json', 'w') as f:
                json.dump(snapshot, f, indent=2)
            with open('public/indices_snapshot.json', 'w') as f:
                json.dump(snapshot, f, indent=2)
            print('Dados salvos em indices_snapshot.json')

        if __name__ == '__main__':
            main()
        # 2. Tenta buscar pelo class tv-symbol-price-quote__value
        price_tag = soup.find('div', class_='tv-symbol-price-quote__value')
        if price_tag and price_tag.text.strip():
            print(f'[LOG] Preço encontrado no TradingView (tv-symbol-price-quote__value): {price_tag.text.strip()}')
            return price_tag.text.strip()
        # 3. Tenta buscar por span com class indicando valor
        for span in soup.find_all('span'):
            if 'value' in span.get('class', []) and span.text.strip():
                if span.text.replace('.', '', 1).replace(',', '', 1).replace('-', '', 1).isdigit():
                    print(f'[LOG] Preço encontrado no TradingView (span value): {span.text.strip()}')
                    return span.text.strip()
        # 4. Busca qualquer número grande em div ou span
        for tag in soup.find_all(['div', 'span']):
            txt = tag.text.strip()
            if txt and txt.replace('.', '', 1).replace(',', '', 1).replace('-', '', 1).isdigit():
                print(f'[LOG] Preço encontrado no TradingView (generic): {txt}')
                return txt
        # 5. Busca por meta tag (caso TradingView use SEO)
        meta = soup.find('meta', {'property': 'og:price:amount'})
        if meta and meta.get('content'):
            print(f'[LOG] Preço encontrado no TradingView (meta): {meta["content"]}')
            return meta["content"]
        print(f'[LOG] Não foi possível encontrar preço no TradingView. HTML parcial: {soup.prettify()[:500]}')
        return None
    except Exception as e:
        print(f'[LOG] Erro ao buscar {url} no TradingView: {e}')
        return None

def main():
    snapshot = {'timestamp': datetime.now(timezone.utc).isoformat(), 'indices': {}}
    # Monta lista de tickers para a API
    tickers = list(INDICES_TV.values())
    payload = {
        "symbols": {"tickers": tickers},
        "columns": ["name", "close", "change", "change_abs", "change_from_open", "change_from_open_abs", "volume"]
    }
    url = "https://scanner.tradingview.com/america/scan"
    r = requests.post(url, json=payload)
    data = r.json()["data"]
    # Mapear resultado para cada índice
    ticker_to_data = {d["s"]: d for d in data}
    for name, tv_ticker in INDICES_TV.items():
        d = ticker_to_data.get(tv_ticker)
        if d:
            snapshot['indices'][name] = {
                "price": d["d"][1],
                "change": d["d"][2],
                "changeAbs": d["d"][3],
                "changeFromOpen": d["d"][4],
                "changeFromOpenAbs": d["d"][5],
                "volume": d["d"][6]
            }
            print(f'[LOG] {name}: price={d["d"][1]}, change={d["d"][2]}, volume={d["d"][6]}')
        else:
            snapshot['indices'][name] = {
                "price": None,
                "change": None,
                "changeAbs": None,
                "changeFromOpen": None,
                "changeFromOpenAbs": None,
                "volume": None
            }
            print(f'[LOG] {name}: NÃO ENCONTRADO na resposta da TradingView!')
    with open('indices_snapshot.json', 'w') as f:
        json.dump(snapshot, f, indent=2)
    with open('public/indices_snapshot.json', 'w') as f:
        json.dump(snapshot, f, indent=2)
    print('Dados salvos em indices_snapshot.json')
if __name__ == '__main__':
    main()
