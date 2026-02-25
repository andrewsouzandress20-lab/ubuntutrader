import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

# Scrape Forexfactory calendar for today
url = 'https://www.forexfactory.com/calendar'
headers = {'User-Agent': 'Mozilla/5.0'}


response = requests.get(url, headers=headers)
with open('forexfactory_calendar.html', 'w', encoding='utf-8') as f:
    f.write(response.text)
soup = BeautifulSoup(response.text, 'html.parser')

# Parse events
rows = soup.select('tr.calendar__row')
print(f'Encontradas {len(rows)} linhas de evento (tr.calendar__row)')
events = []
today = datetime.utcnow().strftime('%b %d, %Y')

for row in rows:
    time_cell = row.select_one('.calendar__time')
    currency_cell = row.select_one('.calendar__currency')
    impact_cell = row.select_one('.impact span')
    event_cell = row.select_one('.calendar__event')
    actual_cell = row.select_one('.calendar__actual')
    forecast_cell = row.select_one('.calendar__forecast')
    previous_cell = row.select_one('.calendar__previous')

    event = {
        'date': today,
        'time': time_cell.text.strip() if time_cell else '',
        'country': currency_cell.text.strip() if currency_cell else '',
        'impact': impact_cell['title'] if impact_cell and impact_cell.has_attr('title') else '',
        'event': event_cell.text.strip() if event_cell else '',
        'actual': actual_cell.text.strip() if actual_cell else '',
        'forecast': forecast_cell.text.strip() if forecast_cell else '',
        'previous': previous_cell.text.strip() if previous_cell else '',
        'description': event_cell.text.strip() if event_cell else ''
    }
    events.append(event)

with open('public/economic_events.json', 'w', encoding='utf-8') as f:
    json.dump(events, f, ensure_ascii=False, indent=2)

print(f'Salvo {len(events)} eventos em public/economic_events.json')
