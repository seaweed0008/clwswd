// DOM elements
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages-container');
const userListContainer = document.getElementById('user-list');

// Firebase references
const auth = firebase.auth();
const database = firebase.database();
const messagesRef = database.ref('messages');
const usersRef = database.ref('users');
const presenceRef = database.ref('presence');

// Sign in anonymously for now
auth.signInAnonymously().catch(error => {
  console.error('Authentication error:', error);
});

// Current user state
let currentUser = null;

// Auth state listener
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    
    // Set user presence
    const userPresenceRef = presenceRef.child(user.uid);
    userPresenceRef.set({
      online: true,
      displayName: `User-${user.uid.substring(0, 5)}`,
      lastActive: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Remove presence when disconnected
    userPresenceRef.onDisconnect().remove();
    
    // Load messages
    loadMessages();
    
    // Set up user list
    setupUserList();
  }
});

// Send a message
function sendMessage() {
  const text = messageInput.value.trim();
  if (text && currentUser) {
    messagesRef.push({
      uid: currentUser.uid,
      text: text,
      displayName: `User-${currentUser.uid.substring(0, 5)}`,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    messageInput.value = '';
  }
}

// Listen for new messages
function loadMessages() {
  messagesRef.limitToLast(50).on('child_added', snapshot => {
    const message = snapshot.val();
    displayMessage(message, snapshot.key);
  });
}

// Display a message in the UI
function displayMessage(message, key) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message';
  messageElement.id = `msg-${key}`;
  
  // Add a different class if it's the current user's message
  if (message.uid === currentUser.uid) {
    messageElement.classList.add('own-message');
  }
  
  messageElement.innerHTML = `
    <span class="username">${message.displayName}</span>
    <div class="message-bubble">
      <p>${message.text}</p>
      <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString()}</span>
    </div>
  `;
  
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Set up the user list
function setupUserList() {
  presenceRef.on('value', snapshot => {
    userListContainer.innerHTML = '';
    snapshot.forEach(userSnapshot => {
      const user = userSnapshot.val();
      const userElement = document.createElement('div');
      userElement.className = 'user-item';
      userElement.innerHTML = `
        <span class="user-status online"></span>
        <span class="username">${user.displayName}</span>
      `;
      userListContainer.appendChild(userElement);
    });
  });
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});
