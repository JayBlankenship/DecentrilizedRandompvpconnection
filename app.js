// --- CONFIG ---
const BASE_PEER_ID = 'ChainBootstrap-2025-001';
let myPeerId = null;
let peer = null;
let isBase = false;
let paired = false;
let partnerPeerId = null;
let partnerConn = null;
let messagesArray = [];
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

function startPeer() {
  myPeerId = `ChainNode-${Math.random().toString(36).substr(2, 8)}`;
  peer = new Peer(myPeerId, {
    host: '0.peerjs.com', port: 443, path: '/', secure: true,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  });
  peer.on('open', (id) => {
    isInitialized = true;
    peerInfoDiv.querySelector('#myPeerId').textContent = myPeerId;
    tryBecomeBase();
  });
  peer.on('connection', (conn) => {
    conn.on('data', (data) => handleData(conn, data));
    conn.on('open', () => {
      logDiag(`[Conn] Incoming connection from ${conn.peer}`);
    });
    conn.on('close', () => logDiag(`[Conn] Connection closed: ${conn.peer}`, '#ff4444'));
    conn.on('error', (err) => logDiag(`[Conn] Error: ${err.message}`, '#ff4444'));
  });
  peer.on('error', (err) => {
    connectionStatusDiv.textContent = `Peer error: ${err.message}`;
    logDiag(`[Peer] Error: ${err.message}`, '#ff4444');
  });
}

// --- Peer connection registry for base peer ---
let basePeerConnections = {};

function tryBecomeBase() {
  // Try to become the base peer
  const basePeer = new Peer(BASE_PEER_ID, {
    host: '0.peerjs.com', port: 443, path: '/', secure: true,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  });
  basePeer.on('open', (id) => {
    isBase = true;
    chainStatus.textContent = 'Waiting for a partner...';
    logDiag('[Base] Became base peer!');
    updateUI();
    let firstPeer = myPeerId;
    let secondPeer = null;
    basePeer.on('connection', (conn) => {
      conn.on('data', (data) => {
        if (data.type === 'join') {
          if (!secondPeer) {
            secondPeer = data.peerId;
            // Pair both peers
            basePeerConnections[firstPeer] = null; // base itself
            basePeerConnections[secondPeer] = conn;
            // Notify both peers
            conn.send({ type: 'pair', partnerPeerId: firstPeer });
            // Notify base peer itself
            setTimeout(() => {
              handleData(null, { type: 'pair', partnerPeerId: secondPeer });
              // Remove base status
              isBase = false;
              logDiag('[Base] Pair formed, base status removed.');
              basePeer.destroy();
              updateUI();
            }, 500);
          }
        }
      });
      conn.on('close', () => {
        for (const pid in basePeerConnections) {
          if (basePeerConnections[pid] === conn) {
            delete basePeerConnections[pid];
            break;
          }
        }
      });
    });
  });
  basePeer.on('error', (err) => {
    isBase = false;
    joinChain();
  });
}


// Propagate new peer join from the front of the chain, hop-by-hop
function propagateNewPeerFromFront(newPeerId) {
  if (chain.length < 2) return; // No one to propagate to
  const firstPeer = chain[1];
  if (basePeerConnections[firstPeer]) {
    logDiag(`[Propagate] Starting propagation of new peer (${newPeerId}) at front: ${firstPeer}`);
    basePeerConnections[firstPeer].send({ type: 'new-peer', newPeerId });
  }
}

// Track base connection for later disconnect
let baseConn = null;
function joinChain() {
  chainStatus.textContent = 'Joining pair...';
  baseConn = peer.connect(BASE_PEER_ID);
  baseConn.on('open', () => {
    baseConn.send({ type: 'join', peerId: myPeerId });
    logDiag(`[Join] Sent join request to base`);
  });
  baseConn.on('data', (data) => {
    if (data.type === 'pair') {
      partnerPeerId = data.partnerPeerId;
      paired = true;
      logDiag(`[Join] Paired with: ${partnerPeerId}`);
      connectToPartner();
      chainStatus.textContent = 'Paired!';
      updateUI();
    }
  });
  baseConn.on('error', (err) => {
    chainStatus.textContent = 'Failed to join pair';
    logDiag(`[Join] Error: ${err.message}`, '#ff4444');
  });
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

function connectToPartner() {
  if (partnerConn) { partnerConn.close(); partnerConn = null; }
  if (partnerPeerId) {
    partnerConn = peer.connect(partnerPeerId);
    partnerConn.on('open', () => {
      logDiag(`[Conn] Connected to partner: ${partnerPeerId}`);
      if (baseConn) {
        logDiag('[Pair] Disconnecting from base peer (island formed)');
        baseConn.close();
        baseConn = null;
      }
    });
    partnerConn.on('data', (data) => handleData(partnerConn, data));
    partnerConn.on('close', () => {
      logDiag(`[Conn] Partner connection closed, will attempt reconnect`, '#ff4444');
    });
  }
  updateUI();
}

// Periodically check and reconnect to neighbors if needed
setInterval(() => {
  if (!isInitialized) return;
  if (partnerPeerId && (!partnerConn || partnerConn.open === false)) {
    logDiag(`[Auto] Reconnecting to partner: ${partnerPeerId}`, '#00ccff');
    partnerConn = peer.connect(partnerPeerId);
    partnerConn.on('open', () => logDiag(`[Auto] Reconnected to partner: ${partnerPeerId}`));
    partnerConn.on('data', (data) => handleData(partnerConn, data));
  }
}, 5000);

function handleData(conn, data) {
  if (data.type === 'pair') {
    partnerPeerId = data.partnerPeerId;
    paired = true;
    connectToPartner();
    updateUI();
  } else if (data.type === 'message') {
    handleMessage(data);
    if (data.from !== myPeerId) {
      relayMessage(data, conn ? conn.peer : null);
    }
  }
}

function relayMessage(data, fromPeer) {
  // Relay only to partner, except the one we got it from
  if (partnerPeerId && partnerPeerId !== fromPeer && partnerConn && partnerConn.open) {
    partnerConn.send(data);
  }
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
  if (!isInitialized) {
    connectionStatusDiv.textContent = 'Error: Peer not initialized.';
    return;
  }
  const text = messageInput.value.trim();
  if (!text) {
    connectionStatusDiv.textContent = 'Error: Message cannot be empty.';
    return;
  }
  const message = {
    id: `${myPeerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    peerId: myPeerId,
    text: text,
    timestamp: Date.now(),
  };
  messagesArray.push(message);
  messagesArray.sort((a, b) => a.timestamp - b.timestamp);
  const payload = {
    type: 'message',
    messages: [message],
    from: myPeerId
  };
  // Send only to partner
  if (partnerConn && partnerConn.open) partnerConn.send(payload);
  connectionStatusDiv.textContent = 'Message sent to partner.';
  messageInput.value = '';
  targetPeerId.value = '';
  updateUI();
}

function updateUI() {
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

// Start everything
startPeer();