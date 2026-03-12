import csv
import json
from datetime import datetime, timezone
import requests

# Lê os tickers do CSV e consulta a API do TradingView para todos de uma vez

def get_tradingview_snapshot_from_csv(csv_path, json_path):
    tickers = []
    companies_info = {}
    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            # Exemplo: NASDAQ:AAPL, NYSE:GS
            ticker = f"{row['market']}:{row['symbol']}"
            tickers.append(ticker)
            companies_info[ticker] = {
                'ticker': row['symbol'],
                'name': row['title'],
                'market': row['market'],
                'url': row['url']
            }
    # Monta payload para API do TradingView
    payload = {
        "symbols": {"tickers": tickers},
        "columns": ["name", "close", "change", "change_abs", "change_from_open", "change_from_open_abs", "volume"]
    }
    url = "https://scanner.tradingview.com/america/scan"
    r = requests.post(url, json=payload)
    data = r.json()["data"]
    companies = []
    for d in data:
        t = d["s"]
        info = companies_info.get(t, {})
        companies.append({
            "ticker": info.get('ticker', t.split(':')[-1]),
            "name": info.get('name', ''),
            "market": info.get('market', ''),
            "url": info.get('url', ''),
            "price": d["d"][1],
            "change": d["d"][2],
            "changeAbs": d["d"][3],
            "changeFromOpen": d["d"][4],
            "changeFromOpenAbs": d["d"][5],
            "volume": d["d"][6]
        })
    snapshot = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'indices': {
            'US30': companies
        }
    }
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)
    print(f'Dados salvos em {json_path}')

if __name__ == '__main__':
    get_tradingview_snapshot_from_csv('dow30_tradingview.csv', 'companies_snapshot.json')
