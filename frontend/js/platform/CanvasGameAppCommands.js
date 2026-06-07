(function (global) {
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
              this.applyApiState(result);
              this.showFamousPersons = true;
              this.famousPersonsPage = 0;
              this.selectedFamousPersonId = '';
              if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
              if (this.canvasShell && 'famousPersonsPage' in this.canvasShell) this.canvasShell.famousPersonsPage = 0;
              if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
              this.showFloatingText(result.message || '瀵昏瀹屾垚');
              this.log(result.message || '瀵昏瀹屾垚');
              return true;
            } catch (error) {
              this.log(`瀵昏澶辫触锟?{error.payload?.message || error.message}`);
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
              this.showFloatingText(result.message || 'Famous person accepted');
              this.log(result.message || 'Famous person accepted');
              return true;
            } catch (error) {
              this.log(`鎺ョ撼澶辫触锟?{error.payload?.message || error.message}`);
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
              this.showFloatingText(result.message || 'Candidate dismissed');
              this.log(result.message || 'Candidate dismissed');
              return true;
            } catch (error) {
              this.log(`鏀惧純澶辫触锟?{error.payload?.message || error.message}`);
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
              this.showFloatingText(result.message || '灞炴€у凡鎻愬崌');
              this.log(result.message || '灞炴€у凡鎻愬崌');
              return true;
            } catch (error) {
              this.log(`鍔犵偣澶辫触锟?{error.payload?.message || error.message}`);
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

      setArmyFormationEditor(editor = {}, options = {}) {
            this.armyFormationEditor = {
              open: false,
              cityId: '',
              slot: 1,
              memberIds: [],
              page: 0,
              saving: false,
              ...(editor || {}),
            };
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
            return this.setArmyFormationEditor({
              open: true,
              cityId,
              slot,
              memberIds: [...memberIds].slice(0, 5),
              page: 0,
              saving: false,
            });
          },

      closeArmyFormationEditor(options = {}) {
            return this.setArmyFormationEditor({ open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false }, options);
          },

      toggleArmyFormationMember(action = {}) {
            const editor = this.armyFormationEditor || {};
            if (!editor.open) return false;
            const personId = String(action.personId || '').trim();
            if (!personId) return false;
            const memberIds = Array.isArray(editor.memberIds) ? [...editor.memberIds] : [];
            const index = memberIds.indexOf(personId);
            if (index >= 0) memberIds.splice(index, 1);
            else {
              if (memberIds.length >= 5) {
                this.showFloatingText('每个编队最多 5 名名人');
                return false;
              }
              memberIds.push(personId);
            }
            return this.setArmyFormationEditor({ ...editor, memberIds }, { render: true });
          },

      changeArmyFormationPage(action = {}) {
            const editor = this.armyFormationEditor || {};
            if (!editor.open) return false;
            const page = Math.max(0, (Number(editor.page) || 0) + (Number(action.delta) || 0));
            return this.setArmyFormationEditor({ ...editor, page }, { render: true });
          },

      async saveArmyFormation() {
            const editor = this.armyFormationEditor || {};
            if (!editor.open || editor.saving) return false;
            const cityId = editor.cityId || this.state?.activeCityId || 'capital';
            const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
            const memberIds = (Array.isArray(editor.memberIds) ? editor.memberIds : []).slice(0, 5);
            this.setArmyFormationEditor({ ...editor, saving: true }, { render: true });
            try {
              const result = await this.getGameApi().setArmyFormation(cityId, slot, memberIds);
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

      getTalentPolicyDraft() {
            const policies = this.state?.talentPolicies || {};
            const systemPolicies = Array.isArray(policies.systemPolicies) ? policies.systemPolicies : [];
            const activeIsSystem = systemPolicies.some((policy) => policy.id === policies.activePolicyId);
            const basePolicyId = this.talentPolicyUiState.basePolicyId
              || this.canvasShell?.talentPolicyUiState?.basePolicyId
              || (activeIsSystem ? policies.activePolicyId : null)
              || 'balanced';
            const defaults = policies.defaultTiers || { agriculture: 2, knowledge: 2, industry: 2 };
            const tiers = this.talentPolicyUiState.tiers || this.canvasShell?.talentPolicyUiState?.tiers || {};
            return {
              basePolicyId,
              tiers: {
                agriculture: Number(tiers.agriculture ?? defaults.agriculture ?? 2),
                knowledge: Number(tiers.knowledge ?? defaults.knowledge ?? 2),
                industry: Number(tiers.industry ?? defaults.industry ?? 2),
              },
            };
          },

      async applyTalentPolicy(policyId) {
            if (!policyId) return false;
            try {
              const result = await this.getGameApi().applyTalentPolicy(policyId);
              this.applyApiState(result);
              this.showTalentPolicy = false;
              if (this.canvasShell && 'showTalentPolicy' in this.canvasShell) {
                this.canvasShell.showTalentPolicy = false;
              }
              this.showFloatingText(result.message || 'Policy applied');
              this.log(result.message || 'Policy applied');
              return true;
            } catch (error) {
              this.log(`鏂归拡澶辫触锟?{error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async applyTalentPolicyDraft() {
            try {
              const result = await this.getGameApi().applyTalentPolicy(null, this.getTalentPolicyDraft());
              this.applyApiState(result);
              this.showTalentPolicy = false;
              if (this.canvasShell && 'showTalentPolicy' in this.canvasShell) {
                this.canvasShell.showTalentPolicy = false;
              }
              this.showFloatingText(result.message || 'Policy applied');
              this.log(result.message || 'Policy applied');
              return true;
            } catch (error) {
              this.log(`鏂归拡澶辫触锟?{error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async saveTalentPolicyDraft() {
            try {
              const result = await this.getGameApi().saveTalentPolicy(this.getTalentPolicyDraft());
              this.applyApiState(result);
              this.showFloatingText(result.message || 'Policy saved');
              this.log(result.message || 'Policy saved');
              return true;
            } catch (error) {
              this.log(`淇濆瓨澶辫触锟?{error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async deleteTalentPolicy(policyId) {
            if (!policyId) return false;
            try {
              const result = await this.getGameApi().deleteTalentPolicy(policyId);
              this.applyApiState(result);
              this.showFloatingText(result.message || 'Policy deleted');
              this.log(result.message || 'Policy deleted');
              return true;
            } catch (error) {
              this.log(`鍒犻櫎澶辫触锟?{error.payload?.message || error.message}`);
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

      async startExplore(options = {}) {
            try {
              const result = await this.getGameApi().startExplore(options);
              this.applyApiState(result);
              this.tutorialController?.sync?.(this.tutorial);
              this.tutorialController?.onExploreStarted?.(result);
              this.showFloatingText(result.message || 'Explorer started');
              this.log(result.message || 'Explorer started');
              return true;
            } catch (error) {
              this.log(`Explore failed: ${error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async startWorldMarch(options = {}) {
            try {
              const api = this.getGameApi();
              const result = api.startWorldMarch
                ? await api.startWorldMarch({ ...options, mode: 'manual' })
                : await api.startExplore({ ...options, mode: 'manual' });
              this.applyApiState(result);
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
              this.log(`March failed: ${error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async returnWorldMarch(missionId) {
            if (!missionId) return false;
            try {
              const api = this.getGameApi();
              const result = await api.returnWorldMarch(missionId);
              this.applyApiState(result);
              this.showFloatingText(result.message || 'Returning');
              this.log(result.message || 'Returning');
              return true;
            } catch (error) {
              this.log(`Return failed: ${error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async stopWorldMarch(missionId, options = {}) {
            if (!missionId) return false;
            try {
              const api = this.getGameApi();
              const result = await api.stopWorldMarch(missionId, options);
              this.applyApiState(result);
              this.showFloatingText(result.message || 'Stopped');
              this.log(result.message || 'Stopped');
              return true;
            } catch (error) {
              this.log(`Stop failed: ${error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async claimExplore(missionId) {
            if (!missionId) return false;
            try {
              const result = await this.getGameApi().claimExplore(missionId);
              this.applyApiState(result);
              this.tutorialController?.sync?.(this.tutorial);
              this.tutorialController?.onExploreClaimed?.(result);
              this.showFloatingText(result.message || 'Explorer returned');
              this.log(result.message || 'Explorer returned');
              return true;
            } catch (error) {
              this.log(`Explore claim failed: ${error.payload?.message || error.message}`);
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
          },

      async claimGuideTaskReward(taskId) {
            return false;
          },

      async claimTaskReward(taskId, category = 'main', options = {}) {
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
