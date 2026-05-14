// ========== 文明火种 H5 - 第二阶段：科技树8节点 ==========
// 核心游戏引擎
// 建筑系统模块已解耦至 js/modules/（全局挂载，无需 require）

const Game = {
    // --- 建筑配置（硬编码，后续可改为 fetch 加载 shared/buildingConfig.json）---
    buildingConfig: {
        version: '1.0',
        buildings: {
            farm: {
                id: 'farm', name: '农田', category: 'production',
                 unlockEra: 0, 
                effects: { perBuilding: { foodOutputMultiplier: 0.5 } },
                ui: { icon: '🚜', color: '#27ae60', description: '每座提升食物产出' }
            },
            house: {
                id: 'house', name: '民居', category: 'housing',
                 unlockEra: 0, 
                effects: { perBuilding: { maxPopulation: 3, happiness: 5 } },
                ui: { icon: '🏠', color: '#e67e22', description: '增加人口上限' }
            },
            workshop: {
                id: 'workshop', name: '工坊', category: 'production',
                 unlockEra: 1, 
                effects: { perBuilding: { craftsmanOutputMultiplier: 0.5 } },
                ui: { icon: '⚒️', color: '#7f8c8d', description: '每座提升工匠产出' }
            },
            academy: {
                id: 'academy', name: '学院', category: 'research',
                 unlockEra: 0, 
                effects: { perBuilding: { scholarOutputMultiplier: 0.5 } },
                ui: { icon: '🏛️', color: '#9b59b6', description: '每座提升学者产出' }
            },
            barracks: {
                id: 'barracks', name: '兵营', category: 'military',
                 unlockEra: 2, 
                effects: { perBuilding: { defense: 1 } },
                ui: { icon: '⚔️', color: '#c0392b', description: '提供防御能力' }
            },
            temple: {
                id: 'temple', name: '神庙', category: 'special',
                 unlockEra: 3, 
                effects: { perBuilding: { offlineEfficiency: 0.05 } },
                ui: { icon: '⛪', color: '#f39c12', description: '提升离线收益效率' }
            }
        },
        categories: {
            production: { label: '生产', order: 1 },
            housing: { label: '居住', order: 2 },
            research: { label: '科研', order: 3 },
            military: { label: '军事', order: 4 },
            special: { label: '特殊', order: 5 }
        }
    },
    // --- 游戏状态 ---
    state: {
        food: 100,
        knowledge: 0,
        totalPop: 3,
        maxPop: 5,
        farmers: 3,
        scholars: 0,
        craftsmen: 0,
        population: {
            total: 3,
            max: 5,
            farmers: 3,
            scholars: 0,
            craftsmen: 0,
            unassigned: 0,
            growthProgress: 0
        },
        // 建筑对象（后端同步）
        // 建筑对象（新模块 BuildingManager 使用）
        buildings: {
            farm: 0,
            house: 1,
            workshop: 0,
            academy: 0,
            barracks: 0,
            temple: 0
        },
        happiness: 100,
        era: 0,
        day: 1,
        lastSave: Date.now(),
        startTime: Date.now(),
        tickCounter: 0,
        currentTab: 'resources',
        // 科技状态
        techState: {},
        activeResearch: null,
        // 事件状态
        eventState: {
            pendingEvents: [],
            eventHistory: [],
            lastEventTime: 0,
            eventCooldowns: {},
            negativeStreak: 0
        }
    },

    // --- 配置常量 ---
    config: {
        foodPerFarmer: 2,
        knowledgePerScholar: 1,
        knowledgePerCraftsman: 1,
        farmBonusPerLevel: 20,
        eraThreshold: 1000,
        maxOfflineHours: 8,
        offlineEfficiencyBase: 0.5,
        // 人口增长由服务端驱动，前端不配置
    },

    // --- 建筑系统（已由新模块接管）---
    buildingAPI: null,
    buildingManager: null,
    buildingRenderer: null,

    // --- 科技树数据 ---
    techs: {
        fireMaking: {
            id: 'fireMaking',
            name: '钻木取火',
            icon: '🔥',
            cost: 30,
            era: 0,
            prereq: null,
            effect: '农民食物产出+20%',
            apply: () => { Game.config.foodPerFarmer *= 1.2; }
        },
        writing: {
            id: 'writing',
            name: '文字',
            icon: '📜',
            cost: 50,
            era: 0,
            prereq: 'fireMaking',
            effect: '学者产出+20%',
            apply: () => { /* 学者加成由 calculateMultipliers 动态计算 */ }
        },
        agriculture: {
            id: 'agriculture',
            name: '农业',
            icon: '🌾',
            cost: 80,
            era: 0,
            prereq: 'writing',
            effect: '农田产出+30%',
            apply: () => { Game.config.farmBonusPerLevel = 30; }
        },
        animalHusbandry: {
            id: 'animalHusbandry',
            name: '畜牧',
            icon: '🐄',
            cost: 120,
            era: 1,
            prereq: 'agriculture',
            effect: '人口增长速度+30%',
            apply: () => { } // 人口增长由服务端驱动
        },
        metallurgy: {
            id: 'metallurgy',
            name: '冶金',
            icon: '⚒️',
            cost: 200,
            era: 1,
            prereq: 'animalHusbandry',
            effect: '工匠产出+25%',
            apply: () => { Game.config.knowledgePerCraftsman *= 1.25; }
        },
        calligraphy: {
            id: 'calligraphy',
            name: '书写法',
            icon: '✍️',
            cost: 250,
            era: 2,
            prereq: 'metallurgy',
            effect: '全局知识产出+15%',
            apply: () => { /* 全局加成由 calculateMultipliers 动态计算 */ }
        },
        potteryWheel: {
            id: 'potteryWheel',
            name: '陶轮',
            icon: '🏺',
            cost: 300,
            era: 2,
            prereq: 'calligraphy',
            effect: '工坊产出+20%',
            apply: () => { /* 工坊加成由 calculateMultipliers 动态计算 */ }
        },
        irrigation: {
            id: 'irrigation',
            name: '灌溉',
            icon: '💧',
            cost: 500,
            era: 2,
            prereq: 'potteryWheel',
            effect: '农田产出额外+20%',
            apply: () => { /* 农田加成由 calculateMultipliers 动态计算 */ }
        },
        bronze: {
            id: 'bronze',
            name: '青铜器',
            icon: '🥉',
            cost: 800,
            era: 2,
            prereq: 'irrigation',
            effect: '金属相关产出+30%',
            apply: () => { /* 金属加成由 calculateMultipliers 动态计算 */ }
        },
        iron: {
            id: 'iron',
            name: '铁器',
            icon: '⚔️',
            cost: 1200,
            era: 3,
            prereq: 'bronze',
            effect: '军事力量+30%',
            apply: () => { /* 军事加成由 calculateMultipliers 动态计算 */ }
        },
        geometry: {
            id: 'geometry',
            name: '几何',
            icon: '📐',
            cost: 1500,
            era: 3,
            prereq: 'iron',
            effect: '学院加成+30%',
            apply: () => { /* 学院加成由 calculateMultipliers 动态计算 */ }
        },
        philosophy: {
            id: 'philosophy',
            name: '哲学',
            icon: '🏛️',
            cost: 2000,
            era: 3,
            prereq: 'geometry',
            effect: '全局知识产出+25%',
            apply: () => { /* 全局加成由 calculateMultipliers 动态计算 */ }
        }
    },

    // --- 事件数据 ---
    events: {
        harvest: {
            id: 'harvest',
            type: 'positive',
            emoji: '🌾',
            title: '大地回馈',
            desc: '今年风调雨顺，农田获得了超出预期的大丰收！村民们兴高采烈地讨论着如何分配这些意外之财。',
            optionA: {
                label: '🛡️ 储备粮食',
                effects: { food: 200, happiness: 5 },
                desc: '+200食物，幸福度+5%'
            },
            optionB: {
                label: '🎉 举办庆典',
                effects: { food: -150, happiness: 20 },
                desc: '幸福度+20%，消耗150食物'
            }
        },
        famine: {
            id: 'famine',
            type: 'negative',
            emoji: '🌾',
            title: '粮食危机',
            desc: '干旱让土地龟裂，存粮急剧减少。村民们面露忧色，长老召集紧急议事。',
            optionA: {
                label: '🛡️ 紧缩配给',
                effects: { happiness: -10 },
                desc: '幸福度-10%，食物消耗减半30秒'
            },
            optionB: {
                label: '🔍 外出觅食',
                effects: {},
                desc: '50%概率+100食物，50%概率损失1人口'
            }
        },
        beastAttack: {
            id: 'beastAttack',
            type: 'negative',
            emoji: '🐺',
            title: '野兽来袭！',
            desc: '夜幕降临时，狼群悄然逼近村庄边缘。尖叫声和嗥叫声交织在一起。',
            optionA: {
                label: '🛡️ 加固防御',
                effects: { food: -50 },
                desc: '消耗50食物，安全度过'
            },
            optionB: {
                label: '⚔️ 主动出击',
                effects: {},
                desc: '30%概率捕获野兽+100食物，70%概率损失1人口'
            }
        },
        ruins: {
            id: 'ruins',
            type: 'positive',
            emoji: '🏛️',
            title: '古老的遗迹',
            desc: '狩猎队在森林深处发现了一处被藤蔓覆盖的古老遗迹，散发着神秘的光芒。',
            optionA: {
                label: '🔬 仔细研究',
                effects: { knowledge: 150 },
                desc: '+150知识，研发速度+10%持续2分钟'
            },
            optionB: {
                label: '⛏️ 挖掘宝藏',
                effects: {},
                desc: '50%概率+50食物+50知识，50%概率陷阱-20%幸福度'
            }
        },
        visitors: {
            id: 'visitors',
            type: 'positive',
            emoji: '👥',
            title: '远方的旅人',
            desc: '一支疲惫的商队从远方而来，他们带来了外界的消息和物资交换的请求。',
            optionA: {
                label: '🤝 热情款待',
                effects: { food: -80, totalPop: 2, happiness: 10 },
                desc: '消耗80食物，+2人口，幸福度+10%'
            },
            optionB: {
                label: '🚪 保持距离',
                effects: {},
                desc: '无消耗，无收益'
            }
        },
        celestial: {
            id: 'celestial',
            type: 'positive',
            emoji: '🌟',
            title: '奇异的天象',
            desc: '夜空中出现了百年难遇的星象排列，所有人都被这壮丽的景象所震撼。',
            optionA: {
                label: '📖 记录星象',
                effects: { knowledge: 100 },
                desc: '+100知识，发现新的研究方向'
            },
            optionB: {
                label: '🙏 祭祀祈福',
                effects: { food: -30, happiness: 15 },
                desc: '消耗30食物，幸福度+15%持续5分钟'
            }
        }
    },

    // --- API 通信层 ---
    apiBase: '/api',
    token: null,
    playerId: null,
    heartbeatId: null,

    techNameMap: {
        fireMaking: '钻木取火',
        writing: '文字',
        agriculture: '农业',
        animalHusbandry: '畜牧',
        metallurgy: '冶金',
        calligraphy: '书写法',
        potteryWheel: '陶轮',
        irrigation: '灌溉',
        bronze: '青铜器',
        iron: '铁器',
        geometry: '几何',
        philosophy: '哲学'
    },

    async apiGet(path) {
        const start = Date.now();
        try {
            const resp = await fetch(`${this.apiBase}${path}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await resp.json();
            this.cacheRequestLog(path, 'GET', null, resp.status, data, Date.now() - start);
            if (resp.status === 401) {
                this.handleAuthError(data);
            }
            return data;
        } catch (e) {
            this.cacheRequestLog(path, 'GET', null, 0, { error: e.message }, Date.now() - start);
            throw e;
        }
    },

    async apiPost(path, body) {
        const start = Date.now();
        try {
            const resp = await fetch(`${this.apiBase}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(body)
            });
            const data = await resp.json();
            this.cacheRequestLog(path, 'POST', body, resp.status, data, Date.now() - start);
            if (resp.status === 401) {
                this.handleAuthError(data);
            }
            return data;
        } catch (e) {
            this.cacheRequestLog(path, 'POST', body, 0, { error: e.message }, Date.now() - start);
            throw e;
        }
    },

    async startHeartbeat() {
        if (!this.token) { this.showLoginPanel("请登录或开始新游戏"); return; }

        this.heartbeatId = setInterval(async () => {
            try {
                const data = await this.apiGet('/game/state');
                if (data.gameState) {
                    this.syncFromServer(data.gameState, data.gameState?.eventQueue, data.gameState?.offlineEventLog);
                }
            } catch (e) {
                console.error('Heartbeat error:', e);
            }
        }, 5000);
        this.startLoop();
    },

    syncFromServer(serverState, eventQueue, offlineEventLog) {
        const s = this.state;

        // Record old values for floating text detection
        const oldFood = s.food;
        const oldKnowledge = s.knowledge;

        // 资源
        s.food = serverState.resources?.food || 0;
        s.knowledge = serverState.resources?.knowledge || 0;
        s.foodPerSecond = serverState.resources?.foodPerSecond || 0;
        s.knowledgePerSecond = serverState.resources?.knowledgePerSecond || 0;

        // Floating text on resource change (syncs with heartbeat, ~5s)
        const foodDelta = s.food - oldFood;
        const knowledgeDelta = s.knowledge - oldKnowledge;
        if (foodDelta > 0) {
            this.showFloatingText('\ud83c\udf3e +' + Math.floor(foodDelta), '.food-card');
        }
        if (knowledgeDelta > 0) {
            this.showFloatingText('\ud83d\udcda +' + Math.floor(knowledgeDelta), '.knowledge-card');
        }

        // 建筑（后端同步，前端不做映射）
        s.buildings = serverState.buildings || {
            farm: 0, house: 1, workshop: 0, academy: 0, barracks: 0, temple: 0
        };

        // 同步建筑成本（后端计算，前端展示用）
        s.buildingCosts = serverState.buildingCosts || {};

        // 人口 —— 关键修正：完整同步后端 population 对象
        const serverPop = serverState.population || {};
        s.totalPop = serverPop.total ?? 3;
        s.maxPop = serverPop.maxPop ?? serverPop.max ?? 5;
        s.farmers = serverPop.farmers ?? 0;
        s.scholars = serverPop.scholars ?? 0;
        s.craftsmen = serverPop.craftsmen ?? 0;

        // 把后端完整 population 对象存下来，供 renderPopulation 优先读取
        s.population = {
            total: s.totalPop,
            max: s.maxPop,
            maxPop: s.maxPop,
            farmers: s.farmers,
            scholars: s.scholars,
            craftsmen: s.craftsmen,
            unassigned: serverPop.unassigned ?? (s.totalPop - s.farmers - s.scholars - s.craftsmen),
            growthProgress: serverPop.growthProgress ?? 0
        };

        // 时代 / 幸福度 / 天数
        s.era = serverState.currentEra || 0;
        s.happiness = serverState.happiness || 80;
        s.day = serverState.gameDay || 1;

        // 科技 - 反向映射：中文名 → 前端ID
        s.techState = {};
        s.activeResearch = null;
        for (const [backendName, techData] of Object.entries(serverState.techs || {})) {
            const frontId = Object.entries(this.techNameMap).find(([k, v]) => v === backendName)?.[0];
            if (frontId) {
                s.techState[frontId] = {
                    status: techData.status,
                    progress: techData.progress / (techData.totalCost || 1)
                };
                if (techData.status === 'researching') {
                    s.activeResearch = frontId;
                }
            }
        }

        // 事件队列
        if (eventQueue && Array.isArray(eventQueue)) {
            s.eventState.pendingEvents = eventQueue.map(e => {
                // 后端事件对象可能有不同结构，转换为前端事件ID
                if (typeof e === 'string') return e;
                if (e.id) return e.id;
                return null;
            }).filter(Boolean);
        }

        // 离线事件日志
        if (offlineEventLog) {
            s.eventState.offlineEventLog = Array.isArray(offlineEventLog)
                ? offlineEventLog
                : [offlineEventLog];
        }

        // 应用科技效果
        this.applyTechEffects();
        this.render();
    },


    // --- 时代进阶条件 ---
    eraConditions: [
        {
            // 原始 → 农耕
            food: 100,
            knowledge: 100,
            buildingTotal: 3,
            requiredBuildings: { farm: 3 },
            techCount: 0,
            requiredTechs: []
        },
        {
            // 农耕 → 青铜
            food: 2000,
            knowledge: 500,
            buildingTotal: 5,
            requiredBuildings: { workshop: 1, farm: 3 },
            techCount: 2,
            requiredTechs: ['fireMaking', 'writing']
        },
        {
            // 青铜 → 古典
            food: 4000,
            knowledge: 1200,
            buildingTotal: 7,
            requiredBuildings: { academy: 1, workshop: 1 },
            techCount: 4,
            requiredTechs: ['writing', 'agriculture', 'animalHusbandry', 'metallurgy']
        }
    ],
    eras: [
        { id: 0, name: '原始时代', icon: '🔥', nextName: '农耕时代', nextIcon: '🌾', threshold: 1000 },
        { id: 1, name: '农耕时代', icon: '🌾', nextName: '青铜器时代', nextIcon: '⚔️', threshold: 3000 },
        { id: 2, name: '青铜器时代', icon: '⚔️', nextName: '古典时代', nextIcon: '🏛️', threshold: 6000 },
        { id: 3, name: '古典时代', icon: '🏛️', nextName: '铁器时代', nextIcon: '⚙️', threshold: 10000 }
    ],

    // --- 初始化 ---

    init() {
        this.token = localStorage.getItem('cf_token') || null;
        this.playerId = localStorage.getItem('cf_playerId') || null;
        this.load();
        this.applyTechEffects();

        // 初始化建筑系统新模块（P1-2）
        this.buildingAPI = new BuildingAPI(this.apiBase, this.token);
        this.buildingManager = new BuildingManager(this.buildingAPI, this.buildingConfig);
        this.buildingRenderer = new BuildingRenderer(this.buildingManager);
        this.buildingManager.init(this.state);
        this.buildingRenderer.bindContainer('.building-grid');
        // this.calculateOffline(); // 离线收益由服务器计算
        if (window.mountAuthMethods) window.mountAuthMethods(this);
        if (window.mountLogMethods) window.mountLogMethods(this);
        if (window.mountFloatingText) window.mountFloatingText(this);
        if (window.mountPopulationMethods) window.mountPopulationMethods(this);
        this.bindEvents();
        this.switchTab(this.state.currentTab || 'resources');
        this.render();
        if (!this.token) {
            this.showLoginPanel();
        }
        this.log('🔥 文明火种已点燃！服务器同步版已上线！');
    },

    // --- Tab 切换 ---
    switchTab(tabId) {
        this.state.currentTab = tabId;
        document.querySelectorAll('.page').forEach(page => {
            page.classList.toggle('active', page.dataset.page === tabId);
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        // 切换到事件tab时创建事件容器
        if (tabId === 'events') {
            this.createPendingEventsContainer();
        }
        this.save();
    },

    // --- 游戏循环 ---
    loopId: null,
    startLoop() {
        this.loopId = setInterval(() => this.tick(), 1000);
        requestAnimationFrame(() => this.smoothUpdate());
    },

    smoothUpdate() {
        this.renderValues();
        requestAnimationFrame(() => this.smoothUpdate());
    },

    tick() {
        const s = this.state;
        const cfg = this.config;

        s.tickCounter++;

        // 计算产出倍率
        const multipliers = this.calculateMultipliers();

        // 计算当前知识产出（用于研发）
        const knowledgePerSec = (s.scholars * multipliers.scholar + s.craftsmen * multipliers.craftsman)
                                 * cfg.knowledgePerScholar;

        // 处理研发进度
        if (s.activeResearch) {
            const tech = this.techs[s.activeResearch];
            const techState = s.techState[s.activeResearch];
            if (tech && techState && techState.status === 'researching') {
                // 研发进度 = 每秒知识产出 / 科技成本
                const progressIncrement = knowledgePerSec / tech.cost;
                techState.progress = (techState.progress || 0) + progressIncrement;

                if (techState.progress >= 1) {
                    // 研发完成
                    techState.progress = 1;
                    techState.status = 'completed';
                    s.activeResearch = null;
                    // 应用科技效果
                    if (tech.apply) tech.apply();
                    this.applyTechEffects();
                    this.log(`🔬 ${tech.icon} ${tech.name} 研发完成！${tech.effect}`);
                    this.showParticles(tech.icon, `#techCard_${tech.id}`, 12);
                    this.triggerScreenFlash();
                    this.animateNumberBump(`techStatus_${tech.id}`);
                }
            }
        }

        // 每秒产出（研发期间知识全部投入研发，不产生结余）
        const foodGain = s.farmers * cfg.foodPerFarmer * multipliers.farm * multipliers.global;
        // 知识：如果有研发中，知识全部投入研发，不增加库存；否则正常累积
        let knowledgeGain = 0;
        if (!s.activeResearch) {
            knowledgeGain = knowledgePerSec * multipliers.global;
            // s.knowledge += knowledgeGain; // 前端不计算资源，由服务端驱动
        }

        // s.food += foodGain; // 前端不计算资源，由服务端驱动

        // 游戏天数
        const elapsed = Date.now() - s.startTime;
        s.day = Math.floor(elapsed / 60000) + 1;

        // 人口自然增长由服务端驱动
        // 前端不计算


        this.save();
        this.render();

    },

    // --- 倍率计算 ---
    calculateMultipliers() {
        const s = this.state;
        const ts = s.techState;

        // 农田倍率
        let farmBonus = s.buildings.farm * this.config.farmBonusPerLevel / 100;
        const farmMultiplier = 1 + farmBonus;

        // 学者倍率（学院加成 × 科技加成）
        let scholarBase = s.buildings.academy > 0 ? (1 + s.buildings.academy * 0.5) : 1;
        if (ts?.writing?.status === 'completed') scholarBase *= 1.2;
        if (ts?.geometry?.status === 'completed') scholarBase *= 1.3;
        const scholarMultiplier = scholarBase;

        // 工匠倍率（工坊加成 × 科技加成）
        let craftsmanBase = s.buildings.workshop > 0 ? (1 + s.buildings.workshop * 0.5) : 1;
        if (ts?.pottery?.status === 'completed') craftsmanBase *= 1.2;
        const craftsmanMultiplier = craftsmanBase;

        // 兵营全局加成
        const barracksMultiplier = 1 + (s.buildings.barracks * 0.1);

        // 幸福度加成
        const happiness = 100 + s.buildings.house * 5 + s.buildings.temple * 15;
        s.happiness = happiness;
        const happinessMultiplier = happiness / 100;

        // 钻木取火加成已在 config.foodPerFarmer 中
        // 全局倍率 = 兵营 × 幸福度
        const globalMultiplier = barracksMultiplier * happinessMultiplier;

        return {
            farm: farmMultiplier,
            scholar: scholarMultiplier,
            craftsman: craftsmanMultiplier,
            global: globalMultiplier,
            happiness: happinessMultiplier,
            barracks: barracksMultiplier
        };
    },

    // --- 科技效果应用 ---
    applyTechEffects() {
        const ts = this.state.techState;
        // 重置基础配置
        this.config.foodPerFarmer = 2;
        this.config.knowledgePerScholar = 1;
        this.config.knowledgePerCraftsman = 1;
        this.config.farmBonusPerLevel = 20;
        // 人口增长由服务端驱动，前端不配置

        // 应用已完成的科技效果（按顺序）
        if (ts?.fireMaking?.status === 'completed') {
            this.config.foodPerFarmer *= 1.2;
        }
        if (ts?.irrigation?.status === 'completed') {
            this.config.farmBonusPerLevel = 30;
        }
        if (ts?.animalHusbandry?.status === 'completed') {
            // 人口增长由服务端驱动，前端不干预
        }
        if (ts?.bronzeSmelting?.status === 'completed') {
            this.config.knowledgePerCraftsman *= 1.25;
        }

        // 时代加成
        if (this.state.era >= 1) {
            this.config.foodPerFarmer *= 1.5;
        }

        // 民居容量由后端同步
    },

    // --- 科技研发 ---
    getTechStatus(techId) {
        const tech = this.techs[techId];
        const s = this.state;
        const ts = s.techState[techId];

        // 已完成
        if (ts?.status === 'completed') return 'completed';

        // 研发中
        if (ts?.status === 'researching') return 'researching';

        // 检查时代要求
        if (s.era < tech.era) return 'locked_era';

        // 检查前置条件
        if (tech.prereq) {
            const prereqState = s.techState[tech.prereq];
            if (!prereqState || prereqState.status !== 'completed') {
                return 'locked_prereq';
            }
        }

        // 检查是否已有其他研发中
        if (s.activeResearch && s.activeResearch !== techId) return 'locked_busy';

        // 检查知识是否足够
        if (s.knowledge < tech.cost) return 'locked_cost';

        // 检查是否有学者产出知识
        const multipliers = this.calculateMultipliers();
        const knowledgePerSec = (s.scholars * multipliers.scholar + s.craftsmen * multipliers.craftsman)
                                 * this.config.knowledgePerScholar;
        if (knowledgePerSec <= 0) return 'locked_no_knowledge';

        return 'available';
    },

    async researchTech(techId) {
        if (!this.token) {
            this.researchTechLocal(techId);
            return;
        }

        const tech = this.techs[techId];
        const backendName = this.techNameMap[techId];

        try {
            const result = await this.apiPost('/game/action', {
                action: 'research',
                target: backendName
            });

            if (result.success) {
                const data = await this.apiGet('/game/state');
                if (data.gameState) this.syncFromServer(data.gameState, data.gameState?.eventQueue, data.gameState?.offlineEventLog);
                // 显示离线收益弹窗
                if (data.offlineIncome && (data.offlineIncome.food > 0 || data.offlineIncome.knowledge > 0)) {
                    this.showOfflineModal(data.offlineIncome, data.offlineEventLog);
                }
                this.log(`🔬 开始研发 ${tech.icon} ${tech.name}！`);
                this.showFloatingText(`研发开始！`, `#techCard_${techId}`, '#e94560');
                this.animateNumberBump('knowledgeValue');
            } else {
                this.log(`❌ 研发失败：${result.message}`);
                const card = document.getElementById(`techCard_${techId}`);
                if (card) {
                    card.classList.remove('shake');
                    void card.offsetWidth;
                    card.classList.add('shake');
                    setTimeout(() => card.classList.remove('shake'), 500);
                }
            }
        } catch (e) {
            console.error('researchTech API error:', e);
            this.researchTechLocal(techId);
        }
    },

    researchTechLocal(techId) {
        const tech = this.techs[techId];
        const s = this.state;
        const status = this.getTechStatus(techId);

        if (status !== 'available') {
            const card = document.getElementById(`techCard_${techId}`);
            if (card) {
                card.classList.remove('shake');
                void card.offsetWidth;
                card.classList.add('shake');
                setTimeout(() => card.classList.remove('shake'), 500);
            }
            return;
        }

        s.knowledge -= tech.cost;
        s.techState[techId] = { status: 'researching', progress: 0, startedAt: Date.now() };
        s.activeResearch = techId;

        this.log(`🔬 开始研发 ${tech.icon} ${tech.name}！需要 ${tech.cost} 知识`);
        this.showFloatingText(`研发开始！`, `#techCard_${techId}`, '#e94560');
        this.animateNumberBump('knowledgeValue');

        this.render();
        this.save();
    },

    // --- 时代进阶 ---
    canAdvanceEra() {
        const nextEraIdx = this.state.era;
        const conditions = this.eraConditions[nextEraIdx];
        if (!conditions) return false;

        const s = this.state;
        const ts = s.techState;

        // 检查食物
        if (s.food < conditions.food) return false;

        // 检查知识
        if (s.knowledge < conditions.knowledge) return false;

        // 检查建筑总数
        const totalBuildings = Object.values(s.buildings || {}).reduce((a, b) => a + b, 0);
        if (totalBuildings < conditions.buildingTotal) return false;

        // 检查特定建筑
        for (const [bldKey, requiredCount] of Object.entries(conditions.requiredBuildings)) {
            const actualCount = s.buildings[bldKey] || 0;
            if (actualCount < requiredCount) return false;
        }

        // 检查科技数量
        const completedTechs = Object.values(ts).filter(t => t.status === 'completed').length;
        if (completedTechs < conditions.techCount) return false;

        // 检查特定科技
        for (const techId of conditions.requiredTechs) {
            if (!ts[techId] || ts[techId].status !== 'completed') return false;
        }

        return true;
    },

    calculateEraProgress() {
        const nextEraIdx = this.state.era;
        const conditions = this.eraConditions[nextEraIdx];
        if (!conditions) {
            return { percentage: 100, conditions: [], allMet: true };
        }

        const s = this.state;
        const ts = s.techState;
        const totalBuildings = Object.values(s.buildings || {}).reduce((a, b) => a + b, 0);
        const completedTechs = Object.values(ts).filter(t => t.status === 'completed').length;

        const conds = [];
        let totalWeight = 0;
        let completedWeight = 0;

        // 食物 (25%)
        const foodMet = s.food >= conditions.food;
        const foodPct = Math.min(s.food / conditions.food, 1);
        totalWeight += 25;
        completedWeight += foodPct * 25;
        conds.push({
            name: '食物',
            icon: '🌾',
            required: conditions.food,
            current: Math.floor(s.food),
            met: foodMet,
            pct: foodPct
        });

        // 知识 (25%)
        const knowledgeMet = s.knowledge >= conditions.knowledge;
        const knowledgePct = Math.min(s.knowledge / conditions.knowledge, 1);
        totalWeight += 25;
        completedWeight += knowledgePct * 25;
        conds.push({
            name: '知识',
            icon: '📚',
            required: conditions.knowledge,
            current: Math.floor(s.knowledge),
            met: knowledgeMet,
            pct: knowledgePct
        });

        // 建筑 (25%)
        let buildingMet = totalBuildings >= conditions.buildingTotal;
        let buildingPct = Math.min(totalBuildings / conditions.buildingTotal, 1);
        // 检查特定建筑
        let specificBldText = '';
        for (const [bldKey, requiredCount] of Object.entries(conditions.requiredBuildings)) {
            const actualCount = s.buildings?.[bldKey] || 0;
            const bldDef = this.buildingConfig.buildings[bldKey];
            const bldName = bldDef?.name || bldKey;
            if (actualCount < requiredCount) {
                buildingMet = false;
                buildingPct = Math.min(buildingPct, 0.8);
                specificBldText += `（缺${bldName}）`;
            }
        }
        totalWeight += 25;
        completedWeight += buildingPct * 25;
        conds.push({
            name: '建筑',
            icon: '🏠',
            required: conditions.buildingTotal,
            current: totalBuildings,
            met: buildingMet,
            pct: buildingPct,
            extraText: specificBldText
        });

        // 科技 (25%)
        let techMet = completedTechs >= conditions.techCount;
        let techPct = Math.min(completedTechs / conditions.techCount, 1);
        // 检查特定科技
        let specificTechText = '';
        for (const techId of conditions.requiredTechs) {
            const tech = this.techs[techId];
            if (!ts[techId] || ts[techId].status !== 'completed') {
                techMet = false;
                techPct = Math.min(techPct, 0.8);
                specificTechText += `（缺${tech?.icon || ''}${tech?.name || techId}）`;
            }
        }
        totalWeight += 25;
        completedWeight += techPct * 25;
        conds.push({
            name: '科技',
            icon: '🔬',
            required: conditions.techCount,
            current: completedTechs,
            met: techMet,
            pct: techPct,
            extraText: specificTechText
        });

        const percentage = Math.round((completedWeight / totalWeight) * 100);

        return {
            percentage,
            conditions: conds,
            allMet: percentage >= 100
        };
    },

    async advanceEra() {
        if (!this.token) {
            this.advanceEraLocal();
            return;
        }

        try {
            const result = await this.apiPost('/game/action', {
                action: 'advanceEra'
            });

            if (result.success) {
                const data = await this.apiGet('/game/state');
                if (data.gameState) this.syncFromServer(data.gameState, data.gameState?.eventQueue, data.gameState?.offlineEventLog);
                // 显示离线收益弹窗
                if (data.offlineIncome && (data.offlineIncome.food > 0 || data.offlineIncome.knowledge > 0)) {
                    this.showOfflineModal(data.offlineIncome, data.offlineEventLog);
                }

                const s = this.state;
                const nextEra = this.eras[s.era];
                this.showParticles(nextEra.icon, '#app', 30);
                this.triggerScreenFlash();
                this.log(`🏛️ ${result.message}`);
            } else {
                this.log(`❌ 进阶失败：${result.message}`);
            }
        } catch (e) {
            console.error('advanceEra API error:', e);
            this.advanceEraLocal();
        }
    },

    advanceEraLocal() {
        if (!this.canAdvanceEra()) return;

        const s = this.state;
        const nextEraIdx = s.era + 1;
        const conditions = this.eraConditions[s.era];
        const nextEra = this.eras[nextEraIdx];

        if (!nextEra || !conditions) return;

        s.food -= conditions.food;
        s.knowledge -= conditions.knowledge;
        s.era = nextEraIdx;

        this.showParticles(nextEra.icon, '#app', 30);
        this.triggerScreenFlash();

        if (s.era === 1) {
            this.config.foodPerFarmer *= 1.5;
            this.log('🏛️ 进入农耕时代！兵营和神庙已解锁！');
        } else if (s.era === 2) {
            this.config.knowledgePerScholar *= 1.5;
            this.log('⚔️ 进入青铜器时代！新科技已解锁！');
        } else if (s.era === 3) {
            this.config.foodPerFarmer *= 1.3;
            this.config.knowledgePerScholar *= 1.3;
            this.log('🏛️ 进入古典时代！全产出大幅提升！');
        }

        if (!s.eraHistory) s.eraHistory = [];
        s.eraHistory.push({ era: s.era, advancedAt: Date.now() });

        this.render();
        this.save();
    },
    chooseEventOption(eventId, option) {
        // 调用后端API处理事件选择
        this.apiPost('/game/event/choose', { eventId, option })
            .then(result => {
                if (result.success) {
                    // 同步服务器返回的最新状态
                    if (result.gameState) {
                        this.syncFromServer(result.gameState, result.gameState?.eventQueue, result.gameState?.offlineEventLog);
                    }
                    // 显示结果
                    const evt = this.events[eventId];
                    this.log(`${evt?.emoji || '📜'} ${evt?.title || '事件'} - 选择了${option}：${result.resultText || '已处理'}`);
                    this.triggerScreenFlash();
                    this.renderEventHistory();
                    this.renderPendingEvents();
                    this.updateTabBadge();
                    this.render();
                    this.save();
                } else {
                    this.log(`❌ 事件处理失败：${result.message || '未知错误'}`);
                    // 刷新状态
                    this.apiGet('/game/state').then(data => {
                        if (data.gameState) {
                            this.syncFromServer(data.gameState, data.gameState?.eventQueue, data.gameState?.offlineEventLog);
                            this.render();
                        }
                    });
                }
            })
            .catch(err => {
                console.error('Event choice error:', err);
                this.log('❌ 网络错误，事件处理失败');
            });

    },
    cacheOfflineEvents(diffMs) {
        const s = this.state;
        const es = s.eventState;
        const intervals = Math.floor(diffMs / 120000); // 120秒一个周期

        let cachedCount = 0;
        for (let i = 0; i < intervals && cachedCount < 2; i++) {
            if (Math.random() < 0.3) {
                // 简单离线事件：直接给正面效果
                const offlineEvents = ['harvest', 'ruins', 'visitors', 'celestial'];
                const randomEvent = offlineEvents[Math.floor(Math.random() * offlineEvents.length)];
                const evt = this.events[randomEvent];

                // 应用简单正面效果
                if (randomEvent === 'harvest') {
                    s.food += 100;
                } else if (randomEvent === 'ruins') {
                    s.knowledge += 80;
                } else if (randomEvent === 'visitors') {
                    s.food += 50;
                    s.knowledge += 30;
                } else if (randomEvent === 'celestial') {
                    s.knowledge += 60;
                }

                if (!es.eventHistory) es.eventHistory = [];
                es.eventHistory.unshift({
                    id: randomEvent,
                    title: evt.title,
                    emoji: evt.emoji,
                    option: 'offline',
                    result: '离线期间自动触发（正面）',
                    isNegative: false,
                    timestamp: Date.now() - (intervals - i) * 120000
                });
                cachedCount++;
            }
        }

        if (cachedCount > 0) {
            this.log(`📦 离线期间缓存了 ${cachedCount} 个事件，已自动处理`);
        }
    },

    renderEventHistory() {
        const container = document.getElementById('eventHistoryList');
        if (!container) return;

        const es = this.state.eventState;
        const history = es.eventHistory || [];

        container.innerHTML = '';
        if (history.length === 0) {
            container.innerHTML = '<div class="event-history-empty">暂无事件记录</div>';
            return;
        }

        for (const item of history) {
            const div = document.createElement('div');
            div.className = `event-history-item ${item.isNegative ? 'negative' : 'positive'}`;

            const timeAgo = this.formatTimeAgo(item.timestamp);
            div.innerHTML = `
                <span class="event-history-emoji">${item.emoji}</span>
                <div class="event-history-info">
                    <div class="event-history-title">${item.title}</div>
                    <div class="event-history-result">${item.result}</div>
                </div>
                <span class="event-history-time">${timeAgo}</span>
            `;
            container.appendChild(div);
        }
    },

    formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        return `${Math.floor(diff / 86400000)}天前`;
    },

    // --- 离线收益 ---
    calculateOffline() {
        const now = Date.now();
        const lastSave = this.state.lastSave || now;
        const diffMs = now - lastSave;
        const diffHours = diffMs / 3600000;

        if (diffHours < 0.01) return;

        const s = this.state;
        const cfg = this.config;
        const offlineEfficiency = cfg.offlineEfficiencyBase + s.buildings.temple * 0.05;
        const effectiveHours = Math.min(diffHours, cfg.maxOfflineHours);

        const multipliers = this.calculateMultipliers();

        const foodGain = s.farmers * cfg.foodPerFarmer * multipliers.farm * multipliers.global
                         * effectiveHours * 3600 * offlineEfficiency;
        const knowledgeGain = (s.scholars * multipliers.scholar + s.craftsmen * multipliers.craftsman)
                              * cfg.knowledgePerScholar * multipliers.global
                              * effectiveHours * 3600 * offlineEfficiency;

        if (foodGain > 1 || knowledgeGain > 1) {
            this.showOfflineModal({ offlineHours: effectiveHours, food: Math.floor(foodGain), knowledge: Math.floor(knowledgeGain), efficiency: offlineEfficiency }, this.state.eventState?.offlineEventLog || []);
        }

        // 离线事件缓存
        this.cacheOfflineEvents(diffMs);
    },

    showOfflineModal(offlineIncome, offlineEventLog) {
        const modal = document.getElementById('offlineModal');
        const timeEl = document.getElementById('offlineTime');
        const foodEl = document.getElementById('offlineFood');
        const knowledgeEl = document.getElementById('offlineKnowledge');
        const narrativeEl = document.getElementById('offlineNarrative');
        const efficiencyEl = document.getElementById('offlineEfficiency');

        if (!modal) return;

        const offlineHours = offlineIncome?.offlineHours || 0;
        const hours = Math.floor(offlineHours);
        const minutes = Math.floor((offlineHours - hours) * 60);
        let timeStr = '';
        if (hours > 0) timeStr += `${hours}小时`;
        if (minutes > 0) timeStr += `${minutes}分钟`;
        if (timeStr === '') timeStr = '不久';

        if (timeEl) timeEl.textContent = timeStr;
        if (foodEl) foodEl.textContent = '+' + (offlineIncome?.food || 0).toLocaleString();
        if (knowledgeEl) knowledgeEl.textContent = '+' + (offlineIncome?.knowledge || 0).toLocaleString();
        if (efficiencyEl) efficiencyEl.textContent = `效率: 80%`;

        if (narrativeEl) {
            const logs = Array.isArray(offlineEventLog) ? offlineEventLog : (offlineEventLog ? [offlineEventLog] : []);
            const narrative = logs.filter(Boolean).join('、') || '族人一切平安，世界在缓慢运转';
            narrativeEl.textContent = '💬 你离开的期间，' + narrative;
        }

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        // 绑定领取按钮
        const btn = document.getElementById('btnClaimOffline');
        if (btn) {
            btn.onclick = () => {
                this.state.food += offlineIncome?.food || 0;
                this.state.knowledge += offlineIncome?.knowledge || 0;
                modal.classList.remove('show');
                setTimeout(() => modal.style.display = 'none', 300);
                this.render();
                this.save();
                this.log(`⏰ 领取离线收益：🌾+${(offlineIncome?.food || 0).toLocaleString()} 📚+${(offlineIncome?.knowledge || 0).toLocaleString()}（效率${((offlineIncome?.efficiency || 0.8) * 100).toFixed(0)}%）`);
            };
        }
    },

    // --- 保存/加载 ---
    save() {
        // 后端是唯一真相源，前端不再保存游戏状态到localStorage
    },

    load() {
        // 后端是唯一真相源，前端不再从localStorage恢复游戏状态
        // token已在init()开头从localStorage恢复
    },

    // --- 渲染 ---
    render() {
        this.renderValues();
        this.renderUI();
        this.renderTechUI();
        this.renderEventHistory();
        this.renderPendingEvents();
        this.updateTabBadge();
    },

    renderValues() {
        const s = this.state;
        const multipliers = this.calculateMultipliers();

        // 资源数值
        this.setText('foodValue', Math.floor(s.food).toLocaleString());
        this.setText('knowledgeValue', Math.floor(s.knowledge).toLocaleString());

        // 产出速率（直接读取后端同步的数据）
        const foodRate = (s.foodPerSecond || 0) * 5;
        const knowledgeRate = s.activeResearch ? 0 : (s.knowledgePerSecond || 0) * 5;
        this.setText('foodRate', `+${foodRate.toFixed(1)}/5s`);
        this.setText('knowledgeRate', `+${knowledgeRate.toFixed(1)}/5s`);

        // 科技页顶部知识产出
        const techKnowledgeRateEl = document.getElementById('techKnowledgeRate');
        if (techKnowledgeRateEl) {
            const researchStatus = s.activeResearch
                ? `（研发中：${this.techs[s.activeResearch].name}）`
                : '';
            techKnowledgeRateEl.textContent = `${(s.knowledgePerSecond || 0).toFixed(1)}/s${researchStatus}`;
        }

        // 人口
        this.renderPopulation();

        // 幸福度
        this.setText('happinessValue', s.happiness);

        // 建筑显示由 BuildingRenderer 接管

        // 时代
        const era = this.eras[s.era];
        this.setText('eraName', era.name);
        this.setText('currentEra', `${era.icon} ${era.name}`);

        // 文明概览
        const totalBuildings = Object.values(s.buildings || {}).reduce((a, b) => a + b, 0);
        const completedTechs = Object.values(s.techState).filter(t => t.status === 'completed').length;
        this.setText('civOverviewEraIcon', era.icon);
        this.setText('civOverviewEraName', era.name);
        this.setText('civOverviewDay', `第 ${s.day} 天`);
        this.setText('civOverviewPop', `${s.totalPop}/${s.maxPop}`);
        this.setText('civOverviewBuildings', totalBuildings);
        this.setText('civOverviewTechs', `${completedTechs}/8`);
        this.setText('civOverviewHappiness', `${s.happiness}%`);

        // 时代条件进度
        const eraProgress = this.calculateEraProgress();
        const progressBar = document.getElementById('eraProgress');
        if (progressBar) {
            progressBar.style.width = `${eraProgress.percentage}%`;
        }
        this.setText('eraProgressText', `总进度: ${eraProgress.percentage}%`);

        // 时代目标
        const nextEra = this.eras[s.era + 1];
        if (nextEra) {
            this.setText('eraTargetIcon', nextEra.nextIcon);
            this.setText('eraTargetName', nextEra.nextName);
        } else {
            this.setText('eraTargetIcon', '🏆');
            this.setText('eraTargetName', '最高时代');
        }

        // 渲染时代条件清单
        this.renderEraConditions(eraProgress);

        // 渲染当前时代特性
        this.renderCurrentFeatures();

        // 渲染下个时代预览
        this.renderNextPreview();

        // 时间
        this.setText('gameTime', `第 ${s.day} 天`);
    },


    renderPendingEvents() {
        const container = document.getElementById('pendingEventsContainer');
        if (!container) return;
        container.innerHTML = this.renderPendingEventsHTML();
    },

    createPendingEventsContainer() {
        let container = document.getElementById('pendingEventsContainer');
        if (container) return container;
        container = document.createElement('div');
        container.id = 'pendingEventsContainer';
        const historyPanel = document.querySelector('.event-history-panel');
        if (historyPanel && historyPanel.parentNode) {
            historyPanel.parentNode.insertBefore(container, historyPanel);
        }
        return container;
    },

    renderPendingEventsHTML() {
        const s = this.state;
        const pending = s.eventState?.pendingEvents || [];
        if (pending.length === 0) {
            return '<div class="pending-events-empty">暂无待处理事件</div>';
        }

        let html = '<div class="pending-events-section">';
        html += '<div class="pending-events-title">📜 待处理事件 (' + pending.length + ')</div>';

        for (const eventId of pending) {
            const evt = this.events[eventId];
            if (!evt) continue;
            html += '<div class="pending-event-card">';
            html += '<div class="pending-event-header">' + (evt.emoji || '') + ' ' + (evt.title || '未知事件') + '</div>';
            html += '<div class="pending-event-desc">' + (evt.desc || '') + '</div>';
            html += '<div class="pending-event-options">';
            if (evt.optionA) {
                html += '<button class="pending-event-btn option-a" data-event-id="' + eventId + '" data-option="A">';
                html += (evt.optionA.label || '选项A') + '</button>';
            }
            if (evt.optionB) {
                html += '<button class="pending-event-btn option-b" data-event-id="' + eventId + '" data-option="B">';
                html += (evt.optionB.label || '选项B') + '</button>';
            }
            html += '</div></div>';
        }
        html += '</div>';

        // 绑定点击事件（避免内联onclick的引号问题）
        setTimeout(() => {
            const container = document.getElementById('pendingEventsContainer');
            if (!container) return;
            container.querySelectorAll('button[data-event-id]').forEach(btn => {
                btn.onclick = () => {
                    const eid = btn.getAttribute('data-event-id');
                    const opt = btn.getAttribute('data-option');
                    this.chooseEventOption(eid, opt);
                };
            });
        }, 0);

        return html;
    },

    updateTabBadge() {
        const s = this.state;
        const count = s.eventState?.pendingEvents?.length || 0;
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            if (tab.dataset.tab === 'events' || tab.dataset.tab === 'civilization') {
                let badge = tab.querySelector('.tab-badge');
                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'tab-badge';
                        tab.style.position = 'relative';
                        tab.appendChild(badge);
                    }
                    badge.textContent = count;
                } else if (badge) {
                    badge.remove();
                }
            }
        });
    },

    renderUI() {
        const s = this.state;

        // 建筑卡片状态 —— 由新模块 BuildingRenderer 接管（P1-2）
        if (this.buildingRenderer) {
            this.buildingRenderer.renderBuildings(document.querySelector('.building-grid'));
        }

        // 时代进阶按钮
        const btnEra = document.getElementById('btnAdvanceEra');
        if (btnEra) {
            const canAdvance = this.canAdvanceEra();
            const nextEra = this.eras[s.era + 1];
            const btnEraLabel = document.getElementById('btnEraLabel');
            btnEra.disabled = !canAdvance || !nextEra;

            if (!nextEra) {
                if (btnEraLabel) btnEraLabel.textContent = '已达最高时代';
            } else if (canAdvance) {
                if (btnEraLabel) btnEraLabel.textContent = `进阶到${nextEra.nextName}`;
            } else {
                if (btnEraLabel) btnEraLabel.textContent = '条件不足，无法进阶';
            }
        }

        // 人口按钮
        this.updatePopulationButtons();
    },

    renderTechUI() {
        const s = this.state;

        for (const [techId, tech] of Object.entries(this.techs)) {
            const card = document.getElementById(`techCard_${techId}`);
            const statusEl = document.getElementById(`techStatus_${techId}`);
            const progressBar = document.getElementById(`techProgress_${techId}`);
            const btn = document.getElementById(`btnResearch_${techId}`);
            if (!card || !statusEl || !btn) continue;

            const status = this.getTechStatus(techId);
            const techState = s.techState[techId];

            // 重置样式
            card.classList.remove('tech-locked', 'tech-researching', 'tech-completed', 'tech-available');

            if (techState?.status === 'completed') {
                card.classList.add('tech-completed');
                statusEl.textContent = '✅ 已完成';
                statusEl.className = 'tech-status completed';
                btn.style.display = 'none';
                if (progressBar) {
                    progressBar.style.width = '100%';
                    progressBar.parentElement.style.display = 'none';
                }
            } else if (techState?.status === 'researching') {
                card.classList.add('tech-researching');
                const pct = Math.floor((techState.progress || 0) * 100);
                statusEl.textContent = `⏳ 研发中 ${pct}%`;
                statusEl.className = 'tech-status researching';
                btn.style.display = 'none';
                if (progressBar) {
                    progressBar.parentElement.style.display = 'block';
                    progressBar.style.width = `${pct}%`;
                }
            } else if (status === 'available') {
                card.classList.add('tech-available');
                statusEl.textContent = `📚 ${tech.cost} 知识`;
                statusEl.className = 'tech-status available';
                btn.style.display = 'flex';
                btn.disabled = false;
                btn.querySelector('.research-label').textContent = '研发';
                if (progressBar) progressBar.parentElement.style.display = 'none';
            } else {
                card.classList.add('tech-locked');
                btn.style.display = 'flex';
                btn.disabled = true;
                if (progressBar) progressBar.parentElement.style.display = 'none';

                let lockReason = '';
                if (status === 'locked_era') {
                    const requiredEra = this.eras[tech.era];
                    lockReason = `🔒 需${requiredEra?.name || '更高时代'}`;
                } else if (status === 'locked_prereq') {
                    const prereqTech = this.techs[tech.prereq];
                    lockReason = `🔒 需${prereqTech?.icon || ''}${prereqTech?.name || '前置科技'}`;
                } else if (status === 'locked_busy') {
                    const activeTech = this.techs[s.activeResearch];
                    lockReason = `🔒 正研发${activeTech?.name || '其他科技'}`;
                } else if (status === 'locked_cost') {
                    lockReason = `🔒 知识不足`;
                } else if (status === 'locked_no_knowledge') {
                    lockReason = `🔒 无知识产出`;
                }
                statusEl.textContent = lockReason;
                statusEl.className = 'tech-status locked';
                btn.querySelector('.research-label').textContent = '锁定';
            }
        }
    },

    renderEraConditions(eraProgress) {
        const container = document.getElementById('eraConditions');
        if (!container) return;

        container.innerHTML = '';

        for (const cond of eraProgress.conditions) {
            const item = document.createElement('div');
            item.className = `era-condition-item ${cond.met ? 'met' : 'unmet'}`;

            const icon = document.createElement('span');
            icon.className = `era-condition-icon ${cond.met ? 'met' : 'unmet'}`;
            icon.textContent = cond.met ? '✅' : '❌';

            const info = document.createElement('div');
            info.className = 'era-condition-info';

            const name = document.createElement('div');
            name.className = 'era-condition-name';
            name.textContent = `${cond.icon} ${cond.name}`;

            const progress = document.createElement('div');
            progress.className = `era-condition-progress ${cond.met ? 'met' : ''}`;
            progress.textContent = cond.met
                ? `${cond.current}/${cond.required} ✓`
                : `${cond.current}/${cond.required}${cond.extraText || ''}`;

            info.appendChild(name);
            info.appendChild(progress);

            const barWrap = document.createElement('div');
            barWrap.className = 'era-condition-bar';

            const fill = document.createElement('div');
            fill.className = `era-condition-fill ${cond.met ? '' : 'unmet'}`;
            fill.style.width = `${Math.round(cond.pct * 100)}%`;

            barWrap.appendChild(fill);
            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(barWrap);
            container.appendChild(item);
        }
    },

    renderCurrentFeatures() {
        const container = document.getElementById('civCurrentFeatures');
        if (!container) return;

        const era = this.eras[this.state.era];
        const features = [];

        // 根据当前时代生成特性列表
        if (this.state.era >= 0) {
            features.push({ icon: '🔥', text: '原始火种：基础食物产出×1' });
            features.push({ icon: '🌾', text: `农民效率：${this.config.foodPerFarmer.toFixed(1)}/s` });
        }
        if (this.state.era >= 1) {
            features.push({ icon: '🌾', text: '农耕加成：食物产出×1.5' });
            features.push({ icon: '🏠', text: '民居扩建：解锁兵营和神庙' });
        }
        if (this.state.era >= 2) {
            features.push({ icon: '⚔️', text: '青铜加成：知识产出×1.5' });
            features.push({ icon: '🔬', text: '新科技：灌溉农业与青铜器冶炼' });
        }
        if (this.state.era >= 3) {
            features.push({ icon: '🏛️', text: '古典加成：全产出×1.3' });
            features.push({ icon: '📐', text: '新科技：几何数学与城邦制度' });
        }

        // 科技加成
        const ts = this.state.techState;
        if (ts?.fireMaking?.status === 'completed') {
            features.push({ icon: '🔥', text: '钻木取火：农民产出+20%' });
        }
        if (ts?.irrigation?.status === 'completed') {
            features.push({ icon: '💧', text: '灌溉农业：农田加成+30%' });
        }
        if (ts?.animalHusbandry?.status === 'completed') {
            features.push({ icon: '🐄', text: '畜牧驯养：人口增长加速' });
        }

        container.innerHTML = '';
        for (const f of features) {
            const item = document.createElement('div');
            item.className = 'civ-feature-item';
            item.innerHTML = `<span class="feature-icon">${f.icon}</span>
                              <span class="feature-text">${f.text}</span>`;
            container.appendChild(item);
        }
    },

    renderNextPreview() {
        const container = document.getElementById('civPreviewList');
        const panel = document.getElementById('civNextPreview');
        if (!container || !panel) return;

        const nextEraIdx = this.state.era + 1;
        const nextEra = this.eras[nextEraIdx];
        const conditions = this.eraConditions[this.state.era];

        if (!nextEra || !conditions) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';

        const previewItems = [];
        previewItems.push({ icon: '🌾', text: `食物需求：${conditions.food}` });
        previewItems.push({ icon: '📚', text: `知识需求：${conditions.knowledge}` });
        previewItems.push({ icon: '🏠', text: `建筑需求：≥${conditions.buildingTotal}座` });
        previewItems.push({ icon: '🔬', text: `科技需求：≥${conditions.techCount}个` });

        // 特定建筑需求
        for (const [bldKey, requiredCount] of Object.entries(conditions.requiredBuildings)) {
            const bldDef = this.buildingConfig.buildings[bldKey];
            const bldName = bldDef?.name || bldKey;
            const bldIcon = bldDef?.ui?.icon || '?';
            if (bldName) {
                previewItems.push({ icon: bldIcon, text: `需要${bldName}×${requiredCount}` });
            }
        }

        // 特定科技需求
        for (const techId of conditions.requiredTechs) {
            const tech = this.techs[techId];
            if (tech) {
                previewItems.push({ icon: tech.icon, text: `需要${tech.name}` });
            }
        }

        // 时代加成预览
        if (nextEraIdx === 1) {
            previewItems.push({ icon: '✨', text: '进阶奖励：食物产出×1.5' });
            previewItems.push({ icon: '🔓', text: '解锁建筑：兵营、神庙' });
            previewItems.push({ icon: '🔓', text: '解锁科技：灌溉农业、畜牧驯养' });
        } else if (nextEraIdx === 2) {
            previewItems.push({ icon: '✨', text: '进阶奖励：知识产出×1.5' });
            previewItems.push({ icon: '🔓', text: '解锁科技：青铜器冶炼、文字记录' });
        } else if (nextEraIdx === 3) {
            previewItems.push({ icon: '✨', text: '进阶奖励：全产出×1.3' });
            previewItems.push({ icon: '🔓', text: '解锁科技：几何数学、城邦制度' });
        }

        container.innerHTML = '';
        for (const item of previewItems) {
            const div = document.createElement('div');
            div.className = 'civ-feature-item';
            div.innerHTML = `<span class="feature-icon">${item.icon}</span>
                             <span class="feature-text">${item.text}</span>`;
            container.appendChild(div);
        }
    },

    setText(id, text) {
        const el = document.getElementById(id);
        if (el && el.textContent !== String(text)) {
            el.textContent = text;
            if (el.classList.contains('resource-value') ||
                el.classList.contains('job-count') ||
                el.classList.contains('building-count')) {
                el.classList.remove('pop');
                void el.offsetWidth;
                el.classList.add('pop');
            }
        }
    },

    // --- 动画辅助 ---
    animateNumberBump(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('pop');
            void el.offsetWidth;
            el.classList.add('pop');
        }
    },

    shakeCard(buildingId) {
        const card = document.getElementById(`${buildingId}Card`);
        if (card) {
            card.classList.remove('shake');
            void card.offsetWidth;
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 500);
        }
    },

    // --- 事件绑定 ---
    bindEvents() {
        // 人口事件
        this.bindPopulationEvents();

        // 建造按钮 —— 由新模块 BuildingRenderer 接管（P1-2）
        if (this.buildingRenderer) {
            this.buildingRenderer.bindEvents(document.querySelector('.building-grid'), this);
        }

        // 时代进阶
        const btnAdvanceEra = document.getElementById('btnAdvanceEra');
        if (btnAdvanceEra) {
            btnAdvanceEra.addEventListener('click', () => this.advanceEra());
        }

        // Tab 切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // 科技研发按钮
        for (const techId of Object.keys(this.techs)) {
            const btn = document.getElementById(`btnResearch_${techId}`);
            if (btn) {
                btn.addEventListener('click', () => this.researchTech(techId));
            }
        }

        // 防止双击缩放
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) e.preventDefault();
        }, { passive: false });

        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) e.preventDefault();
            lastTouchEnd = now;
        }, false);
    },

    // --- 特效 ---
    showParticles(emoji, selector, count = 8) {
        const container = document.querySelector(selector) || document.body;
        const rect = container.getBoundingClientRect();
        const fxLayer = document.getElementById('fxLayer');
        if (!fxLayer) return;

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.textContent = emoji;
            p.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 100}px`;
            p.style.top = `${rect.top + rect.height / 2}px`;
            p.style.animationDelay = `${Math.random() * 0.3}s`;
            p.style.animationDuration = `${1 + Math.random()}s`;
            fxLayer.appendChild(p);
            setTimeout(() => p.remove(), 2000);
        }
    },


    triggerScreenFlash() {
        const fxLayer = document.getElementById('fxLayer');
        if (!fxLayer) return;
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        fxLayer.appendChild(flash);
        setTimeout(() => flash.remove(), 800);
    },

    // --- 日志 ---
    log(message) {
        const logContent = document.getElementById('logContent');
        if (!logContent) return;
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = message;
        logContent.appendChild(entry);

        while (logContent.children.length > 3) {
            logContent.removeChild(logContent.firstChild);
        }
    }
};

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});

// 页面可见性变化时保存
document.addEventListener('visibilitychange', () => {
    if (document.hidden) Game.save();
});


// DEPLOY-TEST: 20260514-123526
