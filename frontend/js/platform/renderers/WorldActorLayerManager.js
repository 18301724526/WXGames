(function (global) {
  // Actor lifecycle / dedup / resolution mixin for WorldMapLayerCanvasRenderer.
  const SharedWorldTime = (() => {
    if (global.WorldTime) return global.WorldTime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/foundation/WorldTime');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/system/WorldMarchSystem');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function install(WorldMapLayerCanvasRenderer) {
    if (!WorldMapLayerCanvasRenderer?.prototype) return false;
    Object.assign(WorldMapLayerCanvasRenderer.prototype, {
      hasWorldExplorerMissions(state = {}) {
        const explorer = state.worldExplorerState || {};
        const combat = explorer.combat || {};
        return (
          this.getWorldExplorerMissionIds(state).size > 0 ||
          (Array.isArray(combat.activeEncounters) && combat.activeEncounters.length > 0)
        );
      },

      getWorldExplorerMissionIds(state = {}) {
        const explorer = state.worldExplorerState || {};
        const ids = new Set();
        const append = (mission) => {
          if (mission?.id) ids.add(String(mission.id));
        };
        (Array.isArray(explorer.missions) ? explorer.missions : []).forEach(append);
        append(explorer.activeMission);
        (Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []).forEach(append);
        return ids;
      },

      hasWorldExplorerState(state = {}) {
        return Boolean(
          state && state.worldExplorerState && typeof state.worldExplorerState === 'object',
        );
      },

      getWorldMapContextActors(state = {}, context = null, renderSnapshot = null) {
        const contextActors = Array.isArray(context?.actors) ? context.actors : null;
        if (contextActors && (contextActors.length || this.hasWorldExplorerState(state)))
          return contextActors;
        if (this.hasWorldExplorerState(state)) return [];
        if (Array.isArray(context?.visibilityActors) && context.visibilityActors.length)
          return context.visibilityActors;
        return Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : [];
      },

      getWorldMapActorNowMs(options = {}) {
        const optionNow = options.epochNowMs ?? options.nowMs ?? options.serverNowMs;
        const resolvedOptionNow = Number(optionNow);
        if (Number.isFinite(resolvedOptionNow)) return resolvedOptionNow;
        const resolvedNow = SharedWorldTime?.getEpochNowMs?.(
          {
            ...options,
            host: this.host || this,
          },
          Number.NaN,
        );
        return Number.isFinite(resolvedNow) ? resolvedNow : Number.NaN;
      },

      buildFreshWorldMapActors(state = {}, options = {}) {
        if (!SharedWorldMarchSystem?.buildActors || !this.hasWorldExplorerMissions(state))
          return [];
        const actors = SharedWorldMarchSystem.buildActors(state.worldExplorerState || {}, {
          nowMs: this.getWorldMapActorNowMs(options),
        });
        return Array.isArray(actors) ? actors : [];
      },

      getActorIdentityKeys(actor = {}) {
        return [actor?.missionId, actor?.id, actor?.formation?.id, actor?.formationId]
          .map((key) => String(key || ''))
          .filter(Boolean);
      },

      isWorldMapMissionActor(actor = {}) {
        if (!actor || typeof actor !== 'object') return false;
        if (actor.missionId || actor.unitKey || actor.type === 'scout') return true;
        if (actor.status === 'active' || actor.status === 'idle') return true;
        if (Array.isArray(actor.route) && actor.route.length) return true;
        return Boolean(
          actor.progress ||
          actor.formation ||
          actor.formationSnapshot ||
          actor.remainingSeconds !== undefined ||
          actor.travelRemainingSeconds !== undefined,
        );
      },

      dedupeWorldMapActors(actors = []) {
        const result = [];
        const seen = new Set();
        (Array.isArray(actors) ? actors : []).forEach((actor) => {
          const keys = this.getActorIdentityKeys(actor);
          if (keys.length && keys.some((key) => seen.has(key))) return;
          keys.forEach((key) => seen.add(key));
          result.push(actor);
        });
        return result;
      },

      getNonMissionContextActors(actors = [], missionIds = new Set()) {
        return (Array.isArray(actors) ? actors : []).filter((actor) => {
          if (this.getActorIdentityKeys(actor).some((key) => missionIds.has(key))) return false;
          return !this.isWorldMapMissionActor(actor);
        });
      },

      resolveWorldMapActors(state = {}, contextActors = [], options = {}) {
        const actors = Array.isArray(contextActors) ? contextActors : [];
        const freshActors = this.dedupeWorldMapActors(
          this.buildFreshWorldMapActors(state, options),
        );
        const missionIds = this.getWorldExplorerMissionIds(state);
        if (!freshActors.length) {
          if (!missionIds.size) {
            return this.hasWorldExplorerState(state)
              ? this.dedupeWorldMapActors(this.getNonMissionContextActors(actors, missionIds))
              : this.dedupeWorldMapActors(actors);
          }
          return this.dedupeWorldMapActors(this.getNonMissionContextActors(actors, missionIds));
        }
        return this.dedupeWorldMapActors([
          ...freshActors,
          ...this.getNonMissionContextActors(actors, missionIds),
        ]);
      },

      getExplorerMissionRemainingSeconds(mission = {}, nowMs = this.getEpochNowMs()) {
        return (
          SharedWorldTime?.getRemainingSeconds?.(mission, nowMs) ??
          Math.max(0, Math.ceil(Number(mission.remainingSeconds) || 0))
        );
      },
    });
    return true;
  }

  const WorldActorLayerManager = { install };
  global.WorldActorLayerManager = WorldActorLayerManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldActorLayerManager;
})(typeof window !== 'undefined' ? window : globalThis);
