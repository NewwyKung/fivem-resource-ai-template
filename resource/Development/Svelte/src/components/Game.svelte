<script>
    import { onMount, onDestroy } from "svelte";

    // Constants
    const defaultPlayerX = 150;
    const runSpeed = 8;
    const fadeDuration = 1000; // ms

    // Game state
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Configuration
    let baseYPercent = window.Config?.baseYPosition ?? 0.7;
    let playerScale = window.Config?.playerScale ?? 1.0;
    let enemyScale = window.Config?.enemyScale ?? 2.5;
    let enemyHitboxMultiplier = window.Config?.enemyHitboxMultiplier ?? 3.5;
    let flipEnemy = window.Config?.flipEnemy ?? true;

    // Speed & Timing Configs
    let playerShootRate = window.Config?.playerShootRate ?? 35;
    let playerAnimSpeed = window.Config?.playerAnimSpeed ?? 6;
    let enemyAnimSpeed = window.Config?.enemyAnimSpeed ?? 6;
    let enemyMoveSpeedMin = window.Config?.enemyMoveSpeedMin ?? 2.0;
    let enemyMoveSpeedMax = window.Config?.enemyMoveSpeedMax ?? 4.0;

    // Weapon Configs
    let bulletOffsetX = window.Config?.bulletOffsetX ?? 10;
    let bulletOffsetY = window.Config?.bulletOffsetY ?? 10;

    // Y positions and depth
    let baseY = height * baseYPercent;
    let player = {
        x: defaultPlayerX,
        y: baseY,
        width: 60,
        height: 60,
        color: "#2c3e50",
        zIndex: 10,
    };
    let enemies = [];
    let bullets = [];

    let frame = 0;
    let animationId;

    // Scene state
    let bgImages = window.Config?.backgroundImages ||
        window.Config?.backgroundVideos || ["./assets/bg.png"];
    let bgShuffleBag = [];
    let currentBgUrl = "";
    let lastScene = "";

    // Enemy & Player Animation Frames
    const enemyRunFrames = Array.from({ length: 9 }).map(
        (_, i) => `./assets/characters/black_guy/run/frame_00${i}.png`,
    );
    const playerRunFrames = Array.from({ length: 9 }).map(
        (_, i) => `./assets/characters/penguin/run/frame_00${i}.png`,
    );
    const playerStandFrame = `./assets/characters/penguin/stand/frame_01.png`;

    // Gameplay progression state
    let gamePhase = "PLAYING"; // PLAYING, RUNNING_OFFSCREEN, FADING, RUNNING_ONSCREEN
    let enemiesKilled = 0;
    let targetKills = getRandomInt(8, 13);
    let isFading = false;
    let fadeOpacity = 0;
    let whiteFlashOpacity = 0;
    let globalOpacity = 1;
    let isShuttingDown = false;
    let nextSpawnFrame = 0;
    let burstRemaining = 0;
    let burstDelay = 0;
    let loadProgress = 0;

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getRandomBg() {
        if (bgImages.length === 0) return "";
        if (bgImages.length === 1) return bgImages[0];

        if (bgShuffleBag.length === 0) {
            bgShuffleBag = [...bgImages].filter((v) => v !== lastScene);
            // Shuffle
            for (let i = bgShuffleBag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bgShuffleBag[i], bgShuffleBag[j]] = [
                    bgShuffleBag[j],
                    bgShuffleBag[i],
                ];
            }
        }

        let selectedBg = bgShuffleBag.pop();
        lastScene = selectedBg;
        return selectedBg;
    }

    function spawnEnemy() {
        const groupSize = getRandomInt(1, 3);
        const newEnemies = [];

        for (let i = 0; i < groupSize; i++) {
            newEnemies.push({
                id: Math.random().toString(36).substr(2, 9),
                x: width + 50 + i * 60,
                y: baseY,
                width: 60,
                height: 60,
                color: "transparent",
                speed:
                    enemyMoveSpeedMin +
                    Math.random() * (enemyMoveSpeedMax - enemyMoveSpeedMin),
                zIndex: 10,
                hp: 3,
                hitFrames: 0,
            });
        }

        enemies = [...enemies, ...newEnemies];

        // Schedule next spawn randomly between 60 and 150 frames (1-2.5 seconds at 60fps)
        nextSpawnFrame = frame + getRandomInt(60, 150);
    }

    function shootBullet() {
        bullets = [
            ...bullets,
            {
                id: Math.random().toString(36).substr(2, 9),
                x: player.x + player.width + bulletOffsetX,
                y:
                    player.y +
                    player.height / 2 -
                    5 +
                    bulletOffsetY +
                    (Math.random() - 0.5) * 20, // Randomize spawn Y slightly
                width: 20,
                height: 10,
                color: "#f1c40f",
                speedX: 12,
                speedY: 0, // No Y movement after spawn
                zIndex: player.zIndex,
            },
        ];
    }

    function isColliding(bullet, enemy) {
        // Calculate true hitbox based on multiplier and bottom-center transform origin
        let hw = enemy.width * enemyHitboxMultiplier;
        let hh = enemy.height * enemyHitboxMultiplier;

        let ex = enemy.x + enemy.width / 2 - hw / 2; // Center X
        let ey = enemy.y + enemy.height - hh; // Bottom Y

        return (
            bullet.x < ex + hw &&
            bullet.x + bullet.width > ex &&
            bullet.y < ey + hh &&
            bullet.y + bullet.height > ey
        );
    }

    function startFadeTransition() {
        gamePhase = "FADING";
        isFading = true;
        fadeOpacity = 1;

        setTimeout(() => {
            // Mid-fade (screen is black)
            currentBgUrl = getRandomBg();
            player.x = -player.width - 50; // Move to far left

            // Start fading back in
            fadeOpacity = 0;

            setTimeout(() => {
                isFading = false;
                gamePhase = "RUNNING_ONSCREEN";
            }, fadeDuration); // Wait for fade-in to complete
        }, fadeDuration); // Wait for fade-out to complete
    }

    function startShutdown() {
        if (isShuttingDown) return;
        isShuttingDown = true;

        // 1. Flash to white
        whiteFlashOpacity = 1;

        // 2. After flash, fade out the whole screen
        setTimeout(() => {
            globalOpacity = 0;

            // 3. After fade out, stop everything to save resources
            setTimeout(() => {
                cancelAnimationFrame(animationId);
                if (window.fakeLoadInterval) {
                    clearInterval(window.fakeLoadInterval);
                }
            }, 1000);
        }, 500); // 500ms white flash duration
    }

    function gameLoop() {
        if (isShuttingDown && globalOpacity === 0) return; // Stop processing logic completely if fully faded

        frame++;

        // Phase specific logic
        if (gamePhase === "PLAYING") {
            if (frame >= nextSpawnFrame && enemiesKilled < targetKills) {
                spawnEnemy();
            }
            if (frame % playerShootRate === 0 && burstRemaining === 0) {
                burstRemaining = getRandomInt(1, 3); // Random burst size
            }

            if (burstRemaining > 0) {
                if (burstDelay <= 0) {
                    shootBullet();
                    burstRemaining--;
                    burstDelay = 5; // Frames between burst shots
                } else {
                    burstDelay--;
                }
            }

            if (enemiesKilled >= targetKills && enemies.length === 0) {
                gamePhase = "RUNNING_OFFSCREEN";
            }
        } else if (gamePhase === "RUNNING_OFFSCREEN") {
            player.x += runSpeed;
            if (player.x > width + 100) {
                startFadeTransition();
            }
        } else if (gamePhase === "RUNNING_ONSCREEN") {
            player.x += runSpeed;
            if (player.x >= defaultPlayerX) {
                player.x = defaultPlayerX;
                gamePhase = "PLAYING";
                enemiesKilled = 0;
                targetKills = getRandomInt(8, 13);
            }
        }

        // Update positions (Bullets)
        let nextBullets = [];
        bullets.forEach((bullet) => {
            bullet.x += bullet.speedX;
            bullet.y += bullet.speedY; // Apply vertical spread
            if (bullet.x < width) {
                nextBullets.push(bullet);
            }
        });

        // Update positions (Enemies)
        let nextEnemies = [];
        enemies.forEach((enemy) => {
            enemy.x -= enemy.speed;
            if (enemy.x + enemy.width > -50) {
                // Keep slightly offscreen left before despawning
                nextEnemies.push(enemy);
            }
        });

        // Collision detection (only if playing)
        if (gamePhase === "PLAYING") {
            for (let i = nextBullets.length - 1; i >= 0; i--) {
                let hit = false;
                for (let j = nextEnemies.length - 1; j >= 0; j--) {
                    if (isColliding(nextBullets[i], nextEnemies[j])) {
                        nextEnemies[j].hp -= 1;
                        nextEnemies[j].hitFrames = 5; // Flash for 5 frames

                        if (nextEnemies[j].hp <= 0) {
                            nextEnemies.splice(j, 1);
                            enemiesKilled++;
                        }

                        hit = true;
                        break;
                    }
                }
                if (hit) {
                    nextBullets.splice(i, 1);
                }
            }
        }

        // Handle hit flashing
        nextEnemies.forEach((enemy) => {
            if (enemy.hitFrames > 0) enemy.hitFrames--;
        });

        bullets = nextBullets;
        enemies = nextEnemies;

        animationId = requestAnimationFrame(gameLoop);
    }

    function handleResize() {
        width = window.innerWidth;
        height = window.innerHeight;
        baseY = height * baseYPercent;
        player.y = baseY;
        player.zIndex = 10;
    }

    onMount(() => {
        window.addEventListener("resize", handleResize);

        // Listen for FiveM loadProgress event
        window.addEventListener("message", (e) => {
            if (e.data.eventName === "loadProgress") {
                loadProgress = e.data.loadFraction * 100;
            }
            if (
                e.data.eventName === "closeLoadingScreen" ||
                e.data.action === "closeLoadingScreen"
            ) {
                startShutdown();
            }
        });

        // Expose globally for testing via browser console
        window.closeLoadingScreen = startShutdown;

        // Fake loading for preview if not in FiveM
        if (!window.invokeNative) {
            window.fakeLoadInterval = setInterval(() => {
                if (loadProgress < 100) {
                    loadProgress += 0.02;
                } else {
                    clearInterval(window.fakeLoadInterval);
                    // Automatically trigger shutdown when fake load finishes for preview purposes
                    setTimeout(startShutdown, 1000);
                }
            }, 30);
        }

        currentBgUrl = getRandomBg();
        nextSpawnFrame = getRandomInt(60, 150);

        animationId = requestAnimationFrame(gameLoop);
    });

    onDestroy(() => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animationId);
    });
