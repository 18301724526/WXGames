(function (global) {
  'use strict';

  // state/UiRuntimeStateStore.js -- the single source of truth for UI runtime fields.
  //
  // This store is part of the frontend/js/state store family. It owns UI runtime
  // navigation and editor state only; ECS simulation facts remain in the real
  // bitecs ECS layer. Existing host.activeTab / host.militaryView /
  // host.armyFormationEditor call sites are compatibility accessors backed by this
  // store, not independent facts.

  const OWNED_UI_RUNTIME_FIELDS = Object.freeze([
    'activeTab',
    'militaryView',
    'armyFormationEditor',
  ]);

  const ALLOWED_MILITARY_VIEWS = Object.freeze(['army', 'scout', 'world', 'veteranCamp']);
  const STORE_ACCESSOR_MARK = '__uiRuntimeStateStoreAccessors';
  const stateByOwner = new WeakMap();

  const CLOSED_ARMY_FORMATION_EDITOR = Object.freeze({
    open: false,
    cityId: '',
    slot: 1,
    memberIds: Object.freeze([]),
    soldierAssignments: Object.freeze({}),
    soldierDraftAssignments: Object.freeze({}),
    page: 0,
    saving: false,
  });

  function isObject(value) {
    return Boolean(value && typeof value === 'object');
  }

  function getStateHost(host) {
    return host && host.lastGame && host.lastGame !== host && typeof host.lastGame === 'object'
      ? host.lastGame
      : host;
  }

  function readOwnDataField(target, field) {
    if (!isObject(target)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(target, field);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : undefined;
  }

  function normalizeActiveTab(value) {
    return String(value || 'resources');
  }

  function normalizeMilitaryView(value) {
    return ALLOWED_MILITARY_VIEWS.includes(value) ? value : 'army';
  }

  function createClosedFormationEditor() {
    return {
      open: false,
      cityId: '',
      slot: 1,
      memberIds: [],
      soldierAssignments: {},
      soldierDraftAssignments: {},
      page: 0,
      saving: false,
    };
  }

  function normalizeFormationEditor(value = null) {
    const source = isObject(value) ? value : {};
    return {
      ...createClosedFormationEditor(),
      ...source,
      open: Boolean(source.open),
      cityId: String(source.cityId || ''),
      slot: Math.max(1, Number(source.slot) || 1),
      memberIds: Array.isArray(source.memberIds) ? [...source.memberIds] : [],
      soldierAssignments: isObject(source.soldierAssignments) ? { ...source.soldierAssignments } : {},
      soldierDraftAssignments: isObject(source.soldierDraftAssignments)
        ? { ...source.soldierDraftAssignments }
        : {},
      page: Math.max(0, Number(source.page) || 0),
      saving: Boolean(source.saving),
    };
  }

  function syncOwnerState(owner, runtimeState, options = {}) {
    if (!isObject(owner) || !isObject(owner.state) || !runtimeState) return;
    if (options.force || Object.prototype.hasOwnProperty.call(owner.state, 'currentTab')) {
      owner.state.currentTab = runtimeState.activeTab;
    }
    if (options.force || Object.prototype.hasOwnProperty.call(owner.state, 'militaryView')) {
      owner.state.militaryView = runtimeState.militaryView;
    }
  }

  function createInitialState(host = null, overrides = {}) {
    const owner = getStateHost(host);
    const sourceOwner = isObject(owner) ? owner : {};
    const sourceHost = isObject(host) ? host : {};
    return {
      activeTab: normalizeActiveTab(
        overrides.activeTab
          || sourceOwner.state?.currentTab
          || readOwnDataField(sourceOwner, 'activeTab')
          || sourceHost.state?.currentTab
          || readOwnDataField(sourceHost, 'activeTab')
          || 'resources',
      ),
      militaryView: normalizeMilitaryView(
        overrides.militaryView
          || sourceOwner.state?.militaryView
          || readOwnDataField(sourceOwner, 'militaryView')
          || sourceHost.state?.militaryView
          || readOwnDataField(sourceHost, 'militaryView')
          || 'army',
      ),
      armyFormationEditor: normalizeFormationEditor(
        overrides.armyFormationEditor
          || readOwnDataField(sourceOwner, 'armyFormationEditor')
          || readOwnDataField(sourceHost, 'armyFormationEditor')
          || null,
      ),
    };
  }

  function getOwnerState(owner, seedHost = owner, overrides = {}) {
    if (!isObject(owner)) return createInitialState(seedHost, overrides);
    if (!stateByOwner.has(owner)) {
      stateByOwner.set(owner, createInitialState(seedHost, overrides));
    }
    const runtimeState = stateByOwner.get(owner);
    syncOwnerState(owner, runtimeState);
    return runtimeState;
  }

  function defineRuntimeAccessor(target, field) {
    if (!isObject(target)) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, field);
    if (descriptor && descriptor.configurable === false) return;
    Object.defineProperty(target, field, {
      configurable: true,
      enumerable: true,
      get() {
        return getField(this, field);
      },
      set(value) {
        setField(this, field, value);
      },
    });
  }

  function installAccessors(target) {
    if (!isObject(target)) return;
    if (!target[STORE_ACCESSOR_MARK]) {
      Object.defineProperty(target, STORE_ACCESSOR_MARK, {
        configurable: true,
        enumerable: false,
        value: true,
      });
      OWNED_UI_RUNTIME_FIELDS.forEach((field) => defineRuntimeAccessor(target, field));
    }
  }

  function ensure(host = null, overrides = {}) {
    const owner = getStateHost(host);
    const runtimeState = getOwnerState(owner, host, overrides);
    installAccessors(owner);
    if (host && host !== owner) installAccessors(host);
    if (isObject(owner?.canvasShell)) installAccessors(owner.canvasShell);
    syncOwnerState(owner, runtimeState);
    return runtimeState;
  }

  function getField(host = null, field = '') {
    const runtimeState = ensure(host);
    return runtimeState[field];
  }

  function setField(host = null, field = '', value = null) {
    if (!OWNED_UI_RUNTIME_FIELDS.includes(field)) return undefined;
    const owner = getStateHost(host);
    const runtimeState = ensure(host);
    if (field === 'activeTab') runtimeState.activeTab = normalizeActiveTab(value);
    else if (field === 'militaryView') runtimeState.militaryView = normalizeMilitaryView(value);
    else if (field === 'armyFormationEditor') {
      runtimeState.armyFormationEditor = normalizeFormationEditor(value);
    }
    syncOwnerState(owner, runtimeState, { force: true });
    return runtimeState[field];
  }

  function patch(host = null, patchValues = {}) {
    if (!isObject(patchValues)) return ensure(host);
    Object.keys(patchValues).forEach((field) => {
      if (OWNED_UI_RUNTIME_FIELDS.includes(field)) setField(host, field, patchValues[field]);
    });
    return ensure(host);
  }

  function syncFromState(host = null, nextState = null) {
    if (!isObject(nextState)) return ensure(host);
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(nextState, 'currentTab')) {
      updates.activeTab = nextState.currentTab;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'militaryView')) {
      updates.militaryView = nextState.militaryView;
    }
    return Object.keys(updates).length > 0 ? patch(host, updates) : ensure(host);
  }

  function getNavigation(host = null) {
    const runtimeState = ensure(host);
    return {
      activeTab: runtimeState.activeTab,
      militaryView: runtimeState.militaryView,
    };
  }

  function setNavigation(host = null, navigation = {}) {
    return patch(host, {
      activeTab: navigation.activeTab,
      militaryView: navigation.militaryView,
    });
  }

  function getFormationEditor(host = null) {
    return ensure(host).armyFormationEditor;
  }

  function closeFormationEditor(host = null) {
    return setField(host, 'armyFormationEditor', CLOSED_ARMY_FORMATION_EDITOR);
  }

  function debugView(host = null) {
    const runtimeState = ensure(host);
    return JSON.parse(JSON.stringify(runtimeState));
  }

  const api = Object.freeze({
    OWNED_UI_RUNTIME_FIELDS,
    CLOSED_ARMY_FORMATION_EDITOR,
    createInitialState,
    normalizeFormationEditor,
    getStateHost,
    ensure,
    getField,
    setField,
    patch,
    syncFromState,
    getNavigation,
    setNavigation,
    getFormationEditor,
    closeFormationEditor,
    debugView,
  });

  global.UiRuntimeStateStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
