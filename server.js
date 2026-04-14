const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_CONTROLLERS = 2;

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
    controllers: new Map(),
    controllerSlots: new Map(),
    startClients: new Set()
};

function safeSend(ws, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function getConnectedPlayerIds() {
    return [...clients.controllers.values()]
        .map((controller) => controller.playerId)
        .sort((a, b) => a - b);
}

function getNextPlayerSlot() {
    const used = new Set(getConnectedPlayerIds());
    for (let playerId = 1; playerId <= MAX_CONTROLLERS; playerId += 1) {
        if (!used.has(playerId)) {
            return playerId;
        }
    }
    return null;
}

function findControllerById(controllerId) {
    for (const [controllerWs, controller] of clients.controllers.entries()) {
        if (controller.controllerId === controllerId) {
            return { controllerWs, controller };
        }
    }
    return null;
}

function broadcastPlayerUpdate() {
    const playerIds = getConnectedPlayerIds();
    const payload = {
        type: 'player_update',
        count: playerIds.length,
        maxPlayers: MAX_CONTROLLERS,
        playerIds
    };

    safeSend(clients.game, payload);

    clients.startClients.forEach((ws) => {
        safeSend(ws, payload);
    });

    clients.controllers.forEach((controller, ws) => {
        safeSend(ws, {
            ...payload,
            yourPlayerId: controller.playerId
        });
    });

    if (clients.game) {
        if (playerIds.length > 0) {
            safeSend(clients.game, { type: 'controller_connected', count: playerIds.length });
        } else {
            safeSend(clients.game, { type: 'controller_disconnected' });
        }
    }
}

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
    safeSend(ws, { type: 'server_info', ips, port: PORT });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'register': {
                    if (data.role === 'game') {
                        clients.game = ws;
                        console.log('Game client registered');
                        safeSend(ws, { type: 'registered', role: 'game' });
                        broadcastPlayerUpdate();
                    } else if (data.role === 'controller') {
                        const controllerId = typeof data.controllerId === 'string' && data.controllerId.trim()
                            ? data.controllerId.trim()
                            : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                        const existing = findControllerById(controllerId);
                        if (existing) {
                            clients.controllers.delete(existing.controllerWs);
                            safeSend(existing.controllerWs, { type: 'controller_replaced' });
                            existing.controllerWs.close();
                        }

                        let playerId = clients.controllerSlots.get(controllerId) || null;
                        if (!playerId) {
                            playerId = getNextPlayerSlot();
                        }

                        if (!playerId) {
                            safeSend(ws, {
                                type: 'controller_full',
                                message: 'Alle speler-slots zijn bezet'
                            });
                            return;
                        }

                        clients.controllerSlots.set(controllerId, playerId);
                        clients.controllers.set(ws, { playerId, controllerId });
                        console.log(`Controller client registered as player ${playerId}`);
                        safeSend(ws, { type: 'registered', role: 'controller', playerId, controllerId });
                        if (clients.game) {
                            safeSend(ws, { type: 'game_connected' });
                        }
                        broadcastPlayerUpdate();
                    } else if (data.role === 'start') {
                        clients.startClients.add(ws);
                        safeSend(ws, { type: 'registered', role: 'start' });
                        broadcastPlayerUpdate();
                    }
                    break;
                }

                case 'move': {
                    const controller = clients.controllers.get(ws);
                    if (clients.game && controller) {
                        if (data.x !== undefined && data.y !== undefined) {
                            safeSend(clients.game, {
                                type: 'move',
                                playerId: controller.playerId,
                                x: data.x,
                                y: data.y
                            });
                        } else {
                            safeSend(clients.game, {
                                type: 'move',
                                playerId: controller.playerId,
                                deltaX: data.deltaX,
                                deltaY: data.deltaY
                            });
                        }
                    }
                    break;
                }

                case 'aim': {
                    const controller = clients.controllers.get(ws);
                    if (clients.game && controller) {
                        safeSend(clients.game, {
                            type: 'aim',
                            playerId: controller.playerId,
                            x: data.x,
                            y: data.y
                        });
                    }
                    break;
                }

                case 'shoot': {
                    const controller = clients.controllers.get(ws);
                    if (clients.game && controller) {
                        safeSend(clients.game, {
                            type: 'shoot',
                            playerId: controller.playerId
                        });
                    }
                    break;
                }

                case 'status':
                    if (data.role === 'game') {
                        clients.controllers.forEach((_, controllerWs) => {
                            safeSend(controllerWs, { type: 'status', message: data.message });
                        });
                    } else if (data.role === 'controller' && clients.game) {
                        safeSend(clients.game, { type: 'status', message: data.message });
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
        }

        if (clients.controllers.has(ws)) {
            clients.controllers.delete(ws);
            broadcastPlayerUpdate();
        }

        if (clients.startClients.has(ws)) {
            clients.startClients.delete(ws);
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
