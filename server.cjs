// --- AGENDADOR AUTOMÁTICO PARA ENVIO TELEGRAM ---
const fs = require('fs');
const cron = require('node-cron');
const fetch = require('node-fetch');

// Função utilitária para enviar mensagem ao Telegram
function sendTelegramMessage(text) {
  const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('Telegram ENV não configurado');
    return;
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        console.log('Mensagem enviada ao Telegram!');
      } else {
        console.error('Falha ao enviar para o Telegram:', data.description);
      }
    })
    .catch(err => console.error('Erro Telegram:', err));
}

// Função para montar mensagem simples de abertura (pode ser customizada)
function montarMensagemAbertura(ativo) {
  // Exemplo: lê o snapshot e monta mensagem simples
  let indices = {};
  try {
    const data = fs.readFileSync('indices_snapshot.json', 'utf8');
    indices = JSON.parse(data).indices || {};
  } catch (e) { console.error('Erro lendo indices_snapshot.json:', e); }
  const preco = indices[ativo]?.price || '---';
  return `🚨 ABERTURA ${ativo} 🚨\nPreço: ${preco}\nHora: ${(new Date()).toLocaleTimeString('pt-BR',{hour12:false})}`;
}

// US30: 11:30 BRT (14:30 UTC) | HK50: 22:30 BRT (01:30 UTC)
// Exemplo: envia 15 min antes e na abertura
cron.schedule('15 14 * * 1-5', () => {
  sendTelegramMessage(montarMensagemAbertura('US30') + '\n(15 min antes)');
});
cron.schedule('30 14 * * 1-5', () => {
  sendTelegramMessage(montarMensagemAbertura('US30') + '\n(ABERTURA)');
});
cron.schedule('15 1 * * 1-5', () => {
  sendTelegramMessage(montarMensagemAbertura('HK50') + '\n(15 min antes)');
});
cron.schedule('30 1 * * 1-5', () => {
  sendTelegramMessage(montarMensagemAbertura('HK50') + '\n(ABERTURA)');
});

console.log('Agendador de envio para Telegram ativado!');
// server.cjs - Contador de usuários online via Socket.IO (CommonJS)


const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Serve arquivos estáticos do frontend React (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Para qualquer rota não-API, retorna o index.html do React (Express 5)
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

let onlineCount = 0;

io.on('connection', (socket) => {
  onlineCount++;
  io.emit('onlineCount', onlineCount);

  socket.on('disconnect', () => {
    onlineCount--;
    io.emit('onlineCount', onlineCount);
  });
});

// Endpoint para buscar cotação do Yahoo Finance
app.get('/api/yahoo-quote', async (req, res) => {
  const symbol = req.query.symbol || '%5EHSI';
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Yahoo Finance error', status: response.status });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket.IO server rodando na porta ${PORT}`);
});
