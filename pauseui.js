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
      baseConn: Network.baseConn,
      isInitialized: Network.isInitialized,
      lobbyPeers: Network.lobbyPeers || [],
      partnerConnections: Network.partnerConnections || {},
      lobbyConnectedPeers: Network.lobbyConnectedPeers || [],
      lobbyFull: Network.lobbyFull || false
    };
    
    // Update peer ID display
    if (networkState.myPeerId && this.elements.peerInfoDiv) {
      const myPeerIdElement = this.elements.peerInfoDiv.querySelector('#myPeerId');
      if (myPeerIdElement) {
        myPeerIdElement.textContent = networkState.myPeerId;
      }
    }
    
    // Update role and status for lobby system
    if (this.elements.chainPositionSpan) {
      if (networkState.isBase && networkState.paired) {
        this.elements.chainPositionSpan.textContent = 'Host';
      } else if (networkState.paired && !networkState.isBase) {
        this.elements.chainPositionSpan.textContent = 'Client';
      } else if (networkState.isBase) {
        this.elements.chainPositionSpan.textContent = 'Host (Waiting)';
      } else {
        this.elements.chainPositionSpan.textContent = 'Joining';
      }
    }

    // Update lobby size for 3-player lobby
    if (this.elements.peerCount) {
      if (networkState.isBase) {
        // Host view - show actual count from lobbyConnectedPeers
        const currentCount = networkState.lobbyConnectedPeers.length || 1;
        if (networkState.lobbyFull && currentCount === 3) {
          this.elements.peerCount.textContent = '3/3 Players (Full)';
        } else {
          this.elements.peerCount.textContent = `${currentCount}/3 Players`;
        }
      } else if (networkState.paired) {
        // Client in full lobby
        this.elements.peerCount.textContent = '3/3 Players (Full)';
      } else {
        // Joining
        this.elements.peerCount.textContent = 'Connecting...';
      }
    }

    // Update connected players info
    if (this.elements.nextPeerSpan) {
      if (networkState.isBase) {
        // Host view - show all connected clients
        const clientCount = (networkState.lobbyConnectedPeers.length || 1) - 1; // Subtract host
        if (clientCount > 0) {
          this.elements.nextPeerSpan.textContent = `${clientCount} client${clientCount !== 1 ? 's' : ''}`;
        } else {
          this.elements.nextPeerSpan.textContent = 'No clients yet';
        }
      } else if (networkState.paired) {
        // Client view - show host and other clients
        this.elements.nextPeerSpan.textContent = `Host + 1 other client`;
      } else {
        this.elements.nextPeerSpan.textContent = 'Searching...';
      }
    }    // Update lobby connection info
    if (this.elements.frontPeerIdSpan) {
      if (networkState.isBase) {
        this.elements.frontPeerIdSpan.textContent = `${networkState.myPeerId} (You)`;
      } else {
        this.elements.frontPeerIdSpan.textContent = networkState.partnerPeerId || 'Unknown';
      }
    }

    if (this.elements.backPeerIdSpan) {
      if (networkState.isBase && networkState.paired) {
        const clientIds = Object.keys(networkState.partnerConnections);
        this.elements.backPeerIdSpan.textContent = clientIds.length > 0 ? `${clientIds.length} clients` : 'No clients';
      } else if (networkState.paired && !networkState.isBase) {
        this.elements.backPeerIdSpan.textContent = `${networkState.lobbyPeers.length - 1} other clients`;
      } else {
        this.elements.backPeerIdSpan.textContent = 'None';
      }
    }

    if (this.elements.frontConnStatusSpan) {
      if (networkState.isBase && networkState.paired) {
        // Show client connection status
        const connectedClients = Object.values(networkState.partnerConnections).filter(conn => conn && conn.open).length;
        const totalClients = Object.keys(networkState.partnerConnections).length;
        this.elements.frontConnStatusSpan.textContent = `Connected (${connectedClients}/${totalClients} clients active)`;
      } else if (networkState.paired && !networkState.isBase) {
        // Show host connection status
        this.elements.frontConnStatusSpan.textContent = (networkState.baseConn && networkState.baseConn.open) ? 'Connected to Host' : 'Disconnected';
      } else {
        this.elements.frontConnStatusSpan.textContent = networkState.isBase ? 'Waiting for clients' : 'Connecting...';
      }
    }

    if (this.elements.backConnStatusSpan) {
      if (networkState.isBase) {
        // Host view
        const currentCount = networkState.lobbyConnectedPeers.length || 1;
        if (networkState.lobbyFull && currentCount === 3) {
          this.elements.backConnStatusSpan.textContent = 'Active Lobby (3/3)';
        } else {
          this.elements.backConnStatusSpan.textContent = `Waiting (${currentCount}/3)`;
        }
      } else if (networkState.paired) {
        this.elements.backConnStatusSpan.textContent = 'Active Lobby (3/3)';
      } else {
        this.elements.backConnStatusSpan.textContent = 'Joining lobby...';
      }
    }
    
    // Update peer chain list for 3-player lobby
    if (this.elements.peerChainList) {
      this.elements.peerChainList.innerHTML = '';
      
      if (networkState.isBase && networkState.lobbyFull) {
        // Host view - show host + all clients (full lobby)
        const li = document.createElement('li');
        li.textContent = `#0 (Host): ${networkState.myPeerId}`;
        li.style.color = '#00ff99';
        this.elements.peerChainList.appendChild(li);
        
        Object.keys(networkState.partnerConnections).forEach((clientId, idx) => {
          const li = document.createElement('li');
          li.textContent = `#${idx + 1} (Client): ${clientId}`;
          li.style.color = '#00ccff';
          this.elements.peerChainList.appendChild(li);
        });
      } else if (networkState.isBase) {
        // Host waiting for players
        const currentCount = networkState.lobbyConnectedPeers.length || 1;
        const li = document.createElement('li');
        li.textContent = `#0 (Host): ${networkState.myPeerId} - Waiting for ${3 - currentCount} more player${3 - currentCount !== 1 ? 's' : ''}`;
        li.style.color = '#ffaa00';
        this.elements.peerChainList.appendChild(li);
        
        // Show any currently connected clients
        for (let i = 1; i < currentCount; i++) {
          const clientId = networkState.lobbyConnectedPeers[i];
          const li = document.createElement('li');
          li.textContent = `#${i} (Client): ${clientId}`;
          li.style.color = '#00ccff';
          this.elements.peerChainList.appendChild(li);
        }
      } else if (networkState.paired && !networkState.isBase) {
        // Client view - show host + all lobby members
        const li = document.createElement('li');
        li.textContent = `#0 (Host): ${networkState.partnerPeerId}`;
        li.style.color = '#ffaa00';
        this.elements.peerChainList.appendChild(li);
        
        [networkState.myPeerId, ...networkState.lobbyPeers.filter(p => p !== networkState.partnerPeerId)].forEach((peerId, idx) => {
          const li = document.createElement('li');
          li.textContent = `#${idx + 1} (${peerId === networkState.myPeerId ? 'You' : 'Client'}): ${peerId}`;
          li.style.color = peerId === networkState.myPeerId ? '#00ffcc' : '#00ccff';
          this.elements.peerChainList.appendChild(li);
        });
      } else {
        // Waiting state
        const li = document.createElement('li');
        li.textContent = `#0: ${networkState.myPeerId} (${networkState.isBase ? 'Waiting as Host' : 'Connecting...'})`;
        li.style.color = '#00ffcc';
        this.elements.peerChainList.appendChild(li);
      }
    }
    
    // Update base peer indicator for host-based system
    if (this.elements.basePeerIndicator) {
      console.log('Updating basePeerIndicator with state:', {
        isBase: networkState.isBase,
        paired: networkState.paired,
        lobbyConnectedPeers: networkState.lobbyConnectedPeers.length,
        lobbyFull: networkState.lobbyFull
      });
      
      if (networkState.isBase) {
        const currentCount = networkState.lobbyConnectedPeers.length || 1;
        if (networkState.lobbyFull && currentCount === 3) {
          this.elements.basePeerIndicator.textContent = 'You are the HOST of a full 3-player lobby';
          this.elements.basePeerIndicator.style.color = '#00ff99';
        } else {
          this.elements.basePeerIndicator.textContent = `You are the HOST (${currentCount}/3 players)`;
          this.elements.basePeerIndicator.style.color = '#ffaa00';
        }
      } else if (networkState.paired) {
        this.elements.basePeerIndicator.textContent = 'You are a CLIENT in a 3-player lobby';
        this.elements.basePeerIndicator.style.color = '#00ccff';
      } else {
        this.elements.basePeerIndicator.textContent = 'Connecting to 3-player lobby...';
        this.elements.basePeerIndicator.style.color = '#ffaa00';
      }
    }
    
    // Update diagnostics for host-based system
    if (this.elements.diagnosticsStaticDiv) {
      const roleText = networkState.isBase ? 
        (networkState.lobbyFull ? 'HOST (Full Lobby)' : `HOST (${networkState.lobbyConnectedPeers.length || 1}/3)`) :
        (networkState.paired ? 'CLIENT (Connected)' : 'CONNECTING');
      
      const connectionInfo = networkState.isBase ? 
        `${(networkState.lobbyConnectedPeers.length || 1) - 1} clients connected` :
        (networkState.baseConn && networkState.baseConn.open ? 'Connected to Host' : 'Disconnected from Host');
      
      const lobbySize = networkState.isBase ?
        `${networkState.lobbyConnectedPeers.length || 1}/3 players` :
        (networkState.paired ? '3/3 players (full)' : 'Joining...');
      
      this.elements.diagnosticsStaticDiv.innerHTML = `
        <div><strong>My Peer ID:</strong> ${networkState.myPeerId}</div>
        <div><strong>Role:</strong> ${roleText}</div>
        <div><strong>Lobby Size:</strong> ${lobbySize}</div>
        <div><strong>Connection Info:</strong> ${connectionInfo}</div>
        <div><strong>Host ID:</strong> ${networkState.isBase ? networkState.myPeerId + ' (You)' : (networkState.partnerPeerId || 'Unknown')}</div>
        <div><strong>Status:</strong> ${networkState.isBase ? (networkState.lobbyFull ? 'Full Lobby Ready' : 'Waiting for Players') : (networkState.paired ? 'In 3-Player Lobby' : 'Connecting...')}</div>
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
