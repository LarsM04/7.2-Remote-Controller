// Controller Logic - Remote Controller
// Handles trackpad, shoot button, and WebSocket communication

class Controller {
    constructor() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    init() {
        this.trackpad = document.getElementById('trackpad');
        this.trackpadIndicator = document.getElementById('trackpad-indicator');
        this.shootBtn = document.getElementById('shoot-btn');
        this.connectionStatus = document.getElementById('connection-status');
        this.helpBtn = document.getElementById('help-btn');
        
        this.ws = null;
        this.trackpadActive = false;
        this.lastX = 0;
        this.lastY = 0;
        this.sensitivity = 0.3;
        this.minDelta = 0.5;
        this.shootInterval = null;
        this.shootFiring = false;
        
        this.connectWebSocket();
        this.setupTrackpad();
        this.setupButtons();
    }
    
    connectWebSocket(customHost = null) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = customHost || window.location.host;
        const wsUrl = `${protocol}//${host}`;
        
        this.updateConnectionStatus('Verbinden...');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.updateConnectionStatus('Verbonden');
            this.ws.send(JSON.stringify({
                type: 'register',
                role: 'controller'
            }));
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'registered':
                        this.updateConnectionStatus('Verbonden met game');
                        break;
                    case 'game_connected':
                        this.updateConnectionStatus('Game actief - beweeg op trackpad!');
                        break;
                    case 'status':
                        this.updateConnectionStatus(data.message);
                        break;
                }
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        };
        
        this.ws.onclose = () => {
            this.updateConnectionStatus('Verbroken');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            this.updateConnectionStatus('Verbindingsfout');
            this.showManualConnection();
        };
    }
    
    setupTrackpad() {
        const getTrackpadPos = (e) => {
            const rect = this.trackpad.getBoundingClientRect();
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
            }
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };
        
        this.trackpad.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const pos = getTrackpadPos(e);
            this.trackpadActive = true;
            this.lastX = pos.x;
            this.lastY = pos.y;
            this.trackpad.classList.add('active');
            this.updateIndicator(pos.x, pos.y);
        }, { passive: false });
        
        this.trackpad.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.trackpadActive) return;
            
            const pos = getTrackpadPos(e);
            const rect = this.trackpad.getBoundingClientRect();
            
            this.updateIndicator(pos.x, pos.y);
            
            this.sendAbsolutePosition(pos.x, pos.y, rect.width, rect.height);
        }, { passive: false });
        
        this.trackpad.addEventListener('touchend', (e) => {
            this.trackpadActive = false;
            this.trackpad.classList.remove('active');
        });
        
        this.trackpad.addEventListener('touchcancel', () => {
            this.trackpadActive = false;
            this.trackpad.classList.remove('active');
        });
        
        this.trackpad.addEventListener('mousedown', (e) => {
            const pos = getTrackpadPos(e);
            this.trackpadActive = true;
            this.lastX = pos.x;
            this.lastY = pos.y;
            this.trackpad.classList.add('active');
            this.updateIndicator(pos.x, pos.y);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.trackpadActive) return;
            
            const rect = this.trackpad.getBoundingClientRect();
            const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            
            this.updateIndicator(pos.x, pos.y);
            
            this.sendAbsolutePosition(pos.x, pos.y, rect.width, rect.height);
        });
        
        document.addEventListener('mouseup', () => {
            this.trackpadActive = false;
            this.trackpad.classList.remove('active');
        });
    }
    
    updateIndicator(x, y) {
        const rect = this.trackpad.getBoundingClientRect();
        const indicatorX = Math.max(30, Math.min(x, rect.width - 30));
        const indicatorY = Math.max(30, Math.min(y, rect.height - 30));
        
        this.trackpadIndicator.style.left = indicatorX + 'px';
        this.trackpadIndicator.style.top = indicatorY + 'px';
    }
    
    sendMovement(deltaX, deltaY) {
        if (Math.abs(deltaX) < this.minDelta && Math.abs(deltaY) < this.minDelta) return;
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'move',
                deltaX: deltaX,
                deltaY: deltaY
            }));
        }
    }
    
    sendAbsolutePosition(x, y, width, height) {
        const normalizedX = x / width;
        const normalizedY = y / height;
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'move',
                x: normalizedX,
                y: normalizedY
            }));
        }
    }
    
    setupButtons() {
        const startShooting = (e) => {
            e.preventDefault();
            this.shootFiring = true;
            this.shootBtn.classList.add('firing');
            this.sendShoot();
            
            this.shootInterval = setInterval(() => {
                if (this.shootFiring) this.sendShoot();
            }, 100);
        };
        
        const stopShooting = (e) => {
            e.preventDefault();
            this.shootFiring = false;
            this.shootBtn.classList.remove('firing');
            
            if (this.shootInterval) {
                clearInterval(this.shootInterval);
                this.shootInterval = null;
            }
        };
        
        this.shootBtn.addEventListener('touchstart', startShooting, { passive: false });
        this.shootBtn.addEventListener('touchend', stopShooting, { passive: false });
        this.shootBtn.addEventListener('touchcancel', stopShooting);
        
        this.shootBtn.addEventListener('mousedown', startShooting);
        this.shootBtn.addEventListener('mouseup', stopShooting);
        this.shootBtn.addEventListener('mouseleave', stopShooting);
        
        if (this.helpBtn) {
            this.helpBtn.addEventListener('click', () => {
                alert('Trackpad: Beweeg je vinger om de crosshair te besturen.\nShoot: Klik en houd vast om te schieten.');
            });
        }
    }
    
    sendShoot() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'shoot' }));
        }
    }
    
    updateConnectionStatus(status) {
        if (this.connectionStatus) {
            this.connectionStatus.textContent = status;
        }
    }
    
    showManualConnection() {
        const manualConnection = document.getElementById('manual-connection');
        if (manualConnection) manualConnection.style.display = 'block';
    }
    
    setupManualConnection() {
        const connectBtn = document.getElementById('connect-btn');
        const serverIp = document.getElementById('server-ip');
        
        if (connectBtn && serverIp) {
            connectBtn.addEventListener('click', () => {
                const ip = serverIp.value.trim();
                if (ip) {
                    if (this.ws) this.ws.close();
                    this.connectWebSocket(`${ip}:3000`);
                }
            });
            
            serverIp.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') connectBtn.click();
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.controller = new Controller();
    
    setTimeout(() => {
        if (window.controller) window.controller.setupManualConnection();
    }, 100);
});