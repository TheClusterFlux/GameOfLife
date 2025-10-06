# Game of Life - Multiplayer Website

A real-time multiplayer implementation of Conway's Game of Life using Trystero for peer-to-peer synchronization. The game continues running even when browsers are closed, and all connected users see the same evolving grid.

## Features

- **Real-time Multiplayer**: Uses Trystero for P2P communication
- **Persistent Updates**: Grid continues evolving even when website is closed
- **Configurable Settings**: Adjust grid size, update frequency, mutation chance, and edge behavior
- **Spacebar Restart**: Press spacebar to restart with new settings
- **Edge Looping Toggle**: Choose between wrapping edges or dead edges
- **Multiple Patterns**: Start with random, glider, oscillator, or empty patterns
- **Docker Ready**: Easy deployment to Kubernetes clusters

## Quick Start

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser to `http://localhost:3000`

### Docker Deployment

1. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

2. Or build and run manually:
   ```bash
   docker build -t game-of-life .
   docker run -p 3000:3000 game-of-life
   ```

## Controls

- **Spacebar**: Open settings dialog to restart with new parameters
- **Settings Dialog**: Configure all game parameters before starting

## Settings

- **Grid Size**: Width and height of the game grid (10-200 cells)
- **Update Frequency**: Time between generations in seconds (0.05-5s)
- **Mutation Chance**: Probability of random cell mutations (0-100%)
- **Edge Looping**: Whether edges wrap around or are considered dead
- **Initial Pattern**: Starting configuration (random, glider, oscillator, empty)

## Technical Details

### Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript with Canvas API
- **Backend**: Express.js static file server
- **P2P Communication**: Trystero for real-time synchronization
- **Containerization**: Docker with health checks

### Trystero Integration

The game uses Trystero to create a peer-to-peer network where:
- All connected clients share the same game state
- State updates are broadcast to all peers
- Settings changes are synchronized across all clients
- The game continues running even when browsers are closed

### Game Logic

- Implements Conway's Game of Life rules
- Supports configurable edge behavior (looping vs dead edges)
- Includes mutation system for random cell changes
- Optimized rendering for large grids

## Deployment

### Kubernetes

The Docker container is ready for Kubernetes deployment. Use the provided `docker-compose.yml` as a reference for Kubernetes manifests.

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (production/development)

## Development

### Project Structure

```
/
├── index.html          # Main HTML file
├── style.css           # Styling
├── game.js            # Game logic and Trystero integration
├── server.js          # Express server
├── package.json       # Dependencies
├── Dockerfile         # Container configuration
├── docker-compose.yml # Docker Compose setup
└── README.md          # This file
```

### Testing

The game includes several test patterns:
- **Random**: Randomly distributed living cells
- **Glider**: Classic moving pattern
- **Oscillator**: Blinking pattern
- **Empty**: Clean slate

## Browser Compatibility

- Modern browsers with WebRTC support
- Canvas API support required
- ES6+ JavaScript features used

## License

MIT License - feel free to use and modify as needed.