</script>

<div
    class="game-container"
    style="opacity: {globalOpacity}; transition: opacity 1s ease-in-out;"
>
    <!-- Background Image -->
    {#key currentBgUrl}
        <img class="bg-image" src={currentBgUrl} alt="background" />
    {/key}

    <!-- Dark overlay -->
    <div class="overlay"></div>

    <!-- Player (Penguin) -->
    <div
        class="entity player"
        style="left: {player.x}px; top: {player.y}px; width: {player.width}px; height: {player.height}px; background-image: url('{gamePhase ===
        'PLAYING'
            ? playerStandFrame
            : playerRunFrames[
                  Math.floor(frame / playerAnimSpeed) % playerRunFrames.length
              ]}'); background-size: contain; background-repeat: no-repeat; background-position: bottom; z-index: {player.zIndex}; transform: scale({playerScale}); transform-origin: bottom center;"
    ></div>

    <!-- Enemies (Men in black) -->
    {#each enemies as enemy (enemy.id)}
        <div
            class="entity enemy"
            style="left: {enemy.x}px; top: {enemy.y}px; width: {enemy.width}px; height: {enemy.height}px; z-index: {enemy.zIndex}; background-image: url('{enemyRunFrames[
                Math.floor(frame / enemyAnimSpeed) % enemyRunFrames.length
            ]}'); background-size: contain; background-repeat: no-repeat; background-position: bottom; transform: scale({flipEnemy
                ? -enemyScale
                : enemyScale}, {enemyScale}); transform-origin: bottom center; filter: {enemy.hitFrames >
            0
                ? 'brightness(100)'
                : 'none'};"
        ></div>
    {/each}

    <!-- Bullets -->
    {#each bullets as bullet (bullet.id)}
        <div
            class="entity bullet"
            style="left: {bullet.x}px; top: {bullet.y}px; width: {bullet.width}px; height: {bullet.height}px; background-color: {bullet.color}; z-index: {bullet.zIndex};"
        ></div>
    {/each}

    <!-- Fade Overlay (Scene transition) -->
    <div
        class="fade-overlay"
        style="opacity: {fadeOpacity}; transition: opacity {fadeDuration}ms ease-in-out; pointer-events: {isFading
            ? 'auto'
            : 'none'}; background-color: #000;"
    ></div>

    <!-- White Flash Overlay (Shutdown) -->
    <div
        class="fade-overlay"
        style="opacity: {whiteFlashOpacity}; transition: opacity 500ms ease-in-out; pointer-events: none; background-color: #fff; z-index: 10001;"
    ></div>

    <!-- Progress Bar -->
    <div class="progress-container">
        <div class="progress-bar" style="width: {loadProgress}%;">
            <!-- Fast running player at the tip of the progress bar -->
            <div
                class="progress-player"
                style="background-image: url('{playerRunFrames[
                    Math.floor(frame / 3) % playerRunFrames.length
                ]}');"
            ></div>
        </div>
    </div>
