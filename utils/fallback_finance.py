import requests

def fetch_google_finance(symbol):
    # Exemplo: US30 = .DJI, US500 = .INX, US100 = .IXIC
    url = f'https://www.google.com/finance/quote/{symbol}:INDEXDJX'
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            import re
            match = re.search(r'"price":\{"raw":([0-9.]+),', resp.text)
            if match:
                return match.group(1)
        return None
    except Exception as e:
        print(f'Erro ao buscar Google Finance para {symbol}: {e}')
        return None

def fetch_yahoo_finance(symbol):
    # Exemplo: US30 = ^DJI, US500 = ^GSPC, US100 = ^IXIC
    url = f'https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbol}'
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            price = data['quoteResponse']['result'][0].get('regularMarketPrice')
            return price
        return None
    except Exception as e:
        print(f'Erro ao buscar Yahoo Finance para {symbol}: {e}')
        return None
