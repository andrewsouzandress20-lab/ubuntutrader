import feedparser
import json
from datetime import datetime

# RSS de notícias econômicas globais do Investing.com
RSS_URLS = [
    'https://www.investing.com/rss/news_25.rss',  # Notícias econômicas globais
    'https://www.investing.com/rss/news_285.rss', # Notícias dos EUA
    'https://www.investing.com/rss/news_284.rss', # Notícias da China
    'https://www.investing.com/rss/news_22.rss',  # Notícias do Brasil
]

KEYWORDS = ['us30', 'dow jones', 'hk50', 'hong kong', 'china', 'fed', 'fomc', 'payroll', 'pmi', 'gdp', 'interest', 'powell', 'biden', 'hsi', 'hang seng', 'stocks', 'equity', 'market', 'president', 'speech', 'press conference']

all_events = []
for url in RSS_URLS:
    feed = feedparser.parse(url)
    for entry in feed.entries:
        title = entry.title.lower()
        summary = entry.summary.lower() if hasattr(entry, 'summary') else ''
        if any(k in title or k in summary for k in KEYWORDS):
            event = {
                'title': entry.title,
                'published': entry.published,
                'link': entry.link,
                'summary': entry.summary if hasattr(entry, 'summary') else '',
                'source': url
            }
            all_events.append(event)

with open('public/economic_events.json', 'w', encoding='utf-8') as f:
    json.dump(all_events, f, ensure_ascii=False, indent=2)

print(f'Salvo {len(all_events)} eventos filtrados por palavras-chave em public/economic_events.json')
