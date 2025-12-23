const socket = io();
let userName = '';
let currentRoom = '';
let isVisible = true;

const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const userNameInput = document.getElementById('userName');
const roomNameInput = document.getElementById('roomName');
const isPublicCheckbox = document.getElementById('isPublic');
const joinBtn = document.getElementById('joinBtn');
const roomTitle = document.getElementById('roomTitle');
const userList = document.getElementById('userList');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const visibilityBtn = document.getElementById('visibilityBtn');
const leaveBtn = document.getElementById('leaveBtn');

const alertSound = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3");

joinBtn.addEventListener('click', () => {
  const name = userNameInput.value.trim();
  const room = roomNameInput.value.trim();
  const isPublic = isPublicCheckbox.checked;

  if (!name || !room) return alert("Введите имя и комнату");

  userName = name;
  socket.emit('createRoom', { roomName: room, isPublic, userName });
  currentRoom = room;
});

socket.on('joinedRoom', (data) => {
  loginScreen.style.display = 'none';
  chatScreen.style.display = 'block';
  roomTitle.textContent = `Комната: ${data.room.name}`;
  updateUsers(data.room.users);
  updateMessages(data.room.messages);
});

socket.on('error', (err) => {
  alert(err.message);
});

socket.on('userList', (users) => {
  updateUsers(users);
});

function updateUsers(users) {
  userList.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u.name;
    userList.appendChild(li);
  });
}
function updateMessages(msgs) {
  messages.innerHTML = '';
  msgs.forEach(renderMessage);
  messages.scrollTop = messages.scrollHeight;
}

function renderMessage(msg) {
  const div = document.createElement('div');
  div.className = 'message';
  if (msg.mentions.includes(userName)) {
    div.classList.add('mention');

    alertSound.play().catch(() => {});
  }

  const author = document.createElement('div');
  author.className = 'author';
  author.textContent = msg.author;
  div.appendChild(author);

  const text = document.createElement('div');
  text.innerHTML = formatTextWithMentions(msg.text);
  div.appendChild(text);

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = new Date(msg.timestamp).toLocaleTimeString();
  div.appendChild(time);

  const reactions = document.createElement('div');
  reactions.className = 'reactions';
  reactions.id = `reactions-${msg.id}`;
  updateReactionsDisplay(reactions, msg.reactions);
  div.appendChild(reactions);

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function formatTextWithMentions(text) {
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

function updateReactionsDisplay(el, reactions) {
  el.innerHTML = '';
  Object.entries(reactions).forEach(([emoji, users]) => {
    const span = document.createElement('span');
    span.textContent = `${emoji} ${users.length}`;
    span.style.marginRight = '8px';
    span.style.cursor = 'pointer';
    span.onclick = () => {
      socket.emit('reaction', { messageId: el.dataset.messageId, emoji });
    };
    el.appendChild(span);
  });
  el.dataset.messageId = el.id.split('-')[1];
}
socket.on('newMessage', (msg) => {
  renderMessage(msg);
});

socket.on('updateReactions', ({ messageId, reactions }) => {
  const el = document.getElementById(`reactions-${messageId}`);
  if (el) updateReactionsDisplay(el, reactions);
});

socket.on('mention', ({ message, from }) => {
  alertSound.play().catch(() => {});
  alert(`@${from}: ${message.text.substring(0, 50)}...`);
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (text) {
    socket.emit('roomMessage', text);
    messageInput.value = '';
  }
}

visibilityBtn.addEventListener('click', () => {
  socket.emit('toggleVisibility');
});

socket.on('visibilityToggled', ({ visible }) => {
  isVisible = visible;
  visibilityBtn.textContent = `Режим: ${visible ? 'Активный' : 'Невидимый'}`;
  visibilityBtn.classList.toggle('invisible', !visible);
});

leaveBtn.addEventListener('click', () => {
  socket.disconnect();
  location.reload();
});
