const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

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

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/start.html' : req.url;
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
            const headers = {
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                Pragma: 'no-cache',
                Expires: '0'
            };
            res.writeHead(200, headers);
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

const clients = {
    game: null,
    controller: null
};

function getLocalIPs() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ips.push(net.address);
            }
        }
    }
    return ips;
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    const ips = getLocalIPs();
    ws.send(JSON.stringify({ type: 'server_info', ips: ips, port: PORT }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    if (data.role === 'game') {
                        clients.game = ws;
                        console.log('Game client registered');
                        ws.send(JSON.stringify({ type: 'registered', role: 'game' }));
                        if (clients.controller) {
                            ws.send(JSON.stringify({ type: 'controller_connected' }));
                            clients.controller.send(JSON.stringify({ type: 'game_connected' }));
                        }
                    } else if (data.role === 'controller') {
                        clients.controller = ws;
                        console.log('Controller client registered');
                        ws.send(JSON.stringify({ type: 'registered', role: 'controller' }));
                        if (clients.game) {
                            clients.game.send(JSON.stringify({ type: 'controller_connected' }));
                            ws.send(JSON.stringify({ type: 'game_connected' }));
                        }
                    }
                    break;
                    
                case 'move':
                    if (clients.game && ws === clients.controller) {
                        if (data.x !== undefined && data.y !== undefined) {
                            clients.game.send(JSON.stringify({ type: 'move', x: data.x, y: data.y }));
                        } else {
                            clients.game.send(JSON.stringify({ type: 'move', deltaX: data.deltaX, deltaY: data.deltaY }));
                        }
                    }
                    break;

                case 'aim':
                    if (clients.game && ws === clients.controller) {
                        clients.game.send(JSON.stringify({ type: 'aim', x: data.x, y: data.y }));
                    }
                    break;
                    
                case 'shoot':
                    if (clients.game && ws === clients.controller) {
                        clients.game.send(JSON.stringify({ type: 'shoot' }));
                    }
                    break;
                    
                case 'status':
                    if (data.role === 'game' && clients.controller) {
                        clients.controller.send(JSON.stringify({ type: 'status', message: data.message }));
                    } else if (data.role === 'controller' && clients.game) {
                        clients.game.send(JSON.stringify({ type: 'status', message: data.message }));
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
        } else if (ws === clients.controller) {
            clients.controller = null;
            if (clients.game) {
                clients.game.send(JSON.stringify({ type: 'controller_disconnected' }));
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    console.log('\nAvailable on:');
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`  Controller: http://${net.address}:${PORT}/controller.html`);
            }
        }
    }
});