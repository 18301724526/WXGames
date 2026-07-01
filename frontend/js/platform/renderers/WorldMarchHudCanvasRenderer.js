(function (global) {
  const WorldMarchSystem = (() => {
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
  const sharedUIStatePresenter = (() => {
    if (global.UIStatePresenter) return global.UIStatePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../state/UIStatePresenter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const ActorPickingDiagnostics = (() => {
    if (global.ActorPickingDiagnostics) return global.ActorPickingDiagnostics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../debug/ActorPickingDiagnostics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const FormationDeploymentEligibility = (() => {
    if (global.FormationDeploymentEligibility) return global.FormationDeploymentEligibility;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../shared/FormationDeploymentEligibilityAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function logActorPickingDiag(stage = '', detail = {}) {
    return ActorPickingDiagnostics?.log?.(stage, detail, { signature: detail?.signature || '' }) || null;
  }

  class WorldMarchHudCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get width() {
      return this.host?.width;
    }

    get height() {
      return this.host?.height;
    }

    get viewportOffsetX() {
      return this.host?.viewportOffsetX;
    }

    get viewportOffsetY() {
      return this.host?.viewportOffsetY;
    }

    get viewportWidth() {
      return this.host?.viewportWidth;
    }

    get viewportHeight() {
      return this.host?.viewportHeight;
    }

    get epochNowMs() {
      return this.host?.epochNowMs;
    }

    get presenter() {
      return this.host?.presenter;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    getTileScreenCenter(coord = {}, viewport = {}, geometry = {}) {
      return WorldMarchSystem?.getTileScreenCenter?.(coord, viewport, geometry) || { x: 0, y: 0 };
    }

    drawSmallHudPanel(x, y, width, height, title) {
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(18, 20, 15, 0.88)',
        stroke: 'rgba(116, 211, 160, 0.36)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      if (title) this.drawText(title, x + 12, y + 13, { size: 12, bold: true, color: '#ffe6b5' });
    }

    clampHudRect(rect = {}, frame = {}) {
      const padding = 8;
      const minX = Number(frame.x) || 0;
      const minY = Number(frame.y) || 0;
      const maxX = minX + (Number(frame.width) || this.width || 390);
      const maxY = minY + (Number(frame.height) || this.height || 844);
      return {
        ...rect,
        x: Math.max(minX + padding, Math.min(maxX - rect.width - padding, rect.x)),
        y: Math.max(minY + padding, Math.min(maxY - rect.height - padding, rect.y)),
      };
    }

    getVisibleHudFrame(frame = {}) {
      const baseFrame = {
        x: Number(frame.x) || 0,
        y: Number(frame.y) || 0,
        width: Math.max(1, Number(frame.width) || this.width || 390),
        height: Math.max(1, Number(frame.height) || this.height || 844),
      };
      const offsetX = Math.max(0, Number(this.viewportOffsetX) || 0);
      const offsetY = Math.max(0, Number(this.viewportOffsetY) || 0);
      const viewportWidth = Math.max(0, Number(this.viewportWidth) || 0);
      const viewportHeight = Math.max(0, Number(this.viewportHeight) || 0);
      if (!viewportWidth || !viewportHeight) return baseFrame;
      const left = Math.max(baseFrame.x, offsetX);
      const top = Math.max(baseFrame.y, offsetY);
      const right = Math.min(baseFrame.x + baseFrame.width, offsetX + viewportWidth);
      const bottom = Math.min(baseFrame.y + baseFrame.height, offsetY + viewportHeight);
      if (right - left < 120 || bottom - top < 120) return baseFrame;
      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
    }

    getTargetIntel(target = {}) {
      const hasTerrainLabel = Boolean(target.terrainLabel || target.terrain);
      const unknownTerrain = this.t('world.march.target.unknownTerrain');
      const known = target.known === true
        || (target.known !== false && hasTerrainLabel && target.terrainLabel !== unknownTerrain);
      const terrainLabel = known
        ? (target.terrainLabel || target.terrain || this.t('world.march.target.genericTerrain'))
        : unknownTerrain;
      return {
        known,
        title: known ? terrainLabel : this.t('world.march.target.unknownTitle'),
        subtitle: known ? this.t('world.march.target.knownSubtitle') : this.t('world.march.target.unknownSubtitle'),
      };
    }

    isMarchTargetBlocked(target = {}) {
      return Boolean(target.marchDisabled || target.blocked || target.disabled);
    }

    getMarchTargetBlockedText(target = {}) {
      if (target.marchDisabledReason === 'EXPLORE_TARGET_TOO_FAR') return this.t('world.march.formation.targetTooFar');
      return this.t('world.march.formation.routeBlocked');
    }

    getWorldTargetPicker(targetPicker = null) {
      if (!targetPicker || targetPicker.pickerKind !== 'worldTargetPicker') return null;
      const picker = targetPicker.picker || null;
      if (!picker || !Array.isArray(picker.candidates) || picker.candidates.length < 2) return null;
      return picker;
    }

    getCandidateKindLabel(candidate = {}) {
      if (candidate.kind === 'actor') return this.t('world.targetPicker.kind.actor');
      if (candidate.kind === 'site') return this.t('world.targetPicker.kind.site');
      return this.t('world.targetPicker.kind.generic');
    }

    renderWorldTargetPicker(picker = {}, viewport = {}, geometry = {}, frame = {}) {
      const hudFrame = this.getVisibleHudFrame(frame);
      const candidates = Array.isArray(picker.candidates) ? picker.candidates.slice(0, 5) : [];
      if (candidates.length < 2) return false;
      const anchor = Number.isFinite(Number(picker.anchorX)) && Number.isFinite(Number(picker.anchorY))
        ? { x: Number(picker.anchorX), y: Number(picker.anchorY) }
        : this.getTileScreenCenter(picker, viewport, geometry);
      const rowH = 38;
      const width = Math.min(220, Math.max(172, (Number(hudFrame.width) || this.width || 390) - 24));
      const height = 34 + rowH * candidates.length + 10;
      const rect = this.clampHudRect({
        x: anchor.x - width / 2,
        y: anchor.y - height - 36,
        width,
        height,
      }, hudFrame);
      this.drawSmallHudPanel(rect.x, rect.y, rect.width, rect.height, this.t('world.targetPicker.title'));
      const closeSize = 24;
      this.drawButton(
        rect.x + rect.width - closeSize - 7,
        rect.y + 7,
        closeSize,
        closeSize,
        this.t('common.close.short'),
        { size: 12, radius: 7 },
      );
      this.addHitTarget({ x: rect.x + rect.width - closeSize - 7, y: rect.y + 7, width: closeSize, height: closeSize }, {
        type: 'closeWorldTargetPicker',
      });
      candidates.forEach((candidate, index) => {
        const rowX = rect.x + 10;
        const rowY = rect.y + 32 + index * rowH;
        const rowW = rect.width - 20;
        const active = candidate.kind === 'actor';
        this.drawPanel(rowX, rowY, rowW, rowH - 6, {
          fill: active ? 'rgba(35, 49, 34, 0.84)' : 'rgba(41, 39, 32, 0.82)',
          stroke: active ? 'rgba(116, 211, 160, 0.42)' : 'rgba(255, 226, 177, 0.18)',
          radius: 7,
          inset: 'rgba(255, 231, 184, 0.04)',
        });
        this.drawText(this.getCandidateKindLabel(candidate), rowX + 12, rowY + 12, {
          size: 10,
          bold: true,
          color: active ? '#74d3a0' : '#f0b45b',
        });
        this.drawText(
          this.truncateText(
            candidate.label || this.t('world.targetPicker.candidateFallback'),
            rowW - 76,
            { size: 11, bold: true },
          ),
          rowX + 56,
          rowY + 12,
          {
            size: 11,
            bold: true,
            color: '#ffe6b5',
          },
        );
        if (candidate.subtitle) {
          this.drawText(this.truncateText(candidate.subtitle, rowW - 76, { size: 9 }), rowX + 56, rowY + 26, {
            size: 9,
            color: '#aeb0b8',
          });
        }
        this.addHitTarget({ x: rowX, y: rowY, width: rowW, height: rowH - 6 }, {
          type: 'chooseWorldTarget',
          targetId: candidate.id,
          index,
        });
      });
      return true;
    }

    hasMilitaryData(state = {}) {
      return Boolean(state?.military || state?.famousPersons || state?.cityState);
    }

    resolveStateCandidates(state = {}) {
      return [state];
    }

    resolveMilitaryState(state = {}) {
      return this.resolveStateCandidates(state).find((candidate) => this.hasMilitaryData(candidate)) || {};
    }

    getMilitaryPresenter() {
      return [
        this.presenter,
        sharedUIStatePresenter,
      ].find((presenter) => presenter && typeof presenter.buildMilitaryViewState === 'function') || null;
    }

    buildMilitaryViewState(state = {}) {
      const presenter = this.getMilitaryPresenter();
      return presenter?.buildMilitaryViewState?.(state) || { formations: [] };
    }

    formationHasMembers(formation = {}) {
      if (Array.isArray(formation.members) && formation.members.length > 0) return true;
      if (Array.isArray(formation.memberIds) && formation.memberIds.length > 0) return true;
      return Number(formation.memberCount) > 0;
    }

    getFormationDeploymentEligibility(formation = {}) {
      return FormationDeploymentEligibility?.evaluateFormationDeployment?.(formation) || {
        allowed: this.formationHasMembers(formation),
        blocked: !this.formationHasMembers(formation),
        blockers: [],
        warnings: [],
        participants: [],
        primary: null,
        deputies: [],
        zeroSoldierDeputies: [],
        soldiersAssigned: Number(formation.soldiersAssigned) || 0,
      };
    }

    getBusyFormationMap(state = {}) {
      const explorer = state?.worldExplorerState || {};
      const busyFormations = Array.isArray(explorer.busyFormations) ? explorer.busyFormations : [];
      const missions = Array.isArray(explorer.missions)
        ? explorer.missions
        : [
          explorer.activeMission,
          ...(Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []),
        ].filter(Boolean);
      const missionById = new Map(missions.map((mission) => [mission?.id, mission]).filter(([id]) => id));
      const nowMs = WorldMarchSystem?.toNumber?.(this.host?.epochNowMs ?? this.epochNowMs, Date.now()) ?? Date.now();
      const map = new Map();
      busyFormations.forEach((item = {}) => {
        const mission = missionById.get(item.missionId || '');
        const status = mission && WorldMarchSystem?.getEffectiveMissionStatus
          ? WorldMarchSystem.getEffectiveMissionStatus(mission, nowMs)
          : item.status;
        if (status === 'idle') return;
        const cityId = item.cityId || 'capital';
        const slot = Math.max(1, Math.floor(Number(item.slot) || 1));
        map.set(`${cityId}:${slot}`, { ...item, status });
      });
      return map;
    }

    getFormationBusyInfo(formation = {}, militaryState = {}, state = {}) {
      const cityId = formation.cityId || militaryState.activeCityId || 'capital';
      const slot = Math.max(1, Math.floor(Number(formation.slot) || 1));
      return this.getBusyFormationMap(state).get(`${cityId}:${slot}`) || null;
    }

    isCombatActor(actor = {}) {
      return Boolean(actor?.combatTarget || actor?.type === 'hostileForce' || actor?.kind === 'worldCombatEncounter');
    }

    getCombatTargetFromActor(actor = {}) {
      const source = actor.combatTarget || {};
      const current = actor.current || actor.target || actor.origin || {};
      return {
        q: source.q ?? current.q ?? current.x,
        r: source.r ?? current.r ?? current.y,
        tileId: source.tileId || current.tileId,
        known: true,
        terrain: source.terrain || source.battleTarget?.tile?.terrain || actor.terrain || '',
        terrainLabel: source.terrainLabel || source.terrain || actor.terrain || '',
        combatEncounterId: source.encounterId || actor.combatEncounterId || actor.id || '',
        combatTarget: source,
        title:
          source.name
          || actor.name
          || actor.label
          || this.t(
            source.nameKey
              || actor.nameKey
              || actor.labelKey
              || 'world.combat.hostileForce.title',
          ),
        defender: source.defender || null,
      };
    }

    getCombatIntel(target = {}) {
      const defender = target.defender || target.combatTarget?.defender || {};
      const soldiers = Math.max(0, Math.floor(Number(defender.soldiers) || 0));
      return {
        title:
          target.title
          || target.combatTarget?.name
          || this.t(target.combatTarget?.nameKey || 'world.combat.hostileForce.title'),
        subtitle: soldiers > 0
          ? this.t('world.combat.hostileForce.soldierCount', { soldiers })
          : (target.terrainLabel || target.terrain || this.t('world.combat.hostileForce.subtitle')),
      };
    }

    renderTargetHud(target = {}, viewport = {}, geometry = {}, frame = {}) {
      const hudFrame = this.getVisibleHudFrame(frame);
      const point = this.getTileScreenCenter(target, viewport, geometry);
      const intel = this.getTargetIntel(target);
      const infoRect = this.clampHudRect({
        x: point.x - 74,
        y: point.y - 86,
        width: 148,
        height: 48,
      }, hudFrame);
      let buttonRect = this.clampHudRect({
        x: infoRect.x + infoRect.width + 8,
        y: infoRect.y + 8,
        width: 68,
        height: 32,
      }, hudFrame);
      const overlapsInfo = buttonRect.x < infoRect.x + infoRect.width + 4
        && buttonRect.y < infoRect.y + infoRect.height + 4;
      if (overlapsInfo) {
        buttonRect = this.clampHudRect({
          x: infoRect.x + infoRect.width - 68,
          y: infoRect.y + infoRect.height + 8,
          width: 68,
          height: 32,
        }, hudFrame);
      }
      this.drawSmallHudPanel(infoRect.x, infoRect.y, infoRect.width, infoRect.height, intel.title);
      this.drawText(intel.subtitle, infoRect.x + 12, infoRect.y + 31, {
        size: 10,
        color: intel.known ? '#74d3a0' : '#aeb0b8',
      });
      this.drawButton(
        buttonRect.x,
        buttonRect.y,
        buttonRect.width,
        buttonRect.height,
        this.t('world.march.command.march'),
        {
          size: 13,
          radius: 8,
          active: true,
        },
      );
      this.addHitTarget({ x: buttonRect.x, y: buttonRect.y, width: buttonRect.width, height: buttonRect.height }, {
        type: 'openWorldMarchFormationPicker',
        targetQ: target.q,
        targetR: target.r,
        tileId: target.tileId,
        ...(target.missionId || target.actorId ? {
          missionId: target.missionId || target.actorId,
          actorId: target.actorId || target.missionId,
        } : {}),
        known: target.known,
        terrain: target.terrain,
        terrainLabel: target.terrainLabel,
        marchDisabled: Boolean(target.marchDisabled),
        marchDisabledReason: target.marchDisabledReason || '',
        ...(target.combatEncounterId ? { combatEncounterId: target.combatEncounterId } : {}),
        ...(target.combatTarget ? { combatTarget: target.combatTarget } : {}),
      });
      return true;
    }

    renderCombatActorHud(actor = {}, viewport = {}, geometry = {}, frame = {}) {
      const target = this.getCombatTargetFromActor(actor);
      const hudFrame = this.getVisibleHudFrame(frame);
      const point = this.getTileScreenCenter(actor.current || actor.target || actor.origin || {}, viewport, geometry);
      const intel = this.getCombatIntel(target);
      const rect = this.clampHudRect({
        x: point.x - 82,
        y: point.y - 104,
        width: 164,
        height: 68,
      }, hudFrame);
      this.drawSmallHudPanel(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        this.truncateText(intel.title, 138, { size: 12, bold: true }),
      );
      this.drawText(this.truncateText(intel.subtitle, 140, { size: 10 }), rect.x + 12, rect.y + 32, {
        size: 10,
        color: '#f0b45b',
      });
      const buttonW = 64;
      const buttonH = 24;
      const buttonX = rect.x + rect.width - buttonW - 12;
      const buttonY = rect.y + rect.height - buttonH - 9;
      this.drawButton(buttonX, buttonY, buttonW, buttonH, this.t('world.combat.attack'), {
        size: 11,
        radius: 7,
        active: true,
      });
      this.addHitTarget({ x: buttonX, y: buttonY, width: buttonW, height: buttonH }, {
        type: 'openWorldMarchFormationPicker',
        targetQ: target.q,
        targetR: target.r,
        tileId: target.tileId,
        known: true,
        terrain: target.terrain,
        terrainLabel: target.terrainLabel,
        combatEncounterId: target.combatEncounterId,
        combatTarget: target.combatTarget,
      });
      return true;
    }

    renderFormationPicker(state = {}, target = {}, frame = {}) {
      const hudFrame = this.getVisibleHudFrame(frame);
      const militaryState = this.resolveMilitaryState(state);
      const view = this.buildMilitaryViewState(militaryState);
      const formations = Array.isArray(view.formations) ? view.formations.slice(0, 3) : [];
      const width = Math.min(340, Math.max(260, (Number(hudFrame.width) || this.width || 390) - 28));
      const height = 148;
      const x = (Number(hudFrame.x) || 0) + ((Number(hudFrame.width) || this.width || 390) - width) / 2;
      const frameY = Number(hudFrame.y) || 0;
      const frameH = Number(hudFrame.height) || this.height || 844;
      const minY = frameY + 8;
      const maxY = frameY + Math.max(8, frameH - height - 8);
      const preferredY = frameY + Math.max(74, Math.floor(frameH * 0.34));
      const y = Math.max(minY, Math.min(maxY, preferredY));
      const intel = this.getTargetIntel(target);
      this.drawSmallHudPanel(x, y, width, height, this.t('world.march.formationPicker.title'));
      this.drawText(intel.title, x + width - 12, y + 13, {
        size: 11,
        color: intel.known ? '#74d3a0' : '#aeb0b8',
        align: 'right',
      });
      const gap = 8;
      const cardY = y + 38;
      const cardH = 84;
      const cardW = Math.floor((width - 24 - gap * 2) / 3);
      [0, 1, 2].forEach((index) => {
        const formation = formations[index] || {
          slot: index + 1,
          cityId: militaryState.activeCityId || 'capital',
          members: [],
        };
        const cardX = x + 12 + index * (cardW + gap);
        const deploymentEligibility = this.getFormationDeploymentEligibility(formation);
        const empty = !this.formationHasMembers(formation);
        const busy = this.getFormationBusyInfo(formation, militaryState, state);
        const blocked = this.isMarchTargetBlocked(target);
        const disabled = empty || Boolean(busy) || blocked;
        this.drawPanel(cardX, cardY, cardW, cardH, {
          fill: disabled ? 'rgba(41, 39, 32, 0.78)' : 'rgba(35, 49, 34, 0.84)',
          stroke: disabled ? 'rgba(255, 226, 177, 0.14)' : 'rgba(116, 211, 160, 0.44)',
          radius: 7,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(
          this.truncateText(
            formation.name || this.t('world.march.formation.defaultName', { index: index + 1 }),
            cardW - 10,
            { size: 11, bold: true },
          ),
          cardX + cardW / 2,
          cardY + 16,
          {
            size: 11,
            bold: true,
            color: disabled ? '#aeb0b8' : '#ffe6b5',
            align: 'center',
          },
        );
        this.drawText(
          `${formation.memberCount ?? formation.members?.length ?? 0}/${formation.maxMembers || 5}`,
          cardX + cardW / 2,
          cardY + 42,
          {
            size: 18,
            bold: true,
            color: disabled ? '#8e918a' : '#74d3a0',
            align: 'center',
          },
        );
        const statusText = blocked
          ? this.getMarchTargetBlockedText(target)
          : empty
          ? this.t('world.march.formation.empty')
          : busy
            ? this.t('world.march.formation.busy')
            : this.t('world.march.formation.start');
        this.drawText(statusText, cardX + cardW / 2, cardY + 65, {
          size: 10,
          color: disabled ? '#8e918a' : '#f0b45b',
          align: 'center',
        });
        this.addHitTarget({ x: cardX, y: cardY, width: cardW, height: cardH }, {
          type: 'startWorldMarch',
          mode: 'manual',
          targetQ: target.q,
          targetR: target.r,
          tileId: target.tileId,
          formationSlot: formation.slot || index + 1,
          cityId: formation.cityId || militaryState.activeCityId || 'capital',
          ...(target.combatEncounterId ? { combatEncounterId: target.combatEncounterId } : {}),
          ...(target.combatTarget ? { combatTarget: target.combatTarget } : {}),
          ...(target.missionId || target.actorId ? {
            missionId: target.missionId || target.actorId,
            actorId: target.actorId || target.missionId,
          } : {}),
          deploymentEligibility,
          disabled,
        });
      });
      const closeSize = 26;
      this.drawButton(
        x + width - closeSize - 8,
        y + height - closeSize - 8,
        closeSize,
        closeSize,
        this.t('common.close.short'),
        { size: 12, radius: 7 },
      );
      this.addHitTarget(
        {
          x: x + width - closeSize - 8,
          y: y + height - closeSize - 8,
          width: closeSize,
          height: closeSize,
        },
        { type: 'closeWorldMarchHud' },
      );
      return true;
    }

    renderActorHud(actor = {}, viewport = {}, geometry = {}, frame = {}) {
      const hudFrame = this.getVisibleHudFrame(frame);
      const point = this.getTileScreenCenter(actor.current || actor.origin || {}, viewport, geometry);
      const canStop = actor.status === 'active';
      const rect = this.clampHudRect({
        x: point.x - 78,
        y: point.y - 102,
        width: 156,
        height: 64,
      }, hudFrame);
      this.drawSmallHudPanel(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        actor.formation?.label || this.t('world.march.actor.defaultScout'),
      );
      const buttonW = 58;
      const buttonH = 24;
      const gap = 10;
      const y = rect.y + 28;
      const buttonCount = canStop ? 2 : 1;
      const totalButtonWidth = buttonW * buttonCount + gap * (buttonCount - 1);
      const returnX = rect.x + Math.max(14, (rect.width - totalButtonWidth) / 2);
      const stopX = returnX + buttonW + gap;
      this.drawButton(returnX, y, buttonW, buttonH, this.t('world.march.actor.return'), { size: 11, radius: 7 });
      this.addHitTarget({ x: returnX, y, width: buttonW, height: buttonH }, {
        type: 'returnWorldMarch',
        missionId: actor.missionId,
      });
      if (canStop) {
        this.drawButton(stopX, y, buttonW, buttonH, this.t('world.march.actor.stop'), { size: 11, radius: 7 });
        this.addHitTarget({ x: stopX, y, width: buttonW, height: buttonH }, {
          type: 'stopWorldMarch',
          missionId: actor.missionId,
        });
      }
      return true;
    }

    renderWorldMarchHud(state = {}, uiState = {}, actors = [], viewport = {}, geometry = {}, frame = {}, targetPicker = null) {
      const selectedActorId = uiState.selectedWorldActorId || '';
      const selectedActor = selectedActorId ? actors.find((actor) => actor.id === selectedActorId || actor.missionId === selectedActorId) : null;
      const picker = this.getWorldTargetPicker(targetPicker);
      const formationPickerOpen = Boolean(targetPicker && targetPicker.pickerKind === 'worldMarchFormation');
      const target = WorldMarchSystem?.getMarchTargetUiState?.(uiState);
      logActorPickingDiag('hud:renderWorldMarchHud', {
        signature: [
          selectedActorId,
          Array.isArray(actors) ? actors.length : 0,
          Boolean(selectedActor),
          picker ? 'picker' : '',
          formationPickerOpen ? 'formation' : '',
          Boolean(target),
        ].join('|'),
        selectedWorldActorId: selectedActorId,
        uiStateBrief: {
          selectedWorldActorId: selectedActorId,
          selectedSiteId: uiState.selectedSiteId || '',
          hasWorldMarchTarget: Boolean(uiState.worldMarchTarget),
          worldMarchTargetTileId: uiState.worldMarchTarget?.tileId || '',
          worldMarchTargetPickerOpen: formationPickerOpen,
          hasWorldTargetPicker: Boolean(picker),
          worldTargetPickerCandidates: Array.isArray(picker?.candidates)
            ? picker.candidates.length
            : 0,
        },
        actorsCount: Array.isArray(actors) ? actors.length : 0,
        actorsBrief: (Array.isArray(actors) ? actors : []).slice(0, 10).map((actor) => ({
          id: actor?.id || '',
          actorId: actor?.actorId || '',
          missionId: actor?.missionId || '',
          status: actor?.status || '',
        })),
        matchedActor: Boolean(selectedActor),
        matchedActorBrief: selectedActor ? {
          id: selectedActor.id || '',
          actorId: selectedActor.actorId || '',
          missionId: selectedActor.missionId || '',
          status: selectedActor.status || '',
        } : null,
        earlyReturnReason: picker ? 'world-target-picker' : (formationPickerOpen ? 'formation-picker' : ''),
        notMatchedReason: selectedActor
          ? ''
          : (!(Array.isArray(actors) && actors.length) ? 'actors-empty' : 'no-id-actorId-missionId-match'),
      });
      if (picker) return this.renderWorldTargetPicker(picker, viewport, geometry, frame);
      if (formationPickerOpen && target) return this.renderFormationPicker(state, target, frame);
      if (this.__codexTempFormationPickerDebugOpen) {
        this.__codexTempFormationPickerDebugOpen = false;
        this.__codexTempFormationPickerDebugSignature = '';
      }
      if (selectedActor) {
        return this.isCombatActor(selectedActor)
          ? this.renderCombatActorHud(selectedActor, viewport, geometry, frame)
          : this.renderActorHud(selectedActor, viewport, geometry, frame);
      }
      if (target) return this.renderTargetHud(target, viewport, geometry, frame);
      return false;
    }
  }

  global.WorldMarchHudCanvasRenderer = WorldMarchHudCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMarchHudCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
