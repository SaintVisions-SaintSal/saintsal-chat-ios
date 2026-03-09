const content = document.getElementById('content');
const installBtn = document.getElementById('install-btn');
let deferredPrompt;
let currentPage = 'splash';
let isLoggedIn = localStorage.getItem('token') ? true : false;
let chats = JSON.parse(localStorage.getItem('chats')) || [];
let currentChat = null;
let messages = [];
let typingTimeout;
let socket; // Placeholder for WebSocket

// Install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'block';
});

installBtn.addEventListener('click', () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted install');
      }
      deferredPrompt = null;
    });
  }
});

// Online/Offline handling
window.addEventListener('online', () => console.log('Online'));
window.addEventListener('offline', () => console.log('Offline'));

// Haptics simulation
function hapticFeedback() {
  if (navigator.vibrate) navigator.vibrate(10);
}

// Pages rendering
const pages = {
  splash: () => {
    content.innerHTML = `
      <div class="page active" id="splash">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <img src="/logo.png" alt="Logo" style="width: 128px; margin-bottom: 16px;">
          <p>Loading...</p>
        </div>
      </div>`;
    setTimeout(() => navigate(isLoggedIn ? 'chat-list' : 'auth'), 2000);
  },
  auth: () => {
    content.innerHTML = `
      <div class="page active" id="auth">
        <header>Login / Signup</header>
        <form id="auth-form" style="padding: 16px;">
          <input type="email" id="email" placeholder="Email" required>
          <input type="password" id="password" placeholder="Password" required>
          <button type="submit">Login / Signup</button>
        </form>
      </div>`;
    document.getElementById('auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      // Dummy auth
      localStorage.setItem('token', 'dummy-token');
      localStorage.setItem('user', JSON.stringify({ email }));
      isLoggedIn = true;
      navigate('chat-list');
    });
  },
  'chat-list': () => {
    content.innerHTML = `
      <div class="page active" id="chat-list">
        <header>Chats <input type="search" placeholder="Search"></header>
        <div id="chat-items">
          ${chats.map(chat => `<div class="chat-list-item" data-id="${chat.id}"><div>${chat.name}</div><div>${chat.lastMessage}</div></div>`).join('')}
        </div>
        <div class="fab" onclick="newChat()">+</div>
      </div>`;
    document.querySelectorAll('.chat-list-item').forEach(item => {
      item.addEventListener('click', () => {
        currentChat = item.dataset.id;
        navigate('chat-room');
      });
    });
  },
  'chat-room': () => {
    messages = JSON.parse(localStorage.getItem(`messages-${currentChat}`)) || [];
    content.innerHTML = `
      <div class="page active" id="chat-room" style="display: flex; flex-direction: column; height: 100%;">
        <header>${currentChat} <button onclick="navigate('chat-list')">Back</button></header>
        <div id="messages"></div>
        <div id="typing-indicator" style="display: none;">Typing...</div>
        <div id="input-bar">
          <button id="attach-btn">+</button>
          <input id="message-input" placeholder="Message">
          <button id="send-btn">Send</button>
          <button id="emoji-btn">😊</button>
          <button id="voice-btn">🎤</button>
        </div>
        <div id="attachment-menu" style="display: none;">
          <button onclick="uploadMedia()">Photo</button>
          <button onclick="recordVoice()">Voice</button>
        </div>
        <div id="emoji-picker" style="display: none;">
          <!-- Simple emojis -->
          <span onclick="addEmoji('😊')">😊</span>
          <span onclick="addEmoji('😂')">😂</span>
          <!-- Add more -->
        </div>
      </div>`;
    renderMessages();
    const input = document.getElementById('message-input');
    document.getElementById('send-btn').addEventListener('click', () => sendMessage(input.value));
    input.addEventListener('input', showTyping);
    document.getElementById('attach-btn').addEventListener('click', () => toggle('attachment-menu'));
    document.getElementById('emoji-btn').addEventListener('click', () => toggle('emoji-picker'));
    document.getElementById('voice-btn').addEventListener('click', recordVoice);
    simulateIncoming();
  },
  profile: () => {
    const user = JSON.parse(localStorage.getItem('user')) || {};
    content.innerHTML = `
      <div class="page active" id="profile">
        <header>Profile <button onclick="navigate('chat-list')">Back</button></header>
        <div style="text-align: center; padding: 16px;">
          <img src="/avatar.png" alt="Avatar" style="width: 128px; border-radius: 50%;">
          <p>${user.email}</p>
        </div>
      </div>`;
  },
  settings: () => {
    content.innerHTML = `
      <div class="page active" id="settings">
        <header>Settings <button onclick="navigate('chat-list')">Back</button></header>
        <div style="padding: 16px;">
          <p>Preferences</p>
          <p>Notifications</p>
          <p>Privacy</p>
          <p>About</p>
        </div>
      </div>`;
  }
};

function navigate(page) {
  document.querySelector('.page.active')?.classList.remove('active');
  currentPage = page;
  pages[page]();
  hapticFeedback();
}

function newChat() {
  const id = Date.now();
  chats.push({ id, name: 'New Chat', lastMessage: '' });
  localStorage.setItem('chats', JSON.stringify(chats));
  navigate('chat-list');
}

function sendMessage(text) {
  if (!text) return;
  const msg = { text, type: 'text', status: 'sent', sent: true };
  messages.push(msg);
  localStorage.setItem(`messages-${currentChat}`, JSON.stringify(messages));
  renderMessages();
  document.getElementById('message-input').value = '';
  scrollToBottom();
  updateStatus(msg);
  // Simulate real-time send via socket if connected
}

function renderMessages() {
  const msgDiv = document.getElementById('messages');
  msgDiv.innerHTML = messages.map(msg => `
    <div class="message ${msg.sent ? 'sent' : 'received'}" data-status="${msg.status}">
      ${msg.type === 'image' ? `<img src="${msg.text}" style="max-width: 100%;">` : msg.type === 'voice' ? `<audio controls src="${msg.text}"></audio>` : msg.text}
      <span>${msg.status}</span>
    </div>`).join('');
}

function scrollToBottom() {
  const msgDiv = document.getElementById('messages');
  msgDiv.scrollTop = msgDiv.scrollHeight;
}

function showTyping() {
  clearTimeout(typingTimeout);
  document.getElementById('typing-indicator').style.display = 'block';
  typingTimeout = setTimeout(() => document.getElementById('typing-indicator').style.display = 'none', 2000);
}

function updateStatus(msg) {
  setTimeout(() => msg.status = 'delivered', 1000);
  setTimeout(() => msg.status = 'read', 2000);
  renderMessages();
}

function simulateIncoming() {
  setInterval(() => {
    messages.push({ text: 'Hello!', type: 'text', status: 'read', sent: false });
    renderMessages();
    scrollToBottom();
  }, 5000);
}

function toggle(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function addEmoji(emoji) {
  const input = document.getElementById('message-input');
  input.value += emoji;
  toggle('emoji-picker');
}

function uploadMedia() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      messages.push({ text: reader.result, type: 'image', status: 'sent', sent: true });
      renderMessages();
      scrollToBottom();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

let mediaRecorder;
let audioChunks = [];
function recordVoice() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/ogg' });
      const url = URL.createObjectURL(blob);
      messages.push({ text: url, type: 'voice', status: 'sent', sent: true });
      renderMessages();
      scrollToBottom();
      audioChunks = [];
    };
    setTimeout(() => mediaRecorder.stop(), 5000); // Auto stop after 5s
  });
}

// Init
navigate('splash');