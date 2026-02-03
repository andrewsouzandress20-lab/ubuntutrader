// Backend simples para enviar mensagem ao Telegram sem CORS
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.VITE_TELEGRAM_CHAT_ID;

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor Telegram backend rodando na porta ${PORT}`);
});
