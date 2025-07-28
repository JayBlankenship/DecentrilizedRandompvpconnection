// network.js - Peer-to-peer networking module

// --- NETWORK MODULE ---
const Network = {
  // Configuration
  BASE_PEER_ID: 'ChainBootstrap-2025-001',
  LOBBY_SIZE: 2, // Static for now, will be controlled by random later
  
  // Private state
  myPeerId: null,
  peer: null,
  isBase: false,
  paired: false,
  partnerPeerId: null,
  partnerConn: null,
  isInitialized: false,
  basePeerConnections: {},
  baseConn: null,
  lobbyPeers: [], // Array to store all peers in current lobby
  partnerConnections: {}, // Object to store connections to all lobby partners
  
  // Callback functions for UI integration
  callbacks: {
    updateConnectionStatus: null,
    logChainEvent: null,
    updateUI: null,
    handleMessage: null
  },
  
  // Set callback functions
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  },
  
  // Initialize the network
  init() {
    this.myPeerId = `ChainNode-${Math.random().toString(36).substr(2, 8)}`;
    this.peer = new Peer(this.myPeerId, {
      host: '0.peerjs.com', port: 443, path: '/', secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });
    
    this.peer.on('open', (id) => {
      this.isInitialized = true;
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus(`Connected as ${this.myPeerId}`);
      }
      if (this.callbacks.logChainEvent) {
        this.callbacks.logChainEvent(`[Peer] Initialized: ${this.myPeerId}`);
      }
      if (this.callbacks.updateUI) {
        this.callbacks.updateUI();
      }
      this.tryBecomeBase();
    });

    this.peer.on('connection', (conn) => {
      conn.on('data', (data) => this.handleData(conn, data));
      conn.on('open', () => {
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent(`[Conn] Incoming connection from ${conn.peer}`);
        }
      });
      conn.on('close', () => {
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent(`[Conn] Connection closed: ${conn.peer}`, '#ff4444');
        }
      });
      conn.on('error', (err) => {
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent(`[Conn] Error: ${err.message}`, '#ff4444');
        }
      });
    });

    this.peer.on('error', (err) => {
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus(`Peer error: ${err.message}`);
      }
      if (this.callbacks.logChainEvent) {
        this.callbacks.logChainEvent(`[Peer] Error: ${err.message}`, '#ff4444');
      }
    });
  },

  tryBecomeBase() {
    const basePeer = new Peer(this.BASE_PEER_ID, {
      host: '0.peerjs.com', port: 443, path: '/', secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    basePeer.on('open', (id) => {
      this.isBase = true;
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus('Waiting for a partner...');
      }
      if (this.callbacks.logChainEvent) {
        this.callbacks.logChainEvent('[Base] Became base peer!');
      }
      if (this.callbacks.updateUI) {
        this.callbacks.updateUI();
      }
      
      let firstPeer = this.myPeerId;
      let secondPeer = null;

      basePeer.on('connection', (conn) => {
        conn.on('data', (data) => {
          if (data.type === 'join') {
            if (!secondPeer) {
              secondPeer = data.peerId;
              if (this.callbacks.logChainEvent) {
                this.callbacks.logChainEvent(`[Base] Second peer joined: ${secondPeer}, pairing with base: ${firstPeer}`);
              }
              // Pair both peers
              this.basePeerConnections[firstPeer] = null; // base itself
              this.basePeerConnections[secondPeer] = conn;
              // Notify both peers
              conn.send({ type: 'pair', partnerPeerId: firstPeer });
              // Notify base peer itself
              setTimeout(() => {
                this.handleData(null, { type: 'pair', partnerPeerId: secondPeer });
                // Remove base status
                this.isBase = false;
                if (this.callbacks.logChainEvent) {
                  this.callbacks.logChainEvent('[Base] Pair formed, base status removed.');
                }
                basePeer.destroy();
              }, 500);
            }
          }
        });

        conn.on('close', () => {
          for (const pid in this.basePeerConnections) {
            if (this.basePeerConnections[pid] === conn) {
              delete this.basePeerConnections[pid];
              break;
            }
          }
        });
      });
    });

    basePeer.on('error', (err) => {
      if (this.callbacks.logChainEvent) {
        this.callbacks.logChainEvent(`[Base] Failed to become base peer: ${err.type}`, '#ffaa00');
      }
      this.isBase = false;
      // Give a small delay to ensure the base peer is ready
      setTimeout(() => {
        this.joinChain();
      }, 1000);
    });
  },

  joinChain() {
    if (this.callbacks.updateConnectionStatus) {
      this.callbacks.updateConnectionStatus('Joining pair...');
    }
    this.baseConn = this.peer.connect(this.BASE_PEER_ID);

    this.baseConn.on('open', () => {
      this.baseConn.send({ type: 'join', peerId: this.myPeerId });
      if (this.callbacks.logChainEvent) {
        this.callbacks.logChainEvent(`[Join] Sent join request to base`);
      }
    });

    this.baseConn.on('data', (data) => {
      if (data.type === 'pair') {
        this.partnerPeerId = data.partnerPeerId;
        this.paired = true;
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent(`[Join] Paired with: ${this.partnerPeerId}`);
        }
        this.connectToPartner();
        if (this.callbacks.updateConnectionStatus) {
          this.callbacks.updateConnectionStatus('Paired!');
        }
        if (this.callbacks.updateUI) {
          this.callbacks.updateUI();
        }
      }
    });

    this.baseConn.on('error', (err) => {
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus('Failed to join pair');
      }
      if (this.callbacks.logChainEvent) {
        this.callbacks.logChainEvent(`[Join] Error: ${err.message}`, '#ff4444');
      }
    });
  },

  connectToPartner() {
    if (this.partnerConn) { 
      this.partnerConn.close(); 
      this.partnerConn = null; 
    }

    if (this.partnerPeerId) {
      this.partnerConn = this.peer.connect(this.partnerPeerId);

      this.partnerConn.on('open', () => {
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent(`[Conn] Connected to partner: ${this.partnerPeerId}`);
        }
        if (this.baseConn) {
          if (this.callbacks.logChainEvent) {
            this.callbacks.logChainEvent('[Pair] Disconnecting from base peer (island formed)');
          }
          this.baseConn.close();
          this.baseConn = null;
        }
        if (this.callbacks.updateConnectionStatus) {
          this.callbacks.updateConnectionStatus('Paired!');
        }
        if (this.callbacks.updateUI) {
          this.callbacks.updateUI();
        }
      });

      this.partnerConn.on('data', (data) => this.handleData(this.partnerConn, data));

      this.partnerConn.on('close', () => {
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent(`[Conn] Partner connection closed, looking for new partner...`, '#ff4444');
        }
        // Reset pairing state and look for new partner
        this.resetPairingAndRejoin();
      });

      this.partnerConn.on('error', (err) => {
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent(`[Conn] Partner connection error: ${err.message}, looking for new partner...`, '#ff4444');
        }
        // Reset pairing state and look for new partner
        this.resetPairingAndRejoin();
      });
    }
  },

  handleData(conn, data) {
    if (data.type === 'pair') {
      this.partnerPeerId = data.partnerPeerId;
      this.paired = true;
      if (this.callbacks.logChainEvent) {
        this.callbacks.logChainEvent(`[Pair] Received pairing notification with: ${this.partnerPeerId}`);
      }
      this.connectToPartner();
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus('Paired!');
      }
      if (this.callbacks.updateUI) {
        this.callbacks.updateUI();
      }
    } else if (data.type === 'message') {
      if (this.callbacks.handleMessage) {
        this.callbacks.handleMessage(data);
      }
      if (data.from !== this.myPeerId) {
        this.relayMessage(data, conn ? conn.peer : null);
      }
    }
  },

  relayMessage(data, fromPeer) {
    // Relay only to partner, except the one we got it from
    if (this.partnerPeerId && this.partnerPeerId !== fromPeer && this.partnerConn && this.partnerConn.open) {
      this.partnerConn.send(data);
    }
  },

  sendMessage(text) {
    if (!this.isInitialized) {
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus('Error: Peer not initialized.');
      }
      return null;
    }

    if (!text || text.trim() === '') {
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus('Error: Message cannot be empty.');
      }
      return null;
    }

    const message = {
      id: `${this.myPeerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      peerId: this.myPeerId,
      text: text.trim(),
      timestamp: Date.now(),
    };

    const payload = {
      type: 'message',
      messages: [message],
      from: this.myPeerId
    };

    // Send only to partner
    if (this.partnerConn && this.partnerConn.open) {
      this.partnerConn.send(payload);
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus('Message sent to partner.');
      }
      return message;
    } else {
      if (this.callbacks.updateConnectionStatus) {
        this.callbacks.updateConnectionStatus('Error: No connection to partner.');
      }
      return null;
    }
  },

  // Reset pairing state and rejoin matchmaking
  resetPairingAndRejoin() {
    // Reset pairing state
    this.paired = false;
    this.partnerPeerId = null;
    if (this.partnerConn) {
      this.partnerConn.close();
      this.partnerConn = null;
    }
    
    // Update UI to show we're looking for a new partner
    if (this.callbacks.updateConnectionStatus) {
      this.callbacks.updateConnectionStatus('Partner disconnected, looking for new partner...');
    }
    if (this.callbacks.updateUI) {
      this.callbacks.updateUI();
    }
    
    // Start looking for a new partner
    if (this.callbacks.logChainEvent) {
      this.callbacks.logChainEvent('[Rejoin] Starting search for new partner...', '#ffaa00');
    }
    
    // Try to become base first, if that fails, join existing base
    setTimeout(() => {
      this.tryBecomeBase();
    }, 1000);
  },

  // Auto-reconnection - modified to handle rejoining when partner is lost
  startAutoReconnect() {
    setInterval(() => {
      if (!this.isInitialized) return;
      
      // If we had a partner but lost connection and they're not reconnecting
      if (this.partnerPeerId && (!this.partnerConn || this.partnerConn.open === false)) {
        // Try to reconnect to existing partner first
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent(`[Auto] Attempting to reconnect to partner: ${this.partnerPeerId}`, '#00ccff');
        }
        this.partnerConn = this.peer.connect(this.partnerPeerId);
        
        let reconnectTimeout = setTimeout(() => {
          // If reconnection fails after 10 seconds, look for new partner
          if (!this.partnerConn || this.partnerConn.open === false) {
            if (this.callbacks.logChainEvent) {
              this.callbacks.logChainEvent(`[Auto] Partner ${this.partnerPeerId} not responding, looking for new partner...`, '#ff8800');
            }
            this.resetPairingAndRejoin();
          }
        }, 10000);
        
        this.partnerConn.on('open', () => {
          clearTimeout(reconnectTimeout);
          if (this.callbacks.logChainEvent) {
            this.callbacks.logChainEvent(`[Auto] Reconnected to partner: ${this.partnerPeerId}`);
          }
        });
        this.partnerConn.on('data', (data) => this.handleData(this.partnerConn, data));
        this.partnerConn.on('close', () => {
          clearTimeout(reconnectTimeout);
          this.resetPairingAndRejoin();
        });
      }
      
      // If we're not paired at all, try to find a partner
      if (!this.paired && !this.isBase) {
        if (this.callbacks.logChainEvent) {
          this.callbacks.logChainEvent('[Auto] Not paired, attempting to find partner...', '#00ccff');
        }
        this.tryBecomeBase();
      }
    }, 5000);
  }
};

// Export the Network object for use in other files
window.Network = Network;