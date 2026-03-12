import requests
from bs4 import BeautifulSoup
import time

# Lista dos 30 símbolos do Dow Jones (TradingView pode usar NASDAQ ou NYSE)
dow30 = [
    'AAPL', 'AMGN', 'AXP', 'BA', 'CAT', 'CSCO', 'CVX', 'DIS', 'DOW', 'GS',
    'HD', 'HON', 'IBM', 'INTC', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM', 'MRK',
    'MSFT', 'NKE', 'PG', 'TRV', 'UNH', 'V', 'VZ', 'WBA', 'WMT', 'CRM'
]

base_urls = [
    'NASDAQ', 'NYSE'
]

results = []

for symbol in dow30:
    found = False
    for market in base_urls:
        url = f"https://www.tradingview.com/symbols/{market}-{symbol}/"
        response = requests.get(url)
        if response.status_code == 200 and 'Page Not Found' not in response.text:
            soup = BeautifulSoup(response.text, 'html.parser')
            # Exemplo: pega o título da página
            title = soup.title.string.strip() if soup.title else ''
            results.append({'symbol': symbol, 'market': market, 'url': url, 'title': title})
            print(f"Coletado: {symbol} ({market}) -> {title}")
            found = True
            break
    if not found:
        print(f"Não encontrado: {symbol}")
    time.sleep(1)  # Respeita o site

# Salva resultados em CSV
import csv
with open('dow30_tradingview.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['symbol', 'market', 'url', 'title'])
    writer.writeheader()
    writer.writerows(results)

print('Coleta finalizada. Resultados em dow30_tradingview.csv')
