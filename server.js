const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// WebSocket server for Trystero tracker
const wss = new WebSocket.Server({ server });

// Simple tracker implementation
const rooms = new Map();

wss.on('connection', (ws, req) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Handle different message types
            switch (data.type) {
                case 'join':
                    handleJoin(ws, data);
                    break;
                case 'game_state':
                    handleGameState(ws, data);
                    break;
                case 'settings':
                    handleSettings(ws, data);
                    break;
                case 'announce':
                    handleAnnounce(ws, data);
                    break;
                case 'scrape':
                    handleScrape(ws, data);
                    break;
                default:
                    // Unknown message type, ignore
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        // Clean up any room entries for this connection
        for (const [roomId, peers] of rooms.entries()) {
            const index = peers.findIndex(peer => peer.ws === ws);
            if (index !== -1) {
                peers.splice(index, 1);
                if (peers.length === 0) {
                    rooms.delete(roomId);
                }
            }
        }
    });
});

function handleAnnounce(ws, data) {
    const { info_hash, peer_id, port, uploaded, downloaded, left } = data;
    
    if (!rooms.has(info_hash)) {
        rooms.set(info_hash, []);
    }
    
    const room = rooms.get(info_hash);
    const existingPeer = room.find(peer => peer.peer_id === peer_id);
    
    if (existingPeer) {
        existingPeer.ws = ws;
        existingPeer.port = port;
        existingPeer.uploaded = uploaded;
        existingPeer.downloaded = downloaded;
        existingPeer.left = left;
        existingPeer.last_seen = Date.now();
    } else {
        room.push({
            ws,
            peer_id,
            port,
            uploaded,
            downloaded,
            left,
            last_seen: Date.now()
        });
    }
    
    // Send peer list to the announcing peer
    const peers = room.filter(peer => peer.peer_id !== peer_id);
    const response = {
        type: 'announce_response',
        interval: 60,
        peers: peers.map(peer => ({
            peer_id: peer.peer_id,
            ip: '127.0.0.1', // In a real implementation, you'd get the actual IP
            port: peer.port
        }))
    };
    
    ws.send(JSON.stringify(response));
}

function handleScrape(ws, data) {
    const { info_hash } = data;
    const room = rooms.get(info_hash) || [];
    
    const response = {
        type: 'scrape_response',
        files: {
            [info_hash]: {
                complete: room.length,
                incomplete: 0,
                downloaded: room.reduce((sum, peer) => sum + peer.downloaded, 0)
            }
        }
    };
    
    ws.send(JSON.stringify(response));
}

function handleJoin(ws, data) {
    const { roomId } = data;
    const peerId = Math.random().toString(36).substr(2, 9);
    
    if (!rooms.has(roomId)) {
        rooms.set(roomId, []);
    }
    
    const room = rooms.get(roomId);
    room.push({
        ws: ws,
        peerId: peerId,
        joined: Date.now()
    });
    
    // Notify other peers about new peer
    room.forEach(peer => {
        if (peer.ws !== ws && peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.send(JSON.stringify({
                type: 'peer_joined',
                peerId: peerId
            }));
        }
    });
    
    // Send list of existing peers to new peer
    const existingPeers = room.filter(peer => peer.ws !== ws).map(peer => peer.peerId);
    ws.send(JSON.stringify({
        type: 'peers_list',
        peers: existingPeers
    }));
}

function handleGameState(ws, data) {
    // Broadcast game state to all other peers in the same room
    for (const [roomId, peers] of rooms.entries()) {
        const peer = peers.find(p => p.ws === ws);
        if (peer) {
            peers.forEach(p => {
                if (p.ws !== ws && p.ws.readyState === WebSocket.OPEN) {
                    p.ws.send(JSON.stringify({
                        type: 'game_state',
                        state: data.state
                    }));
                }
            });
            break;
        }
    }
}

function handleSettings(ws, data) {
    // Broadcast settings to all other peers in the same room
    for (const [roomId, peers] of rooms.entries()) {
        const peer = peers.find(p => p.ws === ws);
        if (peer) {
            peers.forEach(p => {
                if (p.ws !== ws && p.ws.readyState === WebSocket.OPEN) {
                    p.ws.send(JSON.stringify({
                        type: 'settings',
                        settings: data.settings
                    }));
                }
            });
            break;
        }
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Game of Life server running on port ${PORT}`);
    console.log(`Access the game at: http://localhost:${PORT}`);
    console.log(`WebSocket tracker available at: ws://localhost:${PORT}`);
});
