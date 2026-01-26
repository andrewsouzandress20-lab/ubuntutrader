import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime


# URLs das páginas de componentes dos índices no TradingView
INDEX_COMPONENTS = {
        'US30': 'https://www.tradingview.com/symbols/DJI/components/',
        'HK50': 'https://www.tradingview.com/symbols/HKEX-HSI/components/'
}

# Fallback: listas completas dos tickers (do types.ts)
DOW_30_TICKERS = [
    'AAPL', 'AMGN', 'AMZN', 'AXP', 'BA', 'CAT', 'CRM', 'CSCO', 'CVX', 'DIS',
    'GS', 'HD', 'HON', 'IBM', 'INTC', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM',
    'MSFT', 'NKE', 'PG', 'SHW', 'TRV', 'UNH', 'V', 'VZ', 'WBA', 'WMT'
]
HK_50_TICKERS = [
    '0001.HK', '0002.HK', '0003.HK', '0005.HK', '0006.HK', '0011.HK', '0012.HK', '0016.HK', '0017.HK', '0027.HK',
    '0066.HK', '0101.HK', '0175.HK', '0241.HK', '0267.HK', '0288.HK', '0386.HK', '0388.HK', '0669.HK', '0688.HK',
    '0700.HK', '0762.HK', '0823.HK', '0857.HK', '0883.HK', '0939.HK', '0941.HK', '0960.HK', '0968.HK', '0981.HK',
    '0992.HK', '1038.HK', '1044.HK', '1088.HK', '1093.HK', '1109.HK', '1113.HK', '1177.HK', '1211.HK', '1299.HK',
    '1398.HK', '1810.HK', '1928.HK', '2020.HK', '2313.HK', '2318.HK', '2319.HK', '2331.HK', '2382.HK', '2388.HK',
    '2628.HK', '2688.HK', '3690.HK', '3968.HK', '3988.HK', '9618.HK', '9633.HK', '9888.HK', '9988.HK', '9999.HK'
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def fetch_companies(url, fallback_tickers):
    companies = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, 'html.parser')
        table = soup.find('table')
        if table:
            for row in table.find_all('tr')[1:]:
                cols = row.find_all('td')
                if len(cols) >= 3:
                    ticker = cols[0].text.strip()
                    name = cols[1].text.strip()
                    sector = cols[2].text.strip() if len(cols) > 2 else ''
                    companies.append({'ticker': ticker, 'name': name, 'sector': sector})
    except Exception as e:
        print(f'Erro ao buscar empresas em {url}: {e}')
    # Se não conseguiu coletar ou lista incompleta, usa fallback
    if len(companies) < len(fallback_tickers):
        print(f'Usando fallback para completar lista de {len(fallback_tickers)} tickers.')
        tickers_set = set([c['ticker'] for c in companies])
        for t in fallback_tickers:
            if t not in tickers_set:
                companies.append({'ticker': t, 'name': '', 'sector': ''})
    return companies

def main():
    snapshot = {'timestamp': datetime.utcnow().isoformat() + 'Z', 'indices': {}}
    for index, url in INDEX_COMPONENTS.items():
        print(f'Coletando empresas do {index}...')
        fallback = DOW_30_TICKERS if index == 'US30' else HK_50_TICKERS
        companies = fetch_companies(url, fallback)
        snapshot['indices'][index] = companies
    with open('companies_snapshot.json', 'w') as f:
        json.dump(snapshot, f, indent=2)
    print('Dados salvos em companies_snapshot.json')

if __name__ == '__main__':
    main()