</div>

<style>
    .game-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background-color: #111;
    }

    .bg-image {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 1;
    }

    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.4);
        z-index: 2;
    }

    .fade-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
    }

    .entity {
        position: absolute;
        border-radius: 4px;
        /* Note: z-index is set inline per entity based on Y position */
    }

    .player {
        /* Removed box-shadow so it doesn't show a square behind the sprite */
    }

    .enemy {
        /* Removed box-shadow so it doesn't show a square behind the sprite */
    }

    .bullet {
        border-radius: 2px;
        box-shadow: 0 0 8px rgba(241, 196, 15, 0.8);
    }

    .ui-stats {
        position: absolute;
        top: 20px;
        left: 20px;
        color: white;
        z-index: 10000;
        font-family: monospace;
        font-size: 1.2rem;
        text-shadow: 2px 2px 2px black;
    }

    .progress-container {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 6px;
        background-color: rgba(255, 255, 255, 0.2);
        z-index: 10000;
    }

    .progress-bar {
        height: 100%;
        background-color: #f1c40f; /* Yellow matching bullets */
        position: relative;
        /* Don't use css transition for width if it updates every frame, but fine for slight smoothing */
    }

    .progress-player {
        position: absolute;
        right: -15px; /* Offset to center the player exactly at the tip */
        bottom: 6px; /* Feet touching the top of the bar */
        width: 30px;
        height: 30px;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: bottom center;
        /* Flips the sprite horizontally if needed, or leave as is if facing right */
    }
</style>
