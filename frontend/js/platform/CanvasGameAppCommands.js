(function (global) {
  var WorldMarchOptimisticState = global.WorldMarchOptimisticState;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchOptimisticState) {
    try {
      WorldMarchOptimisticState = require('../domain/WorldMarchOptimisticState');
    } catch (_error) {
      WorldMarchOptimisticState = null;
    }
  }

  function getPanelActionRunner(host) {
    const existing = host?.panelActionRunner || null;
    if (existing) return existing;
    const RunnerCtor = global.CanvasPanelActionRunner || null;
    if (!RunnerCtor || !host || typeof host !== 'object') return null;
    host.panelActionRunner = new RunnerCtor();
    return host.panelActionRunner;
  }

  function setField(target, key, value) {
    if (target && typeof target === 'object' && key in target) target[key] = value;
  }

  function fallbackOpenFamousPanel(host, personId = '') {
    [host, host?.canvasShell].filter(Boolean).forEach((target) => {
      setField(target, 'showFamousPersons', true);
      setField(target, 'famousPersonsPage', 0);
      setField(target, 'selectedFamousPersonId', personId || '');
    });
    return true;
  }

  function markFamousModalDirty(host, reason = 'famousCommand', payload = {}) {
    const context = host?.getPanelActionContext?.() || host || {};
    const scheduler = context?.getScheduler?.() || host?.stageScheduler || host?.canvasShell?.stageScheduler || null;
    scheduler?.markDirty?.('modal', reason, payload);
    if (scheduler?.flush) return scheduler.flush(['modal']);
    const manager = context?.getPanelSurfaceManager?.()
      || host?.panelSurfaceManager
      || host?.canvasShell?.panelSurfaceManager
      || null;
    return manager?.projectModalLayer?.({ context, reason, payload }) === true;
  }

  function reopenFamousPanelAfterCommand(host, options = {}) {
    const runner = getPanelActionRunner(host);
    const source = options.source || 'famousCommand';
    const opened = runner?.run?.({
      type: 'openFamousPersons',
      source,
      bypassPanelOpenVeto: true,
    }, host) === true;
    if (!opened) {
      fallbackOpenFamousPanel(host, options.personId || '');
      markFamousModalDirty(host, `${source}.fallback`, { options });
    }
    if (options.personId) {
      const detailOpened = runner?.run?.({
        type: 'openFamousPersonDetail',
        personId: options.personId,
        source,
      }, host) === true;
      if (!detailOpened) {
        fallbackOpenFamousPanel(host, options.personId);
        markFamousModalDirty(host, `${source}.detail`, { options });
      }
    }
    return true;
  }

  function refreshFamousPanelAfterFailure(host, reason = 'famousCommand.failure') {
    if (!host?.showFamousPersons && !host?.canvasShell?.showFamousPersons) return false;
    return markFamousModalDirty(host, reason, {});
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
              this.log(error.payload?.message || error.message || '鎿嶄綔澶辫触');
              return null;
            }
          },

      async seekFamousPerson(source = 'seek') {
            try {
              const result = await this.getGameApi().seekFamousPerson(source);
              this.applyApiState(result, { render: false });
              reopenFamousPanelAfterCommand(this, { source: 'seekFamousPerson' });
              this.showFloatingText(result.message || '瀵昏瀹屾垚');
              this.log(result.message || '瀵昏瀹屾垚');
              return true;
            } catch (error) {
              this.log(`瀵昏澶辫触锟?{error.payload?.message || error.message}`);
              refreshFamousPanelAfterFailure(this, 'seekFamousPerson.failure');
              return false;
            }
          },

      async acceptFamousPerson(candidateId) {
            try {
              const result = await this.getGameApi().acceptFamousPerson(candidateId);
              this.applyApiState(result, { render: false });
              reopenFamousPanelAfterCommand(this, { source: 'acceptFamousPerson' });
              this.showFloatingText(result.message || 'Famous person accepted');
              this.log(result.message || 'Famous person accepted');
              return true;
            } catch (error) {
              this.log(`鎺ョ撼澶辫触锟?{error.payload?.message || error.message}`);
              refreshFamousPanelAfterFailure(this, 'acceptFamousPerson.failure');
              return false;
            }
          },

      async dismissFamousPersonCandidate(candidateId) {
            try {
              const result = await this.getGameApi().dismissFamousPersonCandidate(candidateId);
              this.applyApiState(result, { render: false });
              reopenFamousPanelAfterCommand(this, { source: 'dismissFamousPersonCandidate' });
              this.showFloatingText(result.message || 'Candidate dismissed');
              this.log(result.message || 'Candidate dismissed');
              return true;
            } catch (error) {
              this.log(`鏀惧純澶辫触锟?{error.payload?.message || error.message}`);
              refreshFamousPanelAfterFailure(this, 'dismissFamousPersonCandidate.failure');
              return false;
            }
          },

      async assignFamousAttributePoint(personId, attribute) {
            try {
              const result = await this.getGameApi().assignFamousAttributePoint(personId, attribute);
              this.applyApiState(result, { render: false });
              reopenFamousPanelAfterCommand(this, { source: 'assignFamousAttributePoint', personId });
              this.showFloatingText(result.message || '灞炴€у凡鎻愬崌');
              this.log(result.message || '灞炴€у凡鎻愬崌');
              return true;
            } catch (error) {
              this.log(`鍔犵偣澶辫触锟?{error.payload?.message || error.message}`);
              refreshFamousPanelAfterFailure(this, 'assignFamousAttributePoint.failure');
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
                this.showFloatingText('编队已满');
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
                title: '兵力',
                message: '设置编队兵力',
                placeholder: '0',
                value: String(current),
                inputType: 'number',
              })
              : global.prompt?.('兵力', String(current));
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

      confirmArmyFormationSoldiers() {
            const editor = this.armyFormationEditor || {};
            if (!editor.open || editor.saving) return false;
            const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : [];
            const cap = this.getArmyFormationSoldierCap(editor.cityId, editor.slot);
            const soldierAssignments = this.normalizeArmyFormationAssignments(
              editor.soldierDraftAssignments || editor.soldierAssignments || {},
              memberIds,
              cap,
            );
            this.showFloatingText?.('\u8865\u5175\u5df2\u786e\u8ba4');
            return this.setArmyFormationEditor({
              ...editor,
              soldierAssignments,
              soldierDraftAssignments: { ...soldierAssignments },
            }, { render: true });
          },

      async saveArmyFormation() {
            const editor = this.armyFormationEditor || {};
            if (!editor.open || editor.saving) return false;
            const cityId = editor.cityId || this.state?.activeCityId || 'capital';
            const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
            const memberIds = (Array.isArray(editor.memberIds) ? editor.memberIds : []).slice(0, 5);
            const soldierAssignments = this.normalizeArmyFormationAssignments(
              editor.soldierAssignments || {},
              memberIds,
              this.getArmyFormationSoldierCap(cityId, slot),
            );
            this.setArmyFormationEditor({ ...editor, saving: true }, { render: true });
            try {
              const result = await this.getGameApi().setArmyFormation(cityId, slot, memberIds, soldierAssignments);
              this.applyApiState(result);
              this.closeArmyFormationEditor({ render: false });
              const tutorialHandled = this.tutorialController?.onArmyFormationSaved?.(result) === true;
              this.showFloatingText(result.message || '编队已保存');
              this.log(result.message || '编队已保存');
              if (!tutorialHandled) {
                this.tutorialController?.sync?.(this.tutorial);
                this.tutorialController?.refreshCurrentHighlight?.();
                this.renderCanvasSurface(this.state?.currentTab);
              }
              return true;
            } catch (error) {
              const message = error.payload?.message || error.message || '编队保存失败';
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
              this.showFloatingText(action === 'upgrade' ? '升级成功' : '建造成功');
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
            const message = '民居已经建立起来了，族人终于有了稳定的居所。文明也向前迈出了一步。';
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
            this.tutorialAdvisorDialogue = { message, advisorName: '谋士', source: 'houseBuilt' };
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
              this.log('璇峰厛鐧诲綍');
              return false;
            }
            try {
              const result = await this.getGameApi().assignJob(job, delta);
              if (result?.success === false) {
                this.log(result.message || '浜哄彛鍒嗛厤澶辫触');
                const data = await this.getGameApi().getState?.();
                if (data?.gameState) this.applyApiState(data);
                return false;
              }
              this.applyApiState(result);
              this.log(`浜哄彛鍒嗛厤 ${delta > 0 ? '+' : ''}${delta} ${job}`);
              return true;
            } catch (error) {
              this.log(`浜哄彛鍒嗛厤澶辫触锟?{error.payload?.message || error.message}`);
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
              this.showFloatingText(result.message || 'Policy applied');
              this.log(result.message || 'Policy applied');
              return true;
            } catch (error) {
              this.log(`鏂归拡澶辫触锟?{error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async advanceEra() {
            if (!this.canAdvanceEraNow()) {
              this.log(this.state?.isCapitalCity === false ? 'Capital only' : this.canAdvanceEraByTutorial() ? 'Requirements not met' : 'Action locked');
              this.renderMilitary();
              return false;
            }
            try {
              const result = await this.getGameApi().advanceEra();
              this.applyApiState(result);
              this.tutorialController?.sync?.(this.tutorial);
              this.tutorialController?.onEraAdvanced?.(result);
              this.log(`杩涘叆鏂伴樁娈碉細${result.message || this.state.currentEraName || ''}`);
              this.showFloatingText(result.message || this.state.currentEraName || 'Entered next era');
              return true;
            } catch (error) {
              this.log(`澶辫触锟?{error.payload?.message || error.message}`);
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
              };
              if (this.canvasShell?.territoryUiState) {
                this.canvasShell.territoryUiState.worldMarchTarget = null;
                this.canvasShell.territoryUiState.selectedWorldActorId = '';
              }
              this.tutorialController?.sync?.(this.tutorial);
              this.tutorialController?.onExploreStarted?.(result);
              this.showFloatingText(result.message || 'March started');
              this.log(result.message || 'March started');
              return true;
            } catch (error) {
              global.WorldMarchTrace?.error?.('app:startWorldMarch:error', {
                message: error.payload?.message || error.message,
                payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
              });
              WorldMarchOptimisticState?.rollback?.(this, optimistic || '', { render: false });
              this.log(`March failed: ${error.payload?.message || error.message}`);
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
              this.showFloatingText(result.message || 'Returning');
              this.log(result.message || 'Returning');
              return true;
            } catch (error) {
              global.WorldMarchTrace?.error?.('app:returnWorldMarch:error', {
                missionId,
                message: error.payload?.message || error.message,
                payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
              });
              WorldMarchOptimisticState?.rollback?.(this, optimistic || missionId, { render: false });
              this.log(`Return failed: ${error.payload?.message || error.message}`);
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
              this.showFloatingText(result.message || 'Stopped');
              this.log(result.message || 'Stopped');
              return true;
            } catch (error) {
              global.WorldMarchTrace?.error?.('app:stopWorldMarch:error', {
                missionId,
                message: error.payload?.message || error.message,
                payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
              });
              this.log(`Stop failed: ${error.payload?.message || error.message}`);
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
              this.showFloatingText(result.rewardText || result.message || 'Reward claimed');
              this.log(`濂栧姳锟?{result.message || ''}`);
              return true;
            } catch (error) {
              this.log(`澶辫触锟?{error.payload?.message || error.message}`);
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
              this.log(`澶辫触锟?{error.payload?.message || error.message}`);
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
