const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = {
    money: 500,
    lives: 150,
    wave: 1,
    waveInProgress: false,
    gameActive: false,
    selectedTower: null,
    deleteMode: false,
    upgradeMode: false,
    enemiesSpawned: 0,
    enemiesPerWave: 0,
    timeUntilNextWave: 5,
    waveDuration: 20,
    waveTimeLeft: 0,
    waveTimerInterval: null
};

let towers = [];
let enemies = [];
let bullets = [];
let hoveredTower = null;
let spawnInterval = null;
let nextWaveTimerInterval = null;

const pathPoints = [
    {x: 0, y: 300},
    {x: 200, y: 300},
    {x: 200, y: 500},
    {x: 600, y: 500},
    {x: 600, y: 200},
    {x: 750, y: 200}
];

class Bullet {
    constructor(x, y, target, damage, color, effect = null) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.effect = effect;
        this.speed = 8;
        this.size = 4;
        this.active = true;
    }

    update() {
        if (!this.target || this.target.health <= 0) {
            this.active = false;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            this.target.takeDamage(this.damage);
            
            if (this.effect) {
                switch(this.effect) {
                    case 'poison':
                        this.target.poisoned = true;
                        this.target.poisonDamage = this.damage * 0.3;
                        break;
                    case 'ice':
                        this.target.speed *= 0.3;
                        this.target.slowed = true;
                        setTimeout(() => {
                            if (this.target.health > 0) {
                                this.target.speed *= 3.33;
                                this.target.slowed = false;
                            }
                        }, 2000);
                        break;
                }
            }
            
            this.active = false;
        } else {
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.level = 1;
        this.lastShot = 0;
        
        const towerStats = {
            basic: { damage: 25, range: 100, cooldown: 500, color: '#3498db', cost: 50, emoji: '🔫', name: 'Обычная' },
            splash: { damage: 15, range: 120, cooldown: 800, color: '#e67e22', cost: 80, emoji: '💥', name: 'Взрывная' },
            slow: { damage: 5, range: 100, cooldown: 400, color: '#27ae60', cost: 60, emoji: '❄️', name: 'Замедляющая' },
            sniper: { damage: 60, range: 250, cooldown: 1500, color: '#8e44ad', cost: 120, emoji: '🎯', name: 'Снайпер' },
            laser: { damage: 10, range: 150, cooldown: 100, color: '#f1c40f', cost: 100, emoji: '⚡', name: 'Лазер' },
            farm: { income: 5, color: '#f39c12', cost: 90, emoji: '💰', name: 'Ферма' },
            ice: { damage: 10, range: 110, cooldown: 600, color: '#00bcd4', cost: 110, emoji: '🧊', name: 'Ледяная' },
            poison: { damage: 8, range: 120, cooldown: 700, color: '#9b59b6', cost: 130, emoji: '☠️', name: 'Ядовитая' },
            lightning: { damage: 30, range: 130, cooldown: 900, color: '#ffd700', cost: 140, emoji: '⚡', name: 'Молния' },
            missile: { damage: 50, range: 200, cooldown: 2000, color: '#e74c3c', cost: 150, emoji: '🚀', name: 'Ракетная' },
            tesla: { damage: 20, range: 140, cooldown: 500, color: '#00ffff', cost: 160, emoji: '🌀', name: 'Тесла' },
            nuclear: { damage: 100, range: 300, cooldown: 5000, color: '#ff4500', cost: 200, emoji: '☢️', name: 'Ядерная' }
        };
        
        const stats = towerStats[type];
        Object.assign(this, stats);
        
        if (type === 'farm') {
            this.income = 5;
        }
        
        this.upgradeCost = Math.floor(this.cost * 0.7);
        this.description = this.getDescription();
    }
    
    getDescription() {
        const desc = {
            basic: 'Сбалансированная башня. Хороший урон, средняя скорость.',
            splash: 'Взрывной урон по площади. Эффективна против толп врагов.',
            slow: 'Замедляет врагов при попадании. Комбо с другими башнями!',
            sniper: 'Огромный урон по одной цели. Медленная перезарядка.',
            laser: 'Очень быстрая стрельба. Малый урон, но много выстрелов.',
            farm: 'НЕ СТРЕЛЯЕТ. Даёт 5💰 каждые 10 секунд. Улучшение удваивает доход!',
            ice: 'Сильно замедляет врагов на 2 секунды. Отличный контроль.',
            poison: 'Отравляет врагов. Дополнительный урон со временем.',
            lightning: 'Цепная молния - бьёт до 3 врагов одновременно.',
            missile: 'Мощный взрыв. Большой радиус поражения.',
            tesla: 'Электрическая башня. Быстрая стрельба, средний урон.',
            nuclear: 'ЯДЕРНЫЙ ВЗРЫВ! Огромный урон по всей площади.'
        };
        return desc[this.type];
    }

    upgrade() {
        this.level++;
        if (this.type === 'farm') {
            this.income *= 2;
        } else {
            this.damage = Math.floor(this.damage * 1.5);
            this.range = Math.floor(this.range * 1.2);
            if (this.cooldown > 100) this.cooldown = Math.floor(this.cooldown * 0.9);
        }
        this.upgradeCost = Math.floor(this.upgradeCost * 1.5);
    }

    getSellPrice() {
        let basePrice = this.cost;
        for (let i = 1; i < this.level; i++) {
            basePrice = Math.floor(basePrice * 1.5);
        }
        return Math.floor(basePrice * 0.7);
    }

    canShoot(time) {
        if (this.type === 'farm') return false;
        return time - this.lastShot >= this.cooldown;
    }

    findTarget() {
        if (this.type === 'farm') return null;
        return enemies.find(e => {
            const dist = Math.hypot(e.x - this.x, e.y - this.y);
            return dist <= this.range && e.health > 0;
        });
    }

    shoot(target, time) {
        if (this.type === 'farm') return;
        this.lastShot = time;
        
        let effect = null;
        if (this.type === 'poison') effect = 'poison';
        if (this.type === 'ice') effect = 'ice';
        
        bullets.push(new Bullet(this.x, this.y, target, this.damage, this.color, effect));
        
        if (this.type === 'splash') {
            setTimeout(() => {
                enemies.forEach(e => {
                    if (Math.hypot(e.x - target.x, e.y - target.y) < 60) {
                        e.health -= this.damage * 0.5;
                    }
                });
            }, 100);
        }
        
        if (this.type === 'lightning') {
            let chainTargets = enemies.filter(e => 
                e !== target && Math.hypot(e.x - target.x, e.y - target.y) < 100
            );
            chainTargets.slice(0, 3).forEach(e => {
                e.health -= this.damage * 0.5;
            });
        }
        
        if (this.type === 'nuclear') {
            enemies.forEach(e => {
                if (Math.hypot(e.x - target.x, e.y - target.y) < 150) {
                    e.health -= this.damage * 0.3;
                }
            });
        }
    }
}

