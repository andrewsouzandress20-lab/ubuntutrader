import re
import requests
from datetime import datetime


INDICES = {
    'US30': {
        'tradingview': 'https://www.tradingview.com/symbols/DJI/',
        'investing': 'https://www.investing.com/indices/us-30-futures',
        'forexfactory': None
    },
    'US500': {
        'tradingview': 'https://www.tradingview.com/symbols/SPX/',
        'investing': 'https://www.investing.com/indices/us-spx-500-futures',
        'forexfactory': None
    },
    'US100': {
        'tradingview': 'https://www.tradingview.com/symbols/NDX/',
        'investing': 'https://www.investing.com/indices/nq-100-futures',
        'forexfactory': None
    },
    'VIX': {
        'tradingview': 'https://www.tradingview.com/symbols/CBOE-VIX/',
        'investing': 'https://www.investing.com/indices/volatility-s-p-500',
        'forexfactory': None
    },
    'DXY': {
        'tradingview': 'https://www.tradingview.com/symbols/TVC-DXY/',
        'investing': 'https://www.investing.com/currencies/us-dollar-index',
        'forexfactory': None
    },
    'HK50': {
        'tradingview': 'https://www.tradingview.com/symbols/HKEX-HSI/',
        'investing': 'https://www.investing.com/indices/hang-sen-40-futures',
        'forexfactory': None
    },
    'JP225': {
        'tradingview': 'https://www.tradingview.com/symbols/TVC-NIKKEI225/',
        'investing': 'https://www.investing.com/indices/japan-ni225-futures',
        'forexfactory': None
    },
    'CN50': {
        'tradingview': 'https://www.tradingview.com/symbols/SGX-CN50/',
        'investing': 'https://www.investing.com/indices/ftse-china-a50-futures',
        'forexfactory': None
    },
    'GOLD': {
        'tradingview': 'https://www.tradingview.com/symbols/TVC-GOLD/',
        'investing': 'https://www.investing.com/commodities/gold',
        'forexfactory': None
    },
    'WTI': {
        'tradingview': 'https://www.tradingview.com/symbols/TVC-USOIL/',
        'investing': 'https://www.investing.com/commodities/crude-oil',
        'forexfactory': None
    },
    'VHSI': {
        'tradingview': 'https://www.tradingview.com/symbols/HKEX-VHSI/',
        'investing': None,
        'forexfactory': None
    },
    'CNH=X': {
        'tradingview': 'https://www.tradingview.com/symbols/FX_IDC-CNHUSD/',
        'investing': 'https://www.investing.com/currencies/usd-cnh',
        'forexfactory': None
    },
    '000001.SS': {
        'tradingview': 'https://www.tradingview.com/symbols/SSE-000001/',
        'investing': None,
        'forexfactory': None
    },
    'USDJPY=X': {
        'tradingview': 'https://www.tradingview.com/symbols/FX_IDC-USDJPY/',
        'investing': 'https://www.investing.com/currencies/usd-jpy',
        'forexfactory': None
    },
    '^TNX': {
        'tradingview': 'https://www.tradingview.com/symbols/TVC-US10Y/',
        'investing': 'https://www.investing.com/rates-bonds/u.s.-10-year-bond-yield',
        'forexfactory': None
    },
    '^RUT': {
        'tradingview': 'https://www.tradingview.com/symbols/AMEX-RUT/',
        'investing': None,
        'forexfactory': None
    }
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}


def fetch_tradingview(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, 'html.parser')
        price_tag = soup.find('div', {'data-symbol-price': True})
        if not price_tag:
            price_tag = soup.find('div', class_='tv-symbol-price-quote__value')
        if price_tag:
            return price_tag.text.strip(), 'TradingView'
        for span in soup.find_all('span'):
            if span.text.replace('.', '', 1).replace(',', '', 1).isdigit():
                return span.text.strip(), 'TradingView'
        return None, None
    except Exception as e:
        return None, None

def fetch_investing(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, 'html.parser')
        price_tag = soup.find('span', {'data-test': 'instrument-price-last'})
        if not price_tag:
            price_tag = soup.find('span', class_='text-2xl')
        if price_tag:
            return price_tag.text.strip(), 'Investing'
        return None, None
    except Exception as e:
        return None, None

def fetch_forexfactory(url):
    # ForexFactory não tem página direta para preço de índice, normalmente é usado para calendário
    return None, None

# --- Google Finance ---
def fetch_google(symbol):
    try:
        # Mapeamento dos símbolos para Google Finance
        google_map = {
            'US30': 'INDEXDJX:.DJI',
            'US500': 'INDEXSP:.INX',
            'US100': 'INDEXNASDAQ:.NDX',
            'VIX': 'INDEXCBOE:VIX',
            'DXY': 'CURRENCY:USD',  # Google não tem DXY, mas USD pode retornar algo
            'HK50': 'INDEXHANGSENG:HSI',
            'JP225': 'INDEXNIKKEI:NI225',
            'CN50': 'SHA:000016',
            'GOLD': 'COMMODITY:GC=F',
            'WTI': 'COMMODITY:CL=F',
            'VHSI': 'HKG:3112',  # Exemplo, pode não existir
            'CNH=X': 'CURRENCY:USDCNH',
            '000001.SS': 'SHA:000001',
            'USDJPY=X': 'CURRENCY:USDJPY',
            '^TNX': 'INDEXCBOE:TNX',
            '^RUT': 'INDEXRUSSELL:RUT',
        }
        gsymbol = google_map.get(symbol, symbol)
        url = f'https://www.google.com/finance/quote/{gsymbol}'
        resp = requests.get(url, headers=HEADERS, timeout=10)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, 'html.parser')
        price_tag = soup.find('div', class_='YMlKec fxKbKc')
        if price_tag:
            return price_tag.text.strip(), 'Google Finance', url
        # fallback: procurar por span com classe de preço
        for span in soup.find_all('span'):
            if span.text.replace('.', '', 1).replace(',', '', 1).replace('-', '', 1).isdigit():
                return span.text.strip(), 'Google Finance', url
        return None, None, url
    except Exception as e:
        return None, None, None



def fetch_yahoo(symbol):
    try:
        # Mapeamento dos símbolos para Yahoo Finance
        yahoo_map = {
            'US30': '^DJI',
            'US500': '^GSPC',
            'US100': '^NDX',
            'VIX': '^VIX',
            'DXY': 'DX-Y.NYB',
            'HK50': '^HSI',
            'JP225': '^N225',
            'CN50': 'XIN9.SI',
            'GOLD': 'GC=F',
            'WTI': 'CL=F',
            'VHSI': '^VHSI',
            'CNH=X': 'CNH=X',
            '000001.SS': '000001.SS',
            'USDJPY=X': 'JPY=X',
            '^TNX': '^TNX',
            '^RUT': '^RUT',
        }
        ysymbol = yahoo_map.get(symbol, symbol)
        url = f'https://query1.finance.yahoo.com/v7/finance/quote?symbols={ysymbol}'
        resp = requests.get(url, headers=HEADERS, timeout=10)
        data = resp.json()
        result = data.get('quoteResponse', {}).get('result', [])
        if result and 'regularMarketPrice' in result[0]:
            return str(result[0]['regularMarketPrice']), 'Yahoo Finance', url
        return None, None, url
    except Exception as e:
        return None, None, None

def main():
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    lines = [f'Coleta Multi-Fonte {now}\n']
    for name, urls in INDICES.items():
        price, fonte = fetch_tradingview(urls['tradingview'])
        url_usada = urls['tradingview']
        if not price and urls['investing']:
            price, fonte = fetch_investing(urls['investing'])
            url_usada = urls['investing']
        if not price and urls['forexfactory']:
            price, fonte = fetch_forexfactory(urls['forexfactory'])
            url_usada = urls['forexfactory']
        if not price:
            price, fonte, url_usada = fetch_google(name)
        if not price:
            price, fonte, url_usada = fetch_yahoo(name)
        lines.append(f'{name}: {price} | fonte: {fonte} | url: {url_usada}')
    with open('coleta_teste.txt', 'w') as f:
        f.write('\n'.join(lines))
    print('Dados salvos em coleta_teste.txt')

if __name__ == '__main__':
    main()
