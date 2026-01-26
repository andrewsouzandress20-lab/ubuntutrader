# Fluxo de atualização dos dados

1. **Coleta automática (scraping):**
   - Scripts Python (`fetch_indices_tradingview.py` e `fetch_companies_tradingview.py`) coletam dados do TradingView.
   - Os scripts são agendados via cron para rodar 15 minutos antes e no momento da abertura das bolsas (US30 e HK50).
   - Os dados são salvos em `indices_snapshot.json` e `companies_snapshot.json`.

2. **Leitura no frontend:**
   - O app React lê os arquivos JSON locais usando a função utilitária `fetchLocalJson`.
   - Os dados de índices e empresas são atualizados automaticamente a cada 30 segundos.
   - O frontend exibe sempre os dados mais recentes disponíveis, sem sobrecarregar o TradingView.

3. **Fallback:**
   - Fora dos horários críticos, o app pode continuar usando Yahoo Finance para dados dinâmicos.

4. **Manutenção:**
   - Recomenda-se revisar periodicamente os scripts de scraping, pois o layout do TradingView pode mudar.
   - Atualize o agendamento no cron se os horários de abertura das bolsas mudarem.

---

Dúvidas ou ajustes, consulte o README_scraping_cron.md ou peça suporte.
