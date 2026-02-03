# Scheduler dinâmico para scraping de índices usando horários de abertura via MarketStack e TwelveData
# Requer: pip install apscheduler requests

import requests
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import time
import os

# Configurar suas chaves de API
MARKETSTACK_KEY = os.getenv('MARKETSTACK_KEY', 'SUA_CHAVE_MARKETSTACK')
TWELVEDATA_KEY = os.getenv('TWELVEDATA_KEY', 'SUA_CHAVE_TWELVEDATA')

# Função para buscar horário de abertura pelo MarketStack
# Exemplo: https://api.marketstack.com/v1/exchanges?access_key=YOUR_KEY

def get_opening_time_marketstack(exchange):
    url = f'https://api.marketstack.com/v1/exchanges/{exchange}?access_key={MARKETSTACK_KEY}'
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        # Exemplo de resposta: {'opening_hours': {'open': '09:30', 'close': '16:00'}}
        open_time = data.get('opening_hours', {}).get('open')
        return open_time
    except Exception as e:
        print(f'Erro MarketStack: {e}')
        return None

# Função para buscar horário de abertura pelo TwelveData
# Exemplo: https://api.twelvedata.com/exchange?symbol=NYSE&apikey=YOUR_KEY

def get_opening_time_twelvedata(exchange):
    url = f'https://api.twelvedata.com/exchange?symbol={exchange}&apikey={TWELVEDATA_KEY}'
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        # Exemplo de resposta: {'open': '09:30', ...}
        open_time = data.get('open')
        return open_time
    except Exception as e:
        print(f'Erro TwelveData: {e}')
        return None

# Função para agendar scraping

def agendar_scraping(nome, exchange, script, fonte='marketstack', horarios=[]):
    # Se horários forem fornecidos, agenda manualmente até 4 vezes ao dia
    if horarios:
        agora = datetime.utcnow()
        agendados = 0
        for h in horarios:
            hora, minuto = map(int, h.split(':'))
            agendamento = agora.replace(hour=hora, minute=minuto, second=0, microsecond=0)
            if agendamento < agora:
                agendamento += timedelta(days=1)
            if agendados < 4:
                print(f'Agendando {nome} para {agendamento} UTC (em {int((agendamento-agora).total_seconds()/60)} min)')
                scheduler.add_job(lambda: os.system(f'python3 {script}'), 'date', run_date=agendamento)
                agendados += 1
        return
    # Caso contrário, agenda pelo horário de abertura da API
    if fonte == 'marketstack':
        open_time = get_opening_time_marketstack(exchange)
    else:
        open_time = get_opening_time_twelvedata(exchange)
    if not open_time:
        print(f'Não foi possível obter horário de abertura para {nome}')
        return
    agora = datetime.utcnow()
    hora, minuto = map(int, open_time.split(':'))
    # Agenda 15 min antes, na abertura, 15 min depois e 30 min depois (total 4)
    offsets = [-15, 0, 15, 30]
    agendados = 0
    for offset in offsets:
        agendamento = agora.replace(hour=hora, minute=minuto, second=0, microsecond=0) + timedelta(minutes=offset)
        if agendamento < agora:
            agendamento += timedelta(days=1)
        if agendados < 4:
            print(f'Agendando {nome} para {agendamento} UTC (em {int((agendamento-agora).total_seconds()/60)} min)')
            scheduler.add_job(lambda: os.system(f'python3 {script}'), 'date', run_date=agendamento)
            agendados += 1

if __name__ == '__main__':
    scheduler = BackgroundScheduler()
    # Horários: 15 min antes e na abertura (produção: US30 abre 11:30 UTC, HK50 abre 01:30 UTC)
    horarios_us30 = ['11:15', '11:30']
    horarios_hk50 = ['01:15', '01:30']
    agendar_scraping('US30', 'XNYS', 'fetch_indices_tradingview.py', horarios=horarios_us30)
    agendar_scraping('HK50', 'XHKG', 'fetch_indices_tradingview.py', horarios=horarios_hk50)
    # Compatível com PC e mobile
    scheduler.start()
    print('Scheduler dinâmico rodando...')
    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
