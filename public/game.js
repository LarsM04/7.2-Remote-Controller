// Game Logic - Remote Controller
// Handles game objects, crosshair, and shots

class Game {
    constructor() {
        this.crosshair = document.getElementById('crosshair');
        this.gameArea = document.getElementById('game-area');
        this.targetsContainer = document.getElementById('targets-container');
        this.shotEffects = document.getElementById('shot-effects');
        this.scoreValue = document.getElementById('score-value');
        this.statusText = document.getElementById('status-text');
        
        this.score = 0;
        this.crosshairX = window.innerWidth / 2;
        this.crosshairY = window.innerHeight / 2;
        this.targets = [];
        this.targetSpawnInterval = null;
        this.ws = null;
        
        this.init();
    }
    
    init() {
        // Set up event listeners
        this.setupEventListeners();
        
        // Connect to WebSocket server
        this.connectWebSocket();
        
        // Start spawning targets
        this.startTargetSpawning();
        
        // Update crosshair position
        this.updateCrosshairPosition();
        
        console.log('Game initialized');
    }
    
    setupEventListeners() {
        // Mouse movement for crosshair (temporary - will be replaced by phone controller)
        this.gameArea.addEventListener('mousemove', (e) => {
            this.crosshairX = e.clientX;
            this.crosshairY = e.clientY;
            this.updateCrosshairPosition();
        });
        
        // Click to shoot
        this.gameArea.addEventListener('click', (e) => {
            this.shoot(e.clientX, e.clientY);
        });
        
        // Keyboard controls (for testing)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.shoot(this.crosshairX, this.crosshairY);
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.crosshairX = Math.min(this.crosshairX, window.innerWidth);
            this.crosshairY = Math.min(this.crosshairY, window.innerHeight);
            this.updateCrosshairPosition();
        });
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            this.updateConnectionStatus('Verbonden met server');
            
            // Register as game client
            this.ws.send(JSON.stringify({
                type: 'register',
                role: 'game'
            }));
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'registered':
                        console.log('Registered as game client');
                        this.updateConnectionStatus('Wachten op controller...');
                        break;
                        
                    case 'move':
                        // Update crosshair position from controller
                        this.updateCrosshairFromController(data.x, data.y);
                        break;
                        
                    case 'shoot':
                        // Trigger shoot from controller
                        this.shootFromController();
                        break;
                        
                    case 'reset':
                        // Reset game from controller
                        this.resetGame();
                        break;
                        
                    case 'status':
                        // Update status message
                        this.updateConnectionStatus(data.message);
                        break;
                }
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus('Verbinding verbroken');
            
            // Try to reconnect after 3 seconds
            setTimeout(() => {
                this.connectWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('Verbindingsfout');
        };
    }
    
    updateCrosshairPosition() {
        this.crosshair.style.left = this.crosshairX + 'px';
        this.crosshair.style.top = this.crosshairY + 'px';
    }
    
    shoot(x, y) {
        // Create shot effect
        this.createShotEffect(x, y);
        
        // Check if any target was hit
        const hitTarget = this.checkTargetHit(x, y);
        
        if (hitTarget) {
            this.hitTarget(hitTarget);
        }
        
        // Play sound effect (optional)
        this.playShootSound();
    }
    
    createShotEffect(x, y) {
        const effect = document.createElement('div');
        effect.className = 'shot-effect';
        effect.style.left = (x - 10) + 'px';
        effect.style.top = (y - 10) + 'px';
        this.shotEffects.appendChild(effect);
        
        // Remove effect after animation
        setTimeout(() => {
            effect.remove();
        }, 300);
    }
    
    checkTargetHit(x, y) {
        for (let target of this.targets) {
            const rect = target.element.getBoundingClientRect();
            const targetCenterX = rect.left + rect.width / 2;
            const targetCenterY = rect.top + rect.height / 2;
            const radius = rect.width / 2;
            
            // Check if click is within target circle
            const distance = Math.sqrt(
                Math.pow(x - targetCenterX, 2) + 
                Math.pow(y - targetCenterY, 2)
            );
            
            if (distance <= radius) {
                return target;
            }
        }
        return null;
    }
    
    hitTarget(target) {
        // Add hit animation
        target.element.classList.add('hit');
        
        // Update score
        this.score += 10;
        this.scoreValue.textContent = this.score;
        
        // Remove target after animation
        setTimeout(() => {
            target.element.remove();
            const index = this.targets.indexOf(target);
            if (index > -1) {
                this.targets.splice(index, 1);
            }
        }, 300);
    }
    
    startTargetSpawning() {
        // Spawn initial targets
        for (let i = 0; i < 3; i++) {
            setTimeout(() => this.spawnTarget(), i * 1000);
        }
        
        // Continue spawning targets
        this.targetSpawnInterval = setInterval(() => {
            if (this.targets.length < 5) {
                this.spawnTarget();
            }
        }, 2000);
    }
    
    spawnTarget() {
        const target = document.createElement('div');
        target.className = 'target';
        
        // Random position (avoiding edges)
        const padding = 100;
        const maxX = window.innerWidth - padding - 60;
        const maxY = window.innerHeight - padding - 60;
        const x = padding + Math.random() * (maxX - padding);
        const y = padding + Math.random() * (maxY - padding);
        
        target.style.left = x + 'px';
        target.style.top = y + 'px';
        
        this.targetsContainer.appendChild(target);
        
        const targetObj = {
            element: target,
            x: x,
            y: y
        };
        
        this.targets.push(targetObj);
        
        // Auto-remove target after some time if not hit
        setTimeout(() => {
            if (this.targets.includes(targetObj)) {
                target.style.opacity = '0.5';
                setTimeout(() => {
                    if (this.targets.includes(targetObj)) {
                        target.remove();
                        const index = this.targets.indexOf(targetObj);
                        if (index > -1) {
                            this.targets.splice(index, 1);
                        }
                    }
                }, 1000);
            }
        }, 5000);
    }
    
    playShootSound() {
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // Audio not supported
        }
    }
    
    // Method to update crosshair from phone controller
    updateCrosshairFromController(x, y) {
        // Convert normalized values (-1 to 1) to screen coordinates
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const maxOffset = Math.min(window.innerWidth, window.innerHeight) / 3;
        
        this.crosshairX = centerX + (x * maxOffset);
        this.crosshairY = centerY + (y * maxOffset);
        
        // Keep crosshair within bounds
        this.crosshairX = Math.max(0, Math.min(this.crosshairX, window.innerWidth));
        this.crosshairY = Math.max(0, Math.min(this.crosshairY, window.innerHeight));
        
        this.updateCrosshairPosition();
    }
    
    // Method to trigger shoot from phone controller
    shootFromController() {
        this.shoot(this.crosshairX, this.crosshairY);
    }
    
    // Method to reset game from phone controller
    resetGame() {
        // Reset score
        this.score = 0;
        this.scoreValue.textContent = this.score;
        
        // Clear all targets
        this.targets.forEach(target => target.element.remove());
        this.targets = [];
        
        // Reset crosshair to center
        this.crosshairX = window.innerWidth / 2;
        this.crosshairY = window.innerHeight / 2;
        this.updateCrosshairPosition();
        
        // Restart target spawning
        if (this.targetSpawnInterval) {
            clearInterval(this.targetSpawnInterval);
        }
        this.startTargetSpawning();
        
        console.log('Game reset');
    }
    
    // Update connection status
    updateConnectionStatus(status) {
        this.statusText.textContent = status;
    }
}

// Game will be initialized by start-screen.js
// window.game = new Game();
