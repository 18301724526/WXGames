// 文明火种 H5 MVP - 游戏逻辑
const CONFIG = {
  TICK_MS: 100,
  SAVE_KEY: 'civilization_fire_save_v1',
  OFFLINE_MAX_HOURS: 12,
  OFFLINE_EFFICIENCY: 0.80,
  BUILDING_COST_GROWTH: 1.5,
  POP_GROWTH_RATE: 0.01, // 0.01/秒 = 每100秒+1人
  RECRUIT_COST: 50,
  RECRUIT_CD_MS: 30000,
};

const ERAS = [
  { id: 'primitive', name: '原始时代', emoji: '🪨', desc: '火的发现改变了一切', next: { food: 600, knowledge: 100, buildings: 2, techs: 0 } },
  { id: 'farming', name: '农耕时代', emoji: '🌾', desc: '灌溉农业让部落定居', next: { food: 2500, knowledge: 600, buildings: 4, techs: 2 } },
  { id: 'bronze', name: '青铜时代', emoji: '⚔️', desc: '金属冶炼开启新纪元', next: { food: 6000, knowledge: 1500, buildings: 6, techs: 4 } },
  { id: 'classical', name: '古典时代', emoji: '🏛️', desc: '城邦制度与几何数学', next: null }
];

const BUILDINGS = [
  { id: 'house', name: '民居', emoji: '🏠', baseFood: 100, baseKnow: 0, effect: 'pop+2 happy+5%', max: 20 },
  { id: 'farmland', name: '农田', emoji: '🌱', baseFood: 80, baseKnow: 0, effect: 'farmer×1.5', max: 20 },
  { id: 'workshop', name: '工坊', emoji: '⚒️', baseFood: 150, baseKnow: 40, effect: 'unlock artisan artisan×1.5', max: 15, unlockTech: 'pottery' },
  { id: 'academy', name: '学院', emoji: '📖', baseFood: 200, baseKnow: 80, effect: 'unlock scholar scholar×1.5', max: 10, unlockTech: 'writing' },
  { id: 'barracks', name: '兵营', emoji: '🛡️', baseFood: 250, baseKnow: 60, effect: 'defend output+10%', max: 10 },
  { id: 'temple', name: '神庙', emoji: '⛩️', baseFood: 300, baseKnow: 100, effect: 'happy+15% offline+5%', max: 8 }
];

const TECHS = [
  { id: 'fire', name: '钻木取火', emoji: '🔥', cost: 80, era: 0, prereq: null, effect: 'farmer+20%' },
  { id: 'pottery', name: '陶器烧制', emoji: '🏺', cost: 200, era: 0, prereq: 'fire', effect: 'unlock workshop' },
  { id: 'irrigation', name: '灌溉农业', emoji: '💧', cost: 300, era: 1, prereq: null, effect: 'farmland+30%' },
  { id: 'herding', name: '畜牧驯养', emoji: '🐄', cost: 450, era: 1, prereq: 'irrigation', effect: 'recruitCD-10s' },
  { id: 'bronze', name: '青铜器冶炼', emoji: '⚱️', cost: 600, era: 2, prereq: null, effect: 'artisan+25%' },
  { id: 'writing', name: '文字记录', emoji: '✍️', cost: 800, era: 2, prereq: 'bronze', effect: 'unlock academy' },
  { id: 'geometry', name: '几何数学', emoji: '📐', cost: 1000, era: 3, prereq: null, effect: 'academy+30%' },
  { id: 'citystate', name: '城邦制度', emoji: '🏛️', cost: 1300, era: 3, prereq: 'geometry', effect: 'house+1pop' }
];

