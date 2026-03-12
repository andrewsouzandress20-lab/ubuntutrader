import csv
import json
from datetime import datetime, timezone

# Lê o dow30_tradingview.csv e converte para o formato do companies_snapshot.json

def csv_to_companies_snapshot(csv_path, json_path):
    companies = []
    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            companies.append({
                'ticker': row['symbol'],
                'name': row['title'],
                'market': row['market'],
                'url': row['url'],
                'price': None,  # Pode ser preenchido se disponível
                'change': None,
                'changePercent': None
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
    csv_to_companies_snapshot('dow30_tradingview.csv', 'companies_snapshot.json')
