import json
import requests


API_KEY = '94200850ee23473c98c21d8ab76db933'
SYMBOLS = ['YM1', 'CBOT:YM1!', 'YM=F', 'DJI', 'US30']  # Possíveis símbolos para o futuro do Dow
INTERVAL = '1min'
LIMIT = 100  # Quantidade de candles
OUTFILE = 'data/us30_candles.json'

for symbol in SYMBOLS:
    url = f'https://api.twelvedata.com/time_series?symbol={symbol}&interval={INTERVAL}&outputsize={LIMIT}&apikey={API_KEY}'
    print(f'Testando símbolo: {symbol}')
    resp = requests.get(url)
    data = resp.json()
    if 'values' in data:
        candles = []
        for c in reversed(data['values']):  # do mais antigo para o mais recente
            candles.append({
                'time': c['datetime'],
                'open': float(c['open']),
                'high': float(c['high']),
                'low': float(c['low']),
                'close': float(c['close']),
                'volume': float(c['volume'])
            })
        with open(OUTFILE, 'w', encoding='utf-8') as f:
            json.dump(candles, f, indent=2)
        print(f'Sucesso! Salvo {len(candles)} candles em {OUTFILE} usando símbolo {symbol}')
        break
    else:
        print(f'Falha com símbolo {symbol}:', data)
else:
    print('Nenhum símbolo funcionou para candles do futuro do Dow na TwelveData.')
