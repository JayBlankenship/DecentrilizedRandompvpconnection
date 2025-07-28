// pauseui.js - UI management module for pause menu

// --- UI MODULE ---
const PauseUI = {
  // UI Elements
  elements: {},
  
  // UI State
  messagesArray: [],
  
  // Initialize UI elements
  init() {
    this.elements = {
      chainStatus: document.getElementById('chainStatus'),
      chainPositionSpan: document.getElementById('chainPosition'),
      peerCount: document.getElementById('peerCount'),
      nextPeerSpan: document.getElementById('nextPeer'),
      prevPeerSpan: document.getElementById('prevPeer'),
      chatMessages: document.getElementById('chatMessages'),
      messageInput: document.getElementById('messageInput'),
      targetPeerId: document.getElementById('targetPeerId'),
      peerInfoDiv: document.getElementById('peerInfo'),
      connectionStatusDiv: document.getElementById('connectionStatus'),
      outputPanel: document.getElementById('outputPanel'),
      diagnosticsDiv: document.getElementById('diagnostics'),
      diagnosticsStaticDiv: document.getElementById('diagnosticsStatic'),
      peerChainList: document.getElementById('peerChainList'),
      frontPeerIdSpan: document.getElementById('frontPeerId'),
      backPeerIdSpan: document.getElementById('backPeerId'),
      frontConnStatusSpan: document.getElementById('frontConnStatus'),
      backConnStatusSpan: document.getElementById('backConnStatus'),
      chainLogDiv: document.getElementById('chainLog'),
      basePeerIndicator: document.getElementById('basePeerIndicator')
    };
  },
  
  // Logging functions
  logChainEvent(msg, color = '#ffaa00') {
    if (this.elements.chainLogDiv) {
      this.elements.chainLogDiv.insertAdjacentHTML('beforeend', `<div style='color:${color}'>${msg}</div>`);
      this.elements.chainLogDiv.scrollTop = this.elements.chainLogDiv.scrollHeight;
    }
  },
  
  logDiag(msg, color = '#44ff44') {
    if (this.elements.diagnosticsDiv) {
      this.elements.diagnosticsDiv.insertAdjacentHTML('beforeend', `<div style='color:${color}'>${msg}</div>`);
      this.elements.diagnosticsDiv.scrollTop = this.elements.diagnosticsDiv.scrollHeight;
    }
  },
  
  // Update connection status
  updateConnectionStatus(status) {
    if (this.elements.connectionStatusDiv) {
      this.elements.connectionStatusDiv.textContent = status;
    }
  },
  
  // Handle incoming messages
  handleMessage(data) {
    if (data.messages) {
      data.messages.forEach((m) => {
        if (!this.messagesArray.some((existing) => existing.id === m.id)) {
          this.messagesArray.push(m);
        }
      });
      this.messagesArray.sort((a, b) => a.timestamp - b.timestamp);
      this.updateUI();
    }
  },
  
  // Send message function
  sendMessage() {
    const text = this.elements.messageInput.value.trim();
    const message = Network.sendMessage(text);
    
    if (message) {
      this.messagesArray.push(message);
      this.messagesArray.sort((a, b) => a.timestamp - b.timestamp);
      this.elements.messageInput.value = '';
      this.elements.targetPeerId.value = '';
      this.updateUI();
    }
  },
  
  // Join chain function
  joinChain() {
    Network.joinChain();
  },
  
  // Update the entire UI
  updateUI() {
    // Get current network state
    const networkState = {
      myPeerId: Network.myPeerId,
      isBase: Network.isBase,
      paired: Network.paired,
      partnerPeerId: Network.partnerPeerId,
      partnerConn: Network.partnerConn,
      isInitialized: Network.isInitialized
    };
    
    // Update peer ID display
    if (networkState.myPeerId && this.elements.peerInfoDiv) {
      const myPeerIdElement = this.elements.peerInfoDiv.querySelector('#myPeerId');
      if (myPeerIdElement) {
        myPeerIdElement.textContent = networkState.myPeerId;
      }
    }
    
    // Update chain position and status
    if (this.elements.chainPositionSpan) {
      this.elements.chainPositionSpan.textContent = networkState.paired ? 'Paired' : (networkState.isBase ? 'Base' : 'Waiting');
    }
    
    if (this.elements.peerCount) {
      this.elements.peerCount.textContent = networkState.paired ? '2' : (networkState.isBase ? '1 or waiting' : '1');
    }
    
    if (this.elements.nextPeerSpan) {
      this.elements.nextPeerSpan.textContent = networkState.partnerPeerId || 'None';
    }
    
    if (this.elements.prevPeerSpan) {
      this.elements.prevPeerSpan.textContent = '-';
    }
    
    if (this.elements.frontPeerIdSpan) {
      this.elements.frontPeerIdSpan.textContent = networkState.partnerPeerId || '-';
    }
    
    if (this.elements.backPeerIdSpan) {
      this.elements.backPeerIdSpan.textContent = '-';
    }
    
    if (this.elements.frontConnStatusSpan) {
      this.elements.frontConnStatusSpan.textContent = (networkState.partnerConn && networkState.partnerConn.open) ? 'Connected' : 'Disconnected';
    }
    
    if (this.elements.backConnStatusSpan) {
      this.elements.backConnStatusSpan.textContent = '-';
    }
    
    // Update peer chain list
    if (this.elements.peerChainList) {
      this.elements.peerChainList.innerHTML = '';
      if (networkState.paired) {
        [networkState.myPeerId, networkState.partnerPeerId].forEach((pid, idx) => {
          const li = document.createElement('li');
          li.textContent = `#${idx}: ${pid}`;
          if (pid === networkState.myPeerId) li.style.color = '#00ffcc';
          this.elements.peerChainList.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = `#0: ${networkState.myPeerId}`;
        li.style.color = '#00ffcc';
        this.elements.peerChainList.appendChild(li);
      }
    }
    
    // Update base peer indicator
    if (this.elements.basePeerIndicator) {
      if (networkState.isBase) {
        this.elements.basePeerIndicator.textContent = 'You are the BASE peer (waiting for partner)';
        this.elements.basePeerIndicator.style.color = '#00ff99';
      } else if (networkState.paired) {
        this.elements.basePeerIndicator.textContent = 'You are paired with another peer';
        this.elements.basePeerIndicator.style.color = '#00ccff';
      } else {
        this.elements.basePeerIndicator.textContent = 'Waiting for a partner...';
        this.elements.basePeerIndicator.style.color = '#ffaa00';
      }
    }
    
    // Update diagnostics (static info only)
    if (this.elements.diagnosticsStaticDiv) {
      this.elements.diagnosticsStaticDiv.innerHTML = `
        <div><strong>My Peer ID:</strong> ${networkState.myPeerId}</div>
        <div><strong>Partner Peer ID:</strong> ${networkState.partnerPeerId || '-'}</div>
        <div><strong>Pair Status:</strong> ${networkState.paired ? 'Paired' : (networkState.isBase ? 'Base' : 'Waiting')}</div>
        <div><strong>Total Peers in Pair:</strong> ${networkState.paired ? '2' : (networkState.isBase ? '1 or waiting' : '1')}</div>
        <div><strong>Partner Conn Status:</strong> ${(networkState.partnerConn && networkState.partnerConn.open) ? 'Connected' : 'Disconnected'}</div>
        <div><strong>Peer Role:</strong> ${networkState.isBase ? 'BASE (waiting)' : (networkState.paired ? 'PAIRED' : 'WAITING')}</div>
      `;
    }
    
    // Update chat messages
    if (this.elements.chatMessages) {
      this.elements.chatMessages.innerHTML = this.messagesArray
        .map((m) => {
          const isMyMessage = m.peerId === networkState.myPeerId;
          return `<div${isMyMessage ? ' class="my-message"' : ''}>${m.peerId}: ${m.text}</div>`;
        })
        .join('');
      this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
  },
  
  // Legacy functions for compatibility
  broadcastChain() {
    // Only base peer does this (keeping for compatibility)
    const networkState = {
      myPeerId: Network.myPeerId,
      isBase: Network.isBase
    };
    
    if (!networkState.isBase) return;
    // This function is kept for compatibility but may not be used in current implementation
  },
  
  updateChainLinks() {
    // Legacy function kept for compatibility
    // Current implementation uses simple pairing, not chain linking
  }
};

// Export the PauseUI object for use in other files
window.PauseUI = PauseUI;
