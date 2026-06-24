(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const SharedRewardText = (() => {
    if (global.RewardText) return global.RewardText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/RewardText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  var WorldMarchOptimisticState = global.WorldMarchOptimisticState;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchOptimisticState) {
    try {
      WorldMarchOptimisticState = require('../domain/WorldMarchOptimisticState');
    } catch (_error) {
      WorldMarchOptimisticState = null;
    }
  }

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      async runAction(callback) {
            try {
              const data = await callback();
              if (data) this.applyState(data);
              return data;
            } catch (error) {
              this.log(error.payload?.message || error.message || t('command.action.failed', {}));
              return null;
            }
          },

      async seekFamousPerson(source = 'seek') {
            try {
              const result = await this.getGameApi().seekFamousPerson(source);
              this.applyApiState(result);
              this.showFamousPersons = true;
              this.famousPersonsPage = 0;
              this.selectedFamousPersonId = '';
              if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
              if (this.canvasShell && 'famousPersonsPage' in this.canvasShell) this.canvasShell.famousPersonsPage = 0;
              if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
              this.showFloatingText(result.message || t('command.famous.seekComplete'));
              this.log(result.message || t('command.famous.seekComplete'));
              return true;
            } catch (error) {
              this.log(t('command.famous.seekFailed', { message: error.payload?.message || error.message }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async acceptFamousPerson(candidateId) {
            try {
              const result = await this.getGameApi().acceptFamousPerson(candidateId);
              this.applyApiState(result);
              this.showFamousPersons = true;
              this.famousPersonsPage = 0;
              this.selectedFamousPersonId = '';
              if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
              if (this.canvasShell && 'famousPersonsPage' in this.canvasShell) this.canvasShell.famousPersonsPage = 0;
              if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
              this.showFloatingText(result.message || t('command.famous.accepted', {}));
              this.log(result.message || t('command.famous.accepted', {}));
              return true;
            } catch (error) {
              this.log(t('command.famous.acceptFailed', { message: error.payload?.message || error.message }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async dismissFamousPersonCandidate(candidateId) {
            try {
              const result = await this.getGameApi().dismissFamousPersonCandidate(candidateId);
              this.applyApiState(result);
              this.showFamousPersons = true;
              this.selectedFamousPersonId = '';
              if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
              if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
              this.showFloatingText(result.message || t('command.famous.dismissed', {}));
              this.log(result.message || t('command.famous.dismissed', {}));
              return true;
            } catch (error) {
              this.log(t('command.famous.dismissFailed', { message: error.payload?.message || error.message }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async assignFamousAttributePoint(personId, attribute) {
            try {
              const result = await this.getGameApi().assignFamousAttributePoint(personId, attribute);
              this.applyApiState(result);
              this.showFamousPersons = true;
              if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
              if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = personId;
              this.selectedFamousPersonId = personId;
              this.showFloatingText(result.message || t('command.famous.attributeUpgraded'));
              this.log(result.message || t('command.famous.attributeUpgraded'));
              return true;
            } catch (error) {
              this.log(t('command.famous.attributePointFailed', { message: error.payload?.message || error.message }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      getArmyFormation(cityId, slot) {
            const targetCityId = cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
            const targetSlot = Math.max(1, Math.min(3, Number(slot) || 1));
            const formations = this.state?.military?.formations || {};
            const cityFormations = Array.isArray(formations[targetCityId]) ? formations[targetCityId] : [];
            return cityFormations.find((item) => Number(item?.slot) === targetSlot) || cityFormations[targetSlot - 1] || null;
          },

      getArmyFormationSoldierCap(cityId, slot) {
            const formation = this.getArmyFormation(cityId, slot);
            return Math.max(0, Math.floor(Number(formation?.maxSoldiersPerMember) || 1000));
          },

      getArmyFormationReserveSoldiers(cityId) {
            const targetCityId = cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
            const cityMilitary = this.state?.cities?.[targetCityId]?.military || this.state?.military || {};
            return Math.max(0, Math.floor(Number(cityMilitary.soldiers) || 0));
          },

      normalizeArmyFormationAssignments(assignments = {}, memberIds = [], cap = 1000) {
            const max = Math.max(0, Math.floor(Number(cap) || 1000));
            const result = {};
            (Array.isArray(memberIds) ? memberIds : []).forEach((memberId) => {
              const id = String(memberId || '').trim();
              if (!id) return;
              result[id] = Math.max(0, Math.min(max, Math.floor(Number(assignments?.[id]) || 0)));
            });
            return result;
          },

      sumArmyFormationAssignments(assignments = {}) {
            return Object.values(assignments && typeof assignments === 'object' ? assignments : {})
              .reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);
          },

      createArmyFormationEditorState(editor = {}) {
            return {
              open: false,
              cityId: '',
              slot: 1,
              memberIds: [],
              soldierAssignments: {},
              soldierDraftAssignments: {},
              page: 0,
              saving: false,
              ...(editor || {}),
            };
          },

      getArmyFormationEditablePool(editor = {}) {
            const cityId = editor.cityId || this.state?.activeCityId || 'capital';
            const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
            const formation = this.getArmyFormation(cityId, slot) || {};
            const previousAssigned = this.sumArmyFormationAssignments(formation.soldierAssignments || {});
            return previousAssigned + this.getArmyFormationReserveSoldiers(cityId);
          },

      setArmyFormationSoldierDraft(personId, value, options = {}) {
            const editor = this.armyFormationEditor || {};
            if (!editor.open) return false;
            const id = String(personId || '').trim();
            const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : [];
            if (!id || !memberIds.includes(id)) return false;
            const cap = this.getArmyFormationSoldierCap(editor.cityId, editor.slot);
            const assignments = this.normalizeArmyFormationAssignments(
              editor.soldierDraftAssignments || editor.soldierAssignments || {},
              memberIds,
              cap,
            );
            const pool = this.getArmyFormationEditablePool(editor);
            const others = memberIds.reduce((sum, memberId) => (
              memberId === id ? sum : sum + Math.max(0, Math.floor(Number(assignments[memberId]) || 0))
            ), 0);
            assignments[id] = Math.max(0, Math.min(cap, pool - others, Math.floor(Number(value) || 0)));
            return this.setArmyFormationEditor({ ...editor, soldierDraftAssignments: assignments }, { render: options.render !== false });
          },

      setArmyFormationEditor(editor = {}, options = {}) {
            const next = this.createArmyFormationEditorState(editor);
            const cap = this.getArmyFormationSoldierCap(next.cityId, next.slot);
            next.memberIds = Array.isArray(next.memberIds) ? next.memberIds.slice(0, 5) : [];
            next.soldierAssignments = this.normalizeArmyFormationAssignments(next.soldierAssignments || {}, next.memberIds, cap);
            next.soldierDraftAssignments = this.normalizeArmyFormationAssignments(
              next.soldierDraftAssignments || next.soldierAssignments || {},
              next.memberIds,
              cap,
            );
            this.armyFormationEditor = next;
            if (this.canvasShell && typeof this.canvasShell === 'object') {
              this.canvasShell.armyFormationEditor = { ...this.armyFormationEditor };
            }
            if (options.render !== false) this.renderCanvasSurface(this.state?.currentTab);
            return true;
          },

      openArmyFormation(action = {}) {
            const slot = Math.max(1, Math.min(3, Number(action.slot) || 1));
            const cityId = action.cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
            const formation = this.getArmyFormation(cityId, slot);
            const memberIds = Array.isArray(formation?.memberIds) ? formation.memberIds : [];
            const cap = this.getArmyFormationSoldierCap(cityId, slot);
            return this.setArmyFormationEditor({
              open: true,
              cityId,
              slot,
              memberIds: [...memberIds].slice(0, 5),
              soldierAssignments: this.normalizeArmyFormationAssignments(formation?.soldierAssignments || {}, memberIds, cap),
              soldierDraftAssignments: this.normalizeArmyFormationAssignments(formation?.soldierAssignments || {}, memberIds, cap),
              page: 0,
              saving: false,
            });
          },

      closeArmyFormationEditor(options = {}) {
            return this.setArmyFormationEditor(this.createArmyFormationEditorState(), options);
          },

      toggleArmyFormationMember(action = {}) {
            const editor = this.armyFormationEditor || {};
            if (!editor.open) return false;
            const personId = String(action.personId || '').trim();
            if (!personId) return false;
            const memberIds = Array.isArray(editor.memberIds) ? [...editor.memberIds] : [];
            const assignments = { ...(editor.soldierAssignments || {}) };
            const draftAssignments = { ...(editor.soldierDraftAssignments || editor.soldierAssignments || {}) };
            const index = memberIds.indexOf(personId);
            if (index >= 0) {
              memberIds.splice(index, 1);
              delete assignments[personId];
              delete draftAssignments[personId];
            } else {
              if (memberIds.length >= 5) {
                this.showFloatingText(t('command.formation.full'));
                return false;
              }
              memberIds.push(personId);
              assignments[personId] = 0;
              draftAssignments[personId] = 0;
            }
            return this.setArmyFormationEditor({
              ...editor,
              memberIds,
              soldierAssignments: this.normalizeArmyFormationAssignments(
                assignments,
                memberIds,
                this.getArmyFormationSoldierCap(editor.cityId, editor.slot),
              ),
              soldierDraftAssignments: this.normalizeArmyFormationAssignments(
                draftAssignments,
                memberIds,
                this.getArmyFormationSoldierCap(editor.cityId, editor.slot),
              ),
            }, { render: true });
          },

      changeArmyFormationPage(action = {}) {
            const editor = this.armyFormationEditor || {};
            if (!editor.open) return false;
            const page = Math.max(0, (Number(editor.page) || 0) + (Number(action.delta) || 0));
            return this.setArmyFormationEditor({ ...editor, page }, { render: true });
          },

      changeArmyFormationSoldiers(action = {}) {
            const editor = this.armyFormationEditor || {};
            if (!editor.open || editor.saving) return false;
            const cap = this.getArmyFormationSoldierCap(editor.cityId, editor.slot);
            const ratio = Math.max(0, Math.min(1, Number(action.ratio) || 0));
            return this.setArmyFormationSoldierDraft(action.personId, Math.round(cap * ratio));
          },

      async requestArmyFormationSoldierInput(action = {}) {
            const editor = this.armyFormationEditor || {};
            if (!editor.open || editor.saving) return false;
            const personId = String(action.personId || '').trim();
            if (!personId) return false;
            const current = Math.max(0, Math.floor(Number(
              editor.soldierDraftAssignments?.[personId] ?? editor.soldierAssignments?.[personId],
            ) || 0));
            const input = typeof this.runtime?.requestTextInput === 'function'
              ? await this.runtime.requestTextInput({
                title: t('command.formation.soldierTitle'),
                message: t('command.formation.soldierPrompt'),
                placeholder: '0',
                value: String(current),
                inputType: 'number',
              })
              : global.prompt?.(t('command.formation.soldierTitle'), String(current));
            if (input === null || input === undefined || input === '') return false;
            return this.setArmyFormationSoldierDraft(personId, input);
          },

      autoReplenishArmyFormation() {
            const editor = this.armyFormationEditor || {};
            if (!editor.open || editor.saving) return false;
            const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : [];
            if (!memberIds.length) return false;
            const cap = this.getArmyFormationSoldierCap(editor.cityId, editor.slot);
            let remaining = this.getArmyFormationEditablePool(editor);
            const assignments = {};
            let active = [...memberIds];
            while (active.length && remaining > 0) {
              const share = Math.max(1, Math.floor(remaining / active.length));
              const nextActive = [];
              active.forEach((memberId) => {
                const current = assignments[memberId] || 0;
                const add = Math.min(cap - current, share, remaining);
                assignments[memberId] = current + add;
                remaining -= add;
                if (assignments[memberId] < cap) nextActive.push(memberId);
              });
              if (nextActive.length === active.length && share <= 0) break;
              active = nextActive;
            }
            return this.setArmyFormationEditor({
              ...editor,
              soldierDraftAssignments: this.normalizeArmyFormationAssignments(assignments, memberIds, cap),
            }, { render: true });
          },

      async saveArmyFormation() {
            const editor = this.armyFormationEditor || {};
            if (!editor.open || editor.saving) return false;
            const cityId = editor.cityId || this.state?.activeCityId || 'capital';
            const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
            const memberIds = (Array.isArray(editor.memberIds) ? editor.memberIds : []).slice(0, 5);
            const soldierAssignments = this.normalizeArmyFormationAssignments(
              editor.soldierDraftAssignments || editor.soldierAssignments || {},
              memberIds,
              this.getArmyFormationSoldierCap(cityId, slot),
            );
            this.setArmyFormationEditor({ ...editor, saving: true }, { render: true });
            try {
              const result = await this.getGameApi().setArmyFormation(cityId, slot, memberIds, soldierAssignments);
              this.applyApiState(result);
              this.closeArmyFormationEditor({ render: false });
              const tutorialHandled = this.tutorialController?.onArmyFormationSaved?.(result) === true;
              this.showFloatingText(result.message || t('command.formation.saved'));
              this.log(result.message || t('command.formation.saved'));
              if (!tutorialHandled) {
                this.tutorialController?.sync?.(this.tutorial);
                this.tutorialController?.refreshCurrentHighlight?.();
                this.renderCanvasSurface(this.state?.currentTab);
              }
              return true;
            } catch (error) {
              const message = error.payload?.message || error.message || t('command.formation.saveFailed');
              this.setArmyFormationEditor({ ...editor, saving: false }, { render: false });
              this.showFloatingText(message);
              this.log(message);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async apiGet(path) {
            const api = this.getGameApi();
            const startedAt = Date.now();
            try {
              const data = await api.request('GET', path);
              this.cacheRequestLog?.(path, 'GET', null, 200, data, Date.now() - startedAt);
              return data;
            } catch (error) {
              this.cacheRequestLog?.(path, 'GET', null, error.payload?.statusCode || 500, error.payload || { message: error.message }, Date.now() - startedAt);
              throw error;
            }
          },

      async apiPost(path, body) {
            const api = this.getGameApi();
            const startedAt = Date.now();
            try {
              const data = await api.request('POST', path, body);
              this.cacheRequestLog?.(path, 'POST', body, 200, data, Date.now() - startedAt);
              return data;
            } catch (error) {
              this.cacheRequestLog?.(path, 'POST', body, error.payload?.statusCode || 500, error.payload || { message: error.message }, Date.now() - startedAt);
              throw error;
            }
          },

      async handleBuildingSuccess(result, action, buildingId) {
            if (this.commandService?.handleBuildingSuccess) {
              this.pendingTutorialAdvisorDialogue = action === 'build' && buildingId === 'house';
              try {
                const handled = await this.commandService.handleBuildingSuccess(result, action, buildingId);
                this.tutorialController?.sync?.(this.tutorial);
                this.maybeShowHouseBuiltAdvisor(action, buildingId);
                return handled;
              } finally {
                this.pendingTutorialAdvisorDialogue = false;
              }
            }
            this.pendingTutorialAdvisorDialogue = action === 'build' && buildingId === 'house';
            try {
              this.applyApiState(result);
              this.showFloatingText(action === 'upgrade' ? t('command.building.upgradeSuccess') : t('command.building.buildSuccess'));
              this.log(`Success: ${result?.message || ''}`);
              this.tutorialController?.sync?.(this.tutorial);
              this.maybeShowHouseBuiltAdvisor(action, buildingId);
              return true;
            } finally {
              this.pendingTutorialAdvisorDialogue = false;
            }
          },

      maybeShowHouseBuiltAdvisor(action, buildingId) {
            const steps = this.tutorialController?.constructor?.TUTORIAL_STEPS || {};
            if (action !== 'build' || buildingId !== 'house') return false;
            if (Number(this.tutorial?.currentStep) !== Number(steps.houseBuilt)) return false;
            return this.showHouseBuiltAdvisorDialogue();
          },

      showHouseBuiltAdvisorDialogue() {
            const message = t('command.house.builtAdvisor');
            this.state = {
              ...(this.state || {}),
              softGuide: {
                mode: 'strong',
                target: 'tab-civilization',
                message,
              },
            };
            this.showAdvisor = false;
            this.showCityManagement = false;
            this.showSubcityList = false;
            this.activeCommandPanel = '';
            this.activeEventId = null;
            this.tutorialHighlight = null;
            this.tutorialAdvisorDialogue = { message, advisorName: t('tutorial.advisorName'), source: 'houseBuilt' };
            if (this.canvasShell) {
              this.canvasShell.showAdvisor = false;
              this.canvasShell.showCityManagement = false;
              this.canvasShell.showSubcityList = false;
              this.canvasShell.activeCommandPanel = '';
              this.canvasShell.activeEventId = null;
              this.canvasShell.tutorialAdvisorDialogue = this.tutorialAdvisorDialogue;
              this.canvasShell.tutorialHighlight = null;
            }
            this.renderCanvasSurface(this.state?.currentTab || this.getActiveTab());
            return true;
          },

      setPendingBuildingAction(pending = null, options = {}) {
            const nextPending = pending && pending.buildingId
              ? {
                buildingId: pending.buildingId,
                action: pending.action === 'upgrade' ? 'upgrade' : 'build',
              }
              : null;
            this.pendingBuildingAction = nextPending;
            if (this.canvasShell && typeof this.canvasShell === 'object') {
              this.canvasShell.pendingBuildingAction = nextPending;
            }
            if (options.render !== false) this.renderCanvasSurface(this.state?.currentTab || this.getActiveTab());
            return true;
          },

      async buildBuilding(buildingId) {
            return this.commandService?.buildBuilding
              ? this.commandService.buildBuilding(buildingId)
              : this.handleBuildingAction(buildingId, 'build');
          },

      async upgradeBuilding(buildingId) {
            return this.commandService?.upgradeBuilding
              ? this.commandService.upgradeBuilding(buildingId)
              : this.handleBuildingAction(buildingId, 'upgrade');
          },

      async handleBuildingAction(buildingId, action) {
            if (this.commandService?.handleBuildingAction) {
              return this.commandService.handleBuildingAction(buildingId, action);
            }
            return false;
          },

      async assignJob(job, delta) {
            if (!this.token && this.authStorage) {
              this.log(t('command.auth.loginRequired'));
              return false;
            }
            try {
              const result = await this.getGameApi().assignJob(job, delta);
              if (result?.success === false) {
                this.log(result.message || t('command.job.assignFailed'));
                const data = await this.getGameApi().getState?.();
                if (data?.gameState) this.applyApiState(data);
                return false;
              }
              this.applyApiState(result);
              this.log(t('command.job.assigned', { delta: `${delta > 0 ? '+' : ''}${delta}`, job }));
              return true;
            } catch (error) {
              this.log(t('command.job.assignFailedDetail', { message: error.payload?.message || error.message }));
              try {
                const data = await this.getGameApi().getState?.();
                if (data?.gameState) this.applyApiState(data);
              } catch (_) {}
              return false;
            }
          },

      async applyTalentPolicy(policyId) {
            if (!policyId) return false;
            try {
              const result = await this.getGameApi().applyTalentPolicy(policyId);
              this.applyApiState(result);
              this.showFloatingText(result.message || t('command.policy.applied', {}));
              this.log(result.message || t('command.policy.applied', {}));
              return true;
            } catch (error) {
              this.log(t('command.policy.failed', { message: error.payload?.message || error.message }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async advanceEra() {
            if (!this.canAdvanceEraNow()) {
              this.log(this.state?.isCapitalCity === false
                ? t('command.era.capitalOnly', {})
                : this.canAdvanceEraByTutorial()
                  ? t('command.era.requirementsNotMet', {})
                  : t('command.era.locked', {}));
              this.renderMilitary();
              return false;
            }
            try {
              const result = await this.getGameApi().advanceEra();
              this.applyApiState(result);
              this.tutorialController?.sync?.(this.tutorial);
              this.tutorialController?.onEraAdvanced?.(result);
              this.log(t('command.era.entered', { message: result.message || this.state.currentEraName || '' }));
              this.showFloatingText(result.message || this.state.currentEraName || t('command.era.advanced', {}));
              return true;
            } catch (error) {
              this.log(t('command.failedDetail', { message: error.payload?.message || error.message }));
              return false;
            } finally {
              this.renderMilitary();
            }
          },

      async research(techId) {
            return this.commandService?.research
              ? this.commandService.research(techId)
              : false;
          },

      async startWorldMarch(options = {}) {
            let optimistic = null;
            try {
              const trace = global.WorldMarchTrace;
              trace?.log?.('app:startWorldMarch:begin', {
                options: {
                  mode: options.mode || 'manual',
                  targetQ: options.targetQ ?? options.q ?? options.x ?? null,
                  targetR: options.targetR ?? options.r ?? options.y ?? null,
                  formationSlot: options.formationSlot ?? options.slot ?? null,
                },
                before: trace.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
              });
              optimistic = WorldMarchOptimisticState?.beginStart?.(this, { ...options, mode: 'manual' }) || null;
              const api = this.getGameApi();
              const result = await api.startWorldMarch({ ...options, mode: 'manual' });
              trace?.log?.('app:startWorldMarch:apiResult', {
                result: trace.summarizeApiPayload?.(result) || result,
              });
              this.applyApiState(result);
              WorldMarchOptimisticState?.complete?.(this, optimistic || result?.mission?.id || '');
              trace?.log?.('app:startWorldMarch:afterApply', {
                after: trace.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
              });
              this.territoryUiState = {
                ...(this.territoryUiState || {}),
                worldMarchTarget: null,
                selectedWorldActorId: '',
                selectedWorldMissionId: '',
              };
              if (this.canvasShell?.territoryUiState) {
                this.canvasShell.territoryUiState.worldMarchTarget = null;
                this.canvasShell.territoryUiState.selectedWorldActorId = '';
                this.canvasShell.territoryUiState.selectedWorldMissionId = '';
              }
              this.tutorialController?.sync?.(this.tutorial);
              this.tutorialController?.onExploreStarted?.(result);
              this.showFloatingText(result.message || t('command.worldMarch.started', {}));
              this.log(result.message || t('command.worldMarch.started', {}));
              return true;
            } catch (error) {
              global.WorldMarchTrace?.error?.('app:startWorldMarch:error', {
                message: error.payload?.message || error.message,
                payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
              });
              WorldMarchOptimisticState?.rollback?.(this, optimistic || '', { render: false });
              this.log(t('command.worldMarch.failed', { message: error.payload?.message || error.message || '' }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async returnWorldMarch(missionId, options = {}) {
            if (!missionId) return false;
            let optimistic = null;
            try {
              global.WorldMarchTrace?.log?.('app:returnWorldMarch:begin', {
                missionId,
                before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
              });
              optimistic = WorldMarchOptimisticState?.beginReturn?.(this, missionId, options) || null;
              const api = this.getGameApi();
              const result = await api.returnWorldMarch(missionId, options);
              this.applyApiState(result);
              WorldMarchOptimisticState?.complete?.(this, optimistic || missionId);
              global.WorldMarchTrace?.log?.('app:returnWorldMarch:afterApply', {
                result: global.WorldMarchTrace?.summarizeApiPayload?.(result) || result,
                after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
              });
              this.showFloatingText(result.message || t('command.worldMarch.returning', {}));
              this.log(result.message || t('command.worldMarch.returning', {}));
              return true;
            } catch (error) {
              global.WorldMarchTrace?.error?.('app:returnWorldMarch:error', {
                missionId,
                message: error.payload?.message || error.message,
                payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
              });
              WorldMarchOptimisticState?.rollback?.(this, optimistic || missionId, { render: false });
              this.log(t('command.worldMarch.returnFailed', { message: error.payload?.message || error.message || '' }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async stopWorldMarch(missionId, options = {}) {
            if (!missionId) return false;
            try {
              global.WorldMarchTrace?.log?.('app:stopWorldMarch:begin', {
                missionId,
                before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
              });
              const api = this.getGameApi();
              const result = await api.stopWorldMarch(missionId, options);
              this.applyApiState(result);
              global.WorldMarchTrace?.log?.('app:stopWorldMarch:afterApply', {
                result: global.WorldMarchTrace?.summarizeApiPayload?.(result) || result,
                after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
              });
              this.showFloatingText(result.message || t('command.worldMarch.stopped', {}));
              this.log(result.message || t('command.worldMarch.stopped', {}));
              return true;
            } catch (error) {
              global.WorldMarchTrace?.error?.('app:stopWorldMarch:error', {
                missionId,
                message: error.payload?.message || error.message,
                payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
              });
              this.log(t('command.worldMarch.stopFailed', { message: error.payload?.message || error.message || '' }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async claimGuideTaskReward(_taskId) {
            return false;
          },

      async claimTaskReward(taskId, category = 'main', _options = {}) {
            if (!taskId) return false;
            try {
              const api = this.getGameApi();
              const result = await api.claimTaskReward(taskId, category || 'main');
              this.applyApiState(result);
              this.tutorialController?.sync?.(this.tutorial);
              this.tutorialController?.onTaskRewardClaimed?.(result);
              if (!this.canvasShell?.showRewardReveal?.(result.rewardReveal) && result.rewardReveal) {
                this.rewardReveal = {
                  ...result.rewardReveal,
                  createdAt: this.runtime?.now?.() || Date.now(),
                };
                this.renderCanvasSurface(this.state?.currentTab);
              }
              this.showFloatingText(
                SharedRewardText && SharedRewardText.hasResources(result.rewardReveal?.resources)
                  ? SharedRewardText.formatResources(result.rewardReveal.resources)
                  : result.message || t('command.reward.claimed'),
              );
              this.log(t('command.reward.detail', { message: result.message || '' }));
              return true;
            } catch (error) {
              this.log(t('command.failedDetail', { message: error.payload?.message || error.message }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async switchCity(cityId) {
            return this.commandService?.switchCity
              ? this.commandService.switchCity(cityId)
              : false;
          },

      async enterCity(cityId, options = {}) {
            const targetCityId = cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
            if (!targetCityId) return false;
            try {
              const currentCityId = this.state?.activeCityId
                || this.state?.cityState?.activeCityId
                || this.state?.cityState?.capitalCityId
                || 'capital';
              this.closeCitySwitcher({ skipRender: true });
              this.showSubcityList = false;
              this.activeCommandPanel = '';
              this.activeEventId = null;
              if (this.canvasShell) {
                this.canvasShell.showSubcityList = false;
                this.canvasShell.activeCommandPanel = '';
                this.canvasShell.activeEventId = null;
              }
              if (targetCityId !== currentCityId) {
                const result = await this.getGameApi().switchCity(targetCityId);
                this.applyApiState(result);
              }
              this.showCityManagement = true;
              this.activeCityManagementTab = options.tab || this.activeCityManagementTab || 'buildings';
              this.territoryUiState = {
                ...(this.territoryUiState || {}),
                selectedSiteId: '',
                worldMarchTarget: null,
                selectedWorldActorId: '',
                selectedWorldMissionId: '',
              };
              this.territoryController?.closeSiteDialog?.();
              if (this.canvasShell) {
                this.canvasShell.showCityManagement = true;
                this.canvasShell.activeCityManagementTab = this.activeCityManagementTab;
                this.canvasShell.territoryUiState = {
                  ...(this.canvasShell.territoryUiState || {}),
                  selectedSiteId: '',
                  worldMarchTarget: null,
                  selectedWorldActorId: '',
                  selectedWorldMissionId: '',
                };
              }
              const homeView = this.resolveMapHomeViewState(this.state, { requestedTab: 'resources', forceMapHome: true });
              this.activeTab = homeView.activeTab;
              this.militaryView = homeView.militaryView;
              this.mapHomeActive = homeView.isMapHome;
              this.state = {
                ...this.state,
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
              };
              this.renderCanvasSurface(homeView.activeTab);
              this.tutorialController?.markCityEntered?.().then(() => {
                this.tutorialController?.refreshCurrentHighlight?.();
              }).catch((error) => this.log(error?.message || String(error)));
              return true;
            } catch (error) {
              this.log(t('command.failedDetail', { message: error.payload?.message || error.message }));
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppCommands = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