const EVENTS = [
  { id: 'harvest', name: '丰收', emoji: '🌾', chance: 0.003, effect: (g)=>{ g.addResource('food', g.population*30); g.log('大丰收！每人获得30食物'); } },
  { id: 'famine', name: '饥荒', emoji: '💀', chance: 0.002, effect: (g)=>{ g.food = Math.max(0, g.food - g.population*20); g.log('饥荒降临，每人损失20食物'); g.showFloat(g.food/2, g.food/2, '💀'); } },
  { id: 'beast', name: '野兽袭击', emoji: '🐺', chance: 0.0015, effect: (g)=>{ if(g.buildings.barracks&&g.buildings.barracks>0){ g.log('兵营成功防御了野兽袭击！'); } else { let loss=Math.min(g.population-1,1); g.population-=loss; g.log('野兽袭击！'+loss+'人不幸遇难'); } } },
  { id: 'ruins', name: '发现遗迹', emoji: '🏛️', chance: 0.002, effect: (g)=>{ g.addResource('knowledge', 50+Math.random()*100); g.log('发现了古老遗迹，获得大量知识'); } },
  { id: 'visitor', name: '邻族来访', emoji: '🤝', chance: 0.0025, effect: (g)=>{ g.addResource('food', 40); g.log('邻族带来40食物作为礼物'); } }
];

class Game {
  constructor() {
    this.food = 0;
    this.knowledge = 0;
    this.population = 3;
    this.era = 0;
    this.techs = {};
    this.buildings = {};
    this.profs = { farmer: 3, artisan: 0, scholar: 0 };
    this.lastTick = Date.now();
    this.lastSave = Date.now();
    this.recruitCooldown = 0;
    this.autoRecruit = false;
    this.tickAccum = 0;
    this.logs = [];
    this.init();
  }

  init() {
    this.loadGame();
    this.calcOffline();
    this.renderBuildings();
    this.renderTechs();
    this.updateUI();
    this.startLoop();
    this.checkOffline();
    setTimeout(()=>{
      document.getElementById('loading').style.opacity='0';
      setTimeout(()=>{document.getElementById('loading').style.display='none';document.getElementById('game').style.display='flex';},500);
    },1500);
    this.log('文明之火已点燃 🔥');
  }

  get popLimit() { return 3 + (this.buildings.house||0)*2 + (this.techs.citystate?1:0)*(this.buildings.house||0); }
  get foodCap() { return 500 + (this.buildings.farmland||0)*200; }
  get knowledgeCap() { return Infinity; }

  foodPerSec() {
    let base = this.profs.farmer * 0.5 + this.profs.artisan * 0.2;
    let mult = 1;
    if(this.buildings.farmland) mult *= Math.pow(1.5, this.buildings.farmland);
    if(this.techs.fire) mult *= 1.2;
    if(this.techs.irrigation) mult *= 1.3;
    if(this.buildings.barracks) mult *= 1.1;
    let happy = this.happiness();
    mult *= happy;
    return base * mult - this.population * 0.15;
  }

  knowledgePerSec() {
    let base = this.profs.artisan * 0.15 + this.profs.scholar * 0.2;
    let mult = 1;
    if(this.buildings.workshop && this.profs.artisan>0) mult *= Math.pow(1.5, this.buildings.workshop);
    if(this.buildings.academy && this.profs.scholar>0) mult *= Math.pow(1.5, this.buildings.academy);
    if(this.techs.bronze) mult *= 1.25;
    if(this.techs.geometry) mult *= 1.3;
    if(this.buildings.barracks) mult *= 1.1;
    let happy = this.happiness();
    mult *= happy;
    return base * mult;
  }

  happiness() {
    let h = 1.0;
    if(this.buildings.temple) h += (this.buildings.temple * 0.15);
    if(this.buildings.house) h += (this.buildings.house * 0.05);
    if(this.food < this.population * 5) h -= 0.2;
    if(this.population >= this.popLimit * 0.9) h -= 0.1;
    return Math.max(0.5, Math.min(1.5, h));
  }

