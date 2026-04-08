// Controller Logic - Remote Controller
// Handles trackpad, shoot button, and WebSocket communication

class Controller {
    constructor() {
        this.ws = null;
        this.trackpad = document.getElementById('trackpad');
        this.trackpadIndicator = document.getElementById('trackpad-indicator');
        this.shootBtn = document.getElementById('shoot-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.connectionStatus = document.getElementById('connection-status');
        
        this.trackpadActive = false;
        this.lastX = 0;
        this.lastY = 0;
        this.sensitivity = 3;
        this.shootInterval = null;
        this.shootFiring = false;
        
        this.init();
    }
    
    init() {
        this.connectWebSocket();
        this.setupTrackpad();
        this.setupButtons();
        console.log('Controller initialized');
    }
    
    connectWebSocket(customHost = null) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = customHost || window.location.host;
        const wsUrl = `${protocol}//${host}`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        this.updateConnectionStatus('Verbinden...');
        
        try {
            this.ws = new WebSocket(wsUrl);
        } catch (e) {
            console.error('Failed to create WebSocket:', e);
            this.updateConnectionStatus('Verbindingsfout');
            this.showManualConnection();
            return;
        }
        
        this.ws.onopen = () => {
            console.log('Connected to server');
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
                        console.log('Registered as controller');
                        this.updateConnectionStatus('Verbonden met game');
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
            console.log('Disconnected from server');
            this.updateConnectionStatus('Verbroken');
            
            setTimeout(() => {
                this.connectWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('Verbindingsfout');
            this.showManualConnection();
        };
    }
    
    setupTrackpad() {
        const getTrackpadPos = (e) => {
            const rect = this.trackpad.getBoundingClientRect();
            if (e.touches && e.touches.length > 0) {
                return {
                    x: e.touches[0].clientX - rect.left,
                    y: e.touches[0].clientY - rect.top
                };
            }
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };
        
        // Touch events for mobile
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
            const deltaX = (pos.x - this.lastX) * this.sensitivity;
            const deltaY = (pos.y - this.lastY) * this.sensitivity;
            
            this.sendMovement(deltaX, deltaY);
            
            this.lastX = pos.x;
            this.lastY = pos.y;
            this.updateIndicator(pos.x, pos.y);
        }, { passive: false });
        
        this.trackpad.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.trackpadActive = false;
            this.trackpad.classList.remove('active');
        }, { passive: false });
        
        this.trackpad.addEventListener('touchcancel', (e) => {
            this.trackpadActive = false;
            this.trackpad.classList.remove('active');
        });
        
        // Mouse events for desktop testing
        this.trackpad.addEventListener('mousedown', (e) => {
            e.preventDefault();
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
            const pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            const deltaX = (pos.x - this.lastX) * this.sensitivity;
            const deltaY = (pos.y - this.lastY) * this.sensitivity;
            
            this.sendMovement(deltaX, deltaY);
            
            this.lastX = pos.x;
            this.lastY = pos.y;
            this.updateIndicator(pos.x, pos.y);
        });
        
        document.addEventListener('mouseup', () => {
            if (this.trackpadActive) {
                this.trackpadActive = false;
                this.trackpad.classList.remove('active');
            }
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
        const deadzone = 0.5;
        if (Math.abs(deltaX) < deadzone && Math.abs(deltaY) < deadzone) return;
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'move',
                deltaX: deltaX,
                deltaY: deltaY
            }));
        }
    }
    
    setupButtons() {
        // Shoot button with auto-fire
        const startShooting = (e) => {
            e.preventDefault();
            this.shootFiring = true;
            this.shootBtn.classList.add('firing');
            this.sendShoot();
            
            this.shootInterval = setInterval(() => {
                if (this.shootFiring) {
                    this.sendShoot();
                }
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
        
        // Reset button
        const handleReset = (e) => {
            e.preventDefault();
            this.sendReset();
        };
        
        this.resetBtn.addEventListener('touchstart', handleReset, { passive: false });
        this.resetBtn.addEventListener('mousedown', handleReset);
    }
    
    sendShoot() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'shoot'
            }));
        }
    }
    
    sendReset() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'reset'
            }));
        }
    }
    
    updateConnectionStatus(status) {
        this.connectionStatus.textContent = status;
    }
    
    showManualConnection() {
        const manualConnection = document.getElementById('manual-connection');
        if (manualConnection) {
            manualConnection.style.display = 'block';
        }
    }
    
    setupManualConnection() {
        const connectBtn = document.getElementById('connect-btn');
        const serverIp = document.getElementById('server-ip');
        
        if (connectBtn && serverIp) {
            connectBtn.addEventListener('click', () => {
                const ip = serverIp.value.trim();
                if (ip) {
                    if (this.ws) {
                        this.ws.close();
                    }
                    this.connectWebSocket(`${ip}:3000`);
                }
            });
            
            serverIp.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    connectBtn.click();
                }
            });
        }
    }
    
    updateConnectionStatus(status) {
        this.connectionStatus.textContent = status;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.controller = new Controller();
    
    setTimeout(() => {
        if (window.controller) {
            window.controller.setupManualConnection();
        }
    }, 100);
});
