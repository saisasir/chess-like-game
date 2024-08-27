const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let gameState = initializeGameState();
let currentPlayer = 'A';

function initializeGameState() {
    return {
        A: ['A-P1', 'A-H1', 'A-H2', 'A-H3', 'A-P2'],
        B: ['B-P1', 'B-H1', 'B-H2', 'B-H3', 'B-P2'],
        board: Array(5).fill().map(() => Array(5).fill(null)),
    };
}

function setupBoard(state) {
    for (let i = 0; i < 5; i++) {
        state.board[0][i] = state.A[i];
        state.board[4][i] = state.B[i];
    }
}

setupBoard(gameState);

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);
        handlePlayerMove(parsedMessage, ws);
    });

    ws.send(JSON.stringify({
        type: 'init',
        state: gameState,
        currentPlayer: currentPlayer,
    }));
});

function handlePlayerMove(message, ws) {
    const { player, character, move } = message;

    if (player !== currentPlayer) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not your turn!' }));
        return;
    }

    const validMove = validateMove(player, character, move);

    if (validMove) {
        applyMove(player, character, move);
        currentPlayer = currentPlayer === 'A' ? 'B' : 'A';
        broadcastGameState();
    } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid move!' }));
    }
}

function validateMove(player, character, move) {
    const characterPosition = findCharacterPosition(character);
    if (!characterPosition) return false; // Character not found

    const [row, col] = characterPosition;

    let newRow = row;
    let newCol = col;

    // Calculate new position based on move
    switch (move) {
        case 'L': newCol -= 1; break;
        case 'R': newCol += 1; break;
        case 'F': newRow -= 1; break;
        case 'B': newRow += 1; break;
        // Add additional cases for diagonal moves, Hero1, Hero2, etc.
        default: return false;
    }

    // Check boundaries
    if (newRow < 0 || newRow >= 5 || newCol < 0 || newCol >= 5) {
        return false; // Move out of bounds
    }

    // Check if the move is onto a friendly character
    const targetPosition = gameState.board[newRow][newCol];
    if (targetPosition && targetPosition[0] === player) {
        return false; // Can't move onto a friendly piece
    }

    return true; // Move is valid
}

function findCharacterPosition(character) {
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            if (gameState.board[row][col] === character) {
                return [row, col];
            }
        }
    }
    return null;
}

function applyMove(player, character, move) {
    const [row, col] = findCharacterPosition(character);
    let newRow = row;
    let newCol = col;

    // Calculate new position based on move
    switch (move) {
        case 'L': newCol -= 1; break;
        case 'R': newCol += 1; break;
        case 'F': newRow -= 1; break;
        case 'B': newRow += 1; break;
    }

    // If the target position has an opponent's piece, capture it
    const targetPosition = gameState.board[newRow][newCol];
    if (targetPosition && targetPosition[0] !== player) {
        // Capture the opponent's piece
        gameState.board[newRow][newCol] = null;
    }

    // Move the character to the new position
    gameState.board[row][col] = null;
    gameState.board[newRow][newCol] = character;
}

function broadcastGameState() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'update',
                state: gameState,
                currentPlayer: currentPlayer,
            }));
        }
    });
}

server.listen(3000, () => {
    console.log('Server started on port 3000');
});
