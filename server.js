// server.js - Contador de usuários online via Socket.IO
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
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

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Socket.IO server rodando na porta ${PORT}`);
});
