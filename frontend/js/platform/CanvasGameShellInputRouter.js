(function (global) {
  const WorldMapInputActionMap = (() => {
    if (global.WorldMapInputActionMap) return global.WorldMapInputActionMap;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/WorldMapInputActionMap');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function shouldRouteTapThroughWorldMapRuntime(action = null) {
    if (WorldMapInputActionMap?.shouldRouteTapThroughWorldMapRuntime) {
      return WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime(action);
    }
    return !action;
  }

  function summarizeHandledForOperationLog(handled) {
    return handled && typeof handled.then === 'function' ? 'promise' : Boolean(handled);
  }

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
bindInput() {
      if (!this.inputEnabled || !this.runtime?.onTap || this.tapDisposer) return false;
      this.tapDisposer = this.runtime.onTap((point, event) => this.handleTap(point, event));
      if (this.runtime.onDrag && !this.dragDisposer) {
        this.dragDisposer = this.runtime.onDrag((phase, point, event) => this.handleDrag(phase, point, event));
      }
      if (this.runtime.onGesture && !this.gestureDisposer) {
        this.gestureDisposer = this.runtime.onGesture((gesture, event) => this.handleGesture(gesture, event));
      }
      if (this.runtime.onPointerMove && !this.pointerMoveDisposer) {
        this.pointerMoveDisposer = this.runtime.onPointerMove((point) => this.handlePointerMove(point));
      }
      return true;
    },

handlePointerMove(point) {
      if (!this.renderer || typeof this.renderer.setHoverPoint !== 'function') return false;
      const changed = this.renderer.setHoverPoint(point);
      if (changed && this.showFamousPersons) this.renderActive();
      return changed;
    },

hasBlockingOverlayOpen() {
      return Boolean(this.showSettings
        || this.showLogs
        || this.showResourceDetails
        || this.showCitySwitcher
        || this.showSubcityList
        || this.showCityManagement
        || this.showAdvisor
        || this.tutorialAdvisorDialogue
        || this.lastGame?.tutorialAdvisorDialogue
        || this.showTaskCenter
        || this.showGuidebook
        || this.armyFormationEditor?.open
        || this.confirmDialog?.visible
        || this.activeCommandPanel
        || this.techDetailOpen
        || this.activeEventId
        || this.naming.visible
        || this.battleScene?.visible
        || this.rewardReveal);
    },

isWorldMapHudAction(action = {}) {
      const type = action?.type || '';
      return Boolean(type
        && type !== 'worldMapDrag'
        && type !== 'openWorldSite'
        && type !== 'resetWorldPan'
        && type !== 'closeWorldSite'
        && type !== 'blockCanvasModal');
    },

isTechTreeDragAction(action = {}) {
      return Boolean(action?.type === 'techTreeDrag' || action?.dragType === 'techTreeDrag');
    },

containsCanvasPoint(rect = {}, point = {}) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      return Number.isFinite(x)
        && Number.isFinite(y)
        && x >= Number(rect.x)
        && x <= Number(rect.x) + Number(rect.width)
        && y >= Number(rect.y)
        && y <= Number(rect.y) + Number(rect.height);
    },

getTechTreeHitAction(point = {}) {
      const targets = Array.isArray(this.renderer?.hitTargets) ? this.renderer.hitTargets : [];
      for (let index = targets.length - 1; index >= 0; index -= 1) {
        const target = targets[index];
        if (!this.isTechTreeDragAction(target?.action)) continue;
        if (this.containsCanvasPoint(target, point)) return target.action;
      }
      return null;
    },

isTechTreeInteractionOpen() {
      return Boolean(this.getActiveTab() === 'tech' || this.activeCommandPanel === 'tech');
    },

hasBlockingOverlayExceptTechTree() {
      return Boolean(this.showSettings
        || this.showLogs
        || this.showResourceDetails
        || this.showCitySwitcher
        || this.showSubcityList
        || this.showCityManagement
        || this.showAdvisor
        || this.tutorialAdvisorDialogue
        || this.lastGame?.tutorialAdvisorDialogue
        || this.showTaskCenter
        || this.showGuidebook
        || this.armyFormationEditor?.open
        || this.confirmDialog?.visible
        || (this.activeCommandPanel && this.activeCommandPanel !== 'tech')
        || this.techDetailOpen
        || this.activeEventId
        || this.naming.visible
        || this.battleScene?.visible
        || this.rewardReveal);
    },

canRouteTechTreeInteraction(action = null) {
      if (!this.isTechTreeInteractionOpen()) return false;
      if (this.hasBlockingOverlayExceptTechTree()) return false;
      if (action && !this.isTechTreeDragAction(action)) return false;
      return true;
    },

stopCanvasEvent(event) {
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopPropagation) event.stopPropagation();
      return true;
    },

observeAsyncActionResult(result) {
      if (result && typeof result.then === 'function') {
        result.catch((error) => this.actionController?.log?.(error));
      }
      return result;
    },

getTutorialControlAction(point = {}) {
      if (!this.renderer || typeof this.renderer.getHitTarget !== 'function') return null;
      const action = this.renderer.getHitTarget(point);
      if (!action) return null;
      return action.type === 'blockCanvasModal' ? { ...action, tutorialBlocked: true } : action;
    },

isTutorialInputActive() {
      const intro = this.lastGame?.tutorialIntro || this.tutorialIntro || null;
      const highlight = this.tutorialHighlight || null;
      return Boolean(intro?.active || highlight);
    },

getActiveTutorialIntro() {
      const intro = this.lastGame?.tutorialIntro || this.tutorialIntro || null;
      return intro?.active ? intro : null;
    },

isTutorialIntroActionAllowed(action = {}, intro = this.getActiveTutorialIntro()) {
      if (!intro?.active || !action?.type) return false;
      const targetAction = action.allowedAction || action;
      const capitalCityId = intro.capitalCityId || this.lastGame?.state?.cityState?.capitalCityId || 'capital';
      const actionId = targetAction.cityId || targetAction.territoryId || targetAction.siteId || '';
      if (intro.step === 'city') {
        return targetAction.type === 'openWorldSite' && (!actionId || actionId === capitalCityId);
      }
      if (intro.step === 'enter') {
        return targetAction.type === 'enterCity' && (!actionId || actionId === capitalCityId);
      }
      return false;
    },

matchesTutorialAllowedAction(action = {}, allowedAction = null) {
      if (!action?.type || !allowedAction?.type) return false;
      if (action.type !== allowedAction.type) return false;
      const getTargetId = (item = {}) => item.siteId || item.territoryId || item.cityId || item.targetId || '';
      const allowedTargetId = getTargetId(allowedAction);
      const actionTargetId = getTargetId(action);
      return Object.entries(allowedAction).every(([key, value]) => (
        key === 'type'
        || value === undefined
        || action[key] === value
        || (['siteId', 'territoryId', 'cityId', 'targetId'].includes(key) && (!actionTargetId || !allowedTargetId || actionTargetId === allowedTargetId))
      ));
    },

isTutorialHighlightActionAllowed(action = {}, highlight = this.tutorialHighlight) {
      if (!highlight || !action?.type) return false;
      const targetAction = action.allowedAction || action;
      if (highlight.allowedAction) {
        return this.matchesTutorialAllowedAction(targetAction, highlight.allowedAction);
      }
      const type = targetAction?.type || '';
      return Boolean(type
        && type !== 'worldMapDrag'
        && type !== 'techTreeDrag');
    },

isTutorialActionAllowed(action = {}) {
      if (!action?.type || action.type === 'blockCanvasModal') return false;
      if (this.rewardReveal && action.type === 'closeRewardReveal') return true;
      const targetAction = action.allowedAction || action;
      if (this.tutorialHighlight?.allowedAction
        && this.isTutorialHighlightActionAllowed(targetAction, this.tutorialHighlight)) {
        return true;
      }
      const intro = this.getActiveTutorialIntro();
      if (intro) return this.isTutorialIntroActionAllowed(targetAction, intro);
      return this.isTutorialHighlightActionAllowed(targetAction);
    },

shouldBlockTutorialInput(point = {}) {
      if (!this.isTutorialInputActive()) return false;
      return !this.isTutorialActionAllowed(this.getTutorialControlAction(point));
    },

    blockTutorialCanvasInput(event) {
      global.ClientOperationLog?.record?.('input:tutorialBlocked', {
        dragAction: global.ClientOperationLog?.summarizeAction?.(this.dragAction),
      }, { flush: true });
      this.dragAction = null;
      this.worldMapPinchDragging = false;
      if (this.isWorldMapDragging()) this.finishWorldMapSnapshotDrag();
      this.stopCanvasEvent(event);
      return true;
    },

    handleDrag(phase, point, event) {
      if (!this.inputEnabled || !this.renderer) return false;
      if (this.isTutorialInputActive()) {
        if (phase === 'start') {
          if (this.shouldBlockTutorialInput(point)) return this.blockTutorialCanvasInput(event);
          return this.blockTutorialCanvasInput(event);
        }
        if (!this.dragAction) return this.blockTutorialCanvasInput(event);
      }
      if (phase === 'start' && typeof this.renderer.getHitTarget === 'function') {
        const action = this.getTechTreeHitAction(point) || this.renderer.getHitTarget(point);
        global.ClientOperationLog?.record?.('input:dragHit', {
          phase,
          point: global.ClientOperationLog?.summarizePoint?.(point),
          action: global.ClientOperationLog?.summarizeAction?.(action),
          mapHomeActive: Boolean(this.lastGame?.mapHomeActive),
          currentTab: this.lastGame?.state?.currentTab || this.lastGame?.activeTab || '',
          militaryView: this.lastGame?.state?.militaryView || this.lastGame?.militaryView || '',
        });
        if (this.canRouteTechTreeInteraction(action)) {
          this.dragAction = { type: 'techTreeDrag' };
        } else if (this.isWorldMapHudAction(action)) {
          return false;
        }
      }
      if (this.ensureWorldMapRuntimeCoordinator()?.canRouteDrag(phase, point, this.lastGame?.state)) {
        return this.handleWorldMapRuntimeDrag(phase, point, event);
      }
      if (phase === 'start') {
        if (this.dragAction) {
          // Reuse the hit-tested tech tree action from the HUD gate above.
        } else if (this.getActiveTab() === 'tech' && !this.hasBlockingOverlayOpen()) {
          this.dragAction = { type: 'techTreeDrag' };
        } else {
          if (typeof this.renderer.getHitTarget !== 'function') return false;
          const action = this.renderer.getHitTarget(point);
          if (
          action?.type !== 'worldMapDrag'
          && action?.type !== 'openWorldSite'
          && action?.type !== 'techTreeDrag'
          && action?.dragType !== 'techTreeDrag'
        ) return false;
          this.dragAction = action.dragType === 'techTreeDrag' ? { type: 'techTreeDrag' } : action;
        }
      }
      if (!this.dragAction) return false;
      const dragType = this.dragAction.type === 'techTreeDrag'
        ? 'techTreeDrag'
        : 'worldMapDrag';
      if (dragType === 'worldMapDrag' && phase === 'start') {
        this.closeWorldSiteHud({ direct: true });
        this.startWorldMapSnapshotDrag();
      }
      const handled = this.actionController?.handle?.({ type: dragType, phase, pointer: point }, { event }) || false;
      if (phase === 'start' || phase === 'end' || phase === 'cancel') {
        global.ClientOperationLog?.record?.('input:dragRouted', {
          phase,
          dragType,
          point: global.ClientOperationLog?.summarizePoint?.(point),
          handled,
        }, { flush: phase !== 'start' });
      } else if (dragType === 'worldMapDrag') {
        global.ClientOperationLog?.recordSampled?.('input:dragRouted', dragType, {
          phase,
          dragType,
          point: global.ClientOperationLog?.summarizePoint?.(point),
          handled,
        });
      }
      if (dragType === 'worldMapDrag' && (phase === 'end' || phase === 'cancel')) {
        this.finishWorldMapSnapshotDrag();
      }
      if (phase === 'end' || phase === 'cancel') {
        this.dragAction = null;
      }
      return handled;
    },

handleGesture(gesture, event) {
      if (!this.inputEnabled || !this.renderer) return false;
      if (this.isTutorialInputActive()) return this.blockTutorialCanvasInput(event);
      const worldMapGestureHandled = this.handleWorldMapGesture(gesture, event);
      if (worldMapGestureHandled) return true;
      if (!this.canRouteTechTreeInteraction()) return false;
      const point = {
        x: Number(gesture?.centerX ?? gesture?.x) || 0,
        y: Number(gesture?.centerY ?? gesture?.y) || 0,
      };
      if (!this.getTechTreeHitAction(point)) {
        if (typeof this.renderer.getHitTarget !== 'function') return false;
        if (!this.isTechTreeDragAction(this.renderer.getHitTarget(point))) return false;
      }
      const handled = this.actionController?.handle?.({ type: 'techTreeZoom', gesture }, { event }) || false;
      if (handled && event?.preventDefault) event.preventDefault();
      if (handled && event?.stopPropagation) event.stopPropagation();
      return handled;
    },

handleWorldMapGesture(gesture = {}, event) {
      if (gesture?.type !== 'pinchZoom') return false;
      if (this.isTutorialInputActive()) return false;
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      const state = this.lastGame?.state || {};
      if (!coordinator || !runtime || !this.isWorldMapHomeActive() || this.hasBlockingOverlayOpen()) return false;
      if (!coordinator.canRender?.(state)) return false;
      const point = {
        x: Number(gesture.centerX ?? gesture.x) || 0,
        y: Number(gesture.centerY ?? gesture.y) || 0,
      };
      if (!runtime.isPointInMap?.(point, state) && !this.worldMapPinchDragging) return false;
      const phase = gesture.phase || 'move';
      if (phase === 'end' || phase === 'cancel') {
        this.worldMapPinchDragging = false;
        this.finishWorldMapSnapshotDrag();
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        return true;
      }
      const dx = Number(gesture.deltaX);
      const dy = Number(gesture.deltaY);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
      if (!this.worldMapPinchDragging) {
        this.closeWorldSiteHud({ direct: true });
        const waterTimeMs = this.startWorldMapSnapshotDrag();
        runtime.waterTimeMs = waterTimeMs;
        this.worldMapPinchDragging = true;
      }
      const moved = runtime.setCamera?.(
        (Number(runtime.camera?.x) || 0) + dx,
        (Number(runtime.camera?.y) || 0) + dy,
        { source: 'pinchPan', render: false },
      ) !== false;
      this.worldMapRuntime = runtime;
      this.updateWorldMapDragCompositor();
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopPropagation) event.stopPropagation();
      return moved || true;
    },

