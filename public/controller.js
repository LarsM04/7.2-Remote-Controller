// Controller Logic - Remote Controller
// Handles joystick, shoot button, and WebSocket communication

class Controller {
    constructor() {
        this.ws = null;
        this.joystickBase = document.getElementById('joystick-base');
        this.joystickStick = document.getElementById('joystick-stick');
        this.shootBtn = document.getElementById('shoot-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.connectionStatus = document.getElementById('connection-status');
        
        this.joystickActive = false;
        this.joystickCenterX = 0;
        this.joystickCenterY = 0;
        this.maxDistance = 60; // Maximum distance the stick can move from center
        
        this.init();
    }
    
    init() {
        // Connect to WebSocket server
        this.connectWebSocket();
        
        // Set up joystick controls
        this.setupJoystick();
        
        // Set up button controls
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
            
            // Register as controller client
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
            
            // Try to reconnect after 3 seconds
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
    
    setupJoystick() {
        // Get joystick center position
        this.updateJoystickCenter();
        
        // Touch events for mobile
        this.joystickStick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.joystickActive = true;
            this.updateJoystickCenter();
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!this.joystickActive) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            this.handleJoystickMove(touch.clientX, touch.clientY);
        });
        
        document.addEventListener('touchend', () => {
            if (this.joystickActive) {
                this.joystickActive = false;
                this.resetJoystick();
            }
        });
        
        // Mouse events for testing on desktop
        this.joystickStick.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.joystickActive = true;
            this.updateJoystickCenter();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.joystickActive) return;
            e.preventDefault();
            
            this.handleJoystickMove(e.clientX, e.clientY);
        });
        
        document.addEventListener('mouseup', () => {
            if (this.joystickActive) {
                this.joystickActive = false;
                this.resetJoystick();
            }
        });
        
        // Update center on window resize
        window.addEventListener('resize', () => {
            this.updateJoystickCenter();
        });
    }
    
    updateJoystickCenter() {
        const rect = this.joystickBase.getBoundingClientRect();
        this.joystickCenterX = rect.left + rect.width / 2;
        this.joystickCenterY = rect.top + rect.height / 2;
    }
    
    handleJoystickMove(clientX, clientY) {
        // Calculate distance from center
        const deltaX = clientX - this.joystickCenterX;
        const deltaY = clientY - this.joystickCenterY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Limit distance to maxDistance
        let limitedX = deltaX;
        let limitedY = deltaY;
        
        if (distance > this.maxDistance) {
            limitedX = (deltaX / distance) * this.maxDistance;
            limitedY = (deltaY / distance) * this.maxDistance;
        }
        
        // Update joystick stick position
        this.joystickStick.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
        
        // Apply deadzone (ignore small movements)
        const deadzone = 10;
        if (distance < deadzone) {
            this.sendMovement(0, 0);
        } else {
            this.sendMovement(limitedX, limitedY);
        }
    }
    
    resetJoystick() {
        // Reset joystick stick position
        this.joystickStick.style.transform = 'translate(0, 0)';
        
        // Send reset movement
        this.sendMovement(0, 0);
    }
    
    sendMovement(x, y) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Normalize values to -1 to 1 range
            const normalizedX = x / this.maxDistance;
            const normalizedY = y / this.maxDistance;
            
            this.ws.send(JSON.stringify({
                type: 'move',
                x: normalizedX,
                y: normalizedY
            }));
        }
    }
    
    setupButtons() {
        // Shoot button
        this.shootBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.sendShoot();
        });
        
        this.shootBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.sendShoot();
        });
        
        // Reset button
        this.resetBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.sendReset();
        });
        
        this.resetBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.sendReset();
        });
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
                    // Close existing connection
                    if (this.ws) {
                        this.ws.close();
                    }
                    // Connect to new IP
                    this.connectWebSocket(`${ip}:3000`);
                }
            });
            
            // Also connect on Enter key
            serverIp.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    connectBtn.click();
                }
            });
        }
    }
}

// Initialize controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.controller = new Controller();
    
    // Set up manual connection after DOM is loaded
    setTimeout(() => {
        if (window.controller) {
            window.controller.setupManualConnection();
        }
    }, 100);
});
