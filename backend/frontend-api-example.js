// 《文明火种》前端API对接示例
// 前端职责：渲染 + 发送操作 + 动画效果

const API_BASE = '/api';
let token = localStorage.getItem('cf_token') || null;
let playerId = localStorage.getItem('cf_playerId') || null;

// ========== 工具函数 ==========

async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ========== 玩家认证 ==========

async function registerOrLogin() {
  // 生成或获取deviceId
  let deviceId = localStorage.getItem('cf_deviceId');
  if (!deviceId) {
    deviceId = 'web_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('cf_deviceId', deviceId);
  }

  try {
    // 先尝试登录
    const data = await apiRequest('/player/login', {
      method: 'POST',
      body: JSON.stringify({ deviceId })
    });
    token = data.token;
    playerId = data.playerId;
    localStorage.setItem('cf_token', token);
    localStorage.setItem('cf_playerId', playerId);
    return data;
  } catch (err) {
    // 登录失败则注册
    const data = await apiRequest('/player/register', {
      method: 'POST',
      body: JSON.stringify({ deviceId })
    });
    token = data.token;
    playerId = data.playerId;
    localStorage.setItem('cf_token', token);
    localStorage.setItem('cf_playerId', playerId);
    return data;
  }
}

// ========== 游戏状态 ==========

async function getGameState() {
  return apiRequest('/game/state');
}

// ========== 玩家操作 ==========

async function buildBuilding(buildingType) {
  return apiRequest('/game/action', {
    method: 'POST',
    body: JSON.stringify({ action: 'build', target: buildingType })
  });
}

async function assignPopulation(profession, count = 1) {
  return apiRequest('/game/action', {
    method: 'POST',
    body: JSON.stringify({ action: 'assign', profession, count })
  });
}

async function researchTech(techName) {
  return apiRequest('/game/action', {
    method: 'POST',
    body: JSON.stringify({ action: 'research', tech: techName })
  });
}

async function advanceEra() {
  return apiRequest('/game/action', {
    method: 'POST',
    body: JSON.stringify({ action: 'advanceEra' })
  });
}

async function recruitPopulation() {
  return apiRequest('/game/action', {
    method: 'POST',
    body: JSON.stringify({ action: 'recruit' })
  });
}

async function chooseEventOption(eventId) {
  return apiRequest('/game/action', {
    method: 'POST',
    body: JSON.stringify({ action: 'chooseEvent', eventId })
  });
}

// ========== 离线处理 ==========

async function reportOffline() {
  return apiRequest('/game/offline', {
    method: 'POST',
    body: JSON.stringify({ offlineAt: new Date().toISOString() })
  });
}

// 页面关闭/隐藏时上报离线
window.addEventListener('beforeunload', () => {
  if (token) {
    reportOffline().catch(() => {});
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && token) {
    reportOffline().catch(() => {});
  }
});

// ========== 心跳同步 ==========

let heartbeatInterval = null;

function startHeartbeat(callback, intervalMs = 5000) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(async () => {
    try {
      const data = await getGameState();
      if (callback) callback(data);
    } catch (err) {
      console.error('Heartbeat error:', err);
    }
  }, intervalMs);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ========== 初始化示例 ==========

async function initGame() {
  try {
    // 1. 注册/登录
    const authData = await registerOrLogin();
    console.log('登录成功:', authData.playerId);

    // 2. 获取初始状态
    const stateData = await getGameState();
    console.log('游戏状态:', stateData.gameState);

    // 显示离线收益
    if (stateData.offlineIncome && stateData.offlineIncome.food > 0) {
      console.log(`离线收益: 食物 +${stateData.offlineIncome.food}, 知识 +${stateData.offlineIncome.knowledge}`);
      // TODO: 显示离线收益弹窗
    }

    // 处理新事件
    if (stateData.newEvents && stateData.newEvents.length > 0) {
      console.log('新事件:', stateData.newEvents);
      // TODO: 显示事件弹窗
    }

    // 3. 启动心跳
    startHeartbeat((data) => {
      // 每5秒更新游戏状态
      renderGameState(data.gameState);
    });

    return stateData;
  } catch (err) {
    console.error('初始化失败:', err);
    throw err;
  }
}

// ========== 渲染示例（需根据实际UI实现） ==========

function renderGameState(gameState) {
  // 更新资源显示
  document.getElementById('food-display').textContent = Math.floor(gameState.resources.food);
  document.getElementById('knowledge-display').textContent = Math.floor(gameState.resources.knowledge);

  // 更新人口
  document.getElementById('population-display').textContent =
    `${gameState.population.total}/${gameState.population.max}`;

  // 更新建筑
  for (const [building, count] of Object.entries(gameState.buildings)) {
    const el = document.getElementById(`building-${building}`);
    if (el) el.textContent = count;
  }

  // 更新时代
  const eraNames = ['原始时代', '农耕时代', '青铜时代', '古典时代'];
  document.getElementById('era-display').textContent = eraNames[gameState.currentEra] || '未知时代';

  // 更新幸福度
  document.getElementById('happiness-display').textContent = gameState.happiness + '%';
}

// 导出供前端使用
window.CF_API = {
  initGame,
  registerOrLogin,
  getGameState,
  buildBuilding,
  assignPopulation,
  researchTech,
  advanceEra,
  recruitPopulation,
  chooseEventOption,
  reportOffline,
  startHeartbeat,
  stopHeartbeat,
  renderGameState
};
