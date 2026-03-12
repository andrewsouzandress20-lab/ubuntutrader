import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime, timezone


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


def parse_number(text):
    if text is None:
        return None
    t = text.replace('%', '').replace(',', '').strip()
    try:
        return float(t)
    except Exception:
        return None


def scrape_table(table):
    rows = []
    for row in table.find_all('tr')[1:]:
        cols = row.find_all('td')
        if len(cols) >= 5:
            ticker = cols[0].text.strip()
            name = cols[1].text.strip()
            price = parse_number(cols[2].text)
            change_abs = parse_number(cols[3].text)
            change_pct = parse_number(cols[4].text)
            rows.append({
                'ticker': ticker,
                'name': name,
                'price': price,
                'change': change_abs,
                'changePercent': change_pct
            })
    return rows

def fetch_companies(url, fallback_tickers):
    companies = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        table = soup.find('table')
        if table:
            companies = scrape_table(table)
    except Exception as e:
        print(f'Erro ao buscar empresas em {url}: {e}')

    if not companies and fallback_tickers:
        print(f'[LOG] Nenhuma empresa coletada em {url}, usando fallback de tickers conhecidos.')
        companies = [{
            'ticker': t,
            'name': t,
            'price': None,
            'change': None,
            'changePercent': None
        } for t in fallback_tickers]

    return companies

def main():
    snapshot = {'timestamp': datetime.now(timezone.utc).isoformat(), 'indices': {}}
    for index, url in INDEX_COMPONENTS.items():
        print(f'Coletando empresas do {index}...')
        fallback = DOW_30_TICKERS if index == 'US30' else HK_50_TICKERS if index == 'HK50' else []
        companies = fetch_companies(url, fallback)
        snapshot['indices'][index] = companies
    with open('companies_snapshot.json', 'w') as f:
        json.dump(snapshot, f, indent=2)
    print('Dados salvos em companies_snapshot.json')

if __name__ == '__main__':
    main()