class Enemy {
    constructor(type, wave) {
        this.type = type;
        this.x = 0;
        this.y = 300;
        this.pathIndex = 0;
        this.slowed = false;
        this.poisoned = false;
        this.poisonDamage = 0;
        
        const baseStats = {
            normal: { health: 200, speed: 1.8, color: '#27ae60', size: 18, reward: 50, emoji: '👾', name: 'Обычный' },
            fast: { health: 100, speed: 3.5, color: '#f1c40f', size: 12, reward: 60, emoji: '⚡', name: 'Быстрый' },
            tank: { health: 800, speed: 0.6, color: '#c0392b', size: 24, reward: 200, emoji: '🛡️', name: 'Танк' },
            fly: { health: 150, speed: 2.5, color: '#9b59b6', size: 14, reward: 80, emoji: '🦇', name: 'Летающий' },
            boss: { health: 2000, speed: 0.4, color: '#e74c3c', size: 35, reward: 800, emoji: '👑', name: 'БОСС' },
            swarm: { health: 50, speed: 4.0, color: '#f1c40f', size: 10, reward: 25, emoji: '🐝', name: 'Рой' },
            armored: { health: 600, speed: 0.8, color: '#7f8c8d', size: 22, reward: 150, emoji: '🛡️', name: 'Бронированный' },
            healer: { health: 300, speed: 1.2, color: '#e91e63', size: 20, reward: 120, emoji: '💚', name: 'Лекарь' },
            explosive: { health: 150, speed: 2.0, color: '#ff5722', size: 16, reward: 70, emoji: '💥', name: 'Взрывной' },
            mini: { health: 80, speed: 2.8, color: '#ffc107', size: 11, reward: 35, emoji: '👾', name: 'Малыш' }
        };
        
        const base = baseStats[type];
        const waveMultiplier = 1 + (wave - 1) * 0.3;
        const bossMultiplier = type === 'boss' ? Math.pow(1.5, Math.floor(wave / 5)) : 1;
        
        this.health = Math.floor(base.health * waveMultiplier * bossMultiplier);
        this.maxHealth = this.health;
        this.baseSpeed = base.speed * (1 + (wave - 1) * 0.05); // базовая скорость
        this.speed = this.baseSpeed; // текущая скорость
        this.color = base.color;
        this.size = base.size;
        this.reward = Math.floor(base.reward * waveMultiplier);
        this.emoji = base.emoji;
        this.name = base.name;
        
        // Ярость босса
        this.rage = 1.0;
        this.maxRage = 1.5;
        this.rageIncrease = 0.02;
    }

