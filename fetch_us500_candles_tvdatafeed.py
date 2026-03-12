from tvdatafeed import TvDatafeed, Interval
import json

# Login anonymously (no TradingView account required)
tv = TvDatafeed()

# Fetch US500 candles (symbol: 'US500', exchange: 'OANDA')
data = tv.get_hist(symbol='US500', exchange='OANDA', interval=Interval.in_1_hour, n_bars=200)

# Convert DataFrame to list of dicts for JSON serialization
candles = data.reset_index().to_dict(orient='records')

# Save to JSON file
with open('data/us500_candles.json', 'w') as f:
    json.dump(candles, f, indent=2, ensure_ascii=False)

print(f"Saved {len(candles)} candles to data/us500_candles.json")
