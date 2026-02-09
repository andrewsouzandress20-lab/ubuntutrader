const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Permitir requisições do frontend estático (Render) e testes locais
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.VITE_TELEGRAM_CHAT_ID;

// API Telegram
app.post('/api/send-telegram', async (req, res) => {
  const { text } = req.body;
  console.log('[TELEGRAM API] Recebida requisição para enviar mensagem:', text);
  if (!text) {
    console.error('[TELEGRAM API] Texto obrigatório não informado');
    return res.status(400).json({ error: 'Texto obrigatório' });
  }
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('[TELEGRAM API] BOT_TOKEN ou CHAT_ID não configurados:', { BOT_TOKEN, CHAT_ID });
    return res.status(500).json({ error: 'Env do Telegram não configurado' });
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    console.log('[TELEGRAM API] Enviando para URL:', url);
    const payload = {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown',
    };
    console.log('[TELEGRAM API] Payload:', payload);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log('[TELEGRAM API] Resposta do Telegram:', data);
    if (data.ok) {
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: data.description });
    }
  } catch (err) {
    console.error('[TELEGRAM API] Erro ao enviar mensagem:', err);
    res.status(500).json({ error: err.message });
  }
});

// Proxy simples para Yahoo Finance (evita CORS no navegador)
// Express 5 usa path-to-regexp v8: pattern precisa de regex válido
// para capturar qualquer sufixo. Usamos (.*) para pegar o restante do caminho.
app.get('/api/yahoo/:path(.*)', async (req, res) => {
  const targetPath = req.params.path || '';
  const url = `https://query1.finance.yahoo.com/${targetPath}`;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ubuntutrader/1.0)' } });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[YAHOO PROXY] Erro ao buscar', url, err);
    res.status(502).json({ error: 'Failed to fetch Yahoo Finance' });
  }
});

// Proxy simples para calendário econômico (FF Calendar)
app.get('/api/calendar', async (_req, res) => {
  const url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ubuntutrader/1.0)' } });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[CALENDAR PROXY] Erro ao buscar calendário', err);
    res.status(502).json({ error: 'Failed to fetch calendar' });
  }
});

// Servir build do React
// Serve the Vite build located at repo root (/dist). On Render, __dirname is /opt/render/project/src/legacy.
const buildPath = path.join(__dirname, '..', 'dist');
app.use(express.static(buildPath));
// Fallback: serve index.html para qualquer rota que não comece com /api
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(buildPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Express (API + React) rodando na porta ${PORT}`);
});
