const BuildingConfig = require('../config/BuildingConfig');
const { getAdvanceConfig } = require('../config/EraConfig');
const BuildingState = require('../domain/BuildingState');

function ensureAtLeast(resources, cost) {
  let changed = false;
  Object.entries(cost || {}).forEach(([key, required]) => {
    if ((resources[key] || 0) < required) {
      resources[key] = required;
      changed = true;
    }
  });
  return changed;
}

function isTutorialDone(gameState) {
  return Boolean(gameState?.tutorial?.completed || gameState?.tutorial?.phaseCompleted?.era2);
}

function ensureCityAdvanceResources(gameState, eraProgress) {
  if (!isTutorialDone(gameState)) return false;
  if (gameState.currentEra !== 2) return false;
  const config = getAdvanceConfig(2);
  if (!config) return false;
  if ((eraProgress?.percentage || 0) < 50) return false;
  return ensureAtLeast(gameState.resources, config.cost);
}

function ensureBarracksResources(gameState) {
  if (gameState.currentEra !== 3) return false;
  if (BuildingState.isBuilt(gameState.buildings, 'barracks')) return false;
  return ensureAtLeast(gameState.resources, BuildingConfig.getBuildCost('barracks'));
}

function ensureClassicalAdvanceResources(gameState, eraProgress) {
  if (!isTutorialDone(gameState)) return false;
  if (gameState.currentEra !== 3) return false;
  const config = getAdvanceConfig(3);
  if (!config) return false;
  if ((eraProgress?.percentage || 0) < 60) return false;
  return ensureAtLeast(gameState.resources, config.cost);
}

function apply(gameState, eraProgress) {
  let changed = false;
  changed = ensureCityAdvanceResources(gameState, eraProgress) || changed;
  changed = ensureBarracksResources(gameState) || changed;
  changed = ensureClassicalAdvanceResources(gameState, eraProgress) || changed;
  gameState.softGuideState = gameState.softGuideState || {};
  if (gameState.currentEra === 3 && BuildingState.isBuilt(gameState.buildings, 'barracks')) {
    gameState.softGuideState.barracksUnlockedSeen = true;
  }
  return changed;
}

function getSoftGuide(gameState, eraProgress) {
  if (!isTutorialDone(gameState)) return null;
  if (gameState.currentEra === 2) {
    if (eraProgress?.canAdvance) {
      return {
        id: 'city_advance_ready',
        message: '条件已满足，点击进阶进入城邦时代。',
        target: 'btn-advance-era',
      };
    }
    return {
      id: 'city_preparation',
      message: '聚落正在壮大，继续积累食物、木材与知识，城邦的轮廓已经出现。',
      target: null,
    };
  }
  if (gameState.currentEra === 3 && !BuildingState.isBuilt(gameState.buildings, 'barracks')) {
    return {
      id: 'barracks_unlocked',
      message: '新时代解锁了兵营！在建造页查看。',
      target: 'card-barracks',
    };
  }
  if (gameState.currentEra === 3) {
    if (eraProgress?.canAdvance) {
      return {
        id: 'classical_advance_ready',
        message: '士兵与资源已就绪，点击进阶进入古典时代。',
        target: 'btn-advance-era',
      };
    }
    if (BuildingState.isBuilt(gameState.buildings, 'barracks') && !gameState.softGuideState?.barracksBuiltSeen) {
      gameState.softGuideState = {
        ...(gameState.softGuideState || {}),
        barracksBuiltSeen: true,
      };
      return {
        id: 'barracks_built',
        message: '防御等级+1。你的城邦第一次有了守卫。',
        target: null,
      };
    }
    return {
      id: 'classical_preparation',
      message: '训练至少 3 名士兵，并继续积累食物、木材与知识，为古典时代做准备。',
      target: null,
    };
  }
  if (gameState.currentEra >= 4) {
    return {
      id: 'threat_events_open',
      message: '外部威胁已经出现，留意事件页红点并用士兵守住边界。',
      target: 'tab-events',
    };
  }
  return null;
}

module.exports = {
  apply,
  getSoftGuide,
  ensureCityAdvanceResources,
  ensureBarracksResources,
  ensureClassicalAdvanceResources,
};