    move() {
        if (this.poisoned) {
            this.health -= this.poisonDamage;
        }
        
        if (this.pathIndex < pathPoints.length - 1) {
            const target = pathPoints[this.pathIndex + 1];
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Используем скорость с учётом ярости
            const currentSpeed = this.speed * this.rage;
            
            if (dist < currentSpeed) {
                this.x = target.x;
                this.y = target.y;
                this.pathIndex++;
            } else {
                const angle = Math.atan2(dy, dx);
                this.x += Math.cos(angle) * currentSpeed;
                this.y += Math.sin(angle) * currentSpeed;
            }
        }
    }

    // Метод для получения урона (вызывать извне)
    takeDamage(amount) {
        this.health -= amount;
        
        // Босс злится от боли!
        if (this.type === 'boss' && this.health > 0) {
            this.rage = Math.min(this.maxRage, this.rage + this.rageIncrease);
        }
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (this.type === 'boss') {
            ctx.strokeStyle = 'gold';
            ctx.lineWidth = 3;
            ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2);
            ctx.stroke();
            
            // Показываем ярость босса (красная полоска)
            if (this.rage > 1.0) {
                const ragePercent = (this.rage - 1.0) / 0.5;
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(this.x - this.size, this.y - this.size - 15, this.size * 2 * ragePercent, 3);
            }
        }
        
        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - this.size, this.y - this.size - 10, this.size * 2, 4);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - this.size, this.y - this.size - 10, this.size * 2 * hpPercent, 4);
        
        if (this.slowed) {
            ctx.strokeStyle = 'lightblue';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        if (this.poisoned) {
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 2;
            ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function determineEnemyType(wave, index, total) {
    // Первая волна - только обычные враги
    if (wave === 1) {
        return 'normal';
    }
    
    // Босс каждые 5 волн
    if (wave % 5 === 0 && index === total - 1) {
        return 'boss';
    }
    
    const r = Math.random();
    
    // Волна 2-4: добавляются быстрые и танки
    if (wave < 5) {
        if (r < 0.5) return 'normal';
        if (r < 0.8) return 'fast';
        return 'tank';
    }
    
    // Волна 5-7: добавляются летающие
    if (wave < 8) {
        if (r < 0.3) return 'normal';
        if (r < 0.5) return 'fast';
        if (r < 0.7) return 'tank';
        return 'fly';
    }
    
    // Волна 8-10: добавляются новые враги
    if (wave < 11) {
        if (r < 0.2) return 'normal';
        if (r < 0.35) return 'fast';
        if (r < 0.45) return 'tank';
        if (r < 0.55) return 'fly';
        if (r < 0.7) return 'swarm';
        if (r < 0.8) return 'armored';
        return 'mini';
    }
    
    // Волна 11+: все типы врагов
    if (r < 0.15) return 'normal';
    if (r < 0.25) return 'fast';
    if (r < 0.35) return 'tank';
    if (r < 0.45) return 'fly';
    if (r < 0.55) return 'swarm';
    if (r < 0.65) return 'armored';
    if (r < 0.75) return 'healer';
    if (r < 0.85) return 'explosive';
    if (r < 0.95) return 'mini';
    return 'boss';
}

function isTooCloseToPath(x, y) {
    for (let i = 0; i < pathPoints.length - 1; i++) {
        const start = pathPoints[i];
        const end = pathPoints[i + 1];
        
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) continue;
        
        const t = ((x - start.x) * dx + (y - start.y) * dy) / (length * length);
        
        if (t >= 0 && t <= 1) {
            const projX = start.x + t * dx;
            const projY = start.y + t * dy;
            const dist = Math.hypot(x - projX, y - projY);
            if (dist < 40) return true;
        }
    }
    return false;
}

function startGame() {
    if (!gameState.gameActive) {
        gameState.gameActive = true;
        document.getElementById('startGame').disabled = true;
        document.getElementById('waveStatus').textContent = '⚔️ ИГРА ЗАПУЩЕНА';
        startWave();
    }
}

function restartGame() {
    if (spawnInterval) clearInterval(spawnInterval);
    if (nextWaveTimerInterval) clearInterval(nextWaveTimerInterval);
    if (gameState.waveTimerInterval) clearInterval(gameState.waveTimerInterval);
    
    gameState = {
        money: 500,
        lives: 150,
        wave: 1,
        waveInProgress: false,
        gameActive: false,
        selectedTower: null,
        deleteMode: false,
        upgradeMode: false,
        enemiesSpawned: 0,
        enemiesPerWave: 0,
        timeUntilNextWave: 5,
        waveDuration: 20,
        waveTimeLeft: 0,
        waveTimerInterval: null
    };
    
    towers = [];
    enemies = [];
    bullets = [];
    
    document.getElementById('startGame').disabled = false;
    document.getElementById('removeTower').classList.remove('active');
    document.getElementById('upgradeTower').classList.remove('active');
    document.getElementById('waveTimer').style.display = 'none';
    document.getElementById('waveDuration').style.display = 'none';
    document.getElementById('waveStatus').textContent = '⏳ ОЖИДАНИЕ ЗАПУСКА';
    document.getElementById('money').textContent = gameState.money;
    document.getElementById('lives').textContent = gameState.lives;
    document.getElementById('wave').textContent = gameState.wave;
    document.getElementById('enemyCount').textContent = '👾 0';
    
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    gameState.selectedTower = null;
    
    showNotification('🔄 ИГРА ПЕРЕЗАПУЩЕНА');
    showControlsInfo();
}

function toggleDeleteMode() {
    gameState.deleteMode = !gameState.deleteMode;
    gameState.upgradeMode = false;
    const removeBtn = document.getElementById('removeTower');
    const upgradeBtn = document.getElementById('upgradeTower');
    
    if (gameState.deleteMode) {
        removeBtn.classList.add('active');
        upgradeBtn.classList.remove('active');
        gameState.selectedTower = null;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        showNotification('🗑️ РЕЖИМ УДАЛЕНИЯ', 'warning');
    } else {
        removeBtn.classList.remove('active');
    }
}

function toggleUpgradeMode() {
    gameState.upgradeMode = !gameState.upgradeMode;
    gameState.deleteMode = false;
    const upgradeBtn = document.getElementById('upgradeTower');
    const removeBtn = document.getElementById('removeTower');
    
    if (gameState.upgradeMode) {
        upgradeBtn.classList.add('active');
        removeBtn.classList.remove('active');
        gameState.selectedTower = null;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        showNotification('⬆️ РЕЖИМ УЛУЧШЕНИЯ', 'info');
    } else {
        upgradeBtn.classList.remove('active');
    }
}

function upgradeTower(tower) {
    if (gameState.money >= tower.upgradeCost) {
        gameState.money -= tower.upgradeCost;
        tower.upgrade();
        document.getElementById('money').textContent = gameState.money;
        showNotification(`✨ ${tower.emoji} УР.${tower.level}`);
        gameState.upgradeMode = false;
        document.getElementById('upgradeTower').classList.remove('active');
    } else {
        showNotification('❌ НЕДОСТАТОЧНО ДЕНЕГ', 'error');
    }
}

function deleteTower(tower) {
    const sellPrice = tower.getSellPrice();
    gameState.money += sellPrice;
    
    const index = towers.indexOf(tower);
    if (index > -1) {
        towers.splice(index, 1);
    }
    
    document.getElementById('money').textContent = gameState.money;
    showNotification(`🗑️ ПРОДАНО ЗА ${sellPrice}💰`);
    
    gameState.deleteMode = false;
    document.getElementById('removeTower').classList.remove('active');
}

function startWave() {
    if (!gameState.waveInProgress) {
        gameState.waveInProgress = true;
        gameState.enemiesSpawned = 0;
        
        gameState.enemiesPerWave = 8 + Math.floor(gameState.wave * 2);
        gameState.waveDuration = 20 + (gameState.wave - 1) * 8;
        gameState.waveTimeLeft = gameState.waveDuration;
        
        document.getElementById('waveStatus').textContent = `⚔️ ВОЛНА ${gameState.wave} (${gameState.waveDuration}с)`;
        document.getElementById('waveTimer').style.display = 'none';
        
        showWaveDurationTimer();
        
        if (spawnInterval) clearInterval(spawnInterval);
        
        const spawnDelay = Math.max(300, 600 - gameState.wave * 10);
        
        spawnInterval = setInterval(() => {
            if (gameState.enemiesSpawned < gameState.enemiesPerWave && gameState.waveInProgress) {
                const type = determineEnemyType(gameState.wave, gameState.enemiesSpawned, gameState.enemiesPerWave);
                enemies.push(new Enemy(type, gameState.wave));
                gameState.enemiesSpawned++;
                document.getElementById('enemyCount').textContent = `👾 ${enemies.length}`;
                
                if (type === 'boss') {
                    showNotification('👑 БОСС ПОЯВИЛСЯ!', 'warning');
                }
            }
        }, spawnDelay);
        
        startWaveDurationTimer();
    }
}

function showWaveDurationTimer() {
    const waveDurationEl = document.getElementById('waveDuration');
    waveDurationEl.style.display = 'block';
    waveDurationEl.innerHTML = `⏱️ ВОЛНА: <span id="waveTimeLeft">${formatTime(gameState.waveTimeLeft)}</span> | 👾 ${enemies.length}`;
}

function startWaveDurationTimer() {
    if (gameState.waveTimerInterval) {
        clearInterval(gameState.waveTimerInterval);
    }
    
    gameState.waveTimerInterval = setInterval(() => {
        if (gameState.waveInProgress) {
            gameState.waveTimeLeft--;
            const waveTimeLeftEl = document.getElementById('waveTimeLeft');
            if (waveTimeLeftEl) {
                waveTimeLeftEl.textContent = formatTime(gameState.waveTimeLeft);
                
                const waveDurationEl = document.getElementById('waveDuration');
                if (waveDurationEl) {
                    waveDurationEl.innerHTML = `⏱️ ВОЛНА: <span id="waveTimeLeft">${formatTime(gameState.waveTimeLeft)}</span> | 👾 ${enemies.length}`;
                }
            }
            
            if (gameState.waveTimeLeft <= 0 && gameState.waveInProgress) {
                endWave();
            }
        }
    }, 1000);
}

function formatTime(seconds) {
    if (seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function endWave() {
    gameState.waveInProgress = false;
    
    if (gameState.waveTimerInterval) {
        clearInterval(gameState.waveTimerInterval);
        gameState.waveTimerInterval = null;
    }
    
    if (spawnInterval) {
        clearInterval(spawnInterval);
        spawnInterval = null;
    }
    
    const waveDurationEl = document.getElementById('waveDuration');
    waveDurationEl.style.display = 'none';
    
    // Если враги остались (время вышло) - добиваем их
    if (enemies.length > 0) {
        let bonusFromKills = 0;
        enemies.forEach(enemy => {
            bonusFromKills += Math.floor(enemy.reward * 0.5);
        });
        gameState.money += bonusFromKills;
        enemies = [];
        showNotification(`⏰ ВРЕМЯ ВЫШЛО! +${bonusFromKills}💰 за оставшихся`);
    }
    
    const waveBonus = 50 + gameState.wave * 15;
    gameState.money += waveBonus;
    gameState.wave++;
    
    document.getElementById('money').textContent = gameState.money;
    document.getElementById('wave').textContent = gameState.wave;
    document.getElementById('enemyCount').textContent = '👾 0';
    document.getElementById('waveStatus').textContent = `✅ ВОЛНА ${gameState.wave-1} ЗАВЕРШЕНА`;
    
    showNotification(`✅ ВОЛНА ПРОЙДЕНА! +${waveBonus}💰`);
    
    if (gameState.gameActive) {
        startWaveTimer();
    }
}

function startWaveTimer() {
    gameState.timeUntilNextWave = 5;
    document.getElementById('waveTimer').style.display = 'block';
    document.getElementById('timerValue').textContent = gameState.timeUntilNextWave;
    
    nextWaveTimerInterval = setInterval(() => {
        gameState.timeUntilNextWave--;
        document.getElementById('timerValue').textContent = gameState.timeUntilNextWave;
        
        if (gameState.timeUntilNextWave <= 0) {
            clearInterval(nextWaveTimerInterval);
            nextWaveTimerInterval = null;
            document.getElementById('waveTimer').style.display = 'none';
            if (gameState.gameActive && !gameState.waveInProgress) {
                startWave();
            }
        }
    }, 1000);
}

// ИНФОРМАЦИОННЫЕ ФУНКЦИИ
function showControlsInfo() {
    document.getElementById('infoContent').innerHTML = `
        <div style="background: #2c3e50; padding: 8px; border-radius: 8px; margin-bottom: 10px; text-align: center;">
            <strong style="color: #f1c40f; font-size: 16px;">🎮 УПРАВЛЕНИЕ</strong>
        </div>
        
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px; margin-bottom: 15px; font-size: 13px;">
            <span style="background: #34495e; padding: 2px 6px; border-radius: 4px;">1-9</span><span>Выбрать башни 1-9</span>
            <span style="background: #34495e; padding: 2px 6px; border-radius: 4px;">0,-,=</span><span>10-12 башни</span>
            <span style="background: #34495e; padding: 2px 6px; border-radius: 4px;">U</span><span>Режим улучшения</span>
            <span style="background: #34495e; padding: 2px 6px; border-radius: 4px;">Del</span><span>Режим удаления</span>
            <span style="background: #34495e; padding: 2px 6px; border-radius: 4px;">ESC</span><span>Отмена</span>
        </div>

        <div style="background: #2c3e50; padding: 8px; border-radius: 8px; margin-bottom: 10px;">
            <strong style="color: #f1c40f;">🏰 ОСНОВНЫЕ БАШНИ (1-6)</strong>
        </div>
        
        <div style="font-size: 12px; margin-bottom: 15px;">
            <div><span style="color: #3498db;">1. 🔫 Обычная (50💰)</span> - Сбалансированный урон</div>
            <div><span style="color: #e67e22;">2. 💥 Взрывная (80💰)</span> - Урон по площади</div>
            <div><span style="color: #27ae60;">3. ❄️ Замедляющая (60💰)</span> - Замедляет врагов</div>
            <div><span style="color: #8e44ad;">4. 🎯 Снайпер (120💰)</span> - Огромный урон</div>
            <div><span style="color: #f1c40f;">5. ⚡ Лазер (100💰)</span> - Быстрая стрельба</div>
            <div><span style="color: #f39c12;">6. 💰 Ферма (90💰)</span> - Пассивный доход</div>
        </div>

        <div style="background: #2c3e50; padding: 8px; border-radius: 8px; margin-bottom: 10px;">
            <strong style="color: #f1c40f;">⚡ НОВЫЕ БАШНИ (7-12)</strong>
        </div>
        
        <div style="font-size: 12px; margin-bottom: 15px;">
            <div><span style="color: #00bcd4;">7. 🧊 Ледяная (110💰)</span> - Сильное замедление</div>
            <div><span style="color: #9b59b6;">8. ☠️ Ядовитая (130💰)</span> - Урон со временем</div>
            <div><span style="color: #ffd700;">9. ⚡ Молния (140💰)</span> - Цепная реакция</div>
            <div><span style="color: #ff4500;">0. ☢️ Ядерная (200💰)</span> - ОГРОМНЫЙ взрыв</div>
            <div><span style="color: #00ffff;">-. 🌀 Тесла (160💰)</span> - Электричество</div>
            <div><span style="color: #e74c3c;">=. 🚀 Ракетная (150💰)</span> - Мощный взрыв</div>
        </div>

        <div style="background: #2c3e50; padding: 8px; border-radius: 8px; margin-bottom: 10px;">
            <strong style="color: #f1c40f;">👾 ВРАГИ</strong>
        </div>
        
        <div style="font-size: 12px; margin-bottom: 10px;">
            <div><span style="color: #27ae60;">👾 Обычный</span> - Средний враг (с 1 волны)</div>
            <div><span style="color: #f1c40f;">⚡ Быстрый</span> - Очень быстрый, слабый (с 2 волны)</div>
            <div><span style="color: #c0392b;">🛡️ Танк</span> - Много здоровья (с 3 волны)</div>
            <div><span style="color: #9b59b6;">🦇 Летающий</span> - Быстрый, средний (с 5 волны)</div>
            <div><span style="color: #f1c40f;">🐝 Рой</span> - Очень быстрый, слабый (с 8 волны)</div>
            <div><span style="color: #7f8c8d;">🛡️ Бронированный</span> - Много здоровья (с 8 волны)</div>
            <div><span style="color: #e91e63;">💚 Лекарь</span> - Лечит других (с 10 волны)</div>
            <div><span style="color: #ff5722;">💥 Взрывной</span> - Взрывается при смерти (с 10 волны)</div>
            <div><span style="color: #ffc107;">👾 Малыш</span> - Маленький, быстрый (с 8 волны)</div>
            <div><span style="color: #e74c3c;">👑 Босс</span> - Каждые 5 волн</div>
        </div>

        <div style="background: #2c3e50; padding: 8px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between;">
                <span>💰 Деньги:</span>
                <strong style="color: #f1c40f;">${gameState.money}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>❤️ Жизни:</span>
                <strong style="color: #e74c3c;">${gameState.lives}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>🌊 Волна:</span>
                <strong>${gameState.wave}</strong>
            </div>
        </div>
    `;
}

function showEnemyInfo(enemy) {
    document.getElementById('infoContent').innerHTML = `
        <div style="background: ${enemy.color}; padding: 10px; border-radius: 8px; text-align: center;">
            <strong style="font-size: 16px;">${enemy.emoji} ${enemy.name}</strong>
        </div>
        
        <div style="margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>❤️ Здоровье:</span>
                <strong>${Math.floor(enemy.health)}/${enemy.maxHealth}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>⚡ Скорость:</span>
                <strong>${enemy.speed.toFixed(1)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>💰 Награда:</span>
                <strong>${enemy.reward}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>🌊 Волна:</span>
                <strong>${enemy.wave}</strong>
            </div>
        </div>
    `;
}

function showTowerInfo(tower) {
    const sellPrice = tower.getSellPrice();
    const canUpgrade = gameState.money >= tower.upgradeCost;
    
    document.getElementById('infoContent').innerHTML = `
        <div style="background: ${tower.color}; padding: 10px; border-radius: 8px; text-align: center;">
            <strong style="font-size: 16px;">${tower.emoji} ${tower.name} УР.${tower.level}</strong>
        </div>
        
        <div style="margin-top: 10px;">
            ${tower.type !== 'farm' ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>💥 Урон:</span>
                    <strong>${tower.damage}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>📏 Радиус:</span>
                    <strong>${tower.range}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>⏱️ Перезарядка:</span>
                    <strong>${tower.cooldown}мс</strong>
                </div>
            ` : `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>💰 Доход:</span>
                    <strong>${tower.income}💰/10с</strong>
                </div>
            `}
            
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #4a6b8a;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>⬆️ Улучшить:</span>
                    <strong style="color: ${canUpgrade ? '#2ecc71' : '#e74c3c'};">${tower.upgradeCost}💰</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>🗑️ Продажа:</span>
                    <strong>${sellPrice}💰</strong>
                </div>
            </div>
            
            <div style="margin-top: 10px; background: #2c3e50; padding: 8px; border-radius: 8px; font-size: 12px;">
                📝 ${tower.description}
            </div>
        </div>
    `;
}

// Обработчики для 12 башен
document.querySelectorAll('.tower-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.tower;
        
        gameState.deleteMode = false;
        gameState.upgradeMode = false;
        document.getElementById('removeTower').classList.remove('active');
        document.getElementById('upgradeTower').classList.remove('active');
        
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        
        if (gameState.selectedTower === type) {
            gameState.selectedTower = null;
        } else {
            gameState.selectedTower = type;
            btn.classList.add('selected');
        }
    });
});

document.getElementById('startGame').addEventListener('click', startGame);
document.getElementById('restartGame').addEventListener('click', restartGame);
document.getElementById('removeTower').addEventListener('click', toggleDeleteMode);
document.getElementById('upgradeTower').addEventListener('click', toggleUpgradeMode);

// Горячие клавиши
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Del') {
        e.preventDefault();
        toggleDeleteMode();
    } else if (e.key === 'U' || e.key === 'u') {
        e.preventDefault();
        toggleUpgradeMode();
    } else if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        document.querySelectorAll('.tower-btn')[index]?.click();
    } else if (e.key === '0') {
        e.preventDefault();
        document.querySelectorAll('.tower-btn')[9]?.click();
    } else if (e.key === '-') {
        e.preventDefault();
        document.querySelectorAll('.tower-btn')[10]?.click();
    } else if (e.key === '=') {
        e.preventDefault();
        document.querySelectorAll('.tower-btn')[11]?.click();
    } else if (e.key === 'Escape') {
        gameState.selectedTower = null;
        gameState.deleteMode = false;
        gameState.upgradeMode = false;
        document.getElementById('removeTower').classList.remove('active');
        document.getElementById('upgradeTower').classList.remove('active');
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    }
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedTower = towers.find(t => Math.hypot(t.x - x, t.y - y) < 25);
    
    if (gameState.deleteMode && clickedTower) {
        deleteTower(clickedTower);
        return;
    }
    
    if (gameState.upgradeMode && clickedTower) {
        upgradeTower(clickedTower);
        return;
    }
    
    if (clickedTower) {
        return;
    }
    
    if (!gameState.selectedTower) {
        showNotification('ВЫБЕРИТЕ БАШНЮ!');
        return;
    }
    
    if (isTooCloseToPath(x, y)) {
        showNotification('❌ СЛИШКОМ БЛИЗКО К ДОРОГЕ', 'error');
        return;
    }
    
    if (towers.some(t => Math.hypot(t.x - x, t.y - y) < 40)) {
        showNotification('❌ МЕСТО ЗАНЯТО', 'error');
        return;
    }
    
    const costs = {
        basic: 50, splash: 80, slow: 60, sniper: 120, laser: 100, farm: 90,
        ice: 110, poison: 130, lightning: 140, missile: 150, tesla: 160, nuclear: 200
    };
    const cost = costs[gameState.selectedTower];
    
    if (gameState.money >= cost) {
        towers.push(new Tower(x, y, gameState.selectedTower));
        gameState.money -= cost;
        document.getElementById('money').textContent = gameState.money;
        showNotification('✅ БАШНЯ УСТАНОВЛЕНА');
    } else {
        showNotification('❌ НЕДОСТАТОЧНО ДЕНЕГ', 'error');
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let found = false;
    
    for (let enemy of enemies) {
        if (Math.hypot(enemy.x - x, enemy.y - y) < enemy.size) {
            showEnemyInfo(enemy);
            hoveredTower = null;
            found = true;
            break;
        }
    }
    
    if (!found) {
        for (let tower of towers) {
            if (Math.hypot(tower.x - x, tower.y - y) < 25) {
                showTowerInfo(tower);
                hoveredTower = tower;
                found = true;
                break;
            }
        }
    }
    
    if (!found) {
        showControlsInfo();
        hoveredTower = null;
    }
});

function showNotification(msg, type = 'success') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = msg;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 2000);
}

// Фермы дают доход
setInterval(() => {
    let income = 0;
    towers.forEach(t => {
        if (t.type === 'farm') income += t.income;
    });
    if (income > 0) {
        gameState.money += income;
        document.getElementById('money').textContent = gameState.money;
        showNotification(`💰 ФЕРМЫ: +${income}💰`);
    }
}, 10000);

function gameLoop(time) {
    bullets = bullets.filter(b => {
        b.update();
        return b.active;
    });
    
    if (gameState.waveInProgress) {
        enemies.forEach((enemy, i) => {
            enemy.move();
            
            if (enemy.x >= 750 && enemy.y >= 200) {
                enemies.splice(i, 1);
                gameState.lives -= enemy.type === 'boss' ? 80 : 30;
                document.getElementById('lives').textContent = gameState.lives;
                
                if (gameState.lives <= 0) {
                    showNotification('💀 GAME OVER', 'error');
                    restartGame();
                }
            }
        });
        
        towers.forEach(t => {
            if (t.canShoot(time)) {
                const target = t.findTarget();
                if (target) t.shoot(target, time);
            }
        });
        
        let earned = 0;
        enemies = enemies.filter(e => {
            if (e.health <= 0) {
                earned += e.reward;
                return false;
            }
            return true;
        });
        
        if (earned > 0) {
            gameState.money += earned;
            document.getElementById('money').textContent = gameState.money;
        }
        
        document.getElementById('enemyCount').textContent = `👾 ${enemies.length}`;
        
        // ВАЖНО: Если всех врагов убили И всех заспавнили - сразу конец волны
        if (gameState.enemiesSpawned >= gameState.enemiesPerWave && enemies.length === 0) {
            endWave();
        }
    }
    
    ctx.clearRect(0, 0, 800, 600);
    
    ctx.beginPath();
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 30;
    ctx.moveTo(0, 300);
    ctx.lineTo(200, 300);
    ctx.lineTo(200, 500);
    ctx.lineTo(600, 500);
    ctx.lineTo(600, 200);
    ctx.lineTo(750, 200);
    ctx.stroke();
    
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    towers.forEach(t => {
        if (hoveredTower === t) {
            ctx.beginPath();
            ctx.strokeStyle = gameState.deleteMode ? '#e74c3c' : (gameState.upgradeMode ? '#2ecc71' : 'white');
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.arc(t.x, t.y, t.range || 50, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.beginPath();
        ctx.fillStyle = t.color;
        ctx.arc(t.x, t.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = gameState.deleteMode && hoveredTower === t ? '#e74c3c' : 
                         (gameState.upgradeMode && hoveredTower === t ? '#2ecc71' : 'white');
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.level, t.x, t.y);
    });
    
    bullets.forEach(b => b.draw());
    enemies.forEach(e => e.draw());
    
    requestAnimationFrame(gameLoop);
}

// Показываем информацию при старте
showControlsInfo();
requestAnimationFrame(gameLoop);