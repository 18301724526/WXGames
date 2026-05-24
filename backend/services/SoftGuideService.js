const BuildingConfig = require('../config/BuildingConfig');
const { getAdvanceConfig } = require('../config/EraConfig');
const BuildingState = require('../domain/BuildingState');
const CityService = require('./CityService');

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
  return false;
}

function ensureBarracksResources(gameState) {
  return false;
}

function ensureBorderAdvanceResources(gameState, eraProgress) {
  return false;
}

function ensureWatchtowerResources(gameState) {
  return false;
}

function apply(gameState, eraProgress) {
  CityService.normalizeCities(gameState);
  if ((gameState.activeCityId || CityService.CAPITAL_CITY_ID) !== CityService.CAPITAL_CITY_ID) return false;
  gameState.softGuideState = gameState.softGuideState || {};
  if (gameState.currentEra === 3 && BuildingState.isBuilt(gameState.buildings, 'barracks')) {
    gameState.softGuideState.barracksUnlockedSeen = true;
  }
  return false;
}

function getSoftGuide(gameState, eraProgress) {
  if (!isTutorialDone(gameState)) return null;
  if ((gameState.activeCityId || CityService.CAPITAL_CITY_ID) !== CityService.CAPITAL_CITY_ID) {
    return {
      id: 'subcity_management',
      message: '当前正在管理分城。分城可以独立建设与生产，时代进阶由主城统一推动。',
      target: null,
    };
  }
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
        id: 'border_advance_ready',
        message: '士兵与资源已就绪，点击进阶进入边境时代。',
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
        message: '兵营开始训练士兵。你的城邦第一次有了防御力量。',
        target: null,
      };
    }
    return {
      id: 'border_preparation',
      message: '训练至少 300 士兵，并继续积累食物、木材与知识，为边境时代做准备。',
      target: null,
    };
  }
  if (gameState.currentEra === 4 && !BuildingState.isBuilt(gameState.buildings, 'watchtower')) {
    return {
      id: 'watchtower_unlocked',
      message: '边境时代解锁了瞭望台！建造它来提升威胁事件中的边境防御。',
      target: 'card-watchtower',
    };
  }
  if (gameState.currentEra >= 4) {
    if (gameState.currentEra >= 5) {
      return {
        id: 'territory_open',
        message: '古典时代已经到来，在军事页派出侦察队，让外部世界逐步显现。',
        target: 'tab-military',
      };
    }
    return {
      id: 'threat_events_open',
      message: '外部威胁已经出现，留意事件页红点，并用士兵与瞭望台守住边界。',
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
  ensureBorderAdvanceResources,
  ensureWatchtowerResources,
};
