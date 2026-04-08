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
        this.shootCooldown = false;
        this.autoShootEnabled = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.connectWebSocket();
        this.startTargetSpawning();
        this.updateCrosshairPosition();
        
        console.log('Game initialized');
    }
    
    setupEventListeners() {
        this.gameArea.addEventListener('mousemove', (e) => {
            this.crosshairX = e.clientX;
            this.crosshairY = e.clientY;
            this.updateCrosshairPosition();
        });
        
        this.gameArea.addEventListener('click', (e) => {
            this.shoot(e.clientX, e.clientY);
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.shoot(this.crosshairX, this.crosshairY);
            }
        });
        
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
                        
                    case 'controller_connected':
                        this.autoShootEnabled = true;
                        console.log('Controller connected');
                        this.updateConnectionStatus('Controller verbonden!');
                        break;
                        
                    case 'controller_disconnected':
                        this.autoShootEnabled = false;
                        console.log('Controller disconnected');
                        this.updateConnectionStatus('Controller verbroken');
                        break;
                        
                    case 'move':
                        this.updateCrosshairFromController(data.deltaX, data.deltaY);
                        break;
                        
                    case 'shoot':
                        this.shootFromController();
                        break;
                        
                    case 'reset':
                        this.resetGame();
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
            this.updateConnectionStatus('Verbinding verbroken');
            
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
        if (this.shootCooldown) return;
        
        this.shootCooldown = true;
        setTimeout(() => {
            this.shootCooldown = false;
        }, 80);
        
        this.createShotEffect(x, y);
        
        const hitTarget = this.checkTargetHit(x, y);
        
        if (hitTarget) {
            this.hitTarget(hitTarget);
        }
        
        this.playShootSound();
    }
    
    createShotEffect(x, y) {
        const effect = document.createElement('div');
        effect.className = 'shot-effect';
        effect.style.left = (x - 10) + 'px';
        effect.style.top = (y - 10) + 'px';
        this.shotEffects.appendChild(effect);
        
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
        target.element.classList.add('hit');
        
        this.score += 10;
        this.scoreValue.textContent = this.score;
        
        setTimeout(() => {
            target.element.remove();
            const index = this.targets.indexOf(target);
            if (index > -1) {
                this.targets.splice(index, 1);
            }
        }, 300);
    }
    
    startTargetSpawning() {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => this.spawnTarget(), i * 1000);
        }
        
        this.targetSpawnInterval = setInterval(() => {
            if (this.targets.length < 5) {
                this.spawnTarget();
            }
        }, 2000);
    }
    
    spawnTarget() {
        const target = document.createElement('div');
        target.className = 'target';
        
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
        }
    }
    
    updateCrosshairFromController(deltaX, deltaY) {
        this.crosshairX += deltaX;
        this.crosshairY += deltaY;
        
        const padding = 20;
        this.crosshairX = Math.max(padding, Math.min(this.crosshairX, window.innerWidth - padding));
        this.crosshairY = Math.max(padding, Math.min(this.crosshairY, window.innerHeight - padding));
        
        this.updateCrosshairPosition();
    }
    
    shootFromController() {
        this.shoot(this.crosshairX, this.crosshairY);
    }
    
    resetGame() {
        this.score = 0;
        this.scoreValue.textContent = this.score;
        
        this.targets.forEach(target => target.element.remove());
        this.targets = [];
        
        this.crosshairX = window.innerWidth / 2;
        this.crosshairY = window.innerHeight / 2;
        this.updateCrosshairPosition();
        
        if (this.targetSpawnInterval) {
            clearInterval(this.targetSpawnInterval);
        }
        this.startTargetSpawning();
        
        console.log('Game reset');
    }
    
    updateConnectionStatus(status) {
        this.statusText.textContent = status;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
