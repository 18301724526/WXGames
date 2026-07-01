(function (global) {
  // Soldier / army sprite drawing (classic battle scene) extracted from BattleCanvasRenderer.
  // Renders the individual soldier/army sprites, the per-side skill/status panel and
  // status badges. Pure drawing — all math/layout lives in BattleLayoutModel and the
  // shared drawing-surface delegators stay on BattleCanvasRenderer.
  function install(BattleCanvasRenderer) {
    if (!BattleCanvasRenderer?.prototype) return false;
    Object.assign(BattleCanvasRenderer.prototype, {
      drawBattleMapBackground(map = {}) {
        const path = map.background || 'assets/art/battle/battlefield-forest-camp.png';
        if (this.drawCoverAsset(path, 0, 0, this.width, this.height)) return;
        if (!this.ctx) return;
        this.ctx.fillStyle = '#1d2119';
        this.ctx.fillRect(0, 0, this.width, this.height);
      },

      drawBattleSoldierFrame(
        x,
        y,
        side = 'attacker',
        pose = 'idle',
        frame = 0,
        ratio = 1,
        scale = 0.22,
        spritePath = '',
        progress = 0,
      ) {
        const spec = this.getBattleUnitSpec(side, spritePath);
        const image = this.getAsset(
          this.getBattleFrameSpritePath(side, pose, frame, spritePath, progress),
        );
        if (!image || typeof this.ctx?.drawImage !== 'function') return false;
        const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        this.ctx.globalAlpha = previousAlpha * Math.max(0.25, Math.min(1, Number(ratio) || 1));
        const sourceWidth = Number(image.naturalWidth || image.width || spec.width);
        const sourceHeight = Number(image.naturalHeight || image.height || spec.height);
        const dw = sourceWidth * scale;
        const dh = sourceHeight * scale;
        const drawX = x - dw / 2;
        const drawY = y - dh;
        this.ctx.drawImage(image, drawX, drawY, dw, dh);
        this.drawBattleHitFlash(image, { drawX, drawY, dw, dh, pose, progress, previousAlpha });
        this.ctx.globalAlpha = previousAlpha;
        return true;
      },

      drawBattleHitFlash(image, options = {}) {
        if (options.pose !== 'hit' || typeof this.ctx?.filter !== 'string') return;
        const flashAlpha =
          Math.sin(Math.max(0, Math.min(1, Number(options.progress) || 0)) * Math.PI) * 0.36;
        if (flashAlpha <= 0.01) return;
        const alpha =
          typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : options.previousAlpha;
        const previousFilter = this.ctx.filter;
        this.ctx.globalAlpha = alpha * flashAlpha;
        this.ctx.filter = 'brightness(2.4) saturate(0)';
        this.ctx.drawImage(image, options.drawX, options.drawY, options.dw, options.dh);
        this.ctx.filter = previousFilter;
      },

      drawBattleSoldierFallback(x, y, side = 'attacker', ratio = 1) {
        if (!this.ctx) return;
        const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        this.ctx.globalAlpha = previousAlpha * Math.max(0.25, Math.min(1, Number(ratio) || 1));
        const color = side === 'attacker' ? '#74d3a0' : '#e07b62';
        this.drawCircle(x, y - 18, 5, { fill: color });
        this.drawPanel(x - 6, y - 14, 12, 16, { fill: color, radius: 2 });
        this.ctx.globalAlpha = previousAlpha;
      },

      drawBattleSoldierSprite(
        x,
        y,
        side = 'attacker',
        pose = 'idle',
        frame = 0,
        ratio = 1,
        scale = 0.22,
        spritePath = '',
        progress = 0,
      ) {
        if (
          this.drawBattleSoldierFrame(x, y, side, pose, frame, ratio, scale, spritePath, progress)
        )
          return;
        this.drawBattleSoldierFallback(x, y, side, ratio);
      },

      drawBattleSoldier(
        x,
        y,
        side = 'attacker',
        pose = 'idle',
        frame = 0,
        ratio = 1,
        scale = 0.22,
      ) {
        return this.drawBattleSoldierSprite(x, y, side, pose, frame, ratio, scale);
      },

      drawBattleArmy(sideView = {}, area = {}, options = {}) {
        const groups = sideView.groups || [];
        const pose = options.pose || 'idle';
        const visualGroups =
          groups.length || !(pose === 'die' || pose === 'defeated')
            ? groups
            : [{ ratio: 1, soldiers: 0, capacity: 1 }];
        const side = sideView.side || 'attacker';
        const frame = Number(options.frame) || 0;
        const progress = Math.max(0, Math.min(1, Number(options.progress) || 0));
        const engagementProgress = Math.max(
          0,
          Math.min(1, Number(options.engagementProgress ?? 1) || 0),
        );
        const actionType = options.actionType || '';
        const columns = Math.max(1, Math.floor(area.width / 34));
        const activeCount =
          pose === 'idle' ? 0 : Math.min(visualGroups.length, actionType === 'skill' ? 5 : 3);
        const hitOffset =
          pose === 'hit' ? Math.sin(frame * 2.2) * 5 * (side === 'attacker' ? 1 : -1) : 0;
        visualGroups.slice(0, 18).forEach((group, index) => {
          const active = index < activeCount;
          const position = this.getBattleUnitBattlefieldPosition(
            side,
            area,
            index,
            columns,
            active ? 0.245 : 0.21,
            engagementProgress,
          );
          this.drawBattleSoldierSprite(
            position.x + (active ? hitOffset * Math.max(0, 1 - index * 0.12) : 0),
            position.y,
            side,
            active ? pose : 'idle',
            frame + index,
            group.ratio,
            active ? 0.245 : 0.21,
            this.getBattleSideSpritePath(sideView, side),
            progress,
          );
        });
        this.drawBattleArmyCount(sideView, area, side, groups.length);
      },

      drawBattleArmyCount(sideView = {}, area = {}, side = 'attacker', groupCount = 0) {
        if (groupCount > 18) {
          this.drawText(
            `+${groupCount - 18}`,
            side === 'attacker' ? area.x + area.width - 28 : area.x + 10,
            area.y + area.height - 22,
            {
              size: 12,
              bold: true,
              color: '#f6e8c8',
            },
          );
        }
        this.drawText(
          `${sideView.soldiers || 0}/${sideView.soldiersStart || 0}`,
          area.x + area.width / 2,
          area.y + area.height + 6,
          {
            size: 12,
            bold: true,
            color: side === 'attacker' ? '#74d3a0' : '#e07b62',
            align: 'center',
          },
        );
      },

      drawBattleSideState(sideView = {}, area = {}, side = 'attacker') {
        const panelWidth = Math.min(154, Math.max(128, area.width + 8));
        const x = side === 'attacker' ? area.x : area.x + area.width - panelWidth;
        const y = Math.max(92, area.y - 74);
        this.drawPanel(x, y, panelWidth, 72, {
          fill: 'rgba(18, 14, 10, 0.64)',
          stroke: side === 'attacker' ? 'rgba(116, 211, 160, 0.28)' : 'rgba(224, 123, 98, 0.28)',
          radius: 8,
          inset: 'rgba(255, 231, 184, 0.06)',
        });
        const skillState = sideView.skillState || null;
        const skillName = skillState?.skillName
          ? this.truncateText(skillState.skillName, panelWidth - 82, { size: 11, bold: true })
          : this.t('battle.skill.none', {});
        const stateText = skillState?.stateText || this.t('battle.skill.basicOnly', {});
        this.drawText(skillName, x + 10, y + 11, {
          size: 11,
          bold: true,
          color: skillState?.active ? '#ffe6b5' : '#cbbd96',
        });
        this.drawText(
          this.truncateText(stateText, 68, { size: 10, bold: true }),
          x + panelWidth - 10,
          y + 11,
          {
            size: 10,
            bold: true,
            color:
              skillState?.state === 'ready'
                ? '#74d3a0'
                : skillState?.state === 'casting'
                  ? '#ffd66e'
                  : '#aeb0b8',
            align: 'right',
          },
        );
        this.drawBattleStatusBadges(sideView.statuses, x, y, panelWidth);
      },

      drawBattleStatusBadges(statuses = [], x = 0, y = 0, panelWidth = 140) {
        const list = Array.isArray(statuses) ? statuses : [];
        if (!list.length) {
          this.drawText(this.t('battle.status.noneLine', {}), x + 10, y + 42, {
            size: 11,
            color: '#8d8f99',
          });
          return;
        }
        let cursorX = x + 10;
        let cursorY = y + 40;
        list.slice(0, 4).forEach((status) => {
          const label = this.truncateText(
            status.text || status.label || this.t('battle.status.default', {}),
            68,
            { size: 10, bold: true },
          );
          const width = Math.min(
            74,
            Math.max(38, this.measureTextWidth(label, { size: 10, bold: true }) + 14),
          );
          if (cursorX + width > x + panelWidth - 8) {
            cursorX = x + 10;
            cursorY += 20;
          }
          if (cursorY > y + 55) return;
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
      },
    });
    return true;
  }

  const BattleSpriteRenderer = { install };
  global.BattleSpriteRenderer = BattleSpriteRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = BattleSpriteRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
