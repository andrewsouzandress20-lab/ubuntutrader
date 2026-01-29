const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.VITE_TELEGRAM_CHAT_ID;

// API Telegram
app.post('/api/send-telegram', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto obrigatório' });
  if (!BOT_TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Env do Telegram não configurado' });

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
    const data = await response.json();
    if (data.ok) {
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: data.description });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir build do React
const buildPath = path.join(__dirname, 'dist');
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
