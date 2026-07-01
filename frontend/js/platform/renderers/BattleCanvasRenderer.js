(function (global) {
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

  const BattleCanvasModel = (() => {
    if (global.BattleCanvasModel) return global.BattleCanvasModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleCanvasModel');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const BattleFloatingTextRenderer = (() => {
    if (global.BattleFloatingTextRenderer) return global.BattleFloatingTextRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleFloatingTextRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const BattleEffectRenderer = (() => {
    if (global.BattleEffectRenderer) return global.BattleEffectRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleEffectRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const BattleCameraPolicy = (() => {
    if (global.BattleCameraPolicy) return global.BattleCameraPolicy;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/system/BattleCameraPolicy');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const BattleLayoutModel = (() => {
    if (global.BattleLayoutModel) return global.BattleLayoutModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleLayoutModel');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const BattleSpriteRenderer = (() => {
    if (global.BattleSpriteRenderer) return global.BattleSpriteRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleSpriteRenderer');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  // ---- entity battle (live sim) constants ----
  // The entity battle is the 三国群英传-style mass-melee scene driven by
  // battleSimCore. It is rendered through this canvas renderer (no DOM) for both
  // the interactive 军令 path and the passive replay path. State lives on
  // options.entityBattle; the app owns the sim stepping, this owns the drawing.
  const ENTITY_STATE_POSE = { engage: 'attack', hold: 'idle', covering: 'move', advance: 'move', retreat: 'move', dead: 'die' };
  const ENTITY_FRAMES = 4;
  const ENTITY_FRAME_MS = 130;
  const ENTITY_SPRITE_SCALE = 2;
  const ENTITY_ORDER_KEYS = [
    ['advance', 'battle.entity.order.advance'],
    ['soldierAttack', 'battle.entity.order.soldierAttack'],
    ['generalCharge', 'battle.entity.order.generalCharge'],
    ['generalRetreat', 'battle.entity.order.generalRetreat'],
    ['defend', 'battle.entity.order.defend'],
    ['cover', 'battle.entity.order.cover'],
  ];
  const ENTITY_MASTER_KEYS = [
    ['allOut', 'battle.entity.master.allOut'],
    ['allRetreat', 'battle.entity.master.allRetreat'],
  ];

  class BattleCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get width() {
      return Number(this.host?.width) || 0;
    }

    get height() {
      return Number(this.host?.height) || 0;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get presenter() {
      return this.host?.presenter;
    }

    t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawCircle(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawCircle === 'function' ? surface.drawCircle(...args) : this.host?.drawCircle?.(...args); }
    drawCoverAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawCoverAsset === 'function' ? surface.drawCoverAsset(...args) : this.host?.drawCoverAsset?.(...args); }
    drawFamousPortrait(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawFamousPortrait === 'function' ? surface.drawFamousPortrait(...args) : this.host?.drawFamousPortrait?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    getAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.getAsset === 'function' ? surface.getAsset(...args) : this.host?.getAsset?.(...args); }
    getNow(...args) { const surface = this.drawingSurface; return surface && typeof surface.getNow === 'function' ? surface.getNow(...args) : this.host?.getNow?.(...args); }
    measureTextWidth(...args) { const surface = this.drawingSurface; return surface && typeof surface.measureTextWidth === 'function' ? surface.measureTextWidth(...args) : this.host?.measureTextWidth?.(...args); }
    setHitTargets(...args) { const surface = this.drawingSurface; return surface && typeof surface.setHitTargets === 'function' ? surface.setHitTargets(...args) : this.host?.setHitTargets?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }

    static getBattleUnitAssetVersion() {
      const result = typeof BattleCanvasModel?.getBattleUnitAssetVersion === 'function'
        ? BattleCanvasModel.getBattleUnitAssetVersion()
        : undefined;
      return result === undefined ? 'battle-units-split-v1-20260529' : result;
    }

    static getBattleUnitFrameCount() {
      const result = typeof BattleCanvasModel?.getBattleUnitFrameCount === 'function'
        ? BattleCanvasModel.getBattleUnitFrameCount()
        : undefined;
      return result === undefined ? 4 : result;
    }

    static getBattleUnitKey(side = 'attacker') {
      const result = typeof BattleCanvasModel?.getBattleUnitKey === 'function'
        ? BattleCanvasModel.getBattleUnitKey(side)
        : undefined;
      return result === undefined ? (side === 'attacker' ? 'player' : 'enemy') : result;
    }

    static getBattleUnitFramePath(unit = 'player', pose = 'idle', frameIndex = 0, rootPath = '') {
      const result = typeof BattleCanvasModel?.getBattleUnitFramePath === 'function'
        ? BattleCanvasModel.getBattleUnitFramePath(unit, pose, frameIndex, rootPath)
        : undefined;
      return result === undefined ? 'assets/art/battle/units/player/idle/01.png' : result;
    }

    static getBattleUnitFramePaths() {
      const result = typeof BattleCanvasModel?.getBattleUnitFramePaths === 'function'
        ? BattleCanvasModel.getBattleUnitFramePaths()
        : undefined;
      return result === undefined ? [] : result;
    }

    render(state = {}, options = {}) {
      return this.renderBattleSceneOverlay(state, options);
    }

    drawBattleActionEffect(activeTurn = null, progress = 0) {
      return BattleEffectRenderer?.drawBattleActionEffect?.(this, activeTurn, progress);
    }

    drawBattleSkillCutIn(activeTurn = null, progress = 0) {
      return BattleEffectRenderer?.drawBattleSkillCutIn?.(this, activeTurn, progress);
    }

    drawBattleDamageFloat(activeTurn = null, phase = 'prepare', phaseProgress = 0, targetArea = null) {
      return BattleFloatingTextRenderer?.drawBattleDamageFloat?.(this, activeTurn, phase, phaseProgress, targetArea);
    }

    drawBattleStatusFloatingTexts(activeTurn = null, phase = 'prepare', phaseProgress = 0, areas = {}) {
      return BattleFloatingTextRenderer?.drawBattleStatusFloatingTexts?.(this, activeTurn, phase, phaseProgress, areas);
    }

    drawBattleLeader(sideView = {}, x = 0, y = 0, side = 'attacker') {
      const radius = 32;
      this.drawCircle(x, y, radius + 5, {
        fill: side === 'attacker' ? 'rgba(116, 211, 160, 0.12)' : 'rgba(224, 123, 98, 0.12)',
        stroke: side === 'attacker' ? 'rgba(116, 211, 160, 0.58)' : 'rgba(224, 123, 98, 0.58)',
        width: 2,
      });
      const portrait = side === 'attacker'
        ? this.drawFamousPortrait(sideView, x - radius, y - radius, radius * 2, {
          frameWidth: radius * 2,
          frameHeight: radius * 2,
          radius,
          scale: 1.58,
          offsetY: 0.12,
        })
        : false;
      if (!portrait) this.drawBattleLeaderFallback(sideView, x, y, side, radius);
      this.drawText(this.truncateText(sideView.leaderName || sideView.name || '', 96, { size: 12, bold: true }), x, y + radius + 10, {
        size: 12,
        bold: true,
        color: '#f6e8c8',
        align: 'center',
      });
    }

    drawBattleLeaderFallback(sideView = {}, x = 0, y = 0, side = 'attacker', radius = 32) {
      this.drawCircle(x, y, radius, {
        fill: side === 'attacker' ? '#2f6f59' : '#7f3d32',
        stroke: 'rgba(255, 226, 177, 0.5)',
        width: 2,
      });
      this.drawText(String(sideView.leaderName || sideView.name || '\u5c06').slice(0, 1), x, y, {
        size: 22,
        bold: true,
        color: '#f6e8c8',
        align: 'center',
        baseline: 'middle',
      });
    }

    renderBattleSceneOverlay(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildBattleSceneViewState !== 'function') return;
      const now = this.getNow();
      const { frame, requestedTurnIndex, rawActiveTurn, playback } = this.getBattleScenePlayback(options.battleScene || {}, now);
      const view = this.presenter.buildBattleSceneViewState(options.battleScene || {}, {
        turnIndex: requestedTurnIndex,
        phase: playback.phase,
      });
      if (!view.visible) return;
      this.setHitTargets([]);
      this.drawBattleMapBackground(view.map);
      this.drawBattleSceneChrome(view, playback, requestedTurnIndex);
      this.drawBattleSceneArmies(view, {
        frame,
        activeTurn: view.activeTurn || rawActiveTurn,
        turnPhase: playback.phase,
        phaseProgress: playback.phaseProgress,
        requestedTurnIndex,
      });
      this.drawBattleSceneLog(view);
      this.drawBattleSceneButtons(view);
    }

    drawBattleSceneChrome(view = {}, playback = {}, requestedTurnIndex = 0) {
      const layout = this.getBattleSceneLayout(this.width, this.height);
      this.drawPanel(16, layout.topY, this.width - 32, 68, {
        fill: 'rgba(20, 16, 12, 0.72)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 10,
      });
      this.drawText(this.truncateText(view.title, this.width - 80, { size: 18, bold: true }), this.width / 2, layout.topY + 12, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });
      const total = Math.max(1, view.turnCount || 1);
      const current = view.ended ? total : Math.min((view.turnIndex ?? requestedTurnIndex) + 1, total);
      const turnText = '\u7b2c' + current + '/' + total + ' \u624b';
      this.drawText(`${turnText} - ${view.resultText || ''}`, this.width / 2, layout.topY + 40, {
        size: 12,
        color: '#d6b16e',
        align: 'center',
      });
    }

    drawBattleSceneArmies(view = {}, context = {}) {
      const activeTurn = context.activeTurn;
      const turnPhase = context.turnPhase || 'ended';
      const phaseProgress = context.phaseProgress || 1;
      const layout = this.getBattleSceneLayout(this.width, this.height);
      const engagementProgress = this.getBattleEngagementProgress(context.requestedTurnIndex, turnPhase, phaseProgress, activeTurn);
      const attackerPose = this.getBattleUnitPose('attacker', activeTurn, turnPhase);
      const defenderPose = this.getBattleUnitPose('defender', activeTurn, turnPhase);
      this.drawBattleLeader(view.attacker, 72, layout.fieldTop + 64, 'attacker');
      this.drawBattleLeader(view.defender, this.width - 72, layout.fieldTop + 64, 'defender');
      this.drawBattleSideState(view.attacker, layout.attackerArea, 'attacker');
      this.drawBattleSideState(view.defender, layout.defenderArea, 'defender');
      this.drawBattleArmy(view.attacker, layout.attackerArea, { pose: attackerPose, frame: context.frame, progress: phaseProgress, engagementProgress, actionType: activeTurn?.action });
      this.drawBattleArmy(view.defender, layout.defenderArea, { pose: defenderPose, frame: context.frame, progress: phaseProgress, engagementProgress, actionType: activeTurn?.action });
      this.drawBattleActionEffect(turnPhase === 'impact' ? activeTurn : null, phaseProgress);
      this.drawBattleSkillCutIn(turnPhase === 'cutin' ? activeTurn : null, phaseProgress);
      this.drawBattleDamageFloat(activeTurn, turnPhase, phaseProgress, activeTurn?.target === 'attacker' ? layout.attackerArea : layout.defenderArea);
      this.drawBattleStatusFloatingTexts(activeTurn, turnPhase, phaseProgress, {
        attacker: layout.attackerArea,
        defender: layout.defenderArea,
      });
    }

    drawBattleSceneLog(view = {}) {
      const layout = this.getBattleSceneLayout(this.width, this.height);
      this.drawPanel(16, layout.logY, this.width - 32, layout.logH, {
        fill: 'rgba(20, 16, 12, 0.76)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
      });
      const lines = view.logLines?.length ? view.logLines : [this.t('battle.log.start', {})];
      lines.slice(-4).forEach((line, index, list) => {
        this.drawText(this.truncateText(line, this.width - 56, { size: 12 }), 28, layout.logY + 14 + index * 24, {
          size: 12,
          color: index === list.length - 1 ? '#f6e8c8' : '#aeb0b8',
        });
      });
    }

    drawBattleSceneButtons(view = {}) {
      const layout = this.getBattleSceneLayout(this.width, this.height);
      this.drawButton(18, layout.buttonY, 88, 36, this.t('common.back', {}), { size: 12, radius: 8 });
      this.addHitTarget({ x: 18, y: layout.buttonY, width: 88, height: 36 }, { type: 'closeBattleScene' });
      const primaryLabel = view.ended ? this.t('common.done', {}) : this.t('common.skip', {});
      this.drawButton(this.width - 106, layout.buttonY, 88, 36, primaryLabel, { size: 12, radius: 8, active: true });
      this.addHitTarget({ x: this.width - 106, y: layout.buttonY, width: 88, height: 36 }, { type: view.ended ? 'closeBattleScene' : 'skipBattleScene' });
    }

    // ============================================================
    // Entity battle (battleSimCore live sim) — pure canvas overlay.
    // ============================================================
    getEntityBattleCore() {
      const view = (typeof window !== 'undefined' ? window : globalThis);
      return view.BattleSimCore || null;
    }

    getEntityBattleLayout(entityBattle = {}) {
      const W = this.width;
      const H = this.height;
      const hudH = 30;
      const panelH = entityBattle.mode === 'interactive'
        ? Math.min(260, Math.max(184, Math.round(H * 0.42)))
        : 60;
      const stageTop = hudH;
      const stageBottom = H - panelH;
      return { W, H, hudH, panelH, stageTop, stageBottom, stageH: Math.max(40, stageBottom - stageTop) };
    }

    renderEntityBattleOverlay(_state = {}, options = {}) {
      const entityBattle = options.entityBattle;
      if (!entityBattle || !entityBattle.visible || !entityBattle.battle) return;
      const layout = this.getEntityBattleLayout(entityBattle);
      const renderContext = this.getEntityBattleRenderContext(entityBattle, layout);
      this.setHitTargets([]);
      this.drawEntityBattleBackground(entityBattle, layout, renderContext);
      this.drawEntityBattleField(entityBattle, layout, renderContext);
      this.drawEntityBattleTopHud(entityBattle, layout);
      if (entityBattle.mode === 'interactive') this.drawEntityBattleControls(entityBattle, layout);
      else this.drawEntityReplayControls(entityBattle, layout);
      if (entityBattle.ended) this.drawEntityBattleResult(entityBattle, layout);
    }

    getEntityBattleRenderContext(entityBattle = {}, layout = {}) {
      const arena = entityBattle.arena || { w: layout.W, h: layout.stageH };
      const stage = { x: 0, y: layout.stageTop, w: layout.W, h: layout.stageH };
      const arenaW = Math.max(1, Number(arena.w) || layout.W || 1);
      const arenaH = Math.max(1, Number(arena.h) || layout.stageH || 1);
      const fit = BattleCameraPolicy
        ? BattleCameraPolicy.computeFit({ w: arenaW, h: arenaH }, stage)
        : {
          scale: Math.min(layout.W / arenaW, layout.stageH / arenaH) || 1,
          contentW: arenaW * (Math.min(layout.W / arenaW, layout.stageH / arenaH) || 1),
          contentH: arenaH * (Math.min(layout.W / arenaW, layout.stageH / arenaH) || 1),
          stageX: 0,
          stageY: layout.stageTop,
          stageW: layout.W,
          stageH: layout.stageH,
        };
      entityBattle._viewFit = fit;
      const camera = entityBattle.camera || { zoom: 1, offsetX: 0, offsetY: 0 };
      const transform = BattleCameraPolicy
        ? BattleCameraPolicy.getViewTransform(camera, fit)
        : {
          scale: fit.scale,
          offsetX: (layout.W - arenaW * fit.scale) / 2,
          offsetY: layout.stageTop + (layout.stageH - arenaH * fit.scale) / 2,
        };
      return {
        layout,
        arena: { ...arena, w: arenaW, h: arenaH },
        stage,
        fit,
        camera,
        transform,
      };
    }

    withEntityBattleStageClip(renderContext = {}, draw = null) {
      if (typeof draw !== 'function') return undefined;
      const ctx = this.ctx;
      const stage = renderContext.stage || {};
      const canClip = ctx
        && typeof ctx.save === 'function'
        && typeof ctx.restore === 'function'
        && typeof ctx.beginPath === 'function'
        && typeof ctx.rect === 'function'
        && typeof ctx.clip === 'function';
      if (!canClip) return draw();
      ctx.save();
      ctx.beginPath();
      ctx.rect(stage.x, stage.y, stage.w, stage.h);
      ctx.clip();
      try {
        return draw();
      } finally {
        ctx.restore();
      }
    }

    drawEntityBattleBackground(entityBattle = {}, layout = {}, renderContext = null) {
      const path = entityBattle.bgPath || 'assets/art/battle/battlefield-forest-camp.png';
      const ctx = this.ctx;
      if (!ctx) {
        this.drawCoverAsset(path, 0, 0, this.width, this.height);
        return;
      }
      ctx.fillStyle = '#0c1116';
      ctx.fillRect(0, 0, this.width, this.height);
      const context = renderContext || this.getEntityBattleRenderContext(entityBattle, layout);
      const stage = context.stage || { x: 0, y: layout.stageTop || 0, w: layout.W || this.width, h: layout.stageH || this.height };
      this.withEntityBattleStageClip(context, () => {
        const scale = Number(context.transform?.scale) || 1;
        const x = Number(context.transform?.offsetX) || 0;
        const y = Number(context.transform?.offsetY) || 0;
        const w = Math.max(1, (Number(context.arena?.w) || stage.w || this.width || 1) * scale);
        const h = Math.max(1, (Number(context.arena?.h) || stage.h || this.height || 1) * scale);
        if (this.drawCoverAsset(path, x, y, w, h)) return;
        ctx.fillStyle = '#1d2119';
        ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
      });
    }

    drawEntityBattleField(entityBattle = {}, layout = {}, renderContext = null) {
      const ctx = this.ctx;
      if (!ctx) return;
      const battle = entityBattle.battle;
      // Camera: the pure policy owns fit + zoom/pan math; the renderer only reads
      // the resulting transform. _viewFit is stashed for the input layer so it can
      // map screen<->world for zoom-at-cursor / pan without recomputing layout.
      const context = renderContext || this.getEntityBattleRenderContext(entityBattle, layout);
      const transform = context.transform;
      const scale = transform.scale;
      const offX = transform.offsetX;
      const offY = transform.offsetY;
      const now = this.getNow();
      const base = (now / ENTITY_FRAME_MS) | 0;
      const rstate = entityBattle._rstate || (entityBattle._rstate = {});
      const units = battle.units || [];
      this.withEntityBattleStageClip(context, () => {
        const draw = [];
        for (let i = 0; i < units.length; i += 1) {
          const u = units[i];
          if (!u || !u.alive || u.left) continue;
          const rs = rstate[u.id] || (rstate[u.id] = { fx: u.side === 0 ? 1 : -1, px: u.x });
          if (u.x > rs.px + 0.05) rs.fx = 1;
          else if (u.x < rs.px - 0.05) rs.fx = -1;
          rs.px = u.x;
          draw.push(u);
        }
        draw.sort((a, b) => a.y - b.y);
        for (let j = 0; j < draw.length; j += 1) {
          const d = draw[j];
          const h = (d.kind === 'general' ? 46 : 16) * scale * ENTITY_SPRITE_SCALE;
          const w = Math.round((h * 500) / 400);
          const x = offX + d.x * scale;
          const y = offY + d.y * scale;
          const side = d.side === 0 ? 'player' : 'enemy';
          const pose = ENTITY_STATE_POSE[d.state] || 'move';
          const frameIdx = (base + (d.id % ENTITY_FRAMES)) % ENTITY_FRAMES;
          const path = `assets/art/battle/units/${side}/${pose}/${String(frameIdx + 1).padStart(2, '0')}.png`;
          const img = this.getAsset(path);
          let drew = false;
          if (img && (img.naturalWidth || img.width)) {
            if (rstate[d.id].fx < 0) {
              ctx.save();
              ctx.translate(x, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(img, -w / 2, y - h, w, h);
              ctx.restore();
            } else {
              ctx.drawImage(img, x - w / 2, y - h, w, h);
            }
            drew = true;
          }
          if (!drew) {
            ctx.fillStyle = d.side === 0 ? '#f0564b' : '#4a9bf0';
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
          }
          if (d.kind === 'general') {
            ctx.fillStyle = d.side === 0 ? '#3fb950' : '#f0c000';
            ctx.fillRect(x - 2, y - h - 6, 4, 4);
          }
        }
      });
    }

    drawEntityBattleTopHud(entityBattle = {}, layout = {}) {
      const Core = this.getEntityBattleCore();
      const battle = entityBattle.battle;
      const counts = Core && typeof Core.countOnField === 'function' ? Core.countOnField(battle) : [0, 0];
      this.drawPanel(8, 4, layout.W - 16, layout.hudH - 6, {
        fill: 'rgba(0, 0, 0, 0.5)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 6,
      });
      const midY = 4 + (layout.hudH - 6) / 2;
      this.drawText(this.t('battle.entity.top.tick', { tick: battle.tick || 0 }), 16, midY, { size: 11, color: '#58a6ff', baseline: 'middle' });
      this.drawText(this.t('battle.entity.top.allyCount', { count: counts[0] || 0 }), 92, midY, { size: 11, color: '#3fb950', baseline: 'middle' });
      this.drawText(this.t('battle.entity.top.enemyCount', { count: counts[1] || 0 }), 168, midY, { size: 11, color: '#f0c000', baseline: 'middle' });
      this.drawText(entityBattle.status || this.t('battle.entity.status.fighting', {}), layout.W - 16, midY, {
        size: 11,
        color: entityBattle.statusColor || '#d29922',
        align: 'right',
        baseline: 'middle',
      });
    }

    drawEntityButtonRow(label, items = [], x = 0, y = 0, maxW = 0) {
      const labelW = 52;
      const btnH = 26;
      const gap = 5;
      this.drawText(label, x, y + btnH / 2, { size: 11, color: '#8b98a5', baseline: 'middle' });
      let cx = x + labelW;
      let cy = y;
      items.forEach((item) => {
        const tw = this.measureTextWidth(item.label, { size: 12 }) + 16;
        const bw = Math.max(40, Math.min(maxW - labelW, tw));
        if (cx + bw > x + maxW) {
          cx = x + labelW;
          cy += btnH + gap;
        }
        this.drawButton(cx, cy, bw, btnH, item.label, {
          size: 12,
          radius: 6,
          active: Boolean(item.active),
          disabled: Boolean(item.disabled),
        });
        if (!item.disabled && item.action) {
          this.addHitTarget({ x: cx, y: cy, width: bw, height: btnH }, item.action);
        }
        cx += bw + gap;
      });
      return cy + btnH + gap;
    }

    drawEntityBattleControls(entityBattle = {}, layout = {}) {
      const Core = this.getEntityBattleCore();
      const battle = entityBattle.battle;
      const top = layout.H - layout.panelH;
      this.drawPanel(0, top, layout.W, layout.panelH, {
        fill: 'rgba(22, 27, 34, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 0,
      });
      const pad = 10;
      const x = pad;
      const maxW = layout.W - pad * 2;
      let y = top + 8;
      const tickHz = entityBattle.tickHz || 20;
      const disabled = Boolean(battle.result) || Boolean(entityBattle.ended);
      const squads = battle.squads || {};

      const genItems = [];
      Object.keys(squads).forEach((gid) => {
        if (squads[gid].side !== 0) return;
        genItems.push({
          label: gid,
          active: gid === entityBattle.selectedGid,
          action: { type: 'entityBattleSelectGeneral', gid },
        });
      });
      y = this.drawEntityButtonRow(this.t('battle.entity.row.selectGeneral', {}), genItems, x, y, maxW);

      const sq = squads[entityBattle.selectedGid];

      const orderItems = ENTITY_ORDER_KEYS.map((pair) => {
        const cd = sq ? (sq.orderCdLeft || 0) : 0;
        const labelCd = cd > 0 ? ` (${Math.ceil(cd / tickHz)}s)` : '';
        return {
          label: this.t(pair[1]) + labelCd,
          disabled: disabled || cd > 0 || !sq,
          action: { type: 'entityBattleOrder', gid: entityBattle.selectedGid, order: pair[0] },
        };
      });
      y = this.drawEntityButtonRow(this.t('battle.entity.row.singleOrder', {}), orderItems, x, y, maxW);

      const masterItems = ENTITY_MASTER_KEYS.map((pair) => {
        const used = battle.masterUsed && battle.masterUsed[0] && battle.masterUsed[0][pair[0]];
        return {
          label: this.t(pair[1]),
          active: true,
          disabled: disabled || Boolean(used),
          action: { type: 'entityBattleMaster', order: pair[0] },
        };
      });
      y = this.drawEntityButtonRow(this.t('battle.entity.row.masterOrder', {}), masterItems, x, y, maxW);

      const gen = sq ? battle.units[sq.generalId] : null;
      const rageMax = battle.config && battle.config.rageMax;
      const skillItems = [];
      ((gen && gen.skills) || []).forEach((sk, idx) => {
        const ready = Core && typeof Core.skillReady === 'function' ? Core.skillReady(battle, gen, sk, idx) : false;
        const info = sk.kind === 'ultimate'
          ? this.t(
            'battle.entity.skill.rage',
            { rage: Math.floor(gen.rage || 0), cost: sk.rageCost || rageMax })
          : ((gen.skillCds && gen.skillCds[idx] > 0)
            ? `${Math.ceil(gen.skillCds[idx] / tickHz)}s`
            : this.t('common.ready', {}));
        skillItems.push({
          label: `${sk.name}[${info}]${sk.auto ? this.t('battle.entity.skill.autoSuffix', {}) : ''}`,
          disabled: disabled || !ready,
          action: { type: 'entityBattleSkill', gid: entityBattle.selectedGid, skillId: sk.id },
        });
      });
      if (!skillItems.length) skillItems.push({ label: this.t('battle.entity.skill.none', {}), disabled: true });
      this.drawEntityButtonRow(this.t('battle.entity.row.skill', {}), skillItems, x, y, maxW);

      // Bottom row (anchored): 自动 托管 toggle + 完成 (only after the battle ends).
      const bh = 28;
      const by = layout.H - bh - 8;
      const autoLabel = this.t(
        'battle.entity.auto',
        { state: entityBattle.auto ? this.t('common.enabled', {}) : this.t('common.disabled', {}) });
      const autoW = Math.max(72, this.measureTextWidth(autoLabel, { size: 12 }) + 18);
      this.drawButton(x, by, autoW, bh, autoLabel, { size: 12, radius: 6, active: Boolean(entityBattle.auto) });
      this.addHitTarget({ x, y: by, width: autoW, height: bh }, { type: 'entityBattleAuto' });
      if (entityBattle.ended) {
        const dw = 88;
        const dx = layout.W - dw - pad;
        this.drawButton(dx, by, dw, bh, this.t('common.done', {}), { size: 13, radius: 6, active: true });
        this.addHitTarget({ x: dx, y: by, width: dw, height: bh }, { type: 'entityBattleDone' });
      }
    }

    drawEntityReplayControls(entityBattle = {}, layout = {}) {
      const top = layout.H - layout.panelH;
      this.drawPanel(0, top, layout.W, layout.panelH, {
        fill: 'rgba(0, 0, 0, 0.5)',
        stroke: 'rgba(255, 226, 177, 0.1)',
        radius: 0,
      });
      const bh = 32;
      const bw = 76;
      const by = top + (layout.panelH - bh) / 2;
      const summary = (entityBattle.report && entityBattle.report.summary) || '';
      this.drawText(this.truncateText(summary, layout.W - bw * 2 - 40, { size: 12 }), 14, top + layout.panelH / 2, {
        size: 12,
        color: '#cbd5e1',
        baseline: 'middle',
      });
      const doneX = layout.W - bw - 12;
      this.drawButton(doneX, by, bw, bh, this.t('common.done', {}), { size: 13, radius: 8, active: true });
      this.addHitTarget({ x: doneX, y: by, width: bw, height: bh }, { type: 'entityBattleClose' });
      const backX = doneX - bw - 8;
      this.drawButton(backX, by, bw, bh, this.t('common.back', {}), { size: 13, radius: 8 });
      this.addHitTarget({ x: backX, y: by, width: bw, height: bh }, { type: 'entityBattleClose' });
    }

    entityBattleSideSurvivors(entityBattle = {}, side = 0, result = {}) {
      const battle = entityBattle.battle;
      const survivors = (result && result.survivorsByGid) || {};
      const squads = battle.squads || {};
      const parts = [];
      let total = 0;
      Object.keys(squads).forEach((gid) => {
        if (squads[gid].side !== side) return;
        const n = Math.floor(survivors[gid] || 0);
        total += n;
        parts.push(`${gid} ${n}`);
      });
      return this.t('battle.entity.survivors', { parts: parts.join(' , '), total });
    }

    drawEntityBattleResult(entityBattle = {}, layout = {}) {
      const winner = entityBattle.resultWinner;
      const win = winner === 'attacker';
      const draw = winner === 'draw';
      const title = win
        ? this.t('battle.result.victory', {})
        : (draw ? this.t('battle.result.draw', {}) : this.t('battle.result.defeat', {}));
      const color = win ? '#3fb950' : (draw ? '#d29922' : '#f85149');
      const boxW = Math.min(layout.W - 40, 320);
      const boxH = 124;
      const bx = (layout.W - boxW) / 2;
      const by = layout.stageTop + (layout.stageH - boxH) / 2;
      this.drawPanel(bx, by, boxW, boxH, {
        fill: 'rgba(13, 17, 23, 0.95)',
        stroke: 'rgba(42, 51, 64, 1)',
        radius: 10,
      });
      this.drawText(title, bx + boxW / 2, by + 22, { size: 20, bold: true, color, align: 'center', baseline: 'middle' });
      const result = entityBattle.serverResult || (entityBattle.battle && entityBattle.battle.result) || {};
      this.drawText(this.t(
        'battle.entity.survivorLine.ally',
        { survivors: this.entityBattleSideSurvivors(entityBattle, 0, result) }), bx + 14, by + 52, { size: 12, color: '#cbd5e1' });
      this.drawText(this.t(
        'battle.entity.survivorLine.enemy',
        { survivors: this.entityBattleSideSurvivors(entityBattle, 1, result) }), bx + 14, by + 74, { size: 12, color: '#cbd5e1' });
      this.drawText(this.t(
        'battle.entity.result.audit',
        { ticks: result.ticks || 0, commands: entityBattle.inputStreamLen || 0 }), bx + 14, by + 98, { size: 10, color: '#8b98a5' });
    }
  }

  BattleLayoutModel?.install?.(BattleCanvasRenderer);
  BattleSpriteRenderer?.install?.(BattleCanvasRenderer);

  if (typeof module !== 'undefined' && module.exports) module.exports = BattleCanvasRenderer;
  else global.BattleCanvasRenderer = BattleCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
