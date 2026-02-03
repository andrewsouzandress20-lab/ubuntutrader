from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import json
import time

# Configurações do Selenium
options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

# Inicia o navegador
browser = webdriver.Chrome(options=options)

# Acessa o calendário econômico do Investing.com
browser.get('https://br.investing.com/economic-calendar/')
time.sleep(5)  # Aguarda o carregamento da página

# Aceita cookies se necessário
try:
    accept_btn = browser.find_element(By.ID, 'onetrust-accept-btn-handler')
    accept_btn.click()
    time.sleep(1)
except Exception:
    pass

# Coleta as linhas da tabela de eventos
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

with open('public/economic_events.json', 'w', encoding='utf-8') as f:
    json.dump(events, f, ensure_ascii=False, indent=2)

print(f'Salvo {len(events)} eventos em public/economic_events.json')
