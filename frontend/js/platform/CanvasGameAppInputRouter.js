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

  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      handleDrag(phase, point = {}) {
            const routedInput = typeof this.resolveInputIntent === 'function' ? this.resolveInputIntent({ kind: 'drag', phase, pointer: point }) : null;
            const routedInputRoute = routedInput && routedInput.route;
            if (routedInputRoute ? routedInputRoute === 'entity-battle' : (typeof this.isModeEntityBattleActive === 'function' ? this.isModeEntityBattleActive() : this.entityBattle?.visible)) {
              return this.actionController?.handle?.({ type: 'entityBattleDrag', phase, pointer: point }) || false;
            }
            if (routedInputRoute ? routedInputRoute === 'tech-tree' : (typeof this.canRouteModeTechTree === 'function' ? this.canRouteModeTechTree() : this.activeTab === 'tech')) {
              return this.actionController?.handle?.({ type: 'techTreeDrag', phase, pointer: point }) || false;
            }
            if (routedInputRoute) {
              if (routedInputRoute !== 'world-map') return false;
            } else if (typeof this.canRouteModeWorldMap === 'function') {
              if (!this.canRouteModeWorldMap()) return false;
            } else if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
            if (
              this.isWorldMapHomeActive()
              && !this.hasBlockingOverlayOpen()
            ) {
              const handled = this.ensureWorldMapRuntimeCoordinator()?.handleDrag(phase, point) || false;
              this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
              return handled;
            }
            return this.actionController?.handle?.({ type: 'worldMapDrag', phase, pointer: point }) || false;
          },

      hasBlockingOverlayOpen() {
            if (typeof this.isModeBlockingOverlayOpen === 'function') return this.isModeBlockingOverlayOpen();
            const battleScene = typeof this.getRendererSnapshot === 'function'
              ? this.getRendererSnapshot()?.battle?.battleScene
              : null;
            const namingOpen = typeof this.isNamingSnapshotOpen === 'function'
              ? this.isNamingSnapshotOpen()
              : false;
            const confirmDialogOpen = typeof this.isConfirmDialogSnapshotOpen === 'function'
              ? this.isConfirmDialogSnapshotOpen()
              : false;
            return Boolean(this.showResourceDetails
              || this.showCitySwitcher
              || this.showSubcityList
              || this.showCityManagement
              || this.showAdvisor
              || this.tutorialAdvisorDialogue
              || this.canvasShell?.tutorialAdvisorDialogue
              || this.showTaskCenter
              || this.showGuidebook
              || this.showFamousPersons
              || this.armyFormationEditor?.open
              || confirmDialogOpen
              || this.activeCommandPanel
              || this.techDetailOpen
              || this.activeEventId
              || namingOpen
              || battleScene?.visible
              || this.entityBattle?.visible
              || this.rewardReveal);
          },

      handleGesture(gesture) {
            const routedInput = typeof this.resolveInputIntent === 'function' ? this.resolveInputIntent({ kind: 'gesture', gesture }) : null;
            const routedInputRoute = routedInput && routedInput.route;
            if (routedInputRoute ? routedInputRoute === 'entity-battle' : (typeof this.isModeEntityBattleActive === 'function' ? this.isModeEntityBattleActive() : this.entityBattle?.visible)) {
              return this.actionController?.handle?.({ type: 'entityBattleZoom', gesture }) || false;
            }
            const worldMapGestureHandled = this.handleWorldMapGesture(gesture);
            if (worldMapGestureHandled) return true;
            if (typeof this.canRouteModeTechTree === 'function') {
              if (!this.canRouteModeTechTree()) return false;
            } else if (this.activeTab !== 'tech' || this.hasBlockingOverlayOpen()) return false;
            return this.actionController?.handle?.({ type: 'techTreeZoom', gesture }) || false;
          },

      handleWorldMapGesture(gesture = {}) {
            if (gesture?.type !== 'pinchZoom') return false;
            const routedInput = typeof this.resolveInputIntent === 'function' ? this.resolveInputIntent({ kind: 'gesture', gesture }) : null;
            const routedInputRoute = routedInput && routedInput.route;
            if (routedInputRoute) {
              if (routedInputRoute !== 'world-map') return false;
            } else if (typeof this.canRouteModeWorldMap === 'function') {
              if (!this.canRouteModeWorldMap()) return false;
            } else if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
            if (!this.isWorldMapHomeActive() || this.hasBlockingOverlayOpen()) return false;
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            const runtime = coordinator?.getMapRuntime?.();
            if (!coordinator || !runtime || !coordinator.canRender?.(this.state)) return false;
            const point = {
              x: Number(gesture.centerX ?? gesture.x) || 0,
              y: Number(gesture.centerY ?? gesture.y) || 0,
            };
            if (!runtime.isPointInMap?.(point, this.state) && !this.worldMapPinchDragging) return false;
            const phase = gesture.phase || 'move';
            if (phase === 'end' || phase === 'cancel') {
              this.finishWorldMapSnapshotDrag();
              this.renderCanvasSurface(this.state?.currentTab || this.activeTab);
              return true;
            }
            const dx = Number(gesture.deltaX);
            const dy = Number(gesture.deltaY);
            if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
            if (!this.worldMapPinchDragging) {
              this.worldMapPinchDragging = true;
              runtime.waterTimeMs = this.startWorldMapSnapshotDrag();
            }
            runtime.setCamera?.(
              (Number(runtime.camera?.x) || 0) + dx,
              (Number(runtime.camera?.y) || 0) + dy,
              { source: 'pinchPan', render: false },
            );
            this.worldMapRuntime = runtime;
            this.renderWorldMapSnapshotDragFrame();
            return true;
          },

      observeAsyncActionResult(result) {
            if (result && typeof result.then === 'function') {
              result.catch((error) => this.log?.(error));
            }
            return result;
          },

      async handleTap(point) {
            const action = this.renderer.getHitTarget(point);
            global.ClientOperationLog?.record?.('input:tapHit', {
              point: global.ClientOperationLog?.summarizePoint?.(point),
              action: global.ClientOperationLog?.summarizeAction?.(action),
              blockingOverlay: this.hasBlockingOverlayOpen?.(),
              mapHomeActive: Boolean(this.mapHomeActive),
              currentTab: this.state?.currentTab || this.activeTab || '',
              militaryView: this.state?.militaryView || this.militaryView || '',
            });
            if (action?.type === 'blockCanvasModal') {
              return this.actionController?.handle?.(action);
            }
            if (action?.disabled) {
              global.ClientOperationLog?.record?.('input:tapDisabled', {
                point: global.ClientOperationLog?.summarizePoint?.(point),
                action: global.ClientOperationLog?.summarizeAction?.(action),
              }, { flush: true });
              return true;
            }
            if (shouldRouteTapThroughWorldMapRuntime(action)) {
              const handled = this.ensureWorldMapRuntimeCoordinator()?.handleTap(point);
              this.observeAsyncActionResult(handled);
              this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
              global.ClientOperationLog?.record?.(action ? 'input:tapRuntime' : 'input:tapMiss', {
                point: global.ClientOperationLog?.summarizePoint?.(point),
                actionType: action?.type || '',
                action: global.ClientOperationLog?.summarizeAction?.(action),
                runtimeHandled: summarizeHandledForOperationLog(handled),
              }, { flush: true });
              if (handled) return handled;
              return handled;
            }
            if (action.type === 'showFamousSkillTooltip') {
              this.renderer.setPinnedFamousSkillTooltip?.(action);
              this.render();
              return;
            }
            if (action.type === 'clearFamousSkillTooltip') {
              this.renderer.clearFamousSkillTooltip?.();
              this.render();
              return;
            }
            const handledResult = this.actionController?.handle?.(action);
            global.ClientOperationLog?.record?.('input:tapAction', {
              action: global.ClientOperationLog?.summarizeAction?.(action),
              handled: summarizeHandledForOperationLog(handledResult),
            }, { flush: true });
            const handled = await handledResult;
            this.advanceTutorialIntroAfterHandled(handled, action);
            return handled;
          },

      advanceTutorialIntro(action = {}) {
            const controller = this.tutorialIntroOverlay || null;
            if (!controller || typeof controller.advanceFromAction !== 'function') return false;
            return controller.advanceFromAction(action);
          },

      advanceTutorialIntroAfterHandled(handled, action = {}) {
            if (handled && typeof handled.then === 'function') {
              handled.then((value) => {
                if (value !== false) this.advanceTutorialIntro(action);
              }).catch((error) => this.log?.(error));
              return true;
            }
            return handled ? this.advanceTutorialIntro(action) : false;
          },

      isPointBlockedByTutorialShield(point = {}) {
            if (!this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
            return this.renderer.getHitTarget(point)?.type === 'blockCanvasModal';
          },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppInputRouter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
