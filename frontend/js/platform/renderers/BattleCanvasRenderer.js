(function (global) {
  class BattleCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    static getBattleUnitAssetVersion() {
      return 'battle-units-split-v1-20260529';
    }

    static getBattleUnitFrameCount() {
      return 4;
    }

    static getBattleUnitKey(side = 'attacker') {
      return side === 'attacker' ? 'player' : 'enemy';
    }

    static getBattleUnitFramePath(unit = 'player', pose = 'idle', frameIndex = 0, rootPath = '') {
      const safeUnit = unit === 'enemy' ? 'enemy' : 'player';
      const safePose = ['idle', 'move', 'attack', 'die'].includes(pose) ? pose : 'idle';
      const count = this.getBattleUnitFrameCount();
      const index = Math.max(0, Math.min(count - 1, Math.floor(Number(frameIndex) || 0)));
      const file = String(index + 1).padStart(2, '0') + '.png';
      const root = rootPath && !String(rootPath).endsWith('.png')
        ? String(rootPath).replace(/\/+$/, '')
        : 'assets/art/battle/units/' + safeUnit;
      return root + '/' + safePose + '/' + file;
    }

    static getBattleUnitFramePaths() {
      const poses = ['idle', 'move', 'attack', 'die'];
      const paths = [];
      ['player', 'enemy'].forEach((unit) => {
        poses.forEach((pose) => {
          for (let index = 0; index < this.getBattleUnitFrameCount(); index += 1) {
            paths.push(this.getBattleUnitFramePath(unit, pose, index));
          }
        });
      });
      return paths;
    }

    render(state = {}, options = {}) {
      return this.renderBattleSceneOverlay(state, options);
    }

    getBattleUnitPose(side, activeTurn = null, phase = 'impact') {
      if (!activeTurn) return 'idle';
      if (phase === 'prepare' || phase === 'cutin' || phase === 'settle') return 'idle';
      if (activeTurn.actor === side) return phase === 'move' ? 'move' : 'attack';
      if (activeTurn.target === side) {
        if (phase === 'impact' && this.isBattleSideDefeatedByTurn(side, activeTurn)) return 'die';
        return phase === 'impact' ? 'hit' : 'idle';
      }
      return 'idle';
    }

    getBattleTurnSoldierCount(turn = {}, side = 'attacker', timing = 'after', fallback = 0) {
      const nested = turn?.[`soldiers${timing === 'after' ? 'After' : 'Before'}`]?.[side];
      if (nested !== undefined && nested !== null) return Number(nested) || 0;
      const legacyKey = `${side}Soldiers${timing === 'after' ? 'After' : 'Before'}`;
      if (turn?.[legacyKey] !== undefined && turn?.[legacyKey] !== null) return Number(turn[legacyKey]) || 0;
      return Number(fallback) || 0;
    }

    isBattleSideDefeatedByTurn(side = 'attacker', turn = {}) {
      const before = this.getBattleTurnSoldierCount(turn, side, 'before', 1);
      const after = this.getBattleTurnSoldierCount(turn, side, 'after', before);
      return before > 0 && after <= 0;
    }

    getBattlePlaybackPhase(progress = 0, activeTurn = null) {
      if (!activeTurn) {
        return { phase: 'ended', phaseProgress: 1 };
      }
      const value = Math.max(0, Math.min(1, Number(progress) || 0));
      const isSkill = activeTurn.action === 'skill' || activeTurn.actionType === 'skill' || activeTurn.presentation?.cutIn;
      if (isSkill) {
        if (value < 0.70) {
          return { phase: 'cutin', phaseProgress: value / 0.70 };
        }
        if (value < 0.76) {
          return { phase: 'prepare', phaseProgress: (value - 0.70) / 0.06 };
        }
        if (value < 0.84) {
          return { phase: 'move', phaseProgress: (value - 0.76) / 0.08 };
        }
        if (value < 0.96) {
          return { phase: 'impact', phaseProgress: (value - 0.84) / 0.12 };
        }
        return { phase: 'settle', phaseProgress: (value - 0.96) / 0.04 };
      }
      if (value < 0.12) {
        return { phase: 'prepare', phaseProgress: value / 0.12 };
      }
      if (value < 0.46) {
        return { phase: 'move', phaseProgress: (value - 0.12) / 0.34 };
      }
      if (value < 0.82) {
        return { phase: 'impact', phaseProgress: (value - 0.46) / 0.36 };
      }
      return { phase: 'settle', phaseProgress: (value - 0.82) / 0.18 };
    }

    getBattleEngagementProgress(turnIndex = 0, phase = 'prepare', phaseProgress = 0, activeTurn = null) {
      if (!activeTurn) return 1;
      const index = Math.max(0, Math.floor(Number(turnIndex) || 0));
      if (index > 0) return 1;
      if (phase === 'prepare') return 0;
      if (phase === 'move') return Math.max(0, Math.min(1, Number(phaseProgress) || 0));
      return 1;
    }

    getBattleUnitFormationPosition(side = 'attacker', area = {}, index = 0, columns = 1) {
      const safeColumns = Math.max(1, Math.floor(Number(columns) || 1));
      const col = index % safeColumns;
      const row = Math.floor(index / safeColumns);
      return {
        col,
        row,
        x: side === 'attacker'
          ? area.x + col * 30 + 22
          : area.x + area.width - col * 30 - 22,
        y: area.y + row * 34 + 72 + (col % 2) * 5,
      };
    }

    getBattleUnitEngagementPosition(side = 'attacker', area = {}, index = 0, columns = 1, scale = 0.21) {
      const formation = this.getBattleUnitFormationPosition(side, area, index, columns);
      const centerX = this.width / 2;
      const laneCenter = (Math.max(1, columns) - 1) / 2;
      const laneOffset = (formation.col - laneCenter) * 7 + (((index * 13) % 5) - 2) * 2;
      const frontGap = 20 + Math.min(10, formation.row * 3);
      return {
        x: centerX + (side === 'attacker' ? -frontGap : frontGap) + laneOffset,
        y: formation.y + (((index * 7) % 5) - 2) * 2,
        scale,
      };
    }

    easeBattleUnitProgress(progress = 0) {
      const value = Math.max(0, Math.min(1, Number(progress) || 0));
      return 1 - Math.pow(1 - value, 3);
    }

    getBattleUnitEngagementDelay(index = 0) {
      const row = Math.floor(Math.max(0, Number(index) || 0) / 5);
      return Math.min(0.34, (Math.max(0, Number(index) || 0) % 5) * 0.045 + row * 0.035);
    }

    getBattleUnitEngagementRatio(index = 0, engagementProgress = 1) {
      const progress = Math.max(0, Math.min(1, Number(engagementProgress) || 0));
      if (progress >= 1) return 1;
      if (progress <= 0) return 0;
      const delay = this.getBattleUnitEngagementDelay(index);
      return this.easeBattleUnitProgress((progress - delay) / Math.max(0.01, 1 - delay));
    }

    getBattleUnitBattlefieldPosition(side = 'attacker', area = {}, index = 0, columns = 1, scale = 0.21, engagementProgress = 1) {
      const formation = this.getBattleUnitFormationPosition(side, area, index, columns);
      const engaged = this.getBattleUnitEngagementPosition(side, area, index, columns, scale);
      const ratio = this.getBattleUnitEngagementRatio(index, engagementProgress);
      return {
        x: formation.x + (engaged.x - formation.x) * ratio,
        y: formation.y + (engaged.y - formation.y) * ratio,
        formation,
        engaged,
        ratio,
      };
    }

    getBattleUnitSpec(side = 'attacker', spritePath = '') {
      const unit = this.constructor.getBattleUnitKey(side);
      const root = spritePath && !String(spritePath).endsWith('.png') ? spritePath : `assets/art/battle/units/${unit}`;
      return {
        unit,
        root,
        frameCount: this.constructor.getBattleUnitFrameCount(),
        width: 500,
        height: 400,
      };
    }

    getBattleFramePose(pose = 'idle') {
      if (pose === 'skill') return 'attack';
      if (pose === 'hit') return 'idle';
      if (pose === 'defeated') return 'die';
      if (pose === 'die') return 'die';
      return ['idle', 'move', 'attack'].includes(pose) ? pose : 'idle';
    }

    getBattleFrameIndex(pose = 'idle', frame = 0, progress = 0) {
      const count = this.constructor.getBattleUnitFrameCount();
      if (pose === 'attack' || pose === 'skill' || pose === 'die' || pose === 'defeated') {
        return Math.max(0, Math.min(count - 1, Math.floor(Math.max(0, Math.min(1, Number(progress) || 0)) * count)));
      }
      return Math.abs(Math.floor(Number(frame) || 0)) % count;
    }

    getBattleFrameSpritePath(side = 'attacker', pose = 'idle', frame = 0, spritePath = '', progress = 0) {
      const spec = this.getBattleUnitSpec(side, spritePath);
      const framePose = this.getBattleFramePose(pose);
      const frameIndex = this.getBattleFrameIndex(pose, frame, progress);
      return this.constructor.getBattleUnitFramePath(spec.unit, framePose, frameIndex, spec.root);
    }

    getBattleSideSpritePath(sideView = {}, side = 'attacker') {
      return sideView.sprite || `assets/art/battle/units/${this.constructor.getBattleUnitKey(side)}`;
    }

    drawBattleMapBackground(map = {}) {
      const path = map.background || 'assets/art/battle/battlefield-forest-camp.png';
      if (this.drawCoverAsset(path, 0, 0, this.width, this.height)) return;
      this.ctx.fillStyle = '#1d2119';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawBattleSoldierFrame(x, y, side = 'attacker', pose = 'idle', frame = 0, ratio = 1, scale = 0.22, spritePath = '', progress = 0) {
      const spec = this.getBattleUnitSpec(side, spritePath);
      const path = this.getBattleFrameSpritePath(side, pose, frame, spritePath, progress);
      const image = this.getAsset(path);
      if (!image || typeof this.ctx?.drawImage !== 'function') return false;
      const alpha = Math.max(0.25, Math.min(1, Number(ratio) || 1));
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha * alpha;
      const sourceWidth = Number(image.naturalWidth || image.width || spec.width);
      const sourceHeight = Number(image.naturalHeight || image.height || spec.height);
      const dw = sourceWidth * scale;
      const dh = sourceHeight * scale;
      const drawX = x - dw / 2;
      const drawY = y - dh;
      this.ctx.drawImage(image, drawX, drawY, dw, dh);
      if (pose === 'hit') {
        const flashAlpha = Math.max(0, Math.sin(Math.max(0, Math.min(1, Number(progress) || 0)) * Math.PI)) * 0.36;
        if (flashAlpha > 0.01 && typeof this.ctx.filter === 'string') {
          const afterImageAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : previousAlpha;
          this.ctx.globalAlpha = afterImageAlpha * flashAlpha;
          const previousFilter = this.ctx.filter;
          this.ctx.filter = 'brightness(2.4) saturate(0)';
          this.ctx.drawImage(image, drawX, drawY, dw, dh);
          this.ctx.filter = previousFilter;
        }
      }
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawBattleSoldierFallback(x, y, side = 'attacker', ratio = 1) {
      if (!this.ctx) return;
      const alpha = Math.max(0.25, Math.min(1, Number(ratio) || 1));
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha * alpha;
      const color = side === 'attacker' ? '#74d3a0' : '#e07b62';
      this.drawCircle(x, y - 18, 5, { fill: color });
      this.drawPanel(x - 6, y - 14, 12, 16, { fill: color, radius: 2 });
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
    }

    drawBattleSoldierSprite(x, y, side = 'attacker', pose = 'idle', frame = 0, ratio = 1, scale = 0.22, spritePath = '', progress = 0) {
      if (this.drawBattleSoldierFrame(x, y, side, pose, frame, ratio, scale, spritePath, progress)) return;
      this.drawBattleSoldierFallback(x, y, side, ratio);
    }

    drawBattleSoldier(x, y, side = 'attacker', pose = 'idle', frame = 0, ratio = 1, scale = 0.22) {
      return this.drawBattleSoldierSprite(x, y, side, pose, frame, ratio, scale);
    }

    drawBattleArmy(sideView = {}, area = {}, options = {}) {
      const groups = sideView.groups || [];
      const pose = options.pose || 'idle';
      const visualGroups = groups.length || !(pose === 'die' || pose === 'defeated')
        ? groups
        : [{ ratio: 1, soldiers: 0, capacity: 1 }];
      const side = sideView.side || 'attacker';
      const frame = Number(options.frame) || 0;
      const progress = Math.max(0, Math.min(1, Number(options.progress) || 0));
      const engagementProgress = Math.max(0, Math.min(1, Number(options.engagementProgress ?? 1) || 0));
      const actionType = options.actionType || '';
      const columns = Math.max(1, Math.floor(area.width / 34));
      const dir = side === 'attacker' ? 1 : -1;
      const activeCount = pose === 'idle' ? 0 : Math.min(visualGroups.length, actionType === 'skill' ? 5 : 3);
      const hitOffset = pose === 'hit' ? Math.sin(frame * 2.2) * 5 * dir : 0;
      visualGroups.slice(0, 18).forEach((group, index) => {
        const isActiveSoldier = index < activeCount;
        const stagger = isActiveSoldier ? Math.max(0, 1 - index * 0.12) : 0;
        const activePose = isActiveSoldier ? pose : 'idle';
        const scale = actionType === 'skill' && isActiveSoldier ? 0.245 : 0.21;
        const position = this.getBattleUnitBattlefieldPosition(side, area, index, columns, scale, engagementProgress);
        const activeOffset = isActiveSoldier ? hitOffset * stagger : 0;
        this.drawBattleSoldierSprite(
          position.x + activeOffset,
          position.y,
          side,
          activePose,
          frame + index,
          group.ratio,
          scale,
          this.getBattleSideSpritePath(sideView, side),
          progress,
        );
      });
      if (groups.length > 18) {
        this.drawText(`+${groups.length - 18}`, side === 'attacker' ? area.x + area.width - 28 : area.x + 10, area.y + area.height - 22, {
          size: 12,
          bold: true,
          color: '#f6e8c8',
        });
      }
      this.drawText(`${sideView.soldiers || 0}/${sideView.soldiersStart || 0}`, area.x + area.width / 2, area.y + area.height + 6, {
        size: 12,
        bold: true,
        color: side === 'attacker' ? '#74d3a0' : '#e07b62',
        align: 'center',
      });
    }

    getBattleStatusBadgeColors(tone = 'status') {
      if (tone === 'guard') return {
        fill: 'rgba(26, 64, 72, 0.84)',
        stroke: 'rgba(132, 215, 255, 0.56)',
        color: '#bdeaff',
      };
      if (tone === 'dot') return {
        fill: 'rgba(82, 50, 26, 0.86)',
        stroke: 'rgba(255, 180, 94, 0.58)',
        color: '#ffd0a0',
      };
      if (tone === 'break') return {
        fill: 'rgba(78, 34, 34, 0.86)',
        stroke: 'rgba(255, 138, 114, 0.58)',
        color: '#ffb3a0',
      };
      return {
        fill: 'rgba(52, 43, 76, 0.84)',
        stroke: 'rgba(217, 198, 255, 0.50)',
        color: '#dfd2ff',
      };
    }

    drawBattleSideState(sideView = {}, area = {}, side = 'attacker') {
      const panelWidth = Math.min(154, Math.max(128, area.width + 8));
      const panelHeight = 72;
      const x = side === 'attacker' ? area.x : area.x + area.width - panelWidth;
      const y = Math.max(92, area.y - 74);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(18, 14, 10, 0.64)',
        stroke: side === 'attacker' ? 'rgba(116, 211, 160, 0.28)' : 'rgba(224, 123, 98, 0.28)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      const skillState = sideView.skillState || null;
      const skillName = skillState?.skillName ? this.truncateText(skillState.skillName, panelWidth - 82, { size: 11, bold: true }) : '无战法';
      this.drawText(skillName, x + 10, y + 11, {
        size: 11,
        bold: true,
        color: skillState?.active ? '#ffe6b5' : '#cbbd96',
      });
      const stateText = skillState?.stateText || '只普攻';
      this.drawText(this.truncateText(stateText, 68, { size: 10, bold: true }), x + panelWidth - 10, y + 11, {
        size: 10,
        bold: true,
        color: skillState?.state === 'ready' ? '#74d3a0' : (skillState?.state === 'casting' ? '#ffd66e' : '#aeb0b8'),
        align: 'right',
      });
      const statuses = Array.isArray(sideView.statuses) ? sideView.statuses : [];
      if (!statuses.length) {
        this.drawText('状态：无', x + 10, y + 42, {
          size: 11,
          color: '#8d8f99',
        });
        return;
      }
      let cursorX = x + 10;
      let cursorY = y + 40;
      statuses.slice(0, 4).forEach((status) => {
        const label = this.truncateText(status.text || status.label || '状态', 68, { size: 10, bold: true });
        const width = Math.min(74, Math.max(38, this.measureTextWidth(label, { size: 10, bold: true }) + 14));
        if (cursorX + width > x + panelWidth - 8) {
          cursorX = x + 10;
          cursorY += 20;
        }
        if (cursorY > y + panelHeight - 17) return;
        const colors = this.getBattleStatusBadgeColors(status.tone);
        this.drawPanel(cursorX, cursorY, width, 16, {
          fill: colors.fill,
          stroke: colors.stroke,
          radius: 5,
          inset: 'rgba(255, 255, 255, 0.04)',
        });
        this.drawText(label, cursorX + width / 2, cursorY + 8, {
          size: 10,
          bold: true,
          color: colors.color,
          align: 'center',
          baseline: 'middle',
        });
        cursorX += width + 5;
      });
    }

    drawBattleActionEffect(activeTurn = null, progress = 0) {
      if (!activeTurn) return;
      const isSkill = activeTurn.action === 'skill' || activeTurn.actionType === 'skill';
      const impactProgress = Math.max(0, Math.min(1, Number(progress) || 0));
      if (impactProgress <= 0) return;
      const x = activeTurn.target === 'defender' ? this.width * 0.58 : this.width * 0.42;
      const y = Math.max(270, this.height * 0.48);
      const pulse = Math.sin(impactProgress * Math.PI);
      this.drawCircle(x, y, (isSkill ? 42 : 24) * pulse, {
        fill: isSkill ? 'rgba(255, 196, 76, 0.20)' : 'rgba(255, 245, 210, 0.14)',
        stroke: isSkill ? 'rgba(255, 226, 122, 0.72)' : 'rgba(255, 245, 210, 0.42)',
        width: isSkill ? 3 : 2,
      });
      if (isSkill) {
        this.drawText(activeTurn.skillName || '技能', x, y - 54 * pulse, {
          size: 14,
          bold: true,
          color: '#ffe6b5',
          align: 'center',
        });
      }
    }

    drawBattleSkillCutIn(activeTurn = null, progress = 0) {
      const shouldShowCutIn = activeTurn?.presentation?.cutIn || activeTurn?.action === 'skill' || activeTurn?.actionType === 'skill';
      if (!shouldShowCutIn) return;
      const cutInProgress = Math.max(0, Math.min(1, Number(progress) || 0));
      if (cutInProgress <= 0) return;
      const actorSide = activeTurn.actor === 'defender' ? 'defender' : 'attacker';
      const easeOut = (value) => 1 - Math.pow(1 - Math.max(0, Math.min(1, value)), 3);
      const easeIn = (value) => Math.pow(Math.max(0, Math.min(1, value)), 3);
      const getFlyProgress = (value) => {
        if (value < 0.28) return { stage: 'enter', ratio: easeOut(value / 0.28) };
        if (value < 0.76) return { stage: 'hold', ratio: 1 };
        return { stage: 'exit', ratio: easeIn((value - 0.76) / 0.24) };
      };
      const flyProgress = getFlyProgress(cutInProgress);
      const fadeIn = Math.min(1, cutInProgress / 0.16);
      const fadeOut = cutInProgress < 0.82 ? 1 : Math.max(0, 1 - (cutInProgress - 0.82) / 0.18);
      const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));
      const portraitSize = Math.min(142, Math.max(104, this.width * 0.34));
      const portraitY = Math.max(104, this.height * 0.25);
      const portraitCenterX = this.width / 2 - Math.min(84, this.width * 0.22);
      const portraitHoldX = portraitCenterX - portraitSize / 2;
      const portraitStartX = -portraitSize - 28;
      const portraitEndX = this.width + 28;
      const portraitX = flyProgress.stage === 'exit'
        ? portraitHoldX + (portraitEndX - portraitHoldX) * flyProgress.ratio
        : portraitStartX + (portraitHoldX - portraitStartX) * flyProgress.ratio;
      const titleWidth = Math.min(238, this.width * 0.58);
      const titleHeight = 72;
      const titleY = portraitY + portraitSize * 0.3;
      const titleCenterX = this.width / 2 + Math.min(74, this.width * 0.19);
      const titleHoldX = titleCenterX - titleWidth / 2;
      const titleStartX = this.width + 28;
      const titleEndX = -titleWidth - 28;
      const titleX = flyProgress.stage === 'exit'
        ? titleHoldX + (titleEndX - titleHoldX) * flyProgress.ratio
        : titleStartX + (titleHoldX - titleStartX) * flyProgress.ratio;
      const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (this.ctx && typeof this.ctx.globalAlpha === 'number') {
        this.ctx.globalAlpha = previousAlpha * alpha;
      }

      if (this.ctx && typeof this.ctx.fillRect === 'function') {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
        this.ctx.fillRect(0, Math.max(0, portraitY - 34), this.width, portraitSize + 70);
      }
      this.drawPanel(portraitX, portraitY, portraitSize, portraitSize, {
        fill: actorSide === 'attacker' ? 'rgba(20, 56, 45, 0.90)' : 'rgba(84, 40, 32, 0.90)',
        stroke: 'rgba(255, 226, 177, 0.44)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.12)',
      });
      const portraitDrawn = this.drawFamousPortrait(
        { appearance: activeTurn.actorPortrait || {} },
        portraitX,
        portraitY,
        portraitSize,
        {
          frameWidth: portraitSize,
          frameHeight: portraitSize,
          radius: 10,
          scale: 1.7,
          offsetY: 0.12,
        },
      );
      if (!portraitDrawn) {
        this.drawText(String(activeTurn.actorName || '将').slice(0, 1), portraitX + portraitSize / 2, portraitY + portraitSize / 2, {
          size: 26,
          bold: true,
          color: '#f6e8c8',
          align: 'center',
          baseline: 'middle',
        });
      }

      this.drawPanel(titleX, titleY, titleWidth, titleHeight, {
        fill: 'rgba(20, 16, 12, 0.88)',
        stroke: actorSide === 'attacker' ? 'rgba(116, 211, 160, 0.48)' : 'rgba(224, 123, 98, 0.48)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.10)',
      });
      const accentX = actorSide === 'attacker' ? titleX + 10 : titleX + titleWidth - 14;
      this.drawPanel(accentX, titleY + 12, 4, titleHeight - 24, {
        fill: actorSide === 'attacker' ? '#74d3a0' : '#e07b62',
        stroke: actorSide === 'attacker' ? '#74d3a0' : '#e07b62',
        radius: 2,
      });
      const textX = titleX + (actorSide === 'attacker' ? 24 : 14);
      const textWidth = titleWidth - 38;
      this.drawText(this.truncateText(activeTurn.actorName || '', textWidth, { size: 13, bold: true }), textX, titleY + 12, {
        size: 13,
        bold: true,
        color: '#cbbd96',
      });
      this.drawText(this.truncateText(activeTurn.skillName || '战法', textWidth, { size: 24, bold: true }), textX, titleY + 36, {
        size: 24,
        bold: true,
        color: '#ffe6b5',
      });
      if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
    }

    getBattleTurnDamage(turn = null) {
      if (!turn) return 0;
      const explicitDamage = Number(turn.damage);
      if (Number.isFinite(explicitDamage) && explicitDamage > 0) return Math.floor(explicitDamage);
      const target = turn.target === 'attacker' ? 'attacker' : 'defender';
      const before = this.getBattleTurnSoldierCount(turn, target, 'before', 0);
      const after = this.getBattleTurnSoldierCount(turn, target, 'after', before);
      return Math.max(0, before - after);
    }

    getBattleDamageFloatText(turn = null) {
      const damage = this.getBattleTurnDamage(turn);
      if (damage <= 0) return '';
      if (turn?.action === 'skill' && turn?.damageLabel) return `${turn.damageLabel} -${damage}`;
      return `-${damage}`;
    }

    drawBattleDamageFloat(activeTurn = null, phase = 'prepare', phaseProgress = 0, targetArea = null) {
      if (!activeTurn || phase !== 'impact' || !targetArea) return;
      const text = this.getBattleDamageFloatText(activeTurn);
      if (!text) return;
      const progress = Math.max(0, Math.min(1, Number(phaseProgress) || 0));
      const rise = progress * 42;
      const pop = 1 + Math.sin(progress * Math.PI) * 0.16;
      const alpha = Math.max(0, Math.min(1, 1 - Math.max(0, progress - 0.68) / 0.32));
      const isSkill = activeTurn.action === 'skill';
      const x = this.width / 2 + (activeTurn.target === 'defender' ? 34 : -34);
      const y = targetArea.y + Math.max(34, targetArea.height * 0.22) - rise;
      const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha * alpha;
      this.drawText(text, x + 1, y + 1, {
        size: Math.round(19 * pop),
        bold: true,
        color: 'rgba(24, 15, 10, 0.82)',
        align: 'center',
        baseline: 'middle',
      });
      this.drawText(text, x, y, {
        size: Math.round(19 * pop),
        bold: true,
        color: isSkill ? '#ffd66e' : '#ff8a72',
        align: 'center',
        baseline: 'middle',
      });
      if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
    }

    drawBattleStatusFloatingTexts(activeTurn = null, phase = 'prepare', phaseProgress = 0, areas = {}) {
      if (!activeTurn || !['prepare', 'impact', 'settle'].includes(phase)) return;
      const texts = Array.isArray(activeTurn.floatingTexts) ? activeTurn.floatingTexts : [];
      if (!texts.length) return;
      const progress = Math.max(0, Math.min(1, Number(phaseProgress) || 0));
      const phaseOffset = phase === 'prepare' ? 0 : (phase === 'impact' ? 0.34 : 0.68);
      const alpha = Math.max(0, Math.min(1, 1 - Math.max(0, phaseOffset + progress - 0.72) / 0.28));
      const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha * alpha;
      texts.slice(0, 4).forEach((item, index) => {
        const target = item?.target === 'attacker' ? 'attacker' : 'defender';
        const area = target === 'attacker' ? areas.attacker : areas.defender;
        if (!area) return;
        const kind = item.kind || 'status';
        const color = kind === 'shield'
          ? '#84d7ff'
          : (kind === 'damageOverTime' ? '#ffb45e' : '#d9c6ff');
        const x = area.x + area.width / 2 + (target === 'attacker' ? -18 : 18);
        const y = area.y + Math.max(22, area.height * 0.16) - progress * 28 - index * 17;
        const text = String(item.text || '').trim();
        if (!text) return;
        this.drawText(text, x + 1, y + 1, {
          size: 13,
          bold: true,
          color: 'rgba(19, 14, 10, 0.86)',
          align: 'center',
          baseline: 'middle',
        });
        this.drawText(text, x, y, {
          size: 13,
          bold: true,
          color,
          align: 'center',
          baseline: 'middle',
        });
      });
      if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
    }

    drawBattleLeader(sideView = {}, x, y, side = 'attacker') {
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
      if (!portrait) {
        this.drawCircle(x, y, radius, {
          fill: side === 'attacker' ? '#2f6f59' : '#7f3d32',
          stroke: 'rgba(255, 226, 177, 0.5)',
          width: 2,
        });
        this.drawText(String(sideView.leaderName || sideView.name || '将').slice(0, 1), x, y, {
          size: 22,
          bold: true,
          color: '#f6e8c8',
          align: 'center',
          baseline: 'middle',
        });
      }
      this.drawText(this.truncateText(sideView.leaderName || sideView.name || '', 96, { size: 12, bold: true }), x, y + radius + 10, {
        size: 12,
        bold: true,
        color: '#f6e8c8',
        align: 'center',
      });
    }

    renderBattleSceneOverlay(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildBattleSceneViewState !== 'function') return;
      const frame = Math.floor((this.getNow() || 0) / 140);
      const turnDuration = Math.max(1, Number(options.battleScene?.turnDurationMs) || 720);
      const turnStartedAt = Number(options.battleScene?.turnStartedAt) || this.getNow();
      const turnElapsed = ((this.getNow() - turnStartedAt) % turnDuration + turnDuration) % turnDuration;
      const turnProgress = turnElapsed / turnDuration;
      const reportTurns = options.battleScene?.report?.turns || [];
      const requestedTurnIndex = Math.max(0, Math.min(reportTurns.length, Number(options.battleScene?.turnIndex) || 0));
      const rawActiveTurn = requestedTurnIndex < reportTurns.length ? reportTurns[requestedTurnIndex] : null;
      const playback = this.getBattlePlaybackPhase(turnProgress, rawActiveTurn);
      const view = this.presenter.buildBattleSceneViewState(options.battleScene || {}, {
        turnIndex: requestedTurnIndex,
        phase: playback.phase,
      });
      if (!view.visible) return;
      this.setHitTargets([]);
      this.drawBattleMapBackground(view.map);
      const activeTurn = view.activeTurn;
      const turnPhase = playback.phase;
      const phaseProgress = playback.phaseProgress;
      const engagementProgress = this.getBattleEngagementProgress(requestedTurnIndex, turnPhase, phaseProgress, activeTurn);
      const attackerPose = this.getBattleUnitPose('attacker', activeTurn, turnPhase);
      const defenderPose = this.getBattleUnitPose('defender', activeTurn, turnPhase);
      const topY = 20;
      this.drawPanel(16, topY, this.width - 32, 68, {
        fill: 'rgba(20, 16, 12, 0.72)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 10,
      });
      this.drawText(this.truncateText(view.title, this.width - 80, { size: 18, bold: true }), this.width / 2, topY + 12, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });
      const currentTurnText = view.ended
        ? `第 ${Math.max(1, view.turnCount)}/${Math.max(1, view.turnCount)} 手`
        : `第 ${Math.min(view.turnIndex + 1, Math.max(1, view.turnCount))}/${Math.max(1, view.turnCount)} 手`;
      this.drawText(`${currentTurnText} · ${view.resultText}`, this.width / 2, topY + 40, {
        size: 12,
        color: '#d6b16e',
        align: 'center',
      });

      const fieldTop = 116;
      const logH = 122;
      const logY = this.height - logH - 70;
      const armyTop = fieldTop + 138;
      const armyHeight = Math.max(120, logY - armyTop - 28);
      const laneWidth = Math.min(170, this.width * 0.42);
      const attackerArea = {
        x: 18,
        y: armyTop,
        width: laneWidth,
        height: armyHeight,
      };
      const defenderArea = {
        x: this.width - laneWidth - 18,
        y: armyTop,
        width: laneWidth,
        height: armyHeight,
      };
      this.drawBattleLeader(view.attacker, 72, fieldTop + 64, 'attacker');
      this.drawBattleLeader(view.defender, this.width - 72, fieldTop + 64, 'defender');
      this.drawBattleSideState(view.attacker, attackerArea, 'attacker');
      this.drawBattleSideState(view.defender, defenderArea, 'defender');
      this.drawBattleArmy(view.attacker, attackerArea, { pose: attackerPose, frame, progress: phaseProgress, engagementProgress, actionType: activeTurn?.action });
      this.drawBattleArmy(view.defender, defenderArea, { pose: defenderPose, frame, progress: phaseProgress, engagementProgress, actionType: activeTurn?.action });
      this.drawBattleActionEffect(turnPhase === 'impact' ? activeTurn : null, phaseProgress);
      this.drawBattleSkillCutIn(turnPhase === 'cutin' ? activeTurn : null, phaseProgress);
      this.drawBattleDamageFloat(
        activeTurn,
        turnPhase,
        phaseProgress,
        activeTurn?.target === 'attacker' ? attackerArea : defenderArea,
      );
      this.drawBattleStatusFloatingTexts(activeTurn, turnPhase, phaseProgress, {
        attacker: attackerArea,
        defender: defenderArea,
      });

      this.drawPanel(16, logY, this.width - 32, logH, {
        fill: 'rgba(20, 16, 12, 0.76)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
      });
      const lines = view.logLines.length ? view.logLines : ['双方列阵，战斗即将开始。'];
      lines.slice(-4).forEach((line, index) => {
        this.drawText(this.truncateText(line, this.width - 56, { size: 12 }), 28, logY + 14 + index * 24, {
          size: 12,
          color: index === lines.slice(-4).length - 1 ? '#f6e8c8' : '#aeb0b8',
        });
      });

      const buttonY = this.height - 54;
      this.drawButton(18, buttonY, 88, 36, '返回', { size: 12, radius: 8 });
      this.addHitTarget({ x: 18, y: buttonY, width: 88, height: 36 }, { type: 'closeBattleScene' });
      const primaryLabel = view.ended ? '完成' : '跳过';
      this.drawButton(this.width - 106, buttonY, 88, 36, primaryLabel, { size: 12, radius: 8, active: true });
      this.addHitTarget({ x: this.width - 106, y: buttonY, width: 88, height: 36 }, { type: view.ended ? 'closeBattleScene' : 'skipBattleScene' });
    }

  }

  if (typeof module !== 'undefined' && module.exports) module.exports = BattleCanvasRenderer;
  else global.BattleCanvasRenderer = BattleCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
