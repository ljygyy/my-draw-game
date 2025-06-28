const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const rooms = {};
const wordList = ['苹果', '香蕉', '电脑', '太阳', '月亮', '猫', '狗', '桌子', '椅子'];

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('一个新玩家连接:', socket.id);

    socket.on('createRoom', (data) => {
        const { username, room } = data;
        if (rooms[room]) {
            socket.emit('errorMsg', '房间已存在！');
            return;
        }
        socket.join(room);
        rooms[room] = {
            players: [{ id: socket.id, username, score: 0 }],
            currentDrawer: null,
            currentWord: ''
        };
        socket.emit('roomCreated', { room });
        io.to(room).emit('updatePlayerList', rooms[room].players);
    });

    socket.on('joinRoom', (data) => {
        const { username, room } = data;
        if (!rooms[room]) {
            socket.emit('errorMsg', '房间不存在！');
            return;
        }
        socket.join(room);
        rooms[room].players.push({ id: socket.id, username, score: 0 });
        socket.emit('joinedRoom', { room });
        io.to(room).emit('updatePlayerList', rooms[room].players);
    });

    socket.on('startGame', (room) => {
        if (rooms[room]) {
            startGameForRoom(room);
        }
    });

    socket.on('draw', (data) => {
        socket.to(data.room).emit('draw', data);
    });

    socket.on('clearCanvas', (room) => {
        io.to(room).emit('clearCanvas');
    });

    socket.on('message', (data) => {
        const { room, message } = data;
        const gameRoom = rooms[room];
        if (!gameRoom) return;
        const sender = gameRoom.players.find(p => p.id === socket.id);
        if (!sender) return;

        if (gameRoom.currentWord && message === gameRoom.currentWord && socket.id !== gameRoom.currentDrawer) {
            sender.score += 10;
            const drawerPlayer = gameRoom.players.find(p => p.id === gameRoom.currentDrawer);
            if (drawerPlayer) drawerPlayer.score += 5;

            io.to(room).emit('message', { username: '系统消息', message: `玩家 ${sender.username} 猜对了！答案是：${gameRoom.currentWord}` });
            io.to(room).emit('updatePlayerList', gameRoom.players);
            startGameForRoom(room);

        } else {
            io.to(room).emit('message', { username: sender.username, message });
        }
    });

    socket.on('disconnect', () => {
        for (const room in rooms) {
            const playerIndex = rooms[room].players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                rooms[room].players.splice(playerIndex, 1);
                io.to(room).emit('updatePlayerList', rooms[room].players);
                if (rooms[room].players.length === 0) {
                    delete rooms[room];
                }
                break;
            }
        }
    });

    function startGameForRoom(room) {
        const gameRoom = rooms[room];
        if (gameRoom.players.length < 2) {
             io.to(room).emit('message', { username: '系统消息', message: '人数不足，无法开始新一轮。' });
            return;
        }
        const currentPlayerIndex = gameRoom.players.findIndex(p => p.id === gameRoom.currentDrawer);
        const nextPlayerIndex = (currentPlayerIndex + 1) % gameRoom.players.length;
        gameRoom.currentDrawer = gameRoom.players[nextPlayerIndex].id;
        gameRoom.currentWord = wordList[Math.floor(Math.random() * wordList.length)];

        io.to(room).emit('newRound', {
            drawerId: gameRoom.currentDrawer,
            drawerName: gameRoom.players[nextPlayerIndex].username
        });
        io.to(gameRoom.currentDrawer).emit('yourWord', { word: gameRoom.currentWord });
        io.to(room).emit('clearCanvas');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`服务器正在端口 ${PORT} 上运行`));