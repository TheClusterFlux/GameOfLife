class GameOfLife {
    constructor() {
        this.grid = [];
        this.width = 50;
        this.height = 50;
        this.generation = 0;
        this.updateFrequency = 100; // milliseconds
        this.mutationChance = 0; // percentage - starts at 0, can be changed via settings
        this.mutationType = 'single'; // 'single' or 'stable'
        this.edgeLooping = true;
        this.isRunning = false;
        this.intervalId = null;
        
        // Trystero setup
        this.room = null;
        this.peers = new Map();
        this.roomId = 'game-of-life-room';
        
        this.initializeTrystero();
        this.initializeGrid();
        this.setupEventListeners();
        this.setupRealtimeControls();
        this.updateSettingsDisplay(); // Initialize the display
        this.startGame();
    }
    
    initializeTrystero() {
        // Initialize WebSocket-based multiplayer
        try {
            // Use ws:// for localhost, wss:// for production
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            console.log('Attempting WebSocket connection to:', wsUrl);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected for multiplayer');
                // Join the game room
                this.ws.send(JSON.stringify({
                    type: 'join',
                    roomId: this.roomId
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.peers.clear();
                this.updateConnectedUsers();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('Failed to initialize WebSocket multiplayer:', error);
            // Continue without multiplayer functionality
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'peer_joined':
                this.peers.set(data.peerId, true);
                this.updateConnectedUsers();
                // Send current state to new peer
                this.sendGameState();
                break;
                
            case 'peers_list':
                // Add existing peers to our list
                data.peers.forEach(peerId => {
                    this.peers.set(peerId, true);
                });
                this.updateConnectedUsers();
                break;
                
            case 'peer_left':
                this.peers.delete(data.peerId);
                this.updateConnectedUsers();
                break;
                
            case 'game_state':
                this.receiveGameState(data.state);
                break;
                
            case 'settings':
                this.receiveSettings(data.settings);
                break;
        }
    }
    
    initializeGrid() {
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = false;
            }
        }
        // Start with stable patterns by default
        this.initializeGridWithPattern('stable');
    }
    
    setupEventListeners() {
        // Spacebar restart
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.showSettingsModal();
            }
        });
        
        // Settings modal
        const modal = document.getElementById('settingsModal');
        const form = document.getElementById('settingsForm');
        const cancelBtn = document.getElementById('cancelSettings');
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Form submitted!');
            console.log('Mutation type from form:', document.getElementById('mutationType').value);
            this.applyNewSettings();
            modal.style.display = 'none';
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    setupRealtimeControls() {
        // Update frequency controls (logarithmic)
        const updateFreqSlider = document.getElementById('realtimeUpdateFreq');
        const updateFreqInput = document.getElementById('realtimeUpdateFreqInput');
        
        updateFreqSlider.addEventListener('input', (e) => {
            const logValue = parseFloat(e.target.value);
            const value = Math.pow(10, logValue); // Convert from log scale
            updateFreqInput.value = value.toFixed(3);
            this.updateFrequency = value * 1000; // Convert to milliseconds
            this.restartGameLoop();
            this.updateCurrentSettingsDisplay();
        });
        
        updateFreqInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const logValue = Math.log10(value); // Convert to log scale
            updateFreqSlider.value = logValue;
            this.updateFrequency = value * 1000; // Convert to milliseconds
            this.restartGameLoop();
            this.updateCurrentSettingsDisplay();
        });
        
        // Mutation chance controls (logarithmic)
        const mutationChanceSlider = document.getElementById('realtimeMutationChance');
        const mutationChanceInput = document.getElementById('realtimeMutationChanceInput');
        
        mutationChanceSlider.addEventListener('input', (e) => {
            const logValue = parseFloat(e.target.value);
            const value = Math.pow(10, logValue - 4); // Convert from log scale (0.0001% to 10%)
            mutationChanceInput.value = value.toFixed(4);
            this.mutationChance = value;
            this.updateCurrentSettingsDisplay();
        });
        
        mutationChanceInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const logValue = Math.log10(value) + 4; // Convert to log scale
            mutationChanceSlider.value = logValue;
            this.mutationChance = value;
            this.updateCurrentSettingsDisplay();
        });
        
        // Mutation type control
        const mutationTypeSelect = document.getElementById('realtimeMutationType');
        mutationTypeSelect.addEventListener('change', (e) => {
            this.mutationType = e.target.value;
            this.updateCurrentSettingsDisplay();
        });
        
        // Edge looping control
        const edgeLoopingCheckbox = document.getElementById('realtimeEdgeLooping');
        edgeLoopingCheckbox.addEventListener('change', (e) => {
            this.edgeLooping = e.target.checked;
            this.updateCurrentSettingsDisplay();
        });
        
        // Initialize real-time controls with current values
        this.updateRealtimeControlsFromSettings();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.render();
        });
    }
    
    updateRealtimeControlsFromSettings() {
        // Update frequency (logarithmic)
        const freqValue = this.updateFrequency / 1000;
        const freqLogValue = Math.log10(freqValue);
        document.getElementById('realtimeUpdateFreq').value = freqLogValue;
        document.getElementById('realtimeUpdateFreqInput').value = freqValue.toFixed(3);
        
        // Mutation chance (logarithmic)
        const mutValue = this.mutationChance;
        const mutLogValue = Math.log10(mutValue) + 4; // Convert to log scale
        document.getElementById('realtimeMutationChance').value = mutLogValue;
        document.getElementById('realtimeMutationChanceInput').value = mutValue.toFixed(4);
        
        document.getElementById('realtimeMutationType').value = this.mutationType;
        document.getElementById('realtimeEdgeLooping').checked = this.edgeLooping;
    }
    
    restartGameLoop() {
        this.stopGame();
        this.startGame();
    }
    
    updateCurrentSettingsDisplay() {
        document.getElementById('currentFreq').textContent = `${this.updateFrequency / 1000}s`;
        document.getElementById('currentMutation').textContent = `${this.mutationChance}%`;
        document.getElementById('currentType').textContent = this.mutationType === 'single' ? 'Single Cell' : 'Stable State';
        document.getElementById('currentEdges').textContent = this.edgeLooping ? 'On' : 'Off';
    }
    
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        
        // Populate current settings
        document.getElementById('gridWidth').value = this.width;
        document.getElementById('gridHeight').value = this.height;
        document.getElementById('updateFrequency').value = this.updateFrequency / 1000;
        document.getElementById('mutationChance').value = this.mutationChance;
        document.getElementById('mutationType').value = this.mutationType;
        document.getElementById('edgeLooping').checked = this.edgeLooping;
        document.getElementById('initialPattern').value = 'stable'; // Default to stable patterns
        
        modal.style.display = 'block';
    }
    
    applyNewSettings() {
        const newWidth = parseInt(document.getElementById('gridWidth').value);
        const newHeight = parseInt(document.getElementById('gridHeight').value);
        const newFrequency = parseFloat(document.getElementById('updateFrequency').value) * 1000;
        const newMutationChance = parseFloat(document.getElementById('mutationChance').value);
        const newMutationType = document.getElementById('mutationType').value;
        const newEdgeLooping = document.getElementById('edgeLooping').checked;
        const initialPattern = document.getElementById('initialPattern').value;
        
        // Update settings
        this.width = newWidth;
        this.height = newHeight;
        this.updateFrequency = newFrequency;
        this.mutationChance = newMutationChance;
        this.mutationType = newMutationType;
        this.edgeLooping = newEdgeLooping;
        
        console.log('Settings applied - Mutation chance:', this.mutationChance, 'Type:', this.mutationType);
        
        
        // Restart game with new settings
        this.stopGame();
        this.initializeGridWithPattern(initialPattern);
        this.startGame();
        
        // Update UI
        this.updateSettingsDisplay();
        
        // Broadcast settings to other peers
        this.broadcastSettings();
    }
    
    initializeGridWithPattern(pattern) {
        this.grid = [];
        this.generation = 0;
        
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = false;
            }
        }
        
        switch (pattern) {
            case 'random':
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        this.grid[y][x] = Math.random() < 0.3;
                    }
                }
                break;
                
            case 'glider':
                // Place a glider pattern in the center
                const centerX = Math.floor(this.width / 2);
                const centerY = Math.floor(this.height / 2);
                if (centerX >= 2 && centerY >= 2) {
                    this.grid[centerY - 1][centerX] = true;
                    this.grid[centerY][centerX + 1] = true;
                    this.grid[centerY + 1][centerX - 1] = true;
                    this.grid[centerY + 1][centerX] = true;
                    this.grid[centerY + 1][centerX + 1] = true;
                }
                break;
                
            case 'stable':
                // Place stable patterns that show mutations well
                const stableX = Math.floor(this.width / 2);
                const stableY = Math.floor(this.height / 2);
                
                // Add a block (still life)
                if (stableX >= 1 && stableY >= 1) {
                    this.grid[stableY][stableX] = true;
                    this.grid[stableY][stableX + 1] = true;
                    this.grid[stableY + 1][stableX] = true;
                    this.grid[stableY + 1][stableX + 1] = true;
                }
                
                // Add a blinker (oscillator)
                if (stableX >= 5 && stableY >= 1) {
                    this.grid[stableY][stableX + 5] = true;
                    this.grid[stableY][stableX + 6] = true;
                    this.grid[stableY][stableX + 7] = true;
                }
                
                // Add a toad (oscillator)
                if (stableX >= 10 && stableY >= 5) {
                    this.grid[stableY + 5][stableX + 10] = true;
                    this.grid[stableY + 5][stableX + 11] = true;
                    this.grid[stableY + 5][stableX + 12] = true;
                    this.grid[stableY + 6][stableX + 9] = true;
                    this.grid[stableY + 6][stableX + 10] = true;
                    this.grid[stableY + 6][stableX + 11] = true;
                }
                
                // Add a beacon (oscillator)
                if (stableX >= 15 && stableY >= 10) {
                    this.grid[stableY + 10][stableX + 15] = true;
                    this.grid[stableY + 10][stableX + 16] = true;
                    this.grid[stableY + 11][stableX + 15] = true;
                    this.grid[stableY + 11][stableX + 16] = true;
                    this.grid[stableY + 12][stableX + 17] = true;
                    this.grid[stableY + 12][stableX + 18] = true;
                    this.grid[stableY + 13][stableX + 17] = true;
                    this.grid[stableY + 13][stableX + 18] = true;
                }
                break;
                
            case 'oscillator':
                // Place a blinker pattern
                const oscX = Math.floor(this.width / 2);
                const oscY = Math.floor(this.height / 2);
                if (oscX >= 1 && oscY >= 1) {
                    this.grid[oscY][oscX - 1] = true;
                    this.grid[oscY][oscX] = true;
                    this.grid[oscY][oscX + 1] = true;
                }
                break;
                
            case 'toad':
                // Place a toad oscillator (6 cells)
                const toadX = Math.floor(this.width / 2);
                const toadY = Math.floor(this.height / 2);
                if (toadX >= 1 && toadY >= 1) {
                    this.grid[toadY][toadX] = true;
                    this.grid[toadY][toadX + 1] = true;
                    this.grid[toadY][toadX + 2] = true;
                    this.grid[toadY + 1][toadX - 1] = true;
                    this.grid[toadY + 1][toadX] = true;
                    this.grid[toadY + 1][toadX + 1] = true;
                }
                break;
                
            case 'beacon':
                // Place a beacon oscillator (8 cells)
                const beaconX = Math.floor(this.width / 2);
                const beaconY = Math.floor(this.height / 2);
                if (beaconX >= 1 && beaconY >= 1) {
                    this.grid[beaconY][beaconX] = true;
                    this.grid[beaconY][beaconX + 1] = true;
                    this.grid[beaconY + 1][beaconX] = true;
                    this.grid[beaconY + 1][beaconX + 1] = true;
                    this.grid[beaconY + 2][beaconX + 2] = true;
                    this.grid[beaconY + 2][beaconX + 3] = true;
                    this.grid[beaconY + 3][beaconX + 2] = true;
                    this.grid[beaconY + 3][beaconX + 3] = true;
                }
                break;
                
            case 'figure8':
                // Place a figure-8 oscillator (8 cells)
                const figure8X = Math.floor(this.width / 2);
                const figure8Y = Math.floor(this.height / 2);
                if (figure8X >= 1 && figure8Y >= 1) {
                    this.grid[figure8Y - 1][figure8X - 1] = true;
                    this.grid[figure8Y - 1][figure8X] = true;
                    this.grid[figure8Y - 1][figure8X + 1] = true;
                    this.grid[figure8Y][figure8X - 1] = true;
                    this.grid[figure8Y][figure8X + 1] = true;
                    this.grid[figure8Y + 1][figure8X - 1] = true;
                    this.grid[figure8Y + 1][figure8X] = true;
                    this.grid[figure8Y + 1][figure8X + 1] = true;
                }
                break;
                
            case 'empty':
                // Grid remains empty
                break;
        }
        
        this.render();
    }
    
    startGame() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.intervalId = setInterval(() => {
            this.nextGeneration();
        }, this.updateFrequency);
    }
    
    stopGame() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    nextGeneration() {
        // Apply mutations to the current grid first
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Apply mutation
                if (Math.random() < this.mutationChance / 100) {
                    if (this.mutationType === 'single') {
                        // Single cell mutation - just toggle this cell
                        this.grid[y][x] = !this.grid[y][x];
                    } else {
                        // Stable state mutation - create a stable pattern around this cell
                        this.createStableMutation(this.grid, x, y);
                    }
                }
            }
        }
        
        // Now apply Conway's rules
        const newGrid = [];
        for (let y = 0; y < this.height; y++) {
            newGrid[y] = [];
            for (let x = 0; x < this.width; x++) {
                const neighbors = this.countNeighbors(x, y);
                const isAlive = this.grid[y][x];
                
                // Conway's rules
                if (isAlive) {
                    newGrid[y][x] = neighbors === 2 || neighbors === 3;
                } else {
                    newGrid[y][x] = neighbors === 3;
                }
            }
        }
        
        this.grid = newGrid;
        this.generation++;
        
        this.render();
        this.updateStats();
        
        // Broadcast state to other peers
        this.broadcastGameState();
    }
    
    countNeighbors(x, y) {
        let count = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                let nx = x + dx;
                let ny = y + dy;
                
                if (this.edgeLooping) {
                    // Wrap around edges
                    nx = (nx + this.width) % this.width;
                    ny = (ny + this.height) % this.height;
                } else {
                    // Dead edges
                    if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
                        continue;
                    }
                }
                
                if (this.grid[ny][nx]) {
                    count++;
                }
            }
        }
        
        return count;
    }
    
    createStableMutation(grid, centerX, centerY) {
        // Choose a random stable pattern to create
        const patterns = [
            'block', 'blinker', 'toad', 'beacon', 'glider', 
            'figure8', 'clock', 'lwss'
        ];
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        
        try {
            switch (pattern) {
                case 'block':
                    // 2x2 block (still life) - always place it
                    const blockPos1 = this.wrapPosition(centerX, centerY);
                    const blockPos2 = this.wrapPosition(centerX + 1, centerY);
                    const blockPos3 = this.wrapPosition(centerX, centerY + 1);
                    const blockPos4 = this.wrapPosition(centerX + 1, centerY + 1);
                    
                    // Safety check
                    if (grid[blockPos1.y] && grid[blockPos2.y] && grid[blockPos3.y] && grid[blockPos4.y]) {
                        grid[blockPos1.y][blockPos1.x] = true;
                        grid[blockPos2.y][blockPos2.x] = true;
                        grid[blockPos3.y][blockPos3.x] = true;
                        grid[blockPos4.y][blockPos4.x] = true;
                    }
                    break;
                    
                case 'blinker':
                    // 3-cell blinker (oscillator) - always place it
                    const blinkPos1 = this.wrapPosition(centerX, centerY);
                    const blinkPos2 = this.wrapPosition(centerX + 1, centerY);
                    const blinkPos3 = this.wrapPosition(centerX + 2, centerY);
                    
                    // Safety check
                    if (grid[blinkPos1.y] && grid[blinkPos2.y] && grid[blinkPos3.y]) {
                        grid[blinkPos1.y][blinkPos1.x] = true;
                        grid[blinkPos2.y][blinkPos2.x] = true;
                        grid[blinkPos3.y][blinkPos3.x] = true;
                    }
                    break;
                    
                case 'toad':
                    // 6-cell toad (oscillator)
                    const toadPositions = [
                        this.wrapPosition(centerX, centerY),
                        this.wrapPosition(centerX + 1, centerY),
                        this.wrapPosition(centerX + 2, centerY),
                        this.wrapPosition(centerX - 1, centerY + 1),
                        this.wrapPosition(centerX, centerY + 1),
                        this.wrapPosition(centerX + 1, centerY + 1)
                    ];
                    
                    if (toadPositions.every(pos => grid[pos.y])) {
                        toadPositions.forEach(pos => {
                            grid[pos.y][pos.x] = true;
                        });
                    }
                    break;
                    
                case 'beacon':
                    // 8-cell beacon (oscillator)
                    const beaconPositions = [
                        this.wrapPosition(centerX, centerY),
                        this.wrapPosition(centerX + 1, centerY),
                        this.wrapPosition(centerX, centerY + 1),
                        this.wrapPosition(centerX + 1, centerY + 1),
                        this.wrapPosition(centerX + 2, centerY + 2),
                        this.wrapPosition(centerX + 3, centerY + 2),
                        this.wrapPosition(centerX + 2, centerY + 3),
                        this.wrapPosition(centerX + 3, centerY + 3)
                    ];
                    
                    if (beaconPositions.every(pos => grid[pos.y])) {
                        beaconPositions.forEach(pos => {
                            grid[pos.y][pos.x] = true;
                        });
                    }
                    break;
                    
                case 'glider':
                    // 5-cell glider (moving pattern)
                    const gliderPositions = [
                        this.wrapPosition(centerX, centerY),
                        this.wrapPosition(centerX + 1, centerY),
                        this.wrapPosition(centerX - 1, centerY + 1),
                        this.wrapPosition(centerX, centerY + 1),
                        this.wrapPosition(centerX + 1, centerY + 1)
                    ];
                    
                    if (gliderPositions.every(pos => grid[pos.y])) {
                        gliderPositions.forEach(pos => {
                            grid[pos.y][pos.x] = true;
                        });
                    }
                    break;
                    
                    
                case 'lwss':
                    // Lightweight spaceship (moving pattern)
                    const lwssPositions = [
                        this.wrapPosition(centerX, centerY),
                        this.wrapPosition(centerX + 3, centerY),
                        this.wrapPosition(centerX + 4, centerY + 1),
                        this.wrapPosition(centerX, centerY + 2),
                        this.wrapPosition(centerX + 4, centerY + 2),
                        this.wrapPosition(centerX + 1, centerY + 3),
                        this.wrapPosition(centerX + 2, centerY + 3),
                        this.wrapPosition(centerX + 3, centerY + 3),
                        this.wrapPosition(centerX + 4, centerY + 3)
                    ];
                    
                    if (lwssPositions.every(pos => grid[pos.y])) {
                        lwssPositions.forEach(pos => {
                            grid[pos.y][pos.x] = true;
                        });
                    }
                    break;
                    
                case 'figure8':
                    // Figure-8 oscillator
                    const figure8Positions = [
                        this.wrapPosition(centerX - 1, centerY - 1),
                        this.wrapPosition(centerX, centerY - 1),
                        this.wrapPosition(centerX + 1, centerY - 1),
                        this.wrapPosition(centerX - 1, centerY),
                        this.wrapPosition(centerX + 1, centerY),
                        this.wrapPosition(centerX - 1, centerY + 1),
                        this.wrapPosition(centerX, centerY + 1),
                        this.wrapPosition(centerX + 1, centerY + 1)
                    ];
                    
                    if (figure8Positions.every(pos => grid[pos.y])) {
                        figure8Positions.forEach(pos => {
                            grid[pos.y][pos.x] = true;
                        });
                    }
                    break;
                    
                case 'clock':
                    // Clock oscillator
                    const clockPositions = [
                        this.wrapPosition(centerX - 1, centerY - 1),
                        this.wrapPosition(centerX + 1, centerY - 1),
                        this.wrapPosition(centerX - 1, centerY),
                        this.wrapPosition(centerX + 1, centerY),
                        this.wrapPosition(centerX - 1, centerY + 1),
                        this.wrapPosition(centerX + 1, centerY + 1)
                    ];
                    
                    if (clockPositions.every(pos => grid[pos.y])) {
                        clockPositions.forEach(pos => {
                            grid[pos.y][pos.x] = true;
                        });
                    }
                    break;
            }
        } catch (error) {
            console.error('Error in createStableMutation:', error);
        }
    }
    
    isValidPosition(x, y) {
        if (this.edgeLooping) {
            return true; // All positions are valid with edge looping
        } else {
            return x >= 0 && x < this.width && y >= 0 && y < this.height;
        }
    }
    
    wrapPosition(x, y) {
        if (this.edgeLooping) {
            // Handle wrapping properly - ensure coordinates are always in range [0, width-1] and [0, height-1]
            let wrappedX = x;
            let wrappedY = y;
            
            // Wrap X coordinate
            while (wrappedX < 0) wrappedX += this.width;
            while (wrappedX >= this.width) wrappedX -= this.width;
            
            // Wrap Y coordinate  
            while (wrappedY < 0) wrappedY += this.height;
            while (wrappedY >= this.height) wrappedY -= this.height;
            
            return { x: wrappedX, y: wrappedY };
        } else {
            return { x, y };
        }
    }
    
    render() {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // Get available space
        const gameArea = canvas.parentElement;
        const availableWidth = gameArea.clientWidth;
        const availableHeight = gameArea.clientHeight;
        
        // Calculate optimal canvas size
        const aspectRatio = this.width / this.height;
        let canvasWidth, canvasHeight;
        
        if (availableWidth / availableHeight > aspectRatio) {
            // Height is the limiting factor
            canvasHeight = availableHeight;
            canvasWidth = canvasHeight * aspectRatio;
        } else {
            // Width is the limiting factor
            canvasWidth = availableWidth;
            canvasHeight = canvasWidth / aspectRatio;
        }
        
        // Set canvas size
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Calculate cell size
        const cellSize = Math.min(
            Math.floor(canvasWidth / this.width),
            Math.floor(canvasHeight / this.height)
        );
        
        const offsetX = (canvasWidth - this.width * cellSize) / 2;
        const offsetY = (canvasHeight - this.height * cellSize) / 2;
        
        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Draw grid
        ctx.fillStyle = '#0f0';
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x]) {
                    ctx.fillRect(
                        offsetX + x * cellSize,
                        offsetY + y * cellSize,
                        cellSize - 1,
                        cellSize - 1
                    );
                }
            }
        }
        
        // Draw grid lines
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= this.width; x++) {
            ctx.beginPath();
            ctx.moveTo(offsetX + x * cellSize, offsetY);
            ctx.lineTo(offsetX + x * cellSize, offsetY + this.height * cellSize);
            ctx.stroke();
        }
        for (let y = 0; y <= this.height; y++) {
            ctx.beginPath();
            ctx.moveTo(offsetX, offsetY + y * cellSize);
            ctx.lineTo(offsetX + this.width * cellSize, offsetY + y * cellSize);
            ctx.stroke();
        }
    }
    
    updateSettingsDisplay() {
        // Update real-time controls
        this.updateRealtimeControlsFromSettings();
        this.updateCurrentSettingsDisplay();
    }
    
    updateStats() {
        document.getElementById('generation').textContent = this.generation;
        
        let livingCells = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x]) livingCells++;
            }
        }
        document.getElementById('livingCells').textContent = livingCells;
    }
    
    updateConnectedUsers() {
        document.getElementById('connectedUsers').textContent = this.peers.size + 1; // +1 for self
    }
    
    broadcastGameState() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const state = {
                grid: this.grid,
                generation: this.generation,
                timestamp: Date.now()
            };
            this.ws.send(JSON.stringify({
                type: 'game_state',
                state: state
            }));
        }
    }
    
    broadcastSettings() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const settings = {
                width: this.width,
                height: this.height,
                updateFrequency: this.updateFrequency,
                mutationChance: this.mutationChance,
                mutationType: this.mutationType,
                edgeLooping: this.edgeLooping,
                timestamp: Date.now()
            };
            this.ws.send(JSON.stringify({
                type: 'settings',
                settings: settings
            }));
        }
    }
    
    receiveGameState(state) {
        // Only update if the received state is newer
        if (state.timestamp > (this.lastReceivedState?.timestamp || 0)) {
            this.grid = state.grid;
            this.generation = state.generation;
            this.lastReceivedState = state;
            this.render();
            this.updateStats();
        }
    }
    
    receiveSettings(settings) {
        // Only update if the received settings are newer
        if (settings.timestamp > (this.lastReceivedSettings?.timestamp || 0)) {
            this.width = settings.width;
            this.height = settings.height;
            this.updateFrequency = settings.updateFrequency;
            this.mutationChance = settings.mutationChance;
            this.mutationType = settings.mutationType || 'single'; // Default to single if not set
            this.edgeLooping = settings.edgeLooping;
            this.lastReceivedSettings = settings;
            
            this.stopGame();
            this.startGame();
            this.updateSettingsDisplay();
        }
    }
    
    sendGameState() {
        // Send current state to newly connected peer
        this.broadcastGameState();
    }
    
    // Test function to verify mutation type
    testMutationType() {
        console.log('=== TESTING MUTATION TYPE ===');
        console.log('Current mutation type:', this.mutationType);
        console.log('Mutation type === "single":', this.mutationType === 'single');
        console.log('Mutation type === "stable":', this.mutationType === 'stable');
        
        // Test setting mutation type directly
        this.mutationType = 'stable';
        console.log('Set mutation type to "stable":', this.mutationType);
        console.log('Mutation type === "stable" after setting:', this.mutationType === 'stable');
        
        // Test with high mutation chance
        this.mutationChance = 50;
        console.log('Set mutation chance to 50%');
        
        // Run one generation
        console.log('Running one generation...');
        this.nextGeneration();
        
        // Reset
        this.mutationChance = 0;
        this.mutationType = 'single';
        console.log('Reset mutation chance and type');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new GameOfLife();
});
