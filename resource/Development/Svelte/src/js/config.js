// Loading Screen Configuration
window.Config = {
    // Array of background images to loop through randomly without repeating.
    // Ensure you place these files in the public/assets/ folder.
    backgroundImages: [
        './assets/bg/bg1.png',
        './assets/bg/bg2.png',
        './assets/bg/bg3.png',
        './assets/bg/bg4.png',
        './assets/bg/bg5.png',
    ],

    // Character Settings
    playerScale: 4.4,         // Size multiplier for the player
    enemyScale: 4.5,          // Size multiplier for the enemy
    enemyHitboxMultiplier: 3.5, // Hitbox size multiplier for enemies (so bullets hit them accurately)
    flipEnemy: true,          // Whether to flip the enemy horizontally
    baseYPosition: 0.93,      // The ground level (0.0 is top of screen, 1.0 is bottom)

    // Weapon Settings
    bulletOffsetX: 60,        // Adjust X position of spawning bullets (to match gun barrel)
    bulletOffsetY: -80,        // Adjust Y position of spawning bullets

    // Speed & Timing Settings (Based on 60 FPS)
    playerShootRate: 35,      // How many frames between each shot (lower = faster shooting)
    playerAnimSpeed: 3,       // How many frames per animation frame (lower = faster running animation)
    enemyAnimSpeed: 6,        // How many frames per animation frame (lower = faster running animation)
    enemyMoveSpeedMin: 2.0,   // Minimum walking speed of enemies
    enemyMoveSpeedMax: 4.0    // Maximum walking speed of enemies
};
