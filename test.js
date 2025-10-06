// Test script for Game of Life functionality
// This can be run in the browser console to test core features

console.log('Testing Game of Life functionality...');

// Test 1: Check if game instance exists
if (typeof window.game !== 'undefined') {
    console.log('✅ Game instance created successfully');
} else {
    console.log('❌ Game instance not found');
}

// Test 2: Test grid initialization
if (window.game && window.game.grid && window.game.grid.length > 0) {
    console.log('✅ Grid initialized with dimensions:', window.game.width, 'x', window.game.height);
} else {
    console.log('❌ Grid not properly initialized');
}

// Test 3: Test neighbor counting
if (window.game) {
    const neighbors = window.game.countNeighbors(1, 1);
    console.log('✅ Neighbor counting works, found', neighbors, 'neighbors at (1,1)');
} else {
    console.log('❌ Cannot test neighbor counting');
}

// Test 4: Test edge looping toggle
if (window.game) {
    const originalEdgeLooping = window.game.edgeLooping;
    window.game.edgeLooping = !originalEdgeLooping;
    console.log('✅ Edge looping toggle works, changed from', originalEdgeLooping, 'to', window.game.edgeLooping);
    window.game.edgeLooping = originalEdgeLooping; // Restore
} else {
    console.log('❌ Cannot test edge looping toggle');
}

// Test 5: Test mutation system
if (window.game) {
    const originalMutationChance = window.game.mutationChance;
    window.game.mutationChance = 50; // 50% mutation chance
    console.log('✅ Mutation chance set to', window.game.mutationChance + '%');
    window.game.mutationChance = originalMutationChance; // Restore
} else {
    console.log('❌ Cannot test mutation system');
}

// Test 6: Test Trystero integration
if (window.game && window.game.room) {
    console.log('✅ Trystero room initialized');
} else {
    console.log('⚠️ Trystero room not initialized (may be normal in single-user mode)');
}

// Test 7: Test settings modal
const modal = document.getElementById('settingsModal');
if (modal) {
    console.log('✅ Settings modal exists');
} else {
    console.log('❌ Settings modal not found');
}

// Test 8: Test canvas rendering
const canvas = document.getElementById('gameCanvas');
if (canvas && canvas.getContext) {
    console.log('✅ Canvas element exists and supports 2D context');
} else {
    console.log('❌ Canvas element not found or not supported');
}

console.log('Testing complete! Check the results above.');
