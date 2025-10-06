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
    console.log('WebSocket connection established');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data);
            
            // Handle different message types
            switch (data.type) {
                case 'announce':
                    handleAnnounce(ws, data);
                    break;
                case 'scrape':
                    handleScrape(ws, data);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
        // Clean up any room entries for this connection
        for (const [roomId, peers] of rooms.entries()) {
            const index = peers.findIndex(peer => peer.ws === ws);
            if (index !== -1) {
                peers.splice(index, 1);
                if (peers.length === 0) {
                    rooms.delete(roomId);
                }
                console.log(`Removed peer from room ${roomId}`);
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
    console.log(`Announced peer ${peer_id} in room ${info_hash}, ${peers.length} other peers`);
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
    console.log(`Scraped room ${info_hash}, ${room.length} peers`);
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Game of Life server running on port ${PORT}`);
    console.log(`Access the game at: http://localhost:${PORT}`);
    console.log(`WebSocket tracker available at: ws://localhost:${PORT}`);
});
