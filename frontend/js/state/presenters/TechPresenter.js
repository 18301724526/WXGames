(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class TechPresenter {
    static t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static buildTechViewState(state = {}) {
      const techs = state.techs || {};
      const eras = Array.isArray(techs.eras) ? techs.eras : [];
      const points = this.toInteger(techs.points);
      const researchedCount = this.toInteger(techs.researchedCount || Object.keys(techs.researched || {}).length);
      const availableCount = eras.reduce((sum, era) => (
        sum + (Array.isArray(era.techs) ? era.techs.filter((tech) => tech.available).length : 0)
      ), 0);
      const statusLabels = {
        available: this.t('tech.status.available', {}, '可研究'),
        researched: this.t('tech.status.researched', {}, '已研究'),
        locked: this.t('tech.status.locked', {}, '时代未解锁'),
        missingPrerequisite: this.t('tech.status.missingPrerequisite', {}, '需先研究前置科技'),
        eraChoiceFull: this.t('tech.status.eraChoiceFull', {}, '本时代已确定'),
        noPoints: this.t('tech.status.noPoints', {}, '科技点不足'),
      };
      const resourceDirectionLabels = {
        food: this.t('tech.resourceDirection.food', {}, '粮食生产'),
        wood: this.t('tech.resourceDirection.wood', {}, '木材采集'),
        stone: this.t('tech.resourceDirection.stone', {}, '石料工程'),
        iron: this.t('tech.resourceDirection.iron', {}, '铁矿利用'),
        metal: this.t('tech.resourceDirection.iron', {}, '铁矿利用'),
        knowledge: this.t('tech.resourceDirection.knowledge', {}, '知识积累'),
      };
      const resourceDirectionByText = {
        粮食: this.t('tech.resourceDirection.food', {}, '粮食生产'),
        木材: this.t('tech.resourceDirection.wood', {}, '木材采集'),
        石料: this.t('tech.resourceDirection.stone', {}, '石料工程'),
        铁矿: this.t('tech.resourceDirection.iron', {}, '铁矿利用'),
        知识: this.t('tech.resourceDirection.knowledge', {}, '知识积累'),
      };
      const buildingEffectById = {
        farm: this.t('tech.buildingEffect.farm', {}, '农田提供稳定粮食生产。'),
        house: this.t('tech.buildingEffect.house', {}, '民居提升文明人口承载能力。'),
        lumbermill: this.t('tech.buildingEffect.lumbermill', {}, '伐木场提供稳定木材生产。'),
        barracks: this.t('tech.buildingEffect.barracks', {}, '兵营训练士兵，开启基础军事力量。'),
        watchtower: this.t('tech.buildingEffect.watchtower', {}, '瞭望台提升边境防御能力。'),
        quarry: this.t('tech.buildingEffect.quarry', {}, '采石场提供稳定石料生产。'),
        mine: this.t('tech.buildingEffect.mine', {}, '矿场提供稳定铁矿生产。'),
        workshop: this.t('tech.buildingEffect.workshop', {}, '工坊强化工业生产与后续制造。'),
        academy: this.t('tech.buildingEffect.academy', {}, '学院强化知识积累。'),
        temple: this.t('tech.buildingEffect.temple', {}, '神庙服务后续文化与精神建设。'),
      };
      const buildingEffectByName = {
        农田: buildingEffectById.farm,
        民居: buildingEffectById.house,
        伐木场: buildingEffectById.lumbermill,
        兵营: buildingEffectById.barracks,
        瞭望台: buildingEffectById.watchtower,
        采石场: buildingEffectById.quarry,
        矿场: buildingEffectById.mine,
        工坊: buildingEffectById.workshop,
        学院: buildingEffectById.academy,
        神庙: buildingEffectById.temple,
      };
      const splitDisplayList = (value) => {
        if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
        return String(value || '')
          .split(/[、/,，\s]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      };
      const uniqueList = (items = []) => Array.from(new Set(items.filter(Boolean)));
      const makeTechEffectRows = (tech = {}) => {
        const buildingNames = uniqueList(splitDisplayList(tech.unlockText));
        const listSeparator = this.t('common.listSeparator', {}, '、');
        const clauseSeparator = this.t('common.clauseSeparator', {}, '；');
        const buildingEffects = uniqueList([
          ...(Array.isArray(tech.unlockedBuildings) ? tech.unlockedBuildings.map((id) => buildingEffectById[id]) : []),
          ...buildingNames.map((name) => buildingEffectByName[name]),
        ]);
        const resourceDirections = uniqueList(
          Array.isArray(tech.resourceEntrances) && tech.resourceEntrances.length
            ? tech.resourceEntrances.map((key) => resourceDirectionLabels[key] || key)
            : splitDisplayList(tech.resourceText).map((label) => resourceDirectionByText[label] || label),
        );
        const rows = [];
        if (buildingNames.length) rows.push({ label: this.t('tech.row.unlockBuilding', {}, '解锁建筑'), text: buildingNames.join(listSeparator) });
        if (buildingEffects.length) rows.push({ label: this.t('tech.row.afterResearch', {}, '研究后'), text: buildingEffects.join(clauseSeparator) });
        if (resourceDirections.length) rows.push({ label: this.t('tech.row.direction', {}, '发展方向'), text: resourceDirections.join(listSeparator) });
        if (!rows.length) rows.push({ label: this.t('tech.row.direction', {}, '发展方向'), text: tech.routeLabel || this.t('tech.route.civilization', {}, '文明路线') });
        return rows;
      };
      const visibleEras = eras.map((era) => ({
        era: era.era,
        name: era.name || this.t('tech.era', { era: era.era }, `时代 ${era.era}`),
        summary: era.summary || '',
        choiceText: `${this.toInteger(era.choicesUsed)}/${this.toInteger(era.choiceLimit, 1)}`,
        closed: Boolean(era.closed),
        techs: (era.techs || []).map((tech) => {
          let buttonLabel = this.t('tech.action.research', {}, '研究');
          if (tech.status === 'researched') buttonLabel = this.t('tech.status.researched', {}, '已研究');
          else if (tech.status === 'locked') buttonLabel = this.t('tech.action.locked', {}, '未解锁');
          else if (tech.status === 'missingPrerequisite') buttonLabel = this.t('tech.action.needPrerequisite', {}, '需前置');
          else if (tech.status === 'eraChoiceFull') buttonLabel = this.t('tech.action.eraChoiceFull', {}, '本时代已确定');
          else if (tech.status === 'noPoints') buttonLabel = this.t('tech.action.noPoints', {}, '点数不足');
          const effectRows = makeTechEffectRows(tech);
          const parentNames = Array.isArray(tech.parentNames) ? tech.parentNames.filter(Boolean) : [];
          const missingParentNames = Array.isArray(tech.missingParentNames) ? tech.missingParentNames.filter(Boolean) : [];
          return {
            ...tech,
            title: tech.name || '',
            routeLabel: tech.routeLabel || this.t('tech.route.default', {}, '路线'),
            summary: tech.summary || '',
            core: tech.core || '',
            tree: tech.tree || { column: era.era, lane: 0, parents: tech.parents || [] },
            parents: Array.isArray(tech.parents) ? [...tech.parents] : [],
            parentNames,
            missingParentNames,
            effectRows,
            unlockSummary: effectRows.map((row) => `${row.label}${this.t('common.labelSeparator', {}, '：')}${row.text}`).join(' / '),
            prerequisiteText: parentNames.length ? parentNames.join(' / ') : this.t('tech.noPrerequisite', {}, '无'),
            missingPrerequisiteText: missingParentNames.length ? missingParentNames.join(' / ') : '',
            statusLabel: statusLabels[tech.status] || buttonLabel,
            buttonLabel,
            disabled: !tech.available,
            researched: Boolean(tech.researched || tech.status === 'researched'),
          };
        }),
      }));
      const nodes = visibleEras.flatMap((era) => (
        (era.techs || []).map((tech, index) => ({
          ...tech,
          era: era.era,
          eraName: era.name,
          eraChoiceText: era.choiceText,
          tree: {
            column: this.toInteger(tech.tree?.column, era.era),
            lane: this.toNumber(tech.tree?.lane ?? (index - Math.floor((era.techs || []).length / 2))),
            row: this.toNumber(tech.tree?.row ?? tech.tree?.column ?? era.era),
            routes: Array.isArray(tech.tree?.routes) ? [...tech.tree.routes] : [],
            parents: Array.isArray(tech.tree?.parents) ? [...tech.tree.parents] : [...(tech.parents || [])],
          },
        }))
      ));
      const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
      const links = nodes.flatMap((node) => (
        (node.tree?.parents || [])
          .filter((parentId) => nodesById[parentId])
          .map((parentId) => {
            const parent = nodesById[parentId] || {};
            return {
              from: parentId,
              to: node.id,
              researched: Boolean(parent.researched && node.researched),
              active: Boolean(parent.researched && node.available),
              locked: node.status === 'locked',
            };
          })
      ));
      const treeEras = visibleEras.map((era) => ({
        era: era.era,
        name: era.name,
        choiceText: era.choiceText,
        closed: era.closed,
        column: era.era,
      }));
      const selectedTechId = state.techUiState?.selectedTechId
        || state.selectedTechId
        || nodes.find((node) => node.available)?.id
        || nodes.find((node) => !node.researched)?.id
        || nodes[0]?.id
        || '';
      const selectedTech = nodesById[selectedTechId] || nodes[0] || null;
      const routeLabelsById = {};
      visibleEras.forEach((era) => {
        (era.techs || []).forEach((tech) => {
          if (tech.route) routeLabelsById[tech.route] = tech.routeLabel || tech.route;
          (Array.isArray(tech.tree?.routes) ? tech.tree.routes : []).forEach((route) => {
            if (!routeLabelsById[route]) routeLabelsById[route] = tech.routeLabel || route;
          });
        });
      });
      const selectedRoutes = selectedTech
        ? (Array.isArray(selectedTech.tree?.routes) && selectedTech.tree.routes.length
          ? selectedTech.tree.routes
          : (selectedTech.route ? [selectedTech.route] : []))
        : [];
      const detail = selectedTech
        ? {
          empty: false,
          id: selectedTech.id,
          title: selectedTech.title || selectedTech.name || this.t('tech.generic', {}, '科技'),
          eraName: selectedTech.eraName || visibleEras.find((era) => era.era === selectedTech.era)?.name || '',
          routeId: selectedTech.route || selectedRoutes[0] || '',
          routes: selectedRoutes,
          routeLabel: selectedRoutes.length > 1
            ? selectedRoutes.map((route) => routeLabelsById[route] || route).join(' / ')
            : (selectedTech.routeLabel || this.t('tech.route.default', {}, '路线')),
          statusLabel: selectedTech.statusLabel || this.t('tech.status.unlockedShort', {}, '未解锁'),
          summary: selectedTech.summary || selectedTech.core || this.t('tech.detail.defaultSummary', {}, '选择科技查看效果。'),
          unlockSummary: selectedTech.unlockSummary || this.t('tech.row.routeDirection', {}, '路线倾向'),
          effectRows: Array.isArray(selectedTech.effectRows) ? selectedTech.effectRows : [],
          prerequisiteText: selectedTech.prerequisiteText || this.t('tech.noPrerequisite', {}, '无'),
          missingPrerequisiteText: selectedTech.missingPrerequisiteText || '',
          pointsText: this.t('tech.points', { points }, `科技点 ${points}`),
          buttonLabel: selectedTech.researched
            ? this.t('tech.status.researched', {}, '已研究')
            : this.t('tech.action.research', {}, '研究'),
          canResearch: Boolean(selectedTech.available),
          disabledReason: selectedTech.available ? '' : (selectedTech.statusLabel || selectedTech.buttonLabel || this.t('tech.status.unlockedShort', {}, '未解锁')),
        }
        : {
          empty: true,
          title: this.t('tech.detail.emptyTitle', {}, '选择一个科技'),
          summary: this.t('tech.detail.emptySummary', {}, '点击科技节点查看效果。'),
          statusLabel: this.t('tech.status.unselected', {}, '未选择'),
          buttonLabel: this.t('tech.action.research', {}, '研究'),
          canResearch: false,
        };

      return {
        points,
        researchedCount,
        availableCount,
        eras: visibleEras,
        selectedTechId,
        detail,
        tree: {
          eras: treeEras,
          nodes,
          links,
          laneMin: nodes.reduce((min, node) => Math.min(min, Number(node.tree?.lane) || 0), 0),
          laneMax: nodes.reduce((max, node) => Math.max(max, Number(node.tree?.lane) || 0), 0),
        },
        text: {
          knowledgeRate: `${this.toNumber(state.resources?.knowledgePerSecond)}/s`,
          title: this.t('tech.title', {}, '科技树'),
          points: this.t('tech.points', { points }, `科技点 ${points}`),
          researched: this.t('tech.researchedCount', { count: researchedCount }, `已研究 ${researchedCount}`),
          available: availableCount > 0
            ? this.t('tech.availableCount', { count: availableCount }, `可研究 ${availableCount}`)
            : this.t('tech.availableEmpty', {}, '暂无可研究'),
          placeholder: this.t('tech.placeholder', {}, '进入新时代后获得科技点'),
          subtitle: this.t('tech.subtitle', {}, '前期科技用于选择文明路线，古典时代开始解锁关键建筑。'),
        },
      };
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = TechPresenter;
  else global.TechPresenter = TechPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
