(function (global) {
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      handleDrag(phase, point = {}) {
            if (this.activeTab === 'tech') {
              return this.actionController?.handle?.({ type: 'techTreeDrag', phase, pointer: point }) || false;
            }
            if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
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
              || this.showTalentPolicy
              || this.armyFormationEditor?.open
              || this.activeCommandPanel
              || this.techDetailOpen
              || this.activeEventId
              || this.naming?.visible
              || this.battleScene?.visible
              || this.rewardReveal);
          },

      handleGesture(gesture) {
            const worldMapGestureHandled = this.handleWorldMapGesture(gesture);
            if (worldMapGestureHandled) return true;
            if (this.activeTab !== 'tech' || this.hasBlockingOverlayOpen()) return false;
            return this.actionController?.handle?.({ type: 'techTreeZoom', gesture }) || false;
          },

      handleWorldMapGesture(gesture = {}) {
            if (gesture?.type !== 'pinchZoom') return false;
            if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
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

      async handleTap(point) {
            const action = this.renderer.getHitTarget(point);
            if (action?.type === 'blockCanvasModal') {
              return this.actionController?.handle?.(action);
            }
            if (action?.disabled) return true;
            if (!action) {
              const handled = this.ensureWorldMapRuntimeCoordinator()?.handleTap(point);
              this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
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
            const handled = await this.actionController?.handle?.(action);
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
              });
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
