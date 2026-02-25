from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import json
import time

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

browser = webdriver.Chrome(options=options)
browser.get('https://www.forexfactory.com/calendar')
time.sleep(5)

events = []
rows = browser.find_elements(By.CSS_SELECTOR, 'tr.calendar__row')
for row in rows:
    try:
        time_cell = row.find_element(By.CSS_SELECTOR, '.calendar__time')
        currency_cell = row.find_element(By.CSS_SELECTOR, '.calendar__currency')
        impact_cell = row.find_element(By.CSS_SELECTOR, '.impact span')
        event_cell = row.find_element(By.CSS_SELECTOR, '.calendar__event')
        actual_cell = row.find_element(By.CSS_SELECTOR, '.calendar__actual')
        forecast_cell = row.find_element(By.CSS_SELECTOR, '.calendar__forecast')
        previous_cell = row.find_element(By.CSS_SELECTOR, '.calendar__previous')
        event = {
            'time': time_cell.text.strip(),
            'country': currency_cell.text.strip(),
            'impact': impact_cell.get_attribute('title') if impact_cell else '',
            'event': event_cell.text.strip(),
            'actual': actual_cell.text.strip(),
            'forecast': forecast_cell.text.strip(),
            'previous': previous_cell.text.strip(),
            'description': event_cell.text.strip()
        }
        events.append(event)
    except Exception:
        continue

browser.quit()

with open('public/economic_events.json', 'w', encoding='utf-8') as f:
    json.dump(events, f, ensure_ascii=False, indent=2)

print(f'Salvo {len(events)} eventos em public/economic_events.json')
