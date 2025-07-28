// --- UI VARIABLES ---
let messagesArray = [];

// Legacy global variables for compatibility (reference Network object)
let myPeerId = null;
let peer = null;
let isBase = false;
let paired = false;
let partnerPeerId = null;
let partnerConn = null;
let isInitialized = false;

// UI Elements
const chainStatus = document.getElementById('chainStatus');
const chainPositionSpan = document.getElementById('chainPosition');
const peerCount = document.getElementById('peerCount');
const nextPeerSpan = document.getElementById('nextPeer');
const prevPeerSpan = document.getElementById('prevPeer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const targetPeerId = document.getElementById('targetPeerId');
const peerInfoDiv = document.getElementById('peerInfo');
const connectionStatusDiv = document.getElementById('connectionStatus');
const outputPanel = document.getElementById('outputPanel');
const diagnosticsDiv = document.getElementById('diagnostics');
const diagnosticsStaticDiv = document.getElementById('diagnosticsStatic');
const peerChainList = document.getElementById('peerChainList');
const frontPeerIdSpan = document.getElementById('frontPeerId');
const backPeerIdSpan = document.getElementById('backPeerId');
const frontConnStatusSpan = document.getElementById('frontConnStatus');
const backConnStatusSpan = document.getElementById('backConnStatus');
const chainLogDiv = document.getElementById('chainLog');

function logChainEvent(msg, color='#ffaa00') {
  // Append log message, never clear or truncate
  chainLogDiv.insertAdjacentHTML('beforeend', `<div style='color:${color}'>${msg}</div>`);
  chainLogDiv.scrollTop = chainLogDiv.scrollHeight;
}

function logDiag(msg, color='#44ff44') {
  diagnosticsDiv.insertAdjacentHTML('beforeend', `<div style='color:${color}'>${msg}</div>`);
  diagnosticsDiv.scrollTop = diagnosticsDiv.scrollHeight;
}

function updateConnectionStatus(status) {
  connectionStatusDiv.textContent = status;
}



function joinChain() {
  Network.joinChain();
}

function broadcastChain() {
  // Only base peer does this
  if (!isBase) return;
  // Send updated chain to all peers (including self)
  for (let i = 0; i < chain.length; ++i) {
    if (chain[i] === myPeerId) {
      // Update self directly
      handleData(null, { type: 'chain', chain: [...chain] });
    } else if (basePeerConnections[chain[i]]) {
      // Use open connection if available
      basePeerConnections[chain[i]].send({ type: 'chain', chain: [...chain] });
    } else {
      // Fallback: try to connect and send (for legacy peers)
      const conn = peer.connect(chain[i]);
      conn.on('open', () => {
        conn.send({ type: 'chain', chain: [...chain] });
        conn.close();
      });
    }
  }
}

function updateChainLinks() {
  const idx = chain.indexOf(myPeerId);
  prevPeerId = idx > 0 ? chain[idx - 1] : null;
  nextPeerId = idx < chain.length - 1 ? chain[idx + 1] : null;
}

function handleMessage(data) {
  if (data.messages) {
    data.messages.forEach((m) => {
      if (!messagesArray.some((existing) => existing.id === m.id)) {
        messagesArray.push(m);
      }
    });
    messagesArray.sort((a, b) => a.timestamp - b.timestamp);
    updateUI();
  }
}

function sendMessage() {
  const text = messageInput.value.trim();
  const message = Network.sendMessage(text);
  
  if (message) {
    messagesArray.push(message);
    messagesArray.sort((a, b) => a.timestamp - b.timestamp);
    messageInput.value = '';
    targetPeerId.value = '';
    updateUI();
  }
}

function updateUI() {
  // Update legacy variables for compatibility
  myPeerId = Network.myPeerId;
  peer = Network.peer;
  isBase = Network.isBase;
  paired = Network.paired;
  partnerPeerId = Network.partnerPeerId;
  partnerConn = Network.partnerConn;
  isInitialized = Network.isInitialized;
  
  // Update UI displays
  if (myPeerId) {
    peerInfoDiv.querySelector('#myPeerId').textContent = myPeerId;
  }
  
  chainPositionSpan.textContent = paired ? 'Paired' : (isBase ? 'Base' : 'Waiting');
  peerCount.textContent = paired ? '2' : (isBase ? '1 or waiting' : '1');
  nextPeerSpan.textContent = partnerPeerId || 'None';
  prevPeerSpan.textContent = '-';
  frontPeerIdSpan.textContent = partnerPeerId || '-';
  backPeerIdSpan.textContent = '-';
  frontConnStatusSpan.textContent = (partnerConn && partnerConn.open) ? 'Connected' : 'Disconnected';
  backConnStatusSpan.textContent = '-';
  // Peer chain list
  peerChainList.innerHTML = '';
  if (paired) {
    [myPeerId, partnerPeerId].forEach((pid, idx2) => {
      const li = document.createElement('li');
      li.textContent = `#${idx2}: ${pid}`;
      if (pid === myPeerId) li.style.color = '#00ffcc';
      peerChainList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = `#0: ${myPeerId}`;
    li.style.color = '#00ffcc';
    peerChainList.appendChild(li);
  }
  // Never clear the chainLogDiv here or anywhere else
  // Base peer indicator
  const basePeerIndicator = document.getElementById('basePeerIndicator');
  if (isBase) {
    basePeerIndicator.textContent = 'You are the BASE peer (waiting for partner)';
    basePeerIndicator.style.color = '#00ff99';
  } else if (paired) {
    basePeerIndicator.textContent = 'You are paired with another peer';
    basePeerIndicator.style.color = '#00ccff';
  } else {
    basePeerIndicator.textContent = 'Waiting for a partner...';
    basePeerIndicator.style.color = '#ffaa00';
  }
  // Diagnostics (static info only, never clear logs)
  diagnosticsStaticDiv.innerHTML = `
    <div><strong>My Peer ID:</strong> ${myPeerId}</div>
    <div><strong>Partner Peer ID:</strong> ${partnerPeerId || '-'}</div>
    <div><strong>Pair Status:</strong> ${paired ? 'Paired' : (isBase ? 'Base' : 'Waiting')}</div>
    <div><strong>Total Peers in Pair:</strong> ${paired ? '2' : (isBase ? '1 or waiting' : '1')}</div>
    <div><strong>Partner Conn Status:</strong> ${(partnerConn && partnerConn.open) ? 'Connected' : 'Disconnected'}</div>
    <div><strong>Peer Role:</strong> ${isBase ? 'BASE (waiting)' : (paired ? 'PAIRED' : 'WAITING')}</div>
  `;
  // Chat
  chatMessages.innerHTML = messagesArray
    .map((m) => {
      const isMyMessage = m.peerId === myPeerId;
      return `<div${isMyMessage ? ' class="my-message"' : ''}>${m.peerId}: ${m.text}</div>`;
    })
    .join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendMessage = sendMessage;
window.joinChain = joinChain;

// Set up Network callbacks for UI integration
Network.setCallbacks({
  updateConnectionStatus: updateConnectionStatus,
  logChainEvent: logChainEvent,
  updateUI: updateUI,
  handleMessage: handleMessage
});

// Start everything
Network.init();
Network.startAutoReconnect();