handleTap(point, event) {
      if (!this.inputEnabled || !this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
      const action = this.renderer.getHitTarget(point);
      global.ClientOperationLog?.record?.('input:tapHit', {
        point: global.ClientOperationLog?.summarizePoint?.(point),
        action: global.ClientOperationLog?.summarizeAction?.(action),
        tutorialActive: this.isTutorialInputActive(),
        blockingOverlay: this.hasBlockingOverlayOpen?.(),
        mapHomeActive: Boolean(this.lastGame?.mapHomeActive),
        currentTab: this.lastGame?.state?.currentTab || this.lastGame?.activeTab || '',
        militaryView: this.lastGame?.state?.militaryView || this.lastGame?.militaryView || '',
      });
      if (this.isTutorialInputActive() && !this.isTutorialActionAllowed(action)) {
        return this.blockTutorialCanvasInput(event);
      }
      if (action?.type === 'blockCanvasModal') {
        const handled = this.handleAction(action, event);
        if (handled) this.stopCanvasEvent(event);
        return handled;
      }
      if (shouldRouteTapThroughWorldMapRuntime(action)) {
        const runtimeHandled = this.ensureWorldMapRuntimeCoordinator()?.handleTap(point, event) || false;
        this.observeAsyncActionResult(runtimeHandled);
        this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
        global.ClientOperationLog?.record?.(action ? 'input:tapRuntime' : 'input:tapMiss', {
          point: global.ClientOperationLog?.summarizePoint?.(point),
          actionType: action?.type || '',
          action: global.ClientOperationLog?.summarizeAction?.(action),
          runtimeHandled: summarizeHandledForOperationLog(runtimeHandled),
        }, { flush: true });
        if (runtimeHandled) return runtimeHandled;
        if (action?.type === 'selectWorldMarchTarget' && action.background) return false;
        const closed = this.closeWorldSiteHud({ direct: true });
        if (closed) {
          if (event?.preventDefault) event.preventDefault();
          if (event?.stopPropagation) event.stopPropagation();
          return true;
        }
        return false;
      }
      if (action?.disabled) {
        global.ClientOperationLog?.record?.('input:tapDisabled', {
          point: global.ClientOperationLog?.summarizePoint?.(point),
          action: global.ClientOperationLog?.summarizeAction?.(action),
        }, { flush: true });
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        return true;
      }
      if (!action) {
        const runtimeHandled = this.ensureWorldMapRuntimeCoordinator()?.handleTap(point, event) || false;
        this.observeAsyncActionResult(runtimeHandled);
        this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
        global.ClientOperationLog?.record?.('input:tapMiss', {
          point: global.ClientOperationLog?.summarizePoint?.(point),
          runtimeHandled: summarizeHandledForOperationLog(runtimeHandled),
        }, { flush: true });
        if (runtimeHandled) return runtimeHandled;
        const closed = this.closeWorldSiteHud({ direct: true });
        if (closed) {
          if (event?.preventDefault) event.preventDefault();
          if (event?.stopPropagation) event.stopPropagation();
          return true;
        }
        return false;
      }
      if (action.background && action.type !== 'closeWorldSite') {
        const closed = this.closeWorldSiteHud({ direct: true });
        if (closed) {
          if (event?.preventDefault) event.preventDefault();
          if (event?.stopPropagation) event.stopPropagation();
          return true;
        }
      }
      if (action.type === 'showFamousSkillTooltip') {
        const handled = typeof this.renderer.setPinnedFamousSkillTooltip === 'function'
          ? this.renderer.setPinnedFamousSkillTooltip(action)
          : false;
        if (handled) this.renderActive();
        return handled;
      }
      if (action.type === 'clearFamousSkillTooltip') {
        const handled = typeof this.renderer.clearFamousSkillTooltip === 'function'
          ? this.renderer.clearFamousSkillTooltip()
          : false;
        if (handled) this.renderActive();
        return handled;
      }
      const handled = this.handleAction(action, event);
      global.ClientOperationLog?.record?.('input:tapAction', {
        action: global.ClientOperationLog?.summarizeAction?.(action),
        handled: handled && typeof handled.then === 'function' ? 'promise' : Boolean(handled),
      }, { flush: true });
      this.advanceTutorialIntroAfterHandled(handled, action);
      if (handled && event?.preventDefault) event.preventDefault();
      if (handled && event?.stopPropagation) event.stopPropagation();
      return handled;
    },

handleAction(action, event, meta = {}) {
      const handled = this.actionController?.handle?.(action, { ...(meta || {}), event }) || false;
      if (action?.type === 'openWorldSite') {
        if (handled && typeof handled.then === 'function') {
          handled.then((value) => {
            if (value !== false) this.syncForwardedLocalAction(action);
          }).catch(() => {});
        } else if (handled) {
          this.syncForwardedLocalAction(action);
        }
      }
      return handled;
    },

advanceTutorialIntro(action = {}) {
      const controller = this.lastGame?.tutorialIntroOverlay || this.tutorialIntroOverlay || null;
      if (!controller || typeof controller.advanceFromAction !== 'function') return false;
      return controller.advanceFromAction(action);
    },

advanceTutorialIntroAfterHandled(handled, action = {}) {
      if (handled && typeof handled.then === 'function') {
        handled.then((value) => {
          if (value !== false) this.advanceTutorialIntro(action);
        }).catch((error) => this.actionController?.log?.(error));
        return true;
      }
      return handled ? this.advanceTutorialIntro(action) : false;
    },

isPointBlockedByTutorialShield(point = {}) {
      if (!this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
      return this.renderer.getHitTarget(point)?.type === 'blockCanvasModal';
    },

setInputEnabled(enabled) {
      this.inputEnabled = Boolean(enabled);
      if (!this.inputEnabled && this.tapDisposer) {
        this.tapDisposer();
        this.tapDisposer = null;
      }
      if (!this.inputEnabled && this.dragDisposer) {
        this.dragDisposer();
        this.dragDisposer = null;
      }
      if (!this.inputEnabled && this.gestureDisposer) {
        this.gestureDisposer();
        this.gestureDisposer = null;
      }
      if (!this.inputEnabled && this.pointerMoveDisposer) {
        this.pointerMoveDisposer();
        this.pointerMoveDisposer = null;
      }
      if (this.inputEnabled) this.bindInput();
    }
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellInputRouter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
