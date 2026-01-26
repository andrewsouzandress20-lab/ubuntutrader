# Instruções para agendar scraping automático dos índices e empresas

## 1. Edite o crontab
Execute no terminal:

crontab -e

## 2. Adicione as linhas abaixo para rodar 15 minutos antes e no horário de abertura das bolsas (exemplo: Dow Jones abre 11:30 UTC, HK50 abre 01:30 UTC)

# 15 minutos antes da abertura do Dow Jones (11:15 UTC)
15 11 * * 1-5 cd /workspaces/ubuntutrader && python3 fetch_indices_tradingview.py && python3 fetch_companies_tradingview.py

# Na abertura do Dow Jones (11:30 UTC)
30 11 * * 1-5 cd /workspaces/ubuntutrader && python3 fetch_indices_tradingview.py && python3 fetch_companies_tradingview.py

# 15 minutos antes da abertura do HK50 (01:15 UTC)
15 1 * * 1-5 cd /workspaces/ubuntutrader && python3 fetch_indices_tradingview.py && python3 fetch_companies_tradingview.py

# Na abertura do HK50 (01:30 UTC)
30 1 * * 1-5 cd /workspaces/ubuntutrader && python3 fetch_indices_tradingview.py && python3 fetch_companies_tradingview.py

## 3. Salve e feche o editor

Pronto! Os arquivos indices_snapshot.json e companies_snapshot.json serão atualizados automaticamente nos horários definidos.