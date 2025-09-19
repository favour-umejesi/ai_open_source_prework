// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.players = {};
        this.avatars = {};
        this.myPlayerId = null;
        this.myPlayer = null;
        
        // Viewport
        this.viewportX = 0;
        this.viewportY = 0;
        
        // WebSocket
        this.socket = null;
        
        // Movement
        this.pressedKeys = new Set();
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.connectToServer();
        this.setupKeyboardControls();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.drawWorld();
        });
    }
    
    loadWorldMap() {
        const img = new Image();
        img.onload = () => {
            this.worldImage = img;
            this.drawWorld();
        };
        img.src = 'world.jpg';
    }
    
    connectToServer() {
        this.socket = new WebSocket('wss://codepath-mmorg.onrender.com');
        
        this.socket.onopen = () => {
            console.log('Connected to game server');
            this.sendJoinGame();
        };
        
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from game server');
        };
    }
    
    sendJoinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Favour'
        };
        
        this.socket.send(JSON.stringify(joinMessage));
    }
    
    handleServerMessage(data) {
        switch (data.action) {
            case 'join_game':
                if (data.success) {
                    this.myPlayerId = data.playerId;
                    this.players = data.players;
                    this.avatars = data.avatars;
                    this.myPlayer = this.players[this.myPlayerId];
                    this.centerViewportOnPlayer();
                    this.loadAvatarImages();
                }
                break;
            case 'players_moved':
                this.players = { ...this.players, ...data.players };
                // Update viewport if my player moved
                if (data.players[this.myPlayerId]) {
                    this.centerViewportOnPlayer();
                }
                break;
            case 'player_joined':
                this.players[data.player.id] = data.player;
                this.avatars[data.avatar.name] = data.avatar;
                this.loadAvatarImages();
                break;
            case 'player_left':
                delete this.players[data.playerId];
                break;
        }
        
        this.draw();
    }
    
    centerViewportOnPlayer() {
        if (!this.myPlayer) return;
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Calculate viewport position to center player
        this.viewportX = this.myPlayer.x - centerX;
        this.viewportY = this.myPlayer.y - centerY;
        
        // Constrain viewport to world boundaries
        this.viewportX = Math.max(0, Math.min(this.viewportX, this.worldWidth - this.canvas.width));
        this.viewportY = Math.max(0, Math.min(this.viewportY, this.worldHeight - this.canvas.height));
    }
    
    loadAvatarImages() {
        Object.values(this.avatars).forEach(avatar => {
            Object.values(avatar.frames).forEach(frameArray => {
                frameArray.forEach(frameData => {
                    if (frameData && !frameData.startsWith('data:')) return;
                    
                    const img = new Image();
                    img.src = frameData;
                });
            });
        });
    }
    
    draw() {
        this.drawWorld();
        this.drawPlayers();
    }
    
    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewportX, this.viewportY, this.canvas.width, this.canvas.height,
            0, 0, this.canvas.width, this.canvas.height
        );
    }
    
    drawPlayers() {
        Object.values(this.players).forEach(player => {
            this.drawPlayer(player);
        });
    }
    
    drawPlayer(player) {
        const screenX = player.x - this.viewportX;
        const screenY = player.y - this.viewportY;
        
        // Only draw if player is visible on screen
        if (screenX < -50 || screenX > this.canvas.width + 50 || 
            screenY < -50 || screenY > this.canvas.height + 50) {
            return;
        }
        
        const avatar = this.avatars[player.avatar];
        if (!avatar) return;
        
        const frames = avatar.frames[player.facing];
        if (!frames || frames.length === 0) return;
        
        const frameIndex = player.animationFrame || 0;
        const frameData = frames[frameIndex % frames.length];
        
        if (frameData) {
            const img = new Image();
            img.onload = () => {
                // Calculate avatar size maintaining aspect ratio
                const maxSize = 32;
                const aspectRatio = img.width / img.height;
                let width = maxSize;
                let height = maxSize / aspectRatio;
                
                if (height > maxSize) {
                    height = maxSize;
                    width = maxSize * aspectRatio;
                }
                
                // Draw avatar centered on player position
                this.ctx.drawImage(
                    img,
                    screenX - width / 2,
                    screenY - height,
                    width,
                    height
                );
                
                // Draw username label
                this.ctx.fillStyle = 'white';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 2;
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                
                const textX = screenX;
                const textY = screenY - height - 5;
                
                this.ctx.strokeText(player.username, textX, textY);
                this.ctx.fillText(player.username, textX, textY);
            };
            img.src = frameData;
        }
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            if (this.pressedKeys.has(event.code)) return; // Prevent duplicate events
            
            this.pressedKeys.add(event.code);
            this.handleKeyPress(event.code);
        });
        
        document.addEventListener('keyup', (event) => {
            this.pressedKeys.delete(event.code);
            this.handleKeyRelease(event.code);
        });
    }
    
    handleKeyPress(keyCode) {
        const direction = this.getDirectionFromKey(keyCode);
        if (direction && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.sendMoveCommand(direction);
        }
    }
    
    handleKeyRelease(keyCode) {
        const direction = this.getDirectionFromKey(keyCode);
        if (direction && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.sendStopCommand();
        }
    }
    
    getDirectionFromKey(keyCode) {
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        return keyMap[keyCode];
    }
    
    sendMoveCommand(direction) {
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        this.socket.send(JSON.stringify(moveMessage));
    }
    
    sendStopCommand() {
        const stopMessage = {
            action: 'stop'
        };
        this.socket.send(JSON.stringify(stopMessage));
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
