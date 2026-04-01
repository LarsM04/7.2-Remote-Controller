// Server - Remote Controller
// Handles all WebSocket communication between game and controller

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;

// MIME types for static files
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Create HTTP server
const server = http.createServer((req, res) => {
    // Handle static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, 'public', filePath);
    
    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = {
    game: null,
    controller: null
};

// Get local IP addresses
function getLocalIPs() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                ips.push(net.address);
            }
        }
    }
    return ips;
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // Send available IP addresses to client
    const ips = getLocalIPs();
    ws.send(JSON.stringify({
        type: 'server_info',
        ips: ips,
        port: PORT
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    // Register client as game or controller
                    if (data.role === 'game') {
                        clients.game = ws;
                        console.log('Game client registered');
                        ws.send(JSON.stringify({ type: 'registered', role: 'game' }));
                        
                        // If controller is already connected, notify game
                        if (clients.controller) {
                            ws.send(JSON.stringify({ type: 'controller_connected' }));
                        }
                    } else if (data.role === 'controller') {
                        clients.controller = ws;
                        console.log('Controller client registered');
                        ws.send(JSON.stringify({ type: 'registered', role: 'controller' }));
                        
                        // Notify game that controller has connected
                        if (clients.game) {
                            clients.game.send(JSON.stringify({ type: 'controller_connected' }));
                        }
                    }
                    
                    // Send current connection status to the newly registered client
                    if (data.role === 'game' && clients.controller) {
                        ws.send(JSON.stringify({ type: 'controller_connected' }));
                    } else if (data.role === 'controller' && clients.game) {
                        clients.game.send(JSON.stringify({ type: 'controller_connected' }));
                    }
                    break;
                    
                case 'move':
                    // Forward controller movement to game
                    if (clients.game && ws === clients.controller) {
                        clients.game.send(JSON.stringify({
                            type: 'move',
                            x: data.x,
                            y: data.y
                        }));
                    }
                    break;
                    
                case 'shoot':
                    // Forward shoot command to game
                    if (clients.game && ws === clients.controller) {
                        clients.game.send(JSON.stringify({
                            type: 'shoot'
                        }));
                    }
                    break;
                    
                case 'reset':
                    // Forward reset command to game
                    if (clients.game && ws === clients.controller) {
                        clients.game.send(JSON.stringify({
                            type: 'reset'
                        }));
                    }
                    break;
                    
                case 'status':
                    // Forward status updates
                    if (data.role === 'game' && clients.controller) {
                        clients.controller.send(JSON.stringify({
                            type: 'status',
                            message: data.message
                        }));
                    } else if (data.role === 'controller' && clients.game) {
                        clients.game.send(JSON.stringify({
                            type: 'status',
                            message: data.message
                        }));
                    }
                    break;
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        if (ws === clients.game) {
            clients.game = null;
            console.log('Game client disconnected');
        } else if (ws === clients.controller) {
            clients.controller = null;
            console.log('Controller client disconnected');
            
            // Notify game that controller has disconnected
            if (clients.game) {
                clients.game.send(JSON.stringify({ type: 'controller_disconnected' }));
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Game screen: http://localhost:${PORT}/`);
    console.log(`Controller: http://localhost:${PORT}/controller.html`);
    
    // Get and display local IP addresses
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    console.log('\nAvailable on:');
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`  http://${net.address}:${PORT}`);
                console.log(`  Controller: http://${net.address}:${PORT}/controller.html`);
            }
        }
    }
});
