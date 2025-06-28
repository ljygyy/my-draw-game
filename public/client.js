// public/client.js
const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const action = urlParams.get('action');
const username = sessionStorage.getItem('username');
const room = sessionStorage.getItem('room');

if (!username || !room) {
    alert('信息丢失，请返回主页重试');
    window.location.href = 'index.html';
}

const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clear-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatBox = document.getElementById('chat-box');
const playerList = document.getElementById('player-list');
const roomTitle = document.getElementById('room-title');
const wordDisplay = document.getElementById('word-display');
const wordHint = document.getElementById('word-hint');
const currentDrawerNameSpan = document.getElementById('current-drawer-name');
const startGameBtn = document.getElementById('startGameBtn');

roomTitle.textContent = `房间: ${room}`;

let drawing = false;
let canDraw = false;

function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();


function getEventPosition(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function startPosition(e) {
    e.preventDefault();
    if (!canDraw) return;
    drawing = true;
    draw(e);
}

function endPosition(e) {
    e.preventDefault();
    drawing = false;
    ctx.beginPath();
}

function draw(e) {
    e.preventDefault();
    if (!drawing || !canDraw) return;
    const pos = getEventPosition(e);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    socket.emit('draw', { x: pos.x, y: pos.y, room, drawing });
}

canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchstart', startPosition);
canvas.addEventListener('touchend', endPosition);
canvas.addEventListener('touchmove', draw);


clearBtn.addEventListener('click', () => {
    if (canDraw) {
        socket.emit('clearCanvas', room);
    }
});
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') sendMessage();
});
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', room);
    startGameBtn.style.display = 'none';
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('message', { room, message });
        messageInput.value = '';
    }
}

if (action === 'create') {
    socket.emit('createRoom', { username, room });
} else {
    socket.emit('joinRoom', { username, room });
}

socket.on('roomCreated', () => appendMessage('系统', '房间创建成功！等待其他玩家加入...'));
socket.on('joinedRoom', () => appendMessage('系统', `成功加入房间 ${room}!`));
socket.on('errorMsg', (msg) => {
    alert(msg);
    window.location.href = 'index.html';
});

socket.on('updatePlayerList', (players) => {
    playerList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.username} - ${p.score}分`;
        playerList.appendChild(li);
    });
});

socket.on('message', (data) => appendMessage(data.username, data.message));

socket.on('draw', (data) => {
    if (!data.drawing) {
        ctx.beginPath();
        return;
    }
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('newRound', (data) => {
    appendMessage('系统', `新一轮开始，轮到 ${data.drawerName} 画画！`);
    currentDrawerNameSpan.textContent = data.drawerName;
    wordHint.textContent = '---';
    if (socket.id === data.drawerId) {
        canDraw = true;
        wordDisplay.style.color = 'blue';
    } else {
        canDraw = false;
        wordDisplay.style.color = 'black';
    }
});

socket.on('yourWord', (data) => {
    wordHint.textContent = `你要画的词是：${data.word}`;
});

function appendMessage(user, msg) {
    const p = document.createElement('p');
    p.innerHTML = `<strong>${user}:</strong> ${msg}`;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
}
