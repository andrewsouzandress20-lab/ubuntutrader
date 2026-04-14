import json
from datetime import datetime, timezone

import requests


INDICES_TV = {
    'US30': 'DJ:DJI',
    'US500': 'SP:SPX',
    'US100': 'NASDAQ:NDX',
    'VIX': 'CBOE:VIX',
    'DXY': 'TVC:DXY',
    'HK50': 'HSI:HSI',
    'JP225': 'TVC:NI225',
    'GOLD': 'TVC:GOLD',
    'WTI': 'TVC:USOIL',
    'VHSI': 'HSI:VHSI',
    'CNH=X': 'FX_IDC:USDCNH',
    '000001.SS': 'SSE:000001',
    'USDJPY=X': 'FX_IDC:USDJPY',
    '^TNX': 'TVC:US10Y'
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}


def to_float(value):
    if value is None:
        return None
    try:
        return float(str(value).replace(',', ''))
    except (TypeError, ValueError):
        return None


def fetch_scanner_snapshot():
    payload = {
        'symbols': {
            'tickers': list(INDICES_TV.values()),
            'query': {'types': []}
        },
        'columns': ['name', 'close', 'change', 'change_abs', 'change_from_open', 'change_from_open_abs', 'volume']
    }
    response = requests.post(
        'https://scanner.tradingview.com/global/scan',
        json=payload,
        headers=HEADERS,
        timeout=20
    )
    response.raise_for_status()
    return response.json().get('data', [])


def main():
    snapshot = {'timestamp': datetime.now(timezone.utc).isoformat(), 'indices': {}}

    try:
        data = fetch_scanner_snapshot()
    except Exception as exc:
        print(f'[LOG] Falha ao consultar scanner do TradingView: {exc}')
        raise

    ticker_to_data = {entry.get('s'): entry for entry in data}

    for name, tv_ticker in INDICES_TV.items():
        row = ticker_to_data.get(tv_ticker)
        if not row:
            snapshot['indices'][name] = {
                'price': None,
                'change': None,
                'changeAbs': None,
                'changeFromOpen': None,
                'changeFromOpenAbs': None,
                'volume': None
            }
            print(f'[LOG] {name}: nao encontrado na resposta do TradingView')
            continue

        values = row.get('d') or []
        price = to_float(values[1] if len(values) > 1 else None)
        change = to_float(values[2] if len(values) > 2 else None)
        change_abs = to_float(values[3] if len(values) > 3 else None)
        change_from_open = to_float(values[4] if len(values) > 4 else None)
        change_from_open_abs = to_float(values[5] if len(values) > 5 else None)
        volume = to_float(values[6] if len(values) > 6 else None)

        snapshot['indices'][name] = {
            'price': price,
            'change': change,
            'changeAbs': change_abs,
            'changeFromOpen': change_from_open,
            'changeFromOpenAbs': change_from_open_abs,
            'volume': volume
        }
        print(f'[LOG] {name}: price={price}, change={change}, volume={volume}')

    with open('indices_snapshot.json', 'w', encoding='utf-8') as file:
        json.dump(snapshot, file, indent=2)
    with open('public/indices_snapshot.json', 'w', encoding='utf-8') as file:
        json.dump(snapshot, file, indent=2)

    print('Dados salvos em indices_snapshot.json')


if __name__ == '__main__':
    main()