  calcOffline() {
    let save = localStorage.getItem(CONFIG.SAVE_KEY);
    if(!save) return;
    try {
      let data = JSON.parse(save);
      let last = data.lastSave || Date.now();
      let hours = (Date.now() - last) / 3600000;
      if(hours < 0.1) return;
      hours = Math.min(hours, CONFIG.OFFLINE_MAX_HOURS);
      this._offlineHours = hours;
      let eff = CONFIG.OFFLINE_EFFICIENCY + (this.buildings.temple||0)*0.05;
      let foodRate = data.foodRate || 0.5;
      let knowRate = data.knowledgeRate || 0;
      this._offlineFood = Math.floor(foodRate * 3600 * hours * eff);
      this._offlineKnowledge = Math.floor(knowRate * 3600 * hours * eff);
    } catch(e) {}
  }

  checkOffline() {
    if(this._offlineHours && this._offlineHours > 0.1) {
      document.getElementById('offlineTime').textContent = '你离开了 ' + this._offlineHours.toFixed(1) + ' 小时';
      document.getElementById('offlineFood').textContent = '+' + this._offlineFood;
      document.getElementById('offlineKnowledge').textContent = '+' + this._offlineKnowledge;
      document.getElementById('offlineModal').classList.add('active');
    }
  }

  closeOfflineModal() {
    this.addResource('food', this._offlineFood||0);
    this.addResource('knowledge', this._offlineKnowledge||0);
    document.getElementById('offlineModal').classList.remove('active');
    this.log('收下了离线收益 🔥');
    this.showFloatText('+'+(this._offlineFood||0)+' 🌾', document.getElementById('foodVal'));
  }

