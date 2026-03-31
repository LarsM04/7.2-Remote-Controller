// Start Screen Logic - Remote Controller
// Handles QR code generation and game start

class StartScreen {
    constructor() {
        this.startScreen = document.getElementById('start-screen');
        this.gameContainer = document.getElementById('game-container');
        this.qrCodeContainer = document.getElementById('qr-code');
        this.urlText = document.getElementById('url-text');
        this.copyUrlBtn = document.getElementById('copy-url-btn');
        this.connectionDot = document.getElementById('connection-dot');
        this.connectionText = document.getElementById('connection-text');
        this.startGameBtn = document.getElementById('start-game-btn');
        
        this.controllerConnected = false;
        this.ws = null;
        
        this.init();
    }
    
    init() {
        // Generate controller URL
        this.generateControllerUrl();
        
        // Generate QR code
        this.generateQrCode();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Connect to WebSocket to monitor controller connection
        this.connectWebSocket();
        
        console.log('Start screen initialized');
    }
    
    generateControllerUrl() {
        // Get the current host and protocol
        const protocol = window.location.protocol;
        const host = window.location.host;
        this.controllerUrl = `${protocol}//${host}/controller.html`;
        
        // Display the URL
        this.urlText.textContent = this.controllerUrl;
    }
    
    generateQrCode() {
        // Generate QR code using qrcodejs library
        if (typeof QRCode !== 'undefined') {
            new QRCode(this.qrCodeContainer, {
                text: this.controllerUrl,
                width: 200,
                height: 200,
                colorDark: '#ffffff',
                colorLight: '#1a1a2e',
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            // Fallback if QRCode library is not loaded
            this.qrCodeContainer.innerHTML = '<div style="width: 200px; height: 200px; background: #1a1a2e; display: flex; align-items: center; justify-content: center; color: #888;">QR Code laden...</div>';
            
            // Try again after a short delay
            setTimeout(() => {
                if (typeof QRCode !== 'undefined') {
                    new QRCode(this.qrCodeContainer, {
                        text: this.controllerUrl,
                        width: 200,
                        height: 200,
                        colorDark: '#ffffff',
                        colorLight: '#1a1a2e',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                }
            }, 1000);
        }
    }
    
    setupEventListeners() {
        // Copy URL button
        this.copyUrlBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.controllerUrl).then(() => {
                this.copyUrlBtn.textContent = 'Gekopieerd!';
                setTimeout(() => {
                    this.copyUrlBtn.textContent = 'Kopieer';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy URL:', err);
            });
        });
        
        // Start game button
        this.startGameBtn.addEventListener('click', () => {
            this.startGame();
        });
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            
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
                        break;
                        
                    case 'controller_connected':
                        // Controller has connected
                        this.controllerConnected = true;
                        this.updateConnectionStatus(true);
                        break;
                        
                    case 'controller_disconnected':
                        // Controller has disconnected
                        this.controllerConnected = false;
                        this.updateConnectionStatus(false);
                        break;
                }
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from server');
            
            // Try to reconnect after 3 seconds
            setTimeout(() => {
                this.connectWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionDot.style.background = '#4CAF50';
            this.connectionText.textContent = 'Controller verbonden!';
            this.startGameBtn.disabled = false;
        } else {
            this.connectionDot.style.background = '#888';
            this.connectionText.textContent = 'Wachten op controller...';
            this.startGameBtn.disabled = true;
        }
    }
    
    startGame() {
        // Hide start screen
        this.startScreen.style.display = 'none';
        
        // Show game container
        this.gameContainer.style.display = 'block';
        
        // Initialize the game
        if (typeof Game !== 'undefined') {
            window.game = new Game();
        }
        
        console.log('Game started');
    }
}

// Initialize start screen when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.startScreen = new StartScreen();
});
