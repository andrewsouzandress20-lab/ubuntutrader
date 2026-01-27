// server.cjs - Contador de usuários online via Socket.IO (CommonJS)

const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
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