  startLoop() {
    let loop = () => {
      let now = Date.now();
      let dt = (now - this.lastTick) / 1000;
      this.lastTick = now;
      this.tickAccum += dt;
      while(this.tickAccum >= 0.1) {
        this.tickAccum -= 0.1;
        this.tick(0.1);
      }
      this.updateUI();
      if(now - this.lastSave > 30000) { this.saveGame(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  tick(dt) {
    // 自然人口增长
    let growthChance = CONFIG.POP_GROWTH_RATE * dt;
    if(Math.random() < growthChance && this.population < this.popLimit && this.food >= this.population * 0.5) {
      this.population++;
      this.profs.farmer++;
      this.log('新生儿诞生！总人口 +' + this.population);
      this.showFloatText('+1 👶', document.getElementById('popCount'));
    }
    // 资源产出
    let fps = this.foodPerSec();
    let kps = this.knowledgePerSec();
    this.food = Math.min(this.foodCap, this.food + fps * dt);
    this.knowledge += kps * dt;
    // 自动招募
    if(this.autoRecruit && this.food >= CONFIG.RECRUIT_COST && this.population < this.popLimit && this.recruitCooldown <= 0) {
      this.recruit();
    }
    if(this.recruitCooldown > 0) this.recruitCooldown -= dt;
    // 随机事件
    for(let ev of EVENTS) {
      if(Math.random() < ev.chance * dt) { ev.effect(this); }
    }
    // 时代进度
    this.updateEraProgress();
  }

  updateEraProgress() {
    let era = ERAS[this.era];
    if(!era.next) { document.getElementById('eraProgress').style.width='100%'; return; }
    let reqs = era.next;
    let score = 0, total = 0;
    if(reqs.food) { score += Math.min(1, this.food/reqs.food); total++; }
    if(reqs.knowledge) { score += Math.min(1, this.knowledge/reqs.knowledge); total++; }
    if(reqs.buildings) { let b=0; for(let k in this.buildings) b+=this.buildings[k]; score += Math.min(1, b/reqs.buildings); total++; }
    if(reqs.techs) { let t=Object.keys(this.techs).length; score += Math.min(1, t/reqs.techs); total++; }
    let pct = total>0 ? (score/total)*100 : 0;
    document.getElementById('eraProgress').style.width = pct+'%';
    let btn = document.getElementById('advanceBtn');
    if(pct >= 100) { btn.disabled = false; btn.innerHTML = '<span class="emoji">🚀</span>时代进阶!'; }
    else { btn.disabled = true; btn.innerHTML = '<span class="emoji">🚀</span>时代进阶'; }
  }

  tryAdvanceEra() {
    let era = ERAS[this.era];
    if(!era.next) return;
    let r = era.next;
    if(this.food < r.food || this.knowledge < r.knowledge) { this.log('资源不足，无法进阶'); return; }
    let b=0; for(let k in this.buildings) b+=this.buildings[k];
    if(b < r.buildings) { this.log('建筑不足，无法进阶'); return; }
    let t=Object.keys(this.techs).length;
    if(t < r.techs) { this.log('科技不足，无法进阶'); return; }
    this.food -= r.food;
    this.knowledge -= r.knowledge;
    this.era++;
    let nextEra = ERAS[this.era];
    document.getElementById('eraBigEmoji').textContent = nextEra.emoji;
    document.getElementById('eraBigTitle').textContent = nextEra.name;
    document.getElementById('eraBigDesc').textContent = nextEra.desc;
    let unlocks = [];
    if(this.era===1) unlocks = ['🏺 工坊建筑','👨‍🔧 工匠职业'];
    if(this.era===2) unlocks = ['📖 学院建筑','👨‍🏫 学者职业'];
    if(this.era===3) unlocks = ['🏛️ 城邦制度','📐 几何数学'];
    document.getElementById('eraUnlocks').innerHTML = unlocks.map(u=>'<div class="era-unlock">'+u+'</div>').join('');
    document.getElementById('eraModal').classList.add('active');
    this.log('进入 '+nextEra.name+'！🔥🔥🔥');
    this.updateUI();
  }

  closeEraModal() {
    document.getElementById('eraModal').classList.remove('active');
    this.renderBuildings();
    this.renderTechs();
  }

  changeProf(type, delta) {
    if(delta > 0) {
      let free = this.population - this.profs.farmer - this.profs.artisan - this.profs.scholar;
      if(free <= 0) { this.log('没有闲置人口'); return; }
    }
    if(delta < 0 && this.profs[type] <= 0) return;
    if(type === 'farmer' && delta < 0 && this.profs.farmer <= 1) { this.log('至少需要1名农民'); return; }
    this.profs[type] = Math.max(0, this.profs[type] + delta);
    this.updateUI();
  }

  recruit() {
    if(this.food < CONFIG.RECRUIT_COST) { this.log('食物不足，需要'+CONFIG.RECRUIT_COST); return; }
    if(this.population >= this.popLimit) { this.log('人口已达上限，建造民居'); return; }
    if(this.recruitCooldown > 0) { this.log('招募冷却中...'); return; }
    this.food -= CONFIG.RECRUIT_COST;
    this.population++;
    this.profs.farmer++;
    this.recruitCooldown = CONFIG.RECRUIT_CD_MS / 1000;
    this.log('招募成功！总人口: ' + this.population);
    this.showFloatText('+1 👤', document.getElementById('popCount'));
    this.updateUI();
  }

  toggleAutoRecruit() {
    this.autoRecruit = !this.autoRecruit;
    document.getElementById('autoRecruitStatus').textContent = this.autoRecruit ? '开启' : '关闭';
    document.getElementById('recruitAutoBtn').style.background = this.autoRecruit ? '#e94560' : '#0f3460';
    this.log('自动招募 ' + (this.autoRecruit ? '开启' : '关闭'));
  }

  buildingCost(id) {
    let b = BUILDINGS.find(x=>x.id===id);
    let n = (this.buildings[id]||0) + 1;
    let food = Math.floor(b.baseFood * Math.pow(CONFIG.BUILDING_COST_GROWTH, n-1));
    let know = Math.floor(b.baseKnow * Math.pow(CONFIG.BUILDING_COST_GROWTH, n-1));
    return { food, knowledge: know };
  }

  canBuild(id) {
    let b = BUILDINGS.find(x=>x.id===id);
    if(b.unlockTech && !this.techs[b.unlockTech]) return false;
    let c = this.buildingCost(id);
    if(this.food < c.food || this.knowledge < c.knowledge) return false;
    if(this.buildings[id] >= b.max) return false;
    return true;
  }

  build(id) {
    if(!this.canBuild(id)) { this.log('条件不足，无法建造'); return; }
    let c = this.buildingCost(id);
    this.food -= c.food;
    this.knowledge -= c.knowledge;
    this.buildings[id] = (this.buildings[id]||0) + 1;
    this.renderBuildings();
    this.updateUI();
    let b = BUILDINGS.find(x=>x.id===id);
    this.log('建造了 ' + b.emoji + ' ' + b.name + ' (Lv.' + this.buildings[id] + ')');
    this.showFloatText('+'+b.emoji, document.getElementById('buildGrid'));
  }

  canResearch(id) {
    let t = TECHS.find(x=>x.id===id);
    if(t.era > this.era) return false;
    if(this.techs[id]) return false;
    if(this.knowledge < t.cost) return false;
    if(t.prereq && !this.techs[t.prereq]) return false;
    return true;
  }

  research(id) {
    if(!this.canResearch(id)) { this.log('条件不足'); return; }
    let t = TECHS.find(x=>x.id===id);
    this.knowledge -= t.cost;
    this.techs[id] = true;
    this.renderTechs();
    this.renderBuildings();
    this.updateUI();
    this.log('研发成功: ' + t.emoji + ' ' + t.name);
    this.showFloatText('🔬 '+t.name, document.getElementById('knowledgeVal'));
  }

  addResource(type, amount) {
    if(type === 'food') this.food = Math.min(this.foodCap, this.food + amount);
    else this.knowledge += amount;
    this.updateUI();
  }

  log(msg) {
    this.logs.unshift(msg);
    if(this.logs.length > 20) this.logs.pop();
    let el = document.getElementById('logArea');
    el.innerHTML = this.logs.slice(0,4).map(l=>'<div class="log-entry">'+l+'</div>').join('');
  }

  showFloatText(text, targetEl) {
    let rect = targetEl.getBoundingClientRect();
    let el = document.createElement('div');
    el.className = 'float-text ' + (text.includes('🌾')?'food':'knowledge');
    if(text.includes('👤')||text.includes('👶')) el.style.color='#e94560';
    el.textContent = text;
    el.style.left = (rect.left + rect.width/2 - 20) + 'px';
    el.style.top = (rect.top - 10) + 'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1500);
  }

  showFloat(x, y, emoji) {
    let el = document.createElement('div');
    el.className = 'particle';
    el.textContent = emoji;
    el.style.left = (x || window.innerWidth/2) + 'px';
    el.style.top = (y || window.innerHeight/2) + 'px';
    document.getElementById('particles').appendChild(el);
    setTimeout(()=>el.remove(), 2000);
  }

  saveGame() {
    let data = {
      food: this.food, knowledge: this.knowledge, population: this.population,
      era: this.era, techs: this.techs, buildings: this.buildings, profs: this.profs,
      lastSave: Date.now(), foodRate: this.foodPerSec(), knowledgeRate: this.knowledgePerSec()
    };
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
    this.lastSave = Date.now();
    this.log('💾 已自动存档');
  }

  loadGame() {
    let save = localStorage.getItem(CONFIG.SAVE_KEY);
    if(!save) return;
    try {
      let d = JSON.parse(save);
      this.food = d.food || 0;
      this.knowledge = d.knowledge || 0;
      this.population = d.population || 3;
      this.era = d.era || 0;
      this.techs = d.techs || {};
      this.buildings = d.buildings || {};
      this.profs = d.profs || { farmer: 3, artisan: 0, scholar: 0 };
      this.log('📂 读取存档成功');
    } catch(e) { console.error('存档读取失败', e); }
  }

  updateUI() {
    document.getElementById('foodVal').textContent = Math.floor(this.food);
    document.getElementById('knowledgeVal').textContent = Math.floor(this.knowledge);
    document.getElementById('foodRate').textContent = (this.foodPerSec()>=0?'+':'') + this.foodPerSec().toFixed(2) + '/秒';
    document.getElementById('knowledgeRate').textContent = '+' + this.knowledgePerSec().toFixed(2) + '/秒';
    document.getElementById('foodCap').textContent = '上限: ' + this.foodCap;
    document.getElementById('popCount').textContent = this.population;
    document.getElementById('popLimit').textContent = this.popLimit;
    document.getElementById('farmerCount').textContent = this.profs.farmer;
    document.getElementById('artisanCount').textContent = this.profs.artisan;
    document.getElementById('scholarCount').textContent = this.profs.scholar;
    document.getElementById('eraName').textContent = ERAS[this.era].name;
    document.getElementById('eraBadge').textContent = '时代 ' + (this.era+1) + '/4';
    let btn = document.getElementById('recruitBtn');
    if(this.food < CONFIG.RECRUIT_COST || this.population >= this.popLimit) btn.disabled = true;
    else btn.disabled = false;
    this.updateBuildingUI();
    this.updateTechUI();
  }

  renderBuildings() {
    let grid = document.getElementById('buildGrid');
    grid.innerHTML = BUILDINGS.map(b => {
      let count = this.buildings[b.id] || 0;
      let locked = b.unlockTech && !this.techs[b.unlockTech];
      let cost = this.buildingCost(b.id);
      let can = this.canBuild(b.id);
      return '<div class="build-item '+(locked?'locked':'')+'" onclick="game.build(''+b.id+'')" '+(can?'':'style="opacity:.5"')+'">' +
        '<div class="build-icon">'+b.emoji+'</div>' +
        '<div class="build-name">'+b.name+'</div>' +
        '<div class="build-count">'+count+'/'+b.max+'</div>' +
        '<div class="build-cost">🌾'+cost.food+(cost.knowledge?(' 📚'+cost.knowledge):'')+'</div>' +
        '<div class="build-effect">'+b.effect+'</div>' +
        '</div>';
    }).join('');
  }

  updateBuildingUI() {
    let items = document.querySelectorAll('.build-item');
    items.forEach((el, i) => {
      let b = BUILDINGS[i];
      if(!b) return;
      let can = this.canBuild(b.id);
      el.style.opacity = can ? '1' : '0.5';
    });
  }

  renderTechs() {
    let list = document.getElementById('techList');
    list.innerHTML = TECHS.map(t => {
      let done = this.techs[t.id];
      let can = this.canResearch(t.id);
      let locked = t.era > this.era;
      return '<div class="tech-item '+(locked?'locked':'')+(done?' done':'')+'">' +
        '<div class="tech-icon">'+t.emoji+'</div>' +
        '<div class="tech-info">' +
          '<div class="tech-name">'+t.name+(done?' [DONE]':'')+'</div>' +
          '<div class="tech-desc">'+t.effect+(t.prereq?' (需: '+TECHS.find(x=>x.id===t.prereq)?.name+')':'')+'</div>' +
        '</div>' +
        '<div class="tech-cost">📚 '+t.cost+'</div>' +
        (done?'<span style="color:#3ddc97;font-weight:bold;">已完成</span>':'<button class="tech-btn" '+(can?'':'disabled')+' onclick="game.research(''+t.id+'')">研发</button>') +
        '</div>';
    }).join('');
  }

  updateTechUI() {
    let btns = document.querySelectorAll('.tech-btn');
    btns.forEach((btn, i) => {
      let techId = TECHS[i]?.id;
      if(techId) btn.disabled = !this.canResearch(techId);
    });
  }

  toggleTechPanel() {
    document.getElementById('techPanel').classList.toggle('active');
  }
}

window.game = new Game();
