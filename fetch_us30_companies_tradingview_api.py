# Exemplo: Buscar volume do E-mini Dow Futures (YM1!) via TradingView
try:
    from tradingview_screener import Query
    data = Query().select('name', 'close', 'volume', 'change')\
                  .where('market == "america"')\
                  .get_scanner_data()
    print('Exemplo tradingview-screener:')
    print(data)
except Exception as e:
    print('Erro ao buscar dados com tradingview-screener:', e)
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
    volume_total = 0
    for d in data:
        t = d["s"]
        info = companies_info.get(t, {})
        price = d["d"][1]
        change = d["d"][2]
        volume = d["d"][6]
        # Define status
        status = "BUY" if change > 0 else ("SELL" if change < 0 else "NEUTRAL")
        # O volume será a variação absoluta
        volume_var = abs(change)
        volume_total += volume_var
        companies.append({
            "ticker": info.get('ticker', t.split(':')[-1]),
            "name": info.get('name', ''),
            "market": info.get('market', ''),
            "url": info.get('url', ''),
            "price": price,
            "change": change,
            "status": status,
            "volume": volume,
            "volume_var": volume_var
        })
    snapshot = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'indices': {
            'US30': companies
        },
        'volume_total': volume_total
    }
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)
    print(f'Dados salvos em {json_path}')

if __name__ == '__main__':
    get_tradingview_snapshot_from_csv('dow30_tradingview.csv', 'companies_snapshot.json')
