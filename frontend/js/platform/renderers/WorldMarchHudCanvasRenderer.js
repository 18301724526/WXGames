(function (global) {
  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMarchHudCanvasRenderer {
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
      });
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

    getTargetIntel(target = {}) {
      const hasTerrainLabel = Boolean(target.terrainLabel || target.terrain);
      const known = target.known === true
        || (target.known !== false && hasTerrainLabel && target.terrainLabel !== '未知');
      const terrainLabel = known
        ? (target.terrainLabel || target.terrain || '地形')
        : '未知';
      return {
        known,
        title: known ? terrainLabel : '未知区域',
        subtitle: known ? '已侦明地形' : '派遣队伍揭开迷雾',
      };
    }

    renderTargetHud(target = {}, viewport = {}, geometry = {}, frame = {}) {
      const point = this.getTileScreenCenter(target, viewport, geometry);
      const intel = this.getTargetIntel(target);
      const infoRect = this.clampHudRect({
        x: point.x - 74,
        y: point.y - 86,
        width: 148,
        height: 48,
      }, frame);
      let buttonRect = this.clampHudRect({
        x: infoRect.x + infoRect.width + 8,
        y: infoRect.y + 8,
        width: 68,
        height: 32,
      }, frame);
      const overlapsInfo = buttonRect.x < infoRect.x + infoRect.width + 4
        && buttonRect.y < infoRect.y + infoRect.height + 4;
      if (overlapsInfo) {
        buttonRect = this.clampHudRect({
          x: infoRect.x + infoRect.width - 68,
          y: infoRect.y + infoRect.height + 8,
          width: 68,
          height: 32,
        }, frame);
      }
      this.drawSmallHudPanel(infoRect.x, infoRect.y, infoRect.width, infoRect.height, intel.title);
      this.drawText(intel.subtitle, infoRect.x + 12, infoRect.y + 31, {
        size: 10,
        color: intel.known ? '#74d3a0' : '#aeb0b8',
      });
      this.drawButton(buttonRect.x, buttonRect.y, buttonRect.width, buttonRect.height, '行军', {
        size: 13,
        radius: 8,
        active: true,
      });
      this.addHitTarget({ x: buttonRect.x, y: buttonRect.y, width: buttonRect.width, height: buttonRect.height }, {
        type: 'openWorldMarchFormationPicker',
        targetQ: target.q,
        targetR: target.r,
        tileId: target.tileId,
        known: target.known,
        terrain: target.terrain,
        terrainLabel: target.terrainLabel,
      });
      return true;
    }

    renderFormationPicker(state = {}, target = {}, frame = {}) {
      const view = this.presenter?.buildMilitaryViewState?.(state) || {};
      const formations = Array.isArray(view.formations) ? view.formations.slice(0, 3) : [];
      const width = Math.min(340, Math.max(260, (Number(frame.width) || this.width || 390) - 28));
      const height = 148;
      const x = (Number(frame.x) || 0) + ((Number(frame.width) || this.width || 390) - width) / 2;
      const frameY = Number(frame.y) || 0;
      const frameH = Number(frame.height) || this.height || 844;
      const minY = frameY + 8;
      const maxY = frameY + Math.max(8, frameH - height - 8);
      const preferredY = frameY + Math.max(74, Math.floor(frameH * 0.34));
      const y = Math.max(minY, Math.min(maxY, preferredY));
      const intel = this.getTargetIntel(target);
      this.drawSmallHudPanel(x, y, width, height, '选择出征队伍');
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
        const formation = formations[index] || { slot: index + 1, cityId: state.activeCityId || 'capital', members: [] };
        const cardX = x + 12 + index * (cardW + gap);
        const empty = !Array.isArray(formation.members) || formation.members.length === 0;
        this.drawPanel(cardX, cardY, cardW, cardH, {
          fill: empty ? 'rgba(41, 39, 32, 0.78)' : 'rgba(35, 49, 34, 0.84)',
          stroke: empty ? 'rgba(255, 226, 177, 0.14)' : 'rgba(116, 211, 160, 0.44)',
          radius: 7,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(this.truncateText(formation.name || `队伍${index + 1}`, cardW - 10, { size: 11, bold: true }), cardX + cardW / 2, cardY + 16, {
          size: 11,
          bold: true,
          color: empty ? '#aeb0b8' : '#ffe6b5',
          align: 'center',
        });
        this.drawText(`${formation.memberCount ?? formation.members?.length ?? 0}/${formation.maxMembers || 5}`, cardX + cardW / 2, cardY + 42, {
          size: 18,
          bold: true,
          color: empty ? '#8e918a' : '#74d3a0',
          align: 'center',
        });
        this.drawText(empty ? '未编队' : '出征', cardX + cardW / 2, cardY + 65, {
          size: 10,
          color: empty ? '#8e918a' : '#f0b45b',
          align: 'center',
        });
        this.addHitTarget({ x: cardX, y: cardY, width: cardW, height: cardH }, {
          type: 'startWorldMarch',
          mode: 'manual',
          targetQ: target.q,
          targetR: target.r,
          tileId: target.tileId,
          formationSlot: formation.slot || index + 1,
          cityId: formation.cityId || state.activeCityId || 'capital',
          disabled: empty,
        });
      });
      const closeSize = 26;
      this.drawButton(x + width - closeSize - 8, y + height - closeSize - 8, closeSize, closeSize, 'x', { size: 12, radius: 7 });
      this.addHitTarget({ x: x + width - closeSize - 8, y: y + height - closeSize - 8, width: closeSize, height: closeSize }, { type: 'closeWorldMarchHud' });
      return true;
    }

    renderActorHud(actor = {}, viewport = {}, geometry = {}, frame = {}) {
      const point = this.getTileScreenCenter(actor.current || actor.origin || {}, viewport, geometry);
      const rect = this.clampHudRect({
        x: point.x - 78,
        y: point.y - 102,
        width: 156,
        height: 64,
      }, frame);
      this.drawSmallHudPanel(rect.x, rect.y, rect.width, rect.height, actor.formation?.label || '侦察队');
      const buttonW = 58;
      const buttonH = 24;
      const gap = 10;
      const y = rect.y + 28;
      const returnX = rect.x + 14;
      const stopX = returnX + buttonW + gap;
      this.drawButton(returnX, y, buttonW, buttonH, '回城', { size: 11, radius: 7 });
      this.drawButton(stopX, y, buttonW, buttonH, '停止', { size: 11, radius: 7 });
      this.addHitTarget({ x: returnX, y, width: buttonW, height: buttonH }, {
        type: 'returnWorldMarch',
        missionId: actor.missionId,
      });
      this.addHitTarget({ x: stopX, y, width: buttonW, height: buttonH }, {
        type: 'stopWorldMarch',
        missionId: actor.missionId,
        targetQ: actor.stopTile?.q,
        targetR: actor.stopTile?.r,
      });
      return true;
    }

    renderWorldMarchHud(state = {}, uiState = {}, actors = [], viewport = {}, geometry = {}, frame = {}) {
      const target = WorldMarchSystem?.getMarchTargetUiState?.(uiState);
      if (target?.pickerOpen) return this.renderFormationPicker(state, target, frame);
      const selectedActorId = uiState.selectedWorldActorId || '';
      const selectedActor = selectedActorId ? actors.find((actor) => actor.id === selectedActorId || actor.missionId === selectedActorId) : null;
      if (selectedActor) return this.renderActorHud(selectedActor, viewport, geometry, frame);
      if (target) return this.renderTargetHud(target, viewport, geometry, frame);
      return false;
    }
  }

  global.WorldMarchHudCanvasRenderer = WorldMarchHudCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMarchHudCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
