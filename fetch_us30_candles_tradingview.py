import json
import requests
import time

# Parâmetros
SYMBOL = 'YM1!'  # E-mini Dow Futures no TradingView
EXCHANGE = 'CBOT'  # Exchange correta para futuros
RESOLUTION = '1'  # 1 minuto
LIMIT = 100  # número de candles
OUTFILE = 'data/us30_candles.json'

# Função para buscar candles do TradingView
# Utiliza endpoint público do TradingView (não oficial)
def fetch_tradingview_candles(symbol, resolution, limit, exchange=None):
    url = 'https://scanner.tradingview.com/america/scan'
    payload = {
        "symbols": {"tickers": [f"{exchange+':' if exchange else ''}{symbol}"], "query": {"types": []}},
        "columns": ["logoid", "name"]
    }
    # Primeiro, obter o internal_id do ativo
    r = requests.post(url, json=payload)
    r.raise_for_status()
    data = r.json()
    if not data['data']:
        raise Exception('Ativo não encontrado no TradingView')
    internal_id = data['data'][0]['s']

    # Agora buscar candles
    chart_url = 'https://tvc4.forexpros.com/6e7e1e6b7c1b4b6b8b6b7b6b7b6b7b6b/1619449276/56/56/history'
    # O endpoint acima é um exemplo, mas pode variar. Vamos usar o endpoint oficial de chart:
    chart_url = f'https://tvc4.forexpros.com/6e7e1e6b7c1b4b6b8b6b7b6b7b6b7b6b/1619449276/56/56/history?symbol={internal_id}&resolution={resolution}&from={int(time.time())-limit*60}&to={int(time.time())}&countback={limit}&currencyCode=USD'
    # OBS: O endpoint pode mudar, e pode ser necessário ajustar headers/cookies para simular browser.
    # Aqui, vamos usar o endpoint websocket-like do TradingView, que é mais estável:
    chart_url = f'https://www.tradingview.com/chart/history/?symbol={internal_id}&resolution={resolution}&from={int(time.time())-limit*60}&to={int(time.time())}&countback={limit}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; ubuntutrader/1.0)'
    }
    resp = requests.get(chart_url, headers=headers)
    resp.raise_for_status()
    chart = resp.json()
    candles = []
    for i in range(len(chart['t'])):
        candles.append({
            'time': chart['t'][i],
            'open': chart['o'][i],
            'high': chart['h'][i],
            'low': chart['l'][i],
            'close': chart['c'][i],
            'volume': chart['v'][i]
        })
    return candles

def main():
    try:
        candles = fetch_tradingview_candles(SYMBOL, RESOLUTION, LIMIT, EXCHANGE)
        with open(OUTFILE, 'w', encoding='utf-8') as f:
            json.dump(candles, f, indent=2)
        print(f'Salvo {len(candles)} candles em {OUTFILE}')
    except Exception as e:
        print('Erro ao coletar candles do TradingView:', e)

if __name__ == '__main__':
    main()
