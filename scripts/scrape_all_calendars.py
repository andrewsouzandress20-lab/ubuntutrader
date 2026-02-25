import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

# --- ForexFactory ---
def scrape_forexfactory():
    url = 'https://www.forexfactory.com/calendar'
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    rows = soup.select('tr.calendar__row')
    today = datetime.utcnow().strftime('%b %d, %Y')
    events = []
    for row in rows:
        time_cell = row.select_one('.calendar__time')
        currency_cell = row.select_one('.calendar__currency')
        impact_cell = row.select_one('.impact span')
        event_cell = row.select_one('.calendar__event')
        actual_cell = row.select_one('.calendar__actual')
        forecast_cell = row.select_one('.calendar__forecast')
        previous_cell = row.select_one('.calendar__previous')
        event = {
            'source': 'forexfactory',
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
    return events

# --- Investing.com (Selenium) ---
def scrape_investing():
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.options import Options
    import time
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    browser = webdriver.Chrome(options=options)
    browser.get('https://br.investing.com/economic-calendar/')
    time.sleep(5)
    try:
        accept_btn = browser.find_element(By.ID, 'onetrust-accept-btn-handler')
        accept_btn.click()
        time.sleep(1)
    except Exception:
        pass
    rows = browser.find_elements(By.CSS_SELECTOR, 'tr.js-event-item')
    events = []
    for row in rows:
        try:
            time_cell = row.find_element(By.CSS_SELECTOR, '.first.left.time')
            currency_cell = row.find_element(By.CSS_SELECTOR, '.left.flagCur.noWrap')
            impact_cell = row.find_element(By.CSS_SELECTOR, '.sentiment')
            event_cell = row.find_element(By.CSS_SELECTOR, '.event')
            actual_cell = row.find_element(By.CSS_SELECTOR, '.act')
            forecast_cell = row.find_element(By.CSS_SELECTOR, '.fore')
            previous_cell = row.find_element(By.CSS_SELECTOR, '.prev')
            event = {
                'source': 'investing',
                'time': time_cell.text.strip(),
                'country': currency_cell.text.strip(),
                'impact': impact_cell.get_attribute('title') or impact_cell.text.strip(),
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
    return events

if __name__ == '__main__':
    all_events = []
    try:
        all_events.extend(scrape_forexfactory())
    except Exception as e:
        print('Erro ao coletar do ForexFactory:', e)
    try:
        all_events.extend(scrape_investing())
    except Exception as e:
        print('Erro ao coletar do Investing.com:', e)
    with open('public/economic_events.json', 'w', encoding='utf-8') as f:
        json.dump(all_events, f, ensure_ascii=False, indent=2)
    print(f'Salvo {len(all_events)} eventos em public/economic_events.json')
