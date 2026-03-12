import requests
import time

API_KEY = "94200850ee23473c98c21d8ab76db933"
symbol = "DJI"

buy_volume = 0
sell_volume = 0
last_price = None

def get_price():
    url = f"https://api.twelvedata.com/price?symbol={symbol}&apikey={API_KEY}"
    response = requests.get(url)
    data = response.json()
    return float(data["price"])

while True:
    try:
        price = get_price()
        if last_price is not None:
            if price > last_price:
                buy_volume += 1
            elif price < last_price:
                sell_volume += 1
        last_price = price
        total = buy_volume + sell_volume
        if total > 0:
            buy_percent = (buy_volume / total) * 100
            sell_percent = (sell_volume / total) * 100
        else:
            buy_percent = sell_percent = 0
        print("Preço:", price)
        print("Buy Volume:", buy_volume)
        print("Sell Volume:", sell_volume)
        print(f"Compradores: {buy_percent:.2f}%")
        print(f"Vendedores: {sell_percent:.2f}%")
        print("---------------------------")
        time.sleep(1)
    except Exception as e:
        print("Erro:", e)
        time.sleep(5)
