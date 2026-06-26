/* eslint-disable */
'use strict';
var EcsModeRuntime = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) =>
    typeof require !== 'undefined'
      ? require
      : typeof Proxy !== 'undefined'
        ? new Proxy(x, {
            get: (a, b) => (typeof require !== 'undefined' ? require : a)[b],
          })
        : x)(function (x) {
    if (typeof require !== 'undefined') return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) =>
    function __require2() {
      return (
        mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod),
        mod.exports
      );
    };

  // frontend/js/ecs/mode/ModeKeys.js
  var require_ModeKeys = __commonJS({
    'frontend/js/ecs/mode/ModeKeys.js'(exports, module) {
      'use strict';
      var BASE_MODE_KEYS = Object.freeze([
        'boot',
        'city',
        'worldMap',
        'techTree',
        'formationEditor',
        'battle',
      ]);
      var MODAL_MODE_KEYS = Object.freeze([
        'modal:naming',
        'modal:event',
        'modal:rewardReveal',
        'modal:confirmDialog',
        'modal:targetPicker',
        // Batch 8F: the single 'modal:blockingPanel' umbrella was split into one owned
        // subtype per blocking panel. The 10 show-star booleans + the techDetail popup
        // + the commandPanel string enum (payload-carrying) each get their own mask bit.
        'modal:settings',
        'modal:logs',
        'modal:resourceDetails',
        'modal:citySwitcher',
        'modal:subcityList',
        'modal:cityManagement',
        'modal:advisor',
        'modal:taskCenter',
        'modal:guidebook',
        'modal:famousPersons',
        'modal:commandPanel',
        'modal:techDetail',
      ]);
      var OVERLAY_MODE_KEYS = Object.freeze(['tutorial', 'debug']);
      var MODE_KEYS = Object.freeze([...BASE_MODE_KEYS, ...MODAL_MODE_KEYS, ...OVERLAY_MODE_KEYS]);
      var MODE_ID_BY_KEY = Object.freeze(
        MODE_KEYS.reduce((record, key, index) => {
          record[key] = index + 1;
          return record;
        }, {}),
      );
      var MODE_KEY_BY_ID = Object.freeze(
        MODE_KEYS.reduce((record, key) => {
          record[MODE_ID_BY_KEY[key]] = key;
          return record;
        }, {}),
      );
      var MODAL_BIT_BY_KEY = Object.freeze(
        MODAL_MODE_KEYS.reduce((record, key, index) => {
          record[key] = 1 << index;
          return record;
        }, {}),
      );
      var CAPTURE_PRIORITY = Object.freeze([
        'modal:confirmDialog',
        'modal:naming',
        'modal:rewardReveal',
        'modal:event',
        'modal:targetPicker',
        // Batch 8F: the blocking panels sit below the dialog modals and above the base
        // modes, exactly where the retired 'modal:blockingPanel' umbrella sat. The 10
        // show-star overlays rank above techDetail, which ranks above commandPanel so the
        // techDetail popup wins capture over the tech command panel it overlays (Axis 3).
        'modal:settings',
        'modal:logs',
        'modal:resourceDetails',
        'modal:citySwitcher',
        'modal:subcityList',
        'modal:cityManagement',
        'modal:advisor',
        'modal:taskCenter',
        'modal:guidebook',
        'modal:famousPersons',
        'modal:techDetail',
        'modal:commandPanel',
        'battle',
        'formationEditor',
        'techTree',
        'worldMap',
        'city',
        'boot',
      ]);
      function normalizeModeKey(value, fallback = 'city') {
        const key = String(value || '');
        return MODE_ID_BY_KEY[key] ? key : fallback;
      }
      function modeIdForKey(key, fallback = 'city') {
        return MODE_ID_BY_KEY[normalizeModeKey(key, fallback)] || MODE_ID_BY_KEY[fallback] || 0;
      }
      function modeKeyForId(id, fallback = 'city') {
        return MODE_KEY_BY_ID[Number(id) || 0] || fallback;
      }
      function isModalModeKey(key) {
        return Object.prototype.hasOwnProperty.call(MODAL_BIT_BY_KEY, key);
      }
      var api = Object.freeze({
        BASE_MODE_KEYS,
        CAPTURE_PRIORITY,
        MODAL_BIT_BY_KEY,
        MODAL_MODE_KEYS,
        MODE_ID_BY_KEY,
        MODE_KEY_BY_ID,
        MODE_KEYS,
        OVERLAY_MODE_KEYS,
        isModalModeKey,
        modeIdForKey,
        modeKeyForId,
        normalizeModeKey,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsModeKeys = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // node_modules/bitecs/dist/core/index.min.cjs
  var require_index_min = __commonJS({
    'node_modules/bitecs/dist/core/index.min.cjs'(exports, module) {
      var ne = Object.defineProperty;
      var It = Object.getOwnPropertyDescriptor;
      var Et = Object.getOwnPropertyNames;
      var Wt = Object.prototype.hasOwnProperty;
      var St = (e, t) => {
        for (var n in t) ne(e, n, { get: t[n], enumerable: true });
      };
      var Mt = (e, t, n, o) => {
        if ((t && typeof t == 'object') || typeof t == 'function')
          for (let r of Et(t))
            !Wt.call(e, r) &&
              r !== n &&
              ne(e, r, { get: () => t[r], enumerable: !(o = It(t, r)) || o.enumerable });
        return e;
      };
      var Dt = (e) => Mt(ne({}, '__esModule', { value: true }), e);
      var Bt = {};
      St(Bt, {
        $internal: () => u,
        All: () => et,
        And: () => be,
        Any: () => Ze,
        Cascade: () => rt,
        Hierarchy: () => xe,
        IsA: () => j,
        None: () => tt,
        Not: () => Re,
        Or: () => he,
        Pair: () => h,
        Prefab: () => A,
        Wildcard: () => y,
        addComponent: () => k,
        addComponents: () => _,
        addEntity: () => Ie,
        addPrefab: () => bt,
        aos: () => gt,
        asBuffer: () => at,
        commitRemovals: () => ve,
        createEntityIndex: () => G,
        createRelation: () => qe,
        createWorld: () => Oe,
        deleteWorld: () => Ae,
        entityExists: () => U,
        getAllEntities: () => He,
        getComponent: () => Ce,
        getEntityComponents: () => V,
        getHierarchyDepth: () => Ye,
        getId: () => oe,
        getMaxHierarchyDepth: () => Je,
        getRelationTargets: () => v,
        getVersion: () => re,
        getWorldComponents: () => ke,
        hasComponent: () => W,
        isNested: () => ge,
        isRelation: () => pe,
        isWildcard: () => Pe,
        makeExclusive: () => se,
        noCommit: () => te,
        observe: () => ut,
        onAdd: () => it,
        onGet: () => ft,
        onRemove: () => ct,
        onSet: () => pt,
        pipe: () => Rt,
        query: () => O,
        registerComponent: () => I,
        registerComponents: () => mt,
        registerQuery: () => z,
        removeComponent: () => R,
        removeComponents: () => ht,
        removeEntity: () => Ee,
        removeQuery: () => dt,
        resetWorld: () => Qe,
        set: () => Te,
        setComponent: () => lt,
        soa: () => xt,
        withAutoRemoveSubject: () => ie,
        withOnTargetRemoved: () => ce,
        withStore: () => ae,
        withVersioning: () => Se,
      });
      module.exports = Dt(Bt);
      var $ = (e, t, n) =>
        Object.defineProperty(e, t, {
          value: n,
          enumerable: false,
          writable: true,
          configurable: true,
        });
      var oe = (e, t) => t & e.entityMask;
      var re = (e, t) => (t >>> e.versionShift) & ((1 << e.versionBits) - 1);
      var Ot = (e, t) => {
        let o = (re(e, t) + 1) & ((1 << e.versionBits) - 1);
        return (t & e.entityMask) | (o << e.versionShift);
      };
      var Se = (e) => ({ versioning: true, versionBits: e });
      var G = (e) => {
        let t = e ? (typeof e == 'function' ? e() : e) : { versioning: false, versionBits: 8 },
          n = t.versionBits ?? 8,
          o = t.versioning ?? false,
          r = 32 - n,
          a = (1 << r) - 1,
          i = r,
          s = ((1 << n) - 1) << i;
        return {
          aliveCount: 0,
          dense: [],
          sparse: [],
          maxId: 0,
          versioning: o,
          versionBits: n,
          entityMask: a,
          versionShift: i,
          versionMask: s,
        };
      };
      var Me = (e) => {
        if (e.aliveCount < e.dense.length) {
          let n = e.dense[e.aliveCount],
            o = n;
          return ((e.sparse[o] = e.aliveCount), e.aliveCount++, n);
        }
        let t = ++e.maxId;
        return (e.dense.push(t), (e.sparse[t] = e.aliveCount), e.aliveCount++, t);
      };
      var De = (e, t) => {
        let n = e.sparse[t];
        if (n === void 0 || n >= e.aliveCount) return;
        let o = e.aliveCount - 1,
          r = e.dense[o];
        if (
          ((e.sparse[r] = n), (e.dense[n] = r), (e.sparse[t] = o), (e.dense[o] = t), e.versioning)
        ) {
          let a = Ot(e, t);
          e.dense[o] = a;
        }
        e.aliveCount--;
      };
      var X = (e, t) => {
        let n = oe(e, t),
          o = e.sparse[n];
        return o !== void 0 && o < e.aliveCount && e.dense[o] === t;
      };
      var u = Symbol.for('bitecs_internal');
      var Qt = (e, t) =>
        $(e || {}, u, {
          entityIndex: t || G(),
          entityMasks: [[]],
          entityComponents: /* @__PURE__ */ new Map(),
          bitflag: 1,
          componentMap: /* @__PURE__ */ new Map(),
          componentCount: 0,
          queries: /* @__PURE__ */ new Set(),
          queriesHashMap: /* @__PURE__ */ new Map(),
          notQueries: /* @__PURE__ */ new Set(),
          dirtyQueries: /* @__PURE__ */ new Set(),
          entitiesWithRelations: /* @__PURE__ */ new Set(),
          hierarchyData: /* @__PURE__ */ new Map(),
          hierarchyActiveRelations: /* @__PURE__ */ new Set(),
          hierarchyQueryCache: /* @__PURE__ */ new Map(),
        });
      function Oe(...e) {
        let t, n;
        return (
          e.forEach((o) => {
            typeof o == 'object' && 'dense' in o && 'sparse' in o && 'aliveCount' in o
              ? (t = o)
              : typeof o == 'object' && (n = o);
          }),
          Qt(n, t)
        );
      }
      var Qe = (e) => {
        let t = e[u];
        return (
          (t.entityIndex = G()),
          (t.entityMasks = [[]]),
          (t.entityComponents = /* @__PURE__ */ new Map()),
          (t.bitflag = 1),
          (t.componentMap = /* @__PURE__ */ new Map()),
          (t.componentCount = 0),
          (t.queries = /* @__PURE__ */ new Set()),
          (t.queriesHashMap = /* @__PURE__ */ new Map()),
          (t.notQueries = /* @__PURE__ */ new Set()),
          (t.dirtyQueries = /* @__PURE__ */ new Set()),
          (t.entitiesWithRelations = /* @__PURE__ */ new Set()),
          (t.hierarchyData = /* @__PURE__ */ new Map()),
          (t.hierarchyActiveRelations = /* @__PURE__ */ new Set()),
          (t.hierarchyQueryCache = /* @__PURE__ */ new Map()),
          e
        );
      };
      var Ae = (e) => {
        delete e[u];
      };
      var ke = (e) => Array.from(e[u].componentMap.keys());
      var He = (e) => Array.from(e[u].entityComponents.keys());
      var D = () => {
        let e = [],
          t = [],
          n = (s) => e[t[s]] === s;
        return {
          add: (s) => {
            n(s) || (t[s] = e.push(s) - 1);
          },
          remove: (s) => {
            if (!n(s)) return;
            let p = t[s],
              c = e.pop();
            c !== s && ((e[p] = c), (t[c] = p));
          },
          has: n,
          sparse: t,
          dense: e,
          reset: () => {
            ((e.length = 0), (t.length = 0));
          },
          sort: (s) => {
            e.sort(s);
            for (let p = 0; p < e.length; p++) t[e[p]] = p;
          },
        };
      };
      var $e = typeof SharedArrayBuffer < 'u' ? SharedArrayBuffer : ArrayBuffer;
      var Y = (e = 1e3) => {
        let t = [],
          n = 0,
          o = new Uint32Array(new $e(e * 4)),
          r = (c) => c < t.length && t[c] < n && o[t[c]] === c;
        return {
          add: (c) => {
            if (!r(c)) {
              if (n >= o.length) {
                let f = new Uint32Array(new $e(o.length * 2 * 4));
                (f.set(o), (o = f));
              }
              ((o[n] = c), (t[c] = n), n++);
            }
          },
          remove: (c) => {
            if (!r(c)) return;
            n--;
            let f = t[c],
              d = o[n];
            ((o[f] = d), (t[d] = f));
          },
          has: r,
          sparse: t,
          get dense() {
            return new Uint32Array(o.buffer, 0, n);
          },
          reset: () => {
            ((n = 0), (t.length = 0));
          },
          sort: (c) => {
            let f = Array.from(o.subarray(0, n));
            f.sort(c);
            for (let d = 0; d < f.length; d++) o[d] = f[d];
            for (let d = 0; d < n; d++) t[o[d]] = d;
          },
        };
      };
      var B = () => {
        let e = /* @__PURE__ */ new Set();
        return {
          subscribe: (o) => (
            e.add(o),
            () => {
              e.delete(o);
            }
          ),
          notify: (o, ...r) =>
            Array.from(e).reduce((a, i) => {
              let s = i(o, ...r);
              return s && typeof s == 'object' ? { ...a, ...s } : a;
            }, {}),
        };
      };
      var q = Symbol.for('bitecs-relation');
      var E = Symbol.for('bitecs-pairTarget');
      var F = Symbol.for('bitecs-isPairComponent');
      var g = Symbol.for('bitecs-relationData');
      var J = () => {
        let e = {
            pairsMap: /* @__PURE__ */ new Map(),
            initStore: void 0,
            exclusiveRelation: false,
            autoRemoveSubject: false,
            onTargetRemoved: void 0,
          },
          t = (n) => {
            if (n === void 0) throw Error('Relation target is undefined');
            let o = n === '*' ? y : n;
            if (!e.pairsMap.has(o)) {
              let r = e.initStore ? e.initStore(n) : {};
              ($(r, q, t), $(r, E, o), $(r, F, true), e.pairsMap.set(o, r));
            }
            return e.pairsMap.get(o);
          };
        return ($(t, g, e), t);
      };
      var ae = (e) => (t) => {
        let n = t[g];
        return ((n.initStore = e), t);
      };
      var se = (e) => {
        let t = e[g];
        return ((t.exclusiveRelation = true), e);
      };
      var ie = (e) => {
        let t = e[g];
        return ((t.autoRemoveSubject = true), e);
      };
      var ce = (e) => (t) => {
        let n = t[g];
        return ((n.onTargetRemoved = e), t);
      };
      var h = (e, t) => {
        if (e === void 0) throw Error('Relation is undefined');
        return e(t);
      };
      var v = (e, t, n) => {
        let o = V(e, t),
          r = [];
        for (let a of o) a[q] === n && a[E] !== y && !pe(a[E]) && r.push(a[E]);
        return r;
      };
      function qe(...e) {
        if (e.length === 1 && typeof e[0] == 'object') {
          let { store: t, exclusive: n, autoRemoveSubject: o, onTargetRemoved: r } = e[0];
          return [t && ae(t), n && se, o && ie, r && ce(r)]
            .filter(Boolean)
            .reduce((i, s) => s(i), J());
        } else return e.reduce((n, o) => o(n), J());
      }
      var je = Symbol.for('bitecs-wildcard');
      function At() {
        let e = J();
        return (
          Object.defineProperty(e, je, {
            value: true,
            enumerable: false,
            writable: false,
            configurable: false,
          }),
          e
        );
      }
      function kt() {
        let e = Symbol.for('bitecs-global-wildcard');
        return (globalThis[e] || (globalThis[e] = At()), globalThis[e]);
      }
      var y = kt();
      function Ht() {
        return J();
      }
      function $t() {
        let e = Symbol.for('bitecs-global-isa');
        return (globalThis[e] || (globalThis[e] = Ht()), globalThis[e]);
      }
      var j = $t();
      function Pe(e) {
        return e ? Object.getOwnPropertySymbols(e).includes(je) : false;
      }
      function pe(e) {
        return e ? Object.getOwnPropertySymbols(e).includes(g) : false;
      }
      var qt = 64;
      var C = 4294967295;
      var Ue = 1024;
      function Be(e, t) {
        let { depths: n } = e;
        if (t < n.length) return n;
        let o = Math.max(t + 1, n.length * 2, n.length + Ue),
          r = new Uint32Array(o);
        return (r.fill(C), r.set(n), (e.depths = r), r);
      }
      function Fe(e, t, n, o) {
        let { depthToEntities: r } = e;
        if (o !== void 0 && o !== C) {
          let a = r.get(o);
          a && (a.remove(t), a.dense.length === 0 && r.delete(o));
        }
        n !== C && (r.has(n) || r.set(n, Y()), r.get(n).add(t));
      }
      function jt(e, t) {
        t > e.maxDepth && (e.maxDepth = t);
      }
      function ue(e, t, n, o) {
        ((e.depths[t] = n), Fe(e, t, n, o), jt(e, n));
      }
      function Ve(e, t) {
        e[u].hierarchyQueryCache.delete(t);
      }
      function ee(e, t) {
        let n = e[u];
        return (
          n.hierarchyActiveRelations.has(t) ||
            (n.hierarchyActiveRelations.add(t), de(e, t), Pt(e, t)),
          n.hierarchyData.get(t)
        );
      }
      function Pt(e, t) {
        let n = O(e, [h(t, y)]);
        for (let r of n) fe(e, t, r);
        let o = /* @__PURE__ */ new Set();
        for (let r of n) for (let a of v(e, r, t)) o.has(a) || (o.add(a), fe(e, t, a));
      }
      function de(e, t) {
        let n = e[u];
        if (!n.hierarchyData.has(t)) {
          let o = Math.max(Ue, n.entityIndex.dense.length * 2),
            r = new Uint32Array(o);
          (r.fill(C),
            n.hierarchyData.set(t, {
              depths: r,
              dirty: D(),
              depthToEntities: /* @__PURE__ */ new Map(),
              maxDepth: 0,
            }));
        }
      }
      function we(e, t, n, o = /* @__PURE__ */ new Set()) {
        if (o.has(n)) return 0;
        o.add(n);
        let r = v(e, n, t);
        if (r.length === 0) return 0;
        if (r.length === 1) return Z(e, t, r[0], o) + 1;
        let a = 1 / 0;
        for (let i of r) {
          let s = Z(e, t, i, o);
          if (s < a && ((a = s), a === 0)) break;
        }
        return a === 1 / 0 ? 0 : a + 1;
      }
      function Z(e, t, n, o) {
        let r = e[u];
        de(e, t);
        let a = r.hierarchyData.get(t),
          { depths: i } = a;
        if (((i = Be(a, n)), i[n] === C)) {
          let s = we(e, t, n, o);
          return (ue(a, n, s), s);
        }
        return i[n];
      }
      function fe(e, t, n) {
        return Z(e, t, n, /* @__PURE__ */ new Set());
      }
      function Ne(e, t, n, o, r = D()) {
        if (r.has(n)) return;
        r.add(n);
        let a = O(e, [t(n)]);
        for (let i of a) (o.add(i), Ne(e, t, i, o, r));
      }
      function Le(e, t, n, o, r = /* @__PURE__ */ new Set()) {
        let a = e[u];
        if (!a.hierarchyActiveRelations.has(t)) return;
        de(e, t);
        let i = a.hierarchyData.get(t);
        if (r.has(n)) {
          i.dirty.add(n);
          return;
        }
        r.add(n);
        let { depths: s, dirty: p } = i,
          c = o !== void 0 ? fe(e, t, o) + 1 : 0;
        if (c > qt) return;
        let f = s[n];
        (ue(i, n, c, f === C ? void 0 : f), f !== c && (Ne(e, t, n, p, D()), Ve(e, t)));
      }
      function _e(e, t, n) {
        let o = e[u];
        if (!o.hierarchyActiveRelations.has(t)) return;
        let r = o.hierarchyData.get(t),
          { depths: a } = r;
        ((a = Be(r, n)), Ge(e, t, n, a, D()), Ve(e, t));
      }
      function Ge(e, t, n, o, r) {
        if (r.has(n)) return;
        r.add(n);
        let i = e[u].hierarchyData.get(t);
        if (n < o.length) {
          let p = o[n];
          p !== C && ((i.depths[n] = C), Fe(i, n, C, p));
        }
        let s = O(e, [t(n)]);
        for (let p of s) Ge(e, t, p, o, r);
      }
      function ze(e, t) {
        let o = e[u].hierarchyData.get(t);
        if (!o) return;
        let { dirty: r, depths: a } = o;
        if (r.dense.length !== 0) {
          for (let i of r.dense)
            if (a[i] === C) {
              let s = we(e, t, i);
              ue(o, i, s);
            }
          r.reset();
        }
      }
      function Ke(e, t, n, o = {}) {
        let r = e[u];
        ee(e, t);
        let a = P(e, [t, ...n]),
          i = r.hierarchyQueryCache.get(t);
        if (i && i.hash === a) return i.result;
        (ze(e, t), me(e, n, o));
        let s = r.queriesHashMap.get(P(e, n)),
          p = r.hierarchyData.get(t),
          { depths: c } = p;
        s.sort((d, S) => {
          let l = c[d],
            x = c[S];
          return l !== x ? l - x : d - S;
        });
        let f = (o.buffered, s.dense);
        return (r.hierarchyQueryCache.set(t, { hash: a, result: f }), f);
      }
      function Xe(e, t, n, o = {}) {
        let r = ee(e, t);
        ze(e, t);
        let a = r.depthToEntities.get(n);
        return a ? (o.buffered, a.dense) : o.buffered ? new Uint32Array(0) : [];
      }
      function Ye(e, t, n) {
        return (ee(e, n), Z(e, n, t, /* @__PURE__ */ new Set()));
      }
      function Je(e, t) {
        return ee(e, t).maxDepth;
      }
      var T = Symbol.for('bitecs-opType');
      var Q = Symbol.for('bitecs-opTerms');
      var le =
        (e) =>
        (...t) => ({ [T]: e, [Q]: t });
      var he = le('Or');
      var be = le('And');
      var Re = le('Not');
      var Ze = he;
      var et = be;
      var tt = Re;
      var ye = Symbol.for('bitecs-hierarchyType');
      var nt = Symbol.for('bitecs-hierarchyRel');
      var ot = Symbol.for('bitecs-hierarchyDepth');
      var xe = (e, t) => ({ [ye]: 'Hierarchy', [nt]: e, [ot]: t });
      var rt = xe;
      var w = Symbol.for('bitecs-modifierType');
      var at = { [w]: 'buffer' };
      var ge = { [w]: 'nested' };
      var te = ge;
      var st =
        (e) =>
        (...t) => ({ [T]: e, [Q]: t });
      var it = st('add');
      var ct = st('remove');
      var pt = (e) => ({ [T]: 'set', [Q]: [e] });
      var ft = (e) => ({ [T]: 'get', [Q]: [e] });
      function ut(e, t, n) {
        let o = e[u],
          { [T]: r, [Q]: a } = t;
        if (r === 'add' || r === 'remove')
          return (o.queriesHashMap.get(P(e, a)) || z(e, a))[
            r === 'add' ? 'addObservable' : 'removeObservable'
          ].subscribe(n);
        if (r === 'set' || r === 'get') {
          if (a.length !== 1)
            throw new Error('Set and Get hooks can only observe a single component');
          return (o.componentMap.get(a[0]) || I(e, a[0]))[
            r === 'set' ? 'setObservable' : 'getObservable'
          ].subscribe(n);
        }
        throw new Error(`Invalid hook type: ${r}`);
      }
      var P = (e, t) => {
        let n = e[u],
          o = (a) => (n.componentMap.has(a) || I(e, a), n.componentMap.get(a).id),
          r = (a) =>
            T in a ? `${a[T].toLowerCase()}(${a[Q].map(r).sort().join(',')})` : o(a).toString();
        return t.map(r).sort().join('-');
      };
      var z = (e, t, n = {}) => {
        let o = e[u],
          r = P(e, t),
          a = [],
          i = (m) => {
            T in m ? m[Q].forEach(i) : (o.componentMap.has(m) || I(e, m), a.push(m));
          };
        t.forEach(i);
        let s = [],
          p = [],
          c = [],
          f = (m, b) => {
            b.forEach((M) => {
              (o.componentMap.has(M) || I(e, M), m.push(M));
            });
          };
        t.forEach((m) => {
          if (T in m) {
            let { [T]: b, [Q]: M } = m;
            if (b === 'Not') f(p, M);
            else if (b === 'Or') f(c, M);
            else if (b === 'And') f(s, M);
            else
              throw new Error(
                `Nested combinator ${b} not supported yet - use simple queries for best performance`,
              );
          } else (o.componentMap.has(m) || I(e, m), s.push(m));
        });
        let d = a.map((m) => o.componentMap.get(m)),
          S = [...new Set(d.map((m) => m.generationId))],
          l = (m, b) => ((m[b.generationId] = (m[b.generationId] || 0) | b.bitflag), m),
          x = s.map((m) => o.componentMap.get(m)).reduce(l, {}),
          vt = p.map((m) => o.componentMap.get(m)).reduce(l, {}),
          Ct = c.map((m) => o.componentMap.get(m)).reduce(l, {}),
          Tt = d.reduce(l, {}),
          H = Object.assign(n.buffered ? Y() : D(), {
            allComponents: a,
            orComponents: c,
            notComponents: p,
            masks: x,
            notMasks: vt,
            orMasks: Ct,
            hasMasks: Tt,
            generations: S,
            toRemove: D(),
            addObservable: B(),
            removeObservable: B(),
            queues: {},
          });
        (o.queries.add(H),
          o.queriesHashMap.set(r, H),
          d.forEach((m) => {
            m.queries.add(H);
          }),
          p.length && o.notQueries.add(H));
        let We = o.entityIndex;
        for (let m = 0; m < We.aliveCount; m++) {
          let b = We.dense[m];
          if (W(e, b, A)) continue;
          N(e, H, b) && L(H, b);
        }
        return H;
      };
      function me(e, t, n = {}) {
        let o = e[u],
          r = P(e, t),
          a = o.queriesHashMap.get(r);
        return (
          a
            ? n.buffered && !('buffer' in a.dense) && (a = z(e, t, { buffered: true }))
            : (a = z(e, t, n)),
          n.buffered,
          a.dense
        );
      }
      function O(e, t, ...n) {
        let o = t.find((p) => p && typeof p == 'object' && ye in p),
          r = t.filter((p) => !(p && typeof p == 'object' && ye in p)),
          a = false,
          i = true,
          s = n.some((p) => p && typeof p == 'object' && w in p);
        for (let p of n)
          if (s && p && typeof p == 'object' && w in p) {
            let c = p;
            (c[w] === 'buffer' && (a = true), c[w] === 'nested' && (i = false));
          } else if (!s) {
            let c = p;
            (c.buffered !== void 0 && (a = c.buffered), c.commit !== void 0 && (i = c.commit));
          }
        if (o) {
          let { [nt]: p, [ot]: c } = o;
          return c !== void 0 ? Xe(e, p, c, { buffered: a }) : Ke(e, p, r, { buffered: a });
        }
        return (i && ve(e), me(e, r, { buffered: a }));
      }
      function N(e, t, n) {
        let o = e[u],
          { masks: r, notMasks: a, orMasks: i, generations: s } = t,
          p = Object.keys(i).length === 0;
        for (let c = 0; c < s.length; c++) {
          let f = s[c],
            d = r[f],
            S = a[f],
            l = i[f],
            x = o.entityMasks[f][n];
          if ((S && x & S) || (d && (x & d) !== d)) return false;
          l && x & l && (p = true);
        }
        return p;
      }
      var L = (e, t) => {
        if (e.toRemove.has(t)) {
          (e.toRemove.remove(t), e.addObservable.notify(t));
          return;
        }
        e.has(t) || (e.add(t), e.addObservable.notify(t));
      };
      var Ut = (e) => {
        for (let t = 0; t < e.toRemove.dense.length; t++) {
          let n = e.toRemove.dense[t];
          e.remove(n);
        }
        e.toRemove.reset();
      };
      var ve = (e) => {
        let t = e[u];
        t.dirtyQueries.size && (t.dirtyQueries.forEach(Ut), t.dirtyQueries.clear());
      };
      var K = (e, t, n) => {
        let o = e[u];
        !t.has(n) ||
          t.toRemove.has(n) ||
          (t.toRemove.add(n), o.dirtyQueries.add(t), t.removeObservable.notify(n));
      };
      var dt = (e, t) => {
        let n = e[u],
          o = P(e, t),
          r = n.queriesHashMap.get(o);
        r && (n.queries.delete(r), n.queriesHashMap.delete(o));
      };
      var I = (e, t) => {
        if (!t) throw new Error('bitECS - Cannot register null or undefined component');
        let n = e[u],
          o = /* @__PURE__ */ new Set(),
          r = {
            id: n.componentCount++,
            generationId: n.entityMasks.length - 1,
            bitflag: n.bitflag,
            ref: t,
            queries: o,
            setObservable: B(),
            getObservable: B(),
          };
        return (
          n.componentMap.set(t, r),
          (n.bitflag *= 2),
          n.bitflag >= 2 ** 31 && ((n.bitflag = 1), n.entityMasks.push([])),
          r
        );
      };
      var mt = (e, t) => {
        t.forEach((n) => I(e, n));
      };
      var W = (e, t, n) => {
        let o = e[u],
          r = o.componentMap.get(n);
        if (!r) return false;
        let { generationId: a, bitflag: i } = r;
        return (o.entityMasks[a][t] & i) === i;
      };
      var Ce = (e, t, n) => {
        let r = e[u].componentMap.get(n);
        if (r && W(e, t, n)) return r.getObservable.notify(t);
      };
      var Te = (e, t) => ({ component: e, data: t });
      var yt = (e, t, n, o, r = /* @__PURE__ */ new Set()) => {
        if (!r.has(o)) {
          (r.add(o), k(t, n, j(o)));
          for (let a of V(t, o))
            if (a !== A && !W(t, n, a)) {
              k(t, n, a);
              let i = e.componentMap.get(a);
              if (i?.setObservable) {
                let s = Ce(t, o, a);
                i.setObservable.notify(n, s);
              }
            }
          for (let a of v(t, o, j)) yt(e, t, n, a, r);
        }
      };
      var lt = (e, t, n, o) => {
        k(e, t, Te(n, o));
      };
      var k = (e, t, n) => {
        if (!U(e, t))
          throw new Error(`Cannot add component - entity ${t} does not exist in the world.`);
        let o = e[u],
          r = 'component' in n ? n.component : n,
          a = 'data' in n ? n.data : void 0;
        o.componentMap.has(r) || I(e, r);
        let i = o.componentMap.get(r);
        if (W(e, t, r)) return (a !== void 0 && i.setObservable.notify(t, a), false);
        let { generationId: s, bitflag: p, queries: c } = i;
        if (
          ((o.entityMasks[s][t] |= p),
          W(e, t, A) ||
            c.forEach((f) => {
              N(e, f, t) ? L(f, t) : K(e, f, t);
            }),
          o.entityComponents.get(t).add(r),
          a !== void 0 && i.setObservable.notify(t, a),
          r[F])
        ) {
          let f = r[q],
            d = r[E];
          if (
            (_(e, t, h(f, y), h(y, d)),
            typeof d == 'number' &&
              (_(e, d, h(y, t), h(y, f)),
              o.entitiesWithRelations.add(d),
              o.entitiesWithRelations.add(t)),
            o.entitiesWithRelations.add(d),
            f[g].exclusiveRelation === true && d !== y)
          ) {
            let l = v(e, t, f)[0];
            l != null && l !== d && R(e, t, f(l));
          }
          if (f === j) {
            let l = v(e, t, j);
            for (let x of l) yt(o, e, t, x);
          }
          Le(e, f, t, typeof d == 'number' ? d : void 0);
        }
        return true;
      };
      function _(e, t, ...n) {
        (Array.isArray(n[0]) ? n[0] : n).forEach((r) => {
          k(e, t, r);
        });
      }
      var R = (e, t, ...n) => {
        let o = e[u];
        if (!U(e, t))
          throw new Error(`Cannot remove component - entity ${t} does not exist in the world.`);
        n.forEach((r) => {
          if (!W(e, t, r)) return;
          let a = o.componentMap.get(r),
            { generationId: i, bitflag: s, queries: p } = a;
          if (
            ((o.entityMasks[i][t] &= ~s),
            p.forEach((c) => {
              (c.toRemove.remove(t), N(e, c, t) ? L(c, t) : K(e, c, t));
            }),
            o.entityComponents.get(t).delete(r),
            r[F])
          ) {
            let c = r[E],
              f = r[q];
            (_e(e, f, t),
              R(e, t, h(y, c)),
              typeof c == 'number' && U(e, c) && (R(e, c, h(y, t)), R(e, c, h(y, f))),
              v(e, t, f).length === 0 && R(e, t, h(f, y)));
          }
        });
      };
      var ht = R;
      var A = {};
      var bt = (e) => {
        let t = Ie(e);
        return (k(e, t, A), t);
      };
      function Ie(e, ...t) {
        let n = e[u],
          o = Me(n.entityIndex);
        return (
          n.notQueries.forEach((r) => {
            N(e, r, o) && L(r, o);
          }),
          n.entityComponents.set(o, /* @__PURE__ */ new Set()),
          t.length > 0 && _(e, o, t),
          o
        );
      }
      var Ee = (e, t) => {
        let n = e[u];
        if (!X(n.entityIndex, t)) return;
        let o = [t],
          r = /* @__PURE__ */ new Set();
        for (; o.length > 0; ) {
          let a = o.shift();
          if (r.has(a)) continue;
          r.add(a);
          let i = [];
          if (n.entitiesWithRelations.has(a)) {
            for (let s of O(e, [y(a)], te))
              if (U(e, s))
                for (let p of n.entityComponents.get(s)) {
                  if (!p[F]) continue;
                  let f = p[q][g];
                  (i.push(() => R(e, s, h(y, a))),
                    p[E] === a &&
                      (i.push(() => R(e, s, p)),
                      f.autoRemoveSubject && o.push(s),
                      f.onTargetRemoved && i.push(() => f.onTargetRemoved(e, s, a))));
                }
            n.entitiesWithRelations.delete(a);
          }
          for (let s of i) s();
          for (let s of o) Ee(e, s);
          for (let s of n.queries) K(e, s, a);
          (De(n.entityIndex, a), n.entityComponents.delete(a));
          for (let s = 0; s < n.entityMasks.length; s++) n.entityMasks[s][a] = 0;
        }
      };
      var V = (e, t) => {
        let n = e[u];
        if (t === void 0) throw new Error('getEntityComponents: entity id is undefined.');
        if (!X(n.entityIndex, t))
          throw new Error(`getEntityComponents: entity ${t} does not exist in the world.`);
        return Array.from(n.entityComponents.get(t));
      };
      var U = (e, t) => X(e[u].entityIndex, t);
      var Rt =
        (...e) =>
        (...t) =>
          e.reduce((n, o) => [o(...n)], t)[0];
      var xt = (e) => e;
      function gt(e) {
        let t = [];
        return e ? Object.assign(t, e) : t;
      }
    },
  });

  // node_modules/bitecs/dist/legacy/index.min.cjs
  var require_index_min2 = __commonJS({
    'node_modules/bitecs/dist/legacy/index.min.cjs'(exports, module) {
      var j = Object.defineProperty;
      var ee = Object.getOwnPropertyDescriptor;
      var re = Object.getOwnPropertyNames;
      var ne = Object.prototype.hasOwnProperty;
      var te = (e, r) => {
        for (var n in r) j(e, n, { get: r[n], enumerable: true });
      };
      var oe = (e, r, n, o) => {
        if ((r && typeof r == 'object') || typeof r == 'function')
          for (let i of re(r))
            !ne.call(e, i) &&
              i !== n &&
              j(e, i, { get: () => r[i], enumerable: !(o = ee(r, i)) || o.enumerable });
        return e;
      };
      var ie = (e) => oe(j({}, '__esModule', { value: true }), e);
      var Ee = {};
      te(Ee, {
        $modifier: () => Z,
        Changed: () => De,
        DESERIALIZE_MODE: () => X,
        Not: () => Re,
        Or: () => ve,
        Types: () => Ve,
        addComponent: () => ke,
        defineComponent: () => Pe,
        defineDeserializer: () => We,
        defineQuery: () => $e,
        defineSerializer: () => Ue,
        enterQuery: () => Oe,
        exitQuery: () => Fe,
        hasComponent: () => we,
        removeComponent: () => Be,
      });
      module.exports = ie(Ee);
      var z = require_index_min();
      var f = require_index_min();
      var x = Symbol.for('bitecs-u8');
      var W = Symbol.for('bitecs-i8');
      var h = Symbol.for('bitecs-u16');
      var R = Symbol.for('bitecs-i16');
      var d = Symbol.for('bitecs-u32');
      var v = Symbol.for('bitecs-i32');
      var C = Symbol.for('bitecs-f32');
      var O = Symbol.for('bitecs-f64');
      var I = Symbol.for('bitecs-ref');
      var B = Symbol.for('bitecs-str');
      var P = Symbol.for('bitecs-arr');
      var U =
        (e) =>
        (r = []) =>
          Object.defineProperty(r, e, {
            value: true,
            enumerable: false,
            writable: false,
            configurable: false,
          });
      var ae = (e = []) => U(x)(e);
      var ye = (e = []) => U(W)(e);
      var se = (e = []) => U(h)(e);
      var ue = (e = []) => U(R)(e);
      var pe = (e = []) => U(d)(e);
      var le = (e = []) => U(v)(e);
      var me = (e = []) => U(C)(e);
      var ce = (e = []) => U(O)(e);
      var be = (e = []) => U(I)(e);
      var fe = (e = []) => U(B)(e);
      var Ae = /* @__PURE__ */ new Map([
        [ae, x],
        [ye, W],
        [se, h],
        [ue, R],
        [pe, d],
        [le, v],
        [me, C],
        [ce, O],
        [be, I],
        [fe, B],
      ]);
      var g = {
        [x]: (e, r, n) => (e.setUint8(r, n), 1),
        [W]: (e, r, n) => (e.setInt8(r, n), 1),
        [h]: (e, r, n) => (e.setUint16(r, n), 2),
        [R]: (e, r, n) => (e.setInt16(r, n), 2),
        [d]: (e, r, n) => (e.setUint32(r, n), 4),
        [v]: (e, r, n) => (e.setInt32(r, n), 4),
        [C]: (e, r, n) => (e.setFloat32(r, n), 4),
        [O]: (e, r, n) => (e.setFloat64(r, n), 8),
        [I]: (e, r, n) => (e.setUint32(r, n), 4),
        [B]: (e, r, n) => {
          let i = de.encode(n),
            s = 0;
          return (
            (s += g[d](e, r + s, i.length)),
            new Uint8Array(e.buffer, e.byteOffset + r + s, i.length).set(i),
            (s += i.length),
            s
          );
        },
      };
      var S = {
        [x]: (e, r) => ({ value: e.getUint8(r), size: 1 }),
        [W]: (e, r) => ({ value: e.getInt8(r), size: 1 }),
        [h]: (e, r) => ({ value: e.getUint16(r), size: 2 }),
        [R]: (e, r) => ({ value: e.getInt16(r), size: 2 }),
        [d]: (e, r) => ({ value: e.getUint32(r), size: 4 }),
        [v]: (e, r) => ({ value: e.getInt32(r), size: 4 }),
        [C]: (e, r) => ({ value: e.getFloat32(r), size: 4 }),
        [O]: (e, r) => ({ value: e.getFloat64(r), size: 8 }),
        [I]: (e, r) => ({ value: e.getUint32(r), size: 4 }),
        [B]: (e, r) => {
          let { value: n, size: o } = S[d](e, r),
            i = new Uint8Array(e.buffer, e.byteOffset + r + o, n);
          return { value: Te.decode(i), size: o + n };
        },
      };
      function E(e) {
        if (typeof e == 'symbol') return e;
        if (typeof e == 'function') {
          let r = Ae.get(e);
          if (r) return r;
          throw new Error(`Unknown type function: ${e}`);
        }
        return D(e) ? E(e[P]) : C;
      }
      var de = new TextEncoder();
      var Te = new TextDecoder();
      function V(e) {
        return e && (ArrayBuffer.isView(e) || (Array.isArray(e) && typeof e == 'object'));
      }
      function w(e) {
        if (D(e)) return E(e[P]);
        for (let r of [x, W, h, R, d, v, C, O, B, I]) if (r in e) return r;
        return e instanceof Int8Array
          ? W
          : e instanceof Uint8Array
            ? x
            : e instanceof Int16Array
              ? R
              : e instanceof Uint16Array
                ? h
                : e instanceof Int32Array
                  ? v
                  : e instanceof Uint32Array
                    ? d
                    : e instanceof Float32Array
                      ? C
                      : O;
      }
      function D(e) {
        return Array.isArray(e) && P in e;
      }
      function k(e) {
        return e[P];
      }
      function M(e, r, n, o) {
        let i = 0,
          s = Array.isArray(r) ? 1 : 0;
        if (((i += g[x](n, o, s)), !s)) return i;
        i += g[d](n, o + i, r.length);
        for (let a = 0; a < r.length; a++) {
          let t = r[a];
          if (D(e)) i += M(k(e), t, n, o + i);
          else {
            let y = E(e);
            i += g[y](n, o + i, t);
          }
        }
        return i;
      }
      function q(e, r, n, o) {
        let i = 0,
          s = S[x](r, n + i);
        if (((i += s.size), !s.value)) return { size: i };
        let a = S[d](r, n + i);
        i += a.size;
        let t = new Array(a.value);
        for (let y = 0; y < t.length; y++)
          if (D(e)) {
            let { value: p, size: m } = q(k(e), r, n + i, o);
            ((i += m), Array.isArray(p) && (t[y] = p));
          } else {
            let p = E(e),
              { value: m, size: u } = S[p](r, n + i);
            if (((i += u), p === I)) {
              let l = o ? (o.get(m) ?? m) : m;
              t[y] = l;
            } else t[y] = m;
          }
        return { value: t, size: i };
      }
      var ge = (e) => {
        let r = w(e);
        return r === C || r === O;
      };
      var Se = (e, r) => (ge(e) ? r : 0);
      var Ie = (e, r) => {
        let n = e.get(r);
        return (
          n ||
            (ArrayBuffer.isView(r)
              ? (n = new r.constructor(r.length))
              : (n = new Array(r.length).fill(0)),
            e.set(r, n)),
          n
        );
      };
      var G = (e, r, n, o = 1e-4) => {
        let i = Ie(e, r),
          s = r[n],
          a = Se(r, o),
          t = a > 0 ? Math.abs(i[n] - s) > a : i[n] !== s;
        return ((i[n] = s), t);
      };
      var ze = (e, r = false, n, o = 1e-4) => {
        if (V(e)) {
          let t = w(e),
            y = g[t];
          return (p, m, u, l) => {
            if (r && n) {
              if (!G(n, e, u, o)) return 0;
              let c = 0;
              return (
                (c += g[d](p, m + c, u)),
                (c += g[d](p, m + c, l)),
                (c += y(p, m + c, e[u])),
                c
              );
            } else {
              let c = 0;
              return ((c += g[d](p, m + c, u)), (c += y(p, m + c, e[u])), c);
            }
          };
        }
        let i = Object.keys(e),
          a = i
            .map((t) => {
              let y = e[t];
              if (!V(y)) throw new Error(`Invalid array type for property ${t}`);
              return w(y);
            })
            .map(
              (t) =>
                g[t] ||
                (() => {
                  throw new Error('Unsupported or unannotated type');
                }),
            );
        return (t, y, p, m) => {
          if (r && n) {
            let u = 0;
            for (let b = 0; b < i.length; b++) {
              let A = e[i[b]];
              G(n, A, p, o) && (u |= 1 << b);
            }
            if (u === 0) return 0;
            let l = 0;
            ((l += g[d](t, y + l, p)), (l += g[d](t, y + l, m)));
            let c = i.length <= 8 ? g[x] : i.length <= 16 ? g[h] : g[d];
            l += c(t, y + l, u);
            for (let b = 0; b < i.length; b++)
              if (u & (1 << b)) {
                let A = e[i[b]];
                D(A) ? (l += M(k(A), A[p], t, y + l)) : (l += a[b](t, y + l, A[p]));
              }
            return l;
          } else {
            let u = 0;
            u += g[d](t, y + u, p);
            for (let l = 0; l < i.length; l++) {
              let c = e[i[l]];
              D(c) ? (u += M(k(c), c[p], t, y + u)) : (u += a[l](t, y + u, c[p]));
            }
            return u;
          }
        };
      };
      var xe = (e, r = false) => {
        if (V(e)) {
          let s = w(e),
            a = S[s];
          return (t, y, p) => {
            let m = 0,
              { value: u, size: l } = S[d](t, y);
            m += l;
            let c = p ? (p.get(u) ?? u) : u;
            if (r) {
              let { size: T } = S[d](t, y + m);
              m += T;
            }
            let { value: b, size: A } = a(t, y + m);
            if (s === I) {
              let T = p ? (p.get(b) ?? b) : b;
              e[c] = T;
            } else e[c] = b;
            return m + A;
          };
        }
        let n = Object.keys(e),
          o = n.map((s) => {
            let a = e[s];
            if (!V(a)) throw new Error(`Invalid array type for property ${s}`);
            return w(a);
          }),
          i = o.map(
            (s) =>
              S[s] ||
              (() => {
                throw new Error('Unsupported or unannotated type');
              }),
          );
        return (s, a, t) => {
          let y = 0,
            { value: p, size: m } = S[d](s, a + y);
          y += m;
          let u = t ? (t.get(p) ?? p) : p;
          if (r) {
            let { size: l } = S[d](s, a + y);
            y += l;
            let c = n.length <= 8 ? S[x] : n.length <= 16 ? S[h] : S[d],
              { value: b, size: A } = c(s, a + y);
            y += A;
            for (let T = 0; T < n.length; T++)
              if (b & (1 << T)) {
                let F = e[n[T]];
                if (D(F)) {
                  let { value: $, size: Q } = q(k(F), s, a + y, t);
                  (Array.isArray($) && (F[u] = $), (y += Q));
                } else {
                  let { value: $, size: Q } = i[T](s, a + y);
                  if (o[T] === I) {
                    let _ = t ? (t.get($) ?? $) : $;
                    e[n[T]][u] = _;
                  } else e[n[T]][u] = $;
                  y += Q;
                }
              }
          } else
            for (let l = 0; l < n.length; l++) {
              let c = e[n[l]];
              if (D(c)) {
                let { value: b, size: A } = q(k(c), s, a + y, t);
                (Array.isArray(b) && (c[u] = b), (y += A));
              } else {
                let { value: b, size: A } = i[l](s, a + y);
                if (o[l] === I) {
                  let T = t ? (t.get(b) ?? b) : b;
                  e[n[l]][u] = T;
                } else e[n[l]][u] = b;
                y += A;
              }
            }
          return y;
        };
      };
      var N = (e, r = {}) => {
        let {
            diff: n = false,
            buffer: o = new ArrayBuffer(1024 * 1024 * 100),
            epsilon: i = 1e-4,
          } = r,
          s = new DataView(o),
          a = n ? /* @__PURE__ */ new Map() : void 0,
          t = e.map((y) => ze(y, n, a, i));
        return (y) => {
          let p = 0;
          for (let m = 0; m < y.length; m++) {
            let u = y[m];
            for (let l = 0; l < t.length; l++) p += t[l](s, p, u, l);
          }
          return o.slice(0, p);
        };
      };
      var H = (e, r = {}) => {
        let { diff: n = false } = r,
          o = e.map((i) => xe(i, n));
        return (i, s) => {
          let a = new DataView(i),
            t = 0;
          for (; t < i.byteLength; )
            if (n) {
              let { value: y, size: p } = S[d](a, t),
                { value: m, size: u } = S[d](a, t + p);
              t += o[m](a, t, s);
            } else for (let y = 0; y < o.length; y++) t += o[y](a, t, s);
        };
      };
      function he(e, r, n, o) {
        if (!e) return o;
        if (Array.isArray(e)) {
          let i = e[r];
          return i !== void 0
            ? I in e
              ? (n.setUint32(o, i), o + 4)
              : (n.setFloat64(o, i), o + 8)
            : o;
        }
        if (typeof e == 'object') {
          let i = Object.keys(e).sort();
          for (let s of i) {
            let a = e[s],
              t = a[r];
            t !== void 0 &&
              (a instanceof Int8Array || W in a
                ? (n.setInt8(o, t), (o += 1))
                : a instanceof Uint8Array || x in a
                  ? (n.setUint8(o, t), (o += 1))
                  : a instanceof Int16Array || R in a
                    ? (n.setInt16(o, t), (o += 2))
                    : a instanceof Uint16Array || h in a
                      ? (n.setUint16(o, t), (o += 2))
                      : a instanceof Int32Array || v in a
                        ? (n.setInt32(o, t), (o += 4))
                        : a instanceof Uint32Array || d in a || I in a
                          ? (n.setUint32(o, t), (o += 4))
                          : a instanceof Float32Array || C in a
                            ? (n.setFloat32(o, t), (o += 4))
                            : (n.setFloat64(o, t), (o += 8)));
          }
        }
        return o;
      }
      function Ce(e, r, n, o, i) {
        if (!e) return o;
        if (Array.isArray(e)) {
          if (I in e) {
            let s = n.getUint32(o),
              a = i ? (i.get(s) ?? s) : s;
            return ((e[r] = a), o + 4);
          }
          return ((e[r] = n.getFloat64(o)), o + 8);
        }
        if (typeof e == 'object') {
          let s = Object.keys(e).sort();
          for (let a of s) {
            let t = e[a];
            if (t instanceof Int8Array || W in t) ((t[r] = n.getInt8(o)), (o += 1));
            else if (t instanceof Uint8Array || x in t) ((t[r] = n.getUint8(o)), (o += 1));
            else if (t instanceof Int16Array || R in t) ((t[r] = n.getInt16(o)), (o += 2));
            else if (t instanceof Uint16Array || h in t) ((t[r] = n.getUint16(o)), (o += 2));
            else if (t instanceof Int32Array || v in t) ((t[r] = n.getInt32(o)), (o += 4));
            else if (t instanceof Uint32Array || d in t || I in t) {
              let y = n.getUint32(o);
              if (I in t) {
                let p = i ? (i.get(y) ?? y) : y;
                t[r] = p;
              } else t[r] = y;
              o += 4;
            } else
              t instanceof Float32Array || C in t
                ? ((t[r] = n.getFloat32(o)), (o += 4))
                : ((t[r] = n.getFloat64(o)), (o += 8));
          }
        }
        return o;
      }
      var J = (e, r, n, o = {}) => {
        let i = o.buffer ?? new ArrayBuffer(104857600),
          s = new DataView(i),
          a = 0,
          t = [],
          y = /* @__PURE__ */ new Map();
        return (
          (0, f.observe)(e, (0, f.onAdd)(r), (p) => {
            t.push([p, 0, -1]);
          }),
          (0, f.observe)(e, (0, f.onRemove)(r), (p) => {
            (t.push([p, 1, -1]), y.delete(p));
          }),
          n.forEach((p, m) => {
            (0, f.isRelation)(p)
              ? ((0, f.observe)(e, (0, f.onAdd)(r, p(f.Wildcard)), (u) => {
                  let l = (0, f.getRelationTargets)(e, u, p);
                  for (let c of l) {
                    (y.has(u) || y.set(u, /* @__PURE__ */ new Map()), y.get(u).set(m, c));
                    let b = p(c);
                    t.push([u, 4, m, c, b]);
                  }
                }),
                (0, f.observe)(e, (0, f.onRemove)(r, p(f.Wildcard)), (u) => {
                  let l = y.get(u);
                  if (l) {
                    let c = l.get(m);
                    c !== void 0 &&
                      (t.push([u, 5, m, c]), l.delete(m), l.size === 0 && y.delete(u));
                  }
                }))
              : ((0, f.observe)(e, (0, f.onAdd)(r, p), (u) => {
                  t.push([u, 2, m]);
                }),
                (0, f.observe)(e, (0, f.onRemove)(r, p), (u) => {
                  t.push([u, 3, m]);
                }));
          }),
          () => {
            a = 0;
            for (let p = 0; p < t.length; p++) {
              let [m, u, l, c, b] = t[p];
              (s.setUint32(a, m),
                (a += 4),
                s.setUint8(a, u),
                (a += 1),
                (u === 2 || u === 3 || u === 4 || u === 5) &&
                  (s.setUint8(a, l),
                  (a += 1),
                  (u === 4 || u === 5) &&
                    (s.setUint32(a, c), (a += 4), u === 4 && b && (a = he(b, m, s, a)))));
            }
            return ((t.length = 0), i.slice(0, a));
          }
        );
      };
      var K = (e, r, n, o = {}) => {
        let i = o.idMap || /* @__PURE__ */ new Map();
        return (s, a) => {
          let t = a || i,
            y = new DataView(s),
            p = 0;
          for (; p < s.byteLength; ) {
            let m = y.getUint32(p);
            p += 4;
            let u = y.getUint8(p);
            p += 1;
            let l = -1,
              c = -1;
            (u === 2 || u === 3 || u === 4 || u === 5) &&
              ((l = y.getUint8(p)),
              (p += 1),
              (u === 4 || u === 5) && ((c = y.getUint32(p)), (p += 4)));
            let b = n[l],
              A = t.get(m);
            if (u === 0)
              A === void 0
                ? ((A = (0, f.addEntity)(e)), t.set(m, A), (0, f.addComponent)(e, A, r))
                : console.warn(
                    `Attempted to deserialize addEntity with ID ${m}, but it has already been deserialzied and exists in the mapping.`,
                  );
            else if (A !== void 0 && (0, f.entityExists)(e, A)) {
              if (u === 1) ((0, f.removeEntity)(e, A), t.delete(m));
              else if (u === 2) (0, f.addComponent)(e, A, b);
              else if (u === 3) (0, f.removeComponent)(e, A, b);
              else if (u === 4) {
                let T = t.get(c);
                if (T !== void 0) {
                  let F = b(T);
                  ((0, f.addComponent)(e, A, F), (p = Ce(F, A, y, p, t)));
                }
              } else if (u === 5) {
                let T = t.get(c);
                T !== void 0 && (0, f.removeComponent)(e, A, b(T));
              }
            }
          }
          return t;
        };
      };
      function Ue(e, r) {
        let n = /* @__PURE__ */ new WeakSet(),
          o,
          i;
        return (s, a) => {
          n.has(s) || (n.add(s), (o = J(s, e[0], e)), (i = N(e)));
          let t = o(),
            y = i(a),
            p = new ArrayBuffer(t.byteLength + y.byteLength),
            m = new Uint8Array(p);
          return (m.set(new Uint8Array(t), 0), m.set(new Uint8Array(y), t.byteLength), p);
        };
      }
      function We(e) {
        let r = /* @__PURE__ */ new WeakSet(),
          n,
          o;
        return (i, s, a) => {
          r.has(i) || (r.add(i), (n = K(i, e[0], e)), (o = H(e)));
          let t = n(s, a),
            y = s.slice(t);
          return o(y, a);
        };
      }
      var X = ((o) => (
        (o[(o.REPLACE = 0)] = 'REPLACE'),
        (o[(o.APPEND = 1)] = 'APPEND'),
        (o[(o.MAP = 2)] = 'MAP'),
        o
      ))(X || {});
      var Z = Symbol('$modifier');
      function L(e, r) {
        let n = () => [e, r];
        return ((n[Z] = true), n);
      }
      var Re = (e) => L(e, 'not');
      var ve = (e) => L(e, 'or');
      var De = (e) => L(e, 'changed');
      function $e(e) {
        let r = (n) => (0, z.query)(n, e);
        return ((r.components = e), r);
      }
      function Oe(e) {
        let r = [],
          n = /* @__PURE__ */ new WeakSet();
        return (o) => {
          n.has(o) ||
            ((0, z.observe)(o, (0, z.onAdd)(...e.components), (s) => r.push(s)), n.add(o));
          let i = r.slice();
          return ((r.length = 0), i);
        };
      }
      function Fe(e) {
        let r = [],
          n = /* @__PURE__ */ new WeakSet();
        return (o) => {
          n.has(o) ||
            ((0, z.observe)(o, (0, z.onRemove)(...e.components), (s) => r.push(s)), n.add(o));
          let i = r.slice();
          return ((r.length = 0), i);
        };
      }
      var ke = (e, r, n) => (0, z.addComponent)(e, n, r);
      var we = (e, r, n) => (0, z.hasComponent)(e, n, r);
      var Be = (e, r, n) => (0, z.removeComponent)(e, n, r);
      var Ve = {
        i8: 'i8',
        ui8: 'ui8',
        ui8c: 'ui8c',
        i16: 'i16',
        ui16: 'ui16',
        i32: 'i32',
        ui32: 'ui32',
        f32: 'f32',
        f64: 'f64',
        eid: 'eid',
      };
      var Y = {
        i8: Int8Array,
        ui8: Uint8Array,
        ui8c: Uint8ClampedArray,
        i16: Int16Array,
        ui16: Uint16Array,
        i32: Int32Array,
        ui32: Uint32Array,
        f32: Float32Array,
        f64: Float64Array,
        eid: Uint32Array,
      };
      var Pe = (e, r = 1e5) => {
        let n = (o, i) => {
          let s = {};
          for (let a in o)
            if (Array.isArray(o[a])) {
              let [t, y] = o[a];
              s[a] = Array.from({ length: y }, () => new Y[t](i));
            } else if (typeof o[a] == 'object') s[a] = n(o[a], i);
            else {
              let t = o[a],
                y = Y[t];
              if (y) s[a] = new y(i);
              else throw new Error(`Unsupported type: ${o[a]}`);
            }
          return s;
        };
        return n(e, r);
      };
    },
  });

  // frontend/js/ecs/core/EcsCoreBoundary.js
  var require_EcsCoreBoundary = __commonJS({
    'frontend/js/ecs/core/EcsCoreBoundary.js'(exports, module) {
      'use strict';
      var bitecsCore = require_index_min();
      var bitecsLegacy = require_index_min2();
      var EcsCoreBoundary = Object.freeze({
        createWorld: bitecsCore.createWorld,
        addEntity: bitecsCore.addEntity,
        removeEntity: bitecsCore.removeEntity,
        defineComponent: bitecsLegacy.defineComponent,
        Types: bitecsLegacy.Types,
        addComponent: bitecsLegacy.addComponent,
        removeComponent: bitecsLegacy.removeComponent,
        hasComponent: bitecsLegacy.hasComponent,
        defineQuery: bitecsLegacy.defineQuery,
        enterQuery: bitecsLegacy.enterQuery,
        exitQuery: bitecsLegacy.exitQuery,
        pipe: bitecsCore.pipe,
      });
      module.exports = EcsCoreBoundary;
    },
  });

  // frontend/js/ecs/mode/ModeComponents.js
  var require_ModeComponents = __commonJS({
    'frontend/js/ecs/mode/ModeComponents.js'(exports, module) {
      'use strict';
      var EcsCoreBoundary = (() => {
        if (typeof __require === 'function') return require_EcsCoreBoundary();
        return globalThis.EcsCoreBoundary;
      })();
      var { Types, defineComponent } = EcsCoreBoundary || {};
      if (!Types || !defineComponent) {
        throw new Error('ECS mode components require EcsCoreBoundary primitives');
      }
      var ModeState = defineComponent({
        baseModeId: Types.ui8,
        modalMask: Types.ui32,
        tutorialActive: Types.ui8,
        debugActive: Types.ui8,
        blockingOverlayActive: Types.ui8,
        techTreeBlockingOverlayActive: Types.ui8,
        entityBattleActive: Types.ui8,
        worldMapHomeActive: Types.ui8,
        techTreeActive: Types.ui8,
        formationEditorActive: Types.ui8,
        topCaptureModeId: Types.ui8,
      });
      var api = Object.freeze({ ModeState });
      if (typeof globalThis !== 'undefined') globalThis.EcsModeComponents = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/ecs/mode/ModeResolver.js
  var require_ModeResolver = __commonJS({
    'frontend/js/ecs/mode/ModeResolver.js'(exports, module) {
      'use strict';
      var ModeKeys = (() => {
        if (typeof __require === 'function') return require_ModeKeys();
        return globalThis.EcsModeKeys;
      })();
      var { CAPTURE_PRIORITY, MODAL_BIT_BY_KEY, modeIdForKey, modeKeyForId, normalizeModeKey } =
        ModeKeys || {};
      var BLOCKING_MODAL_KEYS = Object.freeze([
        'modal:naming',
        'modal:event',
        'modal:rewardReveal',
        'modal:confirmDialog',
        'modal:targetPicker',
        'modal:settings',
        'modal:logs',
        'modal:resourceDetails',
        'modal:citySwitcher',
        'modal:subcityList',
        'modal:cityManagement',
        'modal:advisor',
        'modal:taskCenter',
        'modal:guidebook',
        'modal:famousPersons',
        'modal:techDetail',
      ]);
      function readBool(value) {
        return value === true || value === 1;
      }
      function modalMaskFromKeys(keys = []) {
        return keys.reduce((mask, key) => mask | (MODAL_BIT_BY_KEY[key] || 0), 0);
      }
      function modalKeysFromMask(mask = 0) {
        return Object.entries(MODAL_BIT_BY_KEY)
          .filter(([, bit]) => (Number(mask) & bit) !== 0)
          .map(([key]) => key);
      }
      function deriveTopCaptureModeKey(facts = {}) {
        const modalMask = Number(facts.modalMask) || 0;
        if (readBool(facts.tutorialActive)) return 'tutorial';
        return (
          CAPTURE_PRIORITY.find((key) => {
            if (key.startsWith('modal:')) return (modalMask & (MODAL_BIT_BY_KEY[key] || 0)) !== 0;
            return normalizeModeKey(facts.baseModeKey) === key;
          }) || normalizeModeKey(facts.baseModeKey)
        );
      }
      function createModeSnapshot(facts = {}) {
        const baseModeKey = normalizeModeKey(facts.baseModeKey);
        const modalMask = Number(facts.modalMask) || modalMaskFromKeys(facts.modalKeys || []);
        const modalKeys = modalKeysFromMask(modalMask);
        const blockingOverlayActive =
          readBool(facts.blockingOverlayActive) ||
          modalKeys.some((key) => BLOCKING_MODAL_KEYS.includes(key)) ||
          readBool(facts.entityBattleActive);
        const techTreeBlockingOverlayActive = Object.prototype.hasOwnProperty.call(
          facts,
          'techTreeBlockingOverlayActive',
        )
          ? readBool(facts.techTreeBlockingOverlayActive)
          : blockingOverlayActive;
        const topCaptureModeKey =
          facts.topCaptureModeKey || deriveTopCaptureModeKey({ ...facts, baseModeKey, modalMask });
        return Object.freeze({
          baseModeId: modeIdForKey(baseModeKey),
          baseModeKey,
          modalMask,
          modalKeys: Object.freeze(modalKeys),
          tutorialActive: readBool(facts.tutorialActive),
          debugActive: readBool(facts.debugActive),
          blockingOverlayActive,
          techTreeBlockingOverlayActive,
          entityBattleActive: readBool(facts.entityBattleActive),
          worldMapHomeActive: readBool(facts.worldMapHomeActive),
          techTreeActive: readBool(facts.techTreeActive) || baseModeKey === 'techTree',
          formationEditorActive:
            readBool(facts.formationEditorActive) || baseModeKey === 'formationEditor',
          topCaptureModeId: modeIdForKey(topCaptureModeKey),
          topCaptureModeKey,
          canRouteWorldMap: baseModeKey === 'worldMap' && !blockingOverlayActive,
          canRouteTechTree:
            (baseModeKey === 'techTree' || readBool(facts.techTreeActive)) &&
            !techTreeBlockingOverlayActive,
        });
      }
      function snapshotFromComponent(ModeState, entity) {
        const modalMask = ModeState.modalMask[entity] || 0;
        const baseModeKey = modeKeyForId(ModeState.baseModeId[entity], 'city');
        return createModeSnapshot({
          baseModeKey,
          modalMask,
          tutorialActive: ModeState.tutorialActive[entity] === 1,
          debugActive: ModeState.debugActive[entity] === 1,
          blockingOverlayActive: ModeState.blockingOverlayActive[entity] === 1,
          techTreeBlockingOverlayActive: ModeState.techTreeBlockingOverlayActive[entity] === 1,
          entityBattleActive: ModeState.entityBattleActive[entity] === 1,
          worldMapHomeActive: ModeState.worldMapHomeActive[entity] === 1,
          techTreeActive: ModeState.techTreeActive[entity] === 1,
          formationEditorActive: ModeState.formationEditorActive[entity] === 1,
          topCaptureModeKey: modeKeyForId(ModeState.topCaptureModeId[entity], baseModeKey),
        });
      }
      function isBlockingOverlayOpen(snapshot = {}) {
        return Boolean(snapshot.blockingOverlayActive);
      }
      function isEntityBattleActive(snapshot = {}) {
        return Boolean(snapshot.entityBattleActive);
      }
      function canRouteWorldMap(snapshot = {}) {
        return Boolean(snapshot.canRouteWorldMap);
      }
      function canRouteTechTree(snapshot = {}) {
        return Boolean(snapshot.canRouteTechTree);
      }
      var api = Object.freeze({
        BLOCKING_MODAL_KEYS,
        canRouteTechTree,
        canRouteWorldMap,
        createModeSnapshot,
        deriveTopCaptureModeKey,
        isBlockingOverlayOpen,
        isEntityBattleActive,
        modalKeysFromMask,
        modalMaskFromKeys,
        snapshotFromComponent,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsModeResolver = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/ecs/mode/ModeWorld.js
  var require_ModeWorld = __commonJS({
    'frontend/js/ecs/mode/ModeWorld.js'(exports, module) {
      'use strict';
      var EcsCoreBoundary = (() => {
        if (typeof __require === 'function') return require_EcsCoreBoundary();
        return globalThis.EcsCoreBoundary;
      })();
      var { modeIdForKey } = (() => {
        if (typeof __require === 'function') return require_ModeKeys();
        return globalThis.EcsModeKeys;
      })();
      var { ModeState } = (() => {
        if (typeof __require === 'function') return require_ModeComponents();
        return globalThis.EcsModeComponents;
      })();
      var { createModeSnapshot, snapshotFromComponent } = (() => {
        if (typeof __require === 'function') return require_ModeResolver();
        return globalThis.EcsModeResolver;
      })();
      var { addComponent, addEntity, createWorld, hasComponent } = EcsCoreBoundary || {};
      function createModeWorld(initialFacts = {}) {
        const world = createWorld();
        const entity = addEntity(world);
        addComponent(world, ModeState, entity);
        const owner = Object.freeze({
          owner: 'frontend/js/ecs/mode/ModeWorld',
          world,
          entity,
        });
        updateModeWorld(owner, initialFacts);
        return owner;
      }
      function ensureModeWorld(owner = null) {
        if (
          owner?.world &&
          Number.isFinite(owner.entity) &&
          hasComponent(owner.world, ModeState, owner.entity)
        ) {
          return owner;
        }
        return createModeWorld();
      }
      function updateModeWorld(owner, facts = {}) {
        const modeOwner = ensureModeWorld(owner);
        const snapshot = createModeSnapshot(facts);
        const entity = modeOwner.entity;
        ModeState.baseModeId[entity] = snapshot.baseModeId;
        ModeState.modalMask[entity] = snapshot.modalMask;
        ModeState.tutorialActive[entity] = snapshot.tutorialActive ? 1 : 0;
        ModeState.debugActive[entity] = snapshot.debugActive ? 1 : 0;
        ModeState.blockingOverlayActive[entity] = snapshot.blockingOverlayActive ? 1 : 0;
        ModeState.techTreeBlockingOverlayActive[entity] = snapshot.techTreeBlockingOverlayActive
          ? 1
          : 0;
        ModeState.entityBattleActive[entity] = snapshot.entityBattleActive ? 1 : 0;
        ModeState.worldMapHomeActive[entity] = snapshot.worldMapHomeActive ? 1 : 0;
        ModeState.techTreeActive[entity] = snapshot.techTreeActive ? 1 : 0;
        ModeState.formationEditorActive[entity] = snapshot.formationEditorActive ? 1 : 0;
        ModeState.topCaptureModeId[entity] = modeIdForKey(snapshot.topCaptureModeKey);
        return Object.freeze({
          modeOwner,
          snapshot: snapshotFromComponent(ModeState, entity),
        });
      }
      function getModeSnapshot(owner) {
        const modeOwner = ensureModeWorld(owner);
        return snapshotFromComponent(ModeState, modeOwner.entity);
      }
      var api = Object.freeze({
        createModeWorld,
        ensureModeWorld,
        getModeSnapshot,
        updateModeWorld,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsModeWorld = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/ecs/mode/ModalWorld.js
  var require_ModalWorld = __commonJS({
    'frontend/js/ecs/mode/ModalWorld.js'(exports, module) {
      'use strict';
      function freezePayload(payload) {
        return Object.freeze({ ...(payload && typeof payload === 'object' ? payload : {}) });
      }
      function createModalWorld() {
        return Object.freeze({ entries: Object.freeze({}), tokenSeq: 0 });
      }
      function normalizeSubtype(subtype) {
        return String(subtype || '');
      }
      function withEntry(world, key, entry, tokenSeq) {
        const base = world && typeof world === 'object' ? world : createModalWorld();
        const entries = Object.freeze({ ...(base.entries || {}), [key]: Object.freeze(entry) });
        return Object.freeze({
          entries,
          tokenSeq: tokenSeq != null ? tokenSeq : base.tokenSeq || 0,
        });
      }
      function getEntry(world, subtype) {
        return (world && world.entries && world.entries[normalizeSubtype(subtype)]) || null;
      }
      function openModal(world, subtype, payload = {}) {
        const base = world && typeof world === 'object' ? world : createModalWorld();
        const key = normalizeSubtype(subtype);
        const tokenSeq = (base.tokenSeq || 0) + 1;
        const token = `${key}#${tokenSeq}`;
        return withEntry(
          base,
          key,
          { visible: true, token, payload: freezePayload(payload) },
          tokenSeq,
        );
      }
      function updateModalPayload(world, subtype, patch = {}) {
        const prev = getEntry(world, subtype);
        if (!prev || !prev.visible)
          return world && typeof world === 'object' ? world : createModalWorld();
        const key = normalizeSubtype(subtype);
        const payload = freezePayload({ ...prev.payload, ...patch });
        return withEntry(world, key, { visible: true, token: prev.token, payload });
      }
      function closeModal(world, subtype) {
        const key = normalizeSubtype(subtype);
        return withEntry(world, key, { visible: false, token: '', payload: Object.freeze({}) });
      }
      function isModalOpen(world, subtype) {
        return Boolean(getEntry(world, subtype)?.visible);
      }
      function getModalPayload(world, subtype) {
        const entry = getEntry(world, subtype);
        return entry && entry.visible ? entry.payload : null;
      }
      function getModalToken(world, subtype) {
        const entry = getEntry(world, subtype);
        return entry && entry.visible ? entry.token : '';
      }
      var api = Object.freeze({
        closeModal,
        createModalWorld,
        getEntry,
        getModalPayload,
        getModalToken,
        isModalOpen,
        openModal,
        updateModalPayload,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsModalWorld = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/ecs/input/InputIntent.js
  var require_InputIntent = __commonJS({
    'frontend/js/ecs/input/InputIntent.js'(exports, module) {
      'use strict';
      var INTENT_KINDS = Object.freeze({
        DRAG: 'drag',
        GESTURE: 'gesture',
        TAP: 'tap',
      });
      var INTENT_PHASES = Object.freeze({
        START: 'start',
        MOVE: 'move',
        END: 'end',
        CANCEL: 'cancel',
      });
      var INPUT_ROUTES = Object.freeze({
        ENTITY_BATTLE: 'entity-battle',
        TECH_TREE: 'tech-tree',
        WORLD_MAP: 'world-map',
        CITY: 'city',
      });
      var KIND_VALUES = Object.freeze(Object.values(INTENT_KINDS));
      var ROUTE_VALUES = Object.freeze(Object.values(INPUT_ROUTES));
      function toFiniteNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
      }
      function normalizePointer(pointer) {
        if (!pointer || typeof pointer !== 'object') return null;
        return Object.freeze({ x: toFiniteNumber(pointer.x), y: toFiniteNumber(pointer.y) });
      }
      function normalizeGesture(gesture) {
        if (!gesture || typeof gesture !== 'object') return null;
        return Object.freeze({
          type: String(gesture.type || ''),
          phase: gesture.phase ? String(gesture.phase) : '',
        });
      }
      function createPhysicalIntent(input = {}) {
        return Object.freeze({
          kind: String(input.kind || ''),
          phase: input.phase ? String(input.phase) : '',
          pointer: normalizePointer(input.pointer),
          gesture: normalizeGesture(input.gesture),
        });
      }
      function createRoutedIntent(input = {}) {
        return Object.freeze({
          route: String(input.route || ''),
          kind: input.kind ? String(input.kind) : '',
          action:
            input.action && typeof input.action === 'object'
              ? Object.freeze({ ...input.action })
              : null,
        });
      }
      function isCoveredRoute(route) {
        return ROUTE_VALUES.includes(route);
      }
      var api = Object.freeze({
        INTENT_KINDS,
        INTENT_PHASES,
        INPUT_ROUTES,
        KIND_VALUES,
        ROUTE_VALUES,
        createPhysicalIntent,
        createRoutedIntent,
        isCoveredRoute,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsInputIntent = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/ecs/input/InputIntentResolver.js
  var require_InputIntentResolver = __commonJS({
    'frontend/js/ecs/input/InputIntentResolver.js'(exports, module) {
      'use strict';
      var ModeResolver = (() => {
        if (typeof __require === 'function') return require_ModeResolver();
        return globalThis.EcsModeResolver;
      })();
      var InputIntent = (() => {
        if (typeof __require === 'function') return require_InputIntent();
        return globalThis.EcsInputIntent;
      })();
      var { INPUT_ROUTES, INTENT_KINDS, createRoutedIntent } = InputIntent || {};
      var { isEntityBattleActive, canRouteTechTree, canRouteWorldMap } = ModeResolver || {};
      function prefersWorldBeforeTech(kind) {
        return kind === INTENT_KINDS.GESTURE;
      }
      function routeForSnapshot(snapshot = {}, kind = '') {
        if (isEntityBattleActive(snapshot)) return INPUT_ROUTES.ENTITY_BATTLE;
        if (prefersWorldBeforeTech(kind)) {
          if (canRouteWorldMap(snapshot)) return INPUT_ROUTES.WORLD_MAP;
          if (canRouteTechTree(snapshot)) return INPUT_ROUTES.TECH_TREE;
        } else {
          if (canRouteTechTree(snapshot)) return INPUT_ROUTES.TECH_TREE;
          if (canRouteWorldMap(snapshot)) return INPUT_ROUTES.WORLD_MAP;
        }
        return INPUT_ROUTES.CITY;
      }
      function resolveInputIntent(physicalIntent = {}, snapshot = null) {
        if (!snapshot) return null;
        const kind = String(physicalIntent.kind || '');
        const route = routeForSnapshot(snapshot, kind);
        return createRoutedIntent({ route, kind });
      }
      var api = Object.freeze({
        resolveInputIntent,
        routeForSnapshot,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsInputIntentResolver = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/ecs/snapshot/RendererSnapshotBoundary.js
  var require_RendererSnapshotBoundary = __commonJS({
    'frontend/js/ecs/snapshot/RendererSnapshotBoundary.js'(exports, module) {
      'use strict';
      var SCHEMA = 'renderer-snapshot-v1';
      var MODAL_SUBTYPES = Object.freeze([
        'modal:naming',
        'modal:event',
        'modal:rewardReveal',
        'modal:confirmDialog',
        'modal:targetPicker',
        'modal:settings',
        'modal:logs',
        'modal:resourceDetails',
        'modal:citySwitcher',
        'modal:subcityList',
        'modal:cityManagement',
        'modal:advisor',
        'modal:taskCenter',
        'modal:guidebook',
        'modal:famousPersons',
        'modal:commandPanel',
        'modal:techDetail',
      ]);
      var PANEL_KEYS = Object.freeze([
        'showSettings',
        'showLogs',
        'showResourceDetails',
        'showCitySwitcher',
        'showSubcityList',
        'showCityManagement',
        'showAdvisor',
        'showTaskCenter',
        'showGuidebook',
        'showFamousPersons',
        'activeCommandPanel',
        'techDetailOpen',
      ]);
      var PANEL_DEFAULTS = Object.freeze({
        showSettings: false,
        showLogs: false,
        showResourceDetails: false,
        showCitySwitcher: false,
        showSubcityList: false,
        showCityManagement: false,
        showAdvisor: false,
        showTaskCenter: false,
        showGuidebook: false,
        showFamousPersons: false,
        activeCommandPanel: '',
        techDetailOpen: false,
      });
      var MODE_DEFAULTS = Object.freeze({
        baseModeId: 0,
        baseModeKey: 'city',
        modalMask: 0,
        modalKeys: Object.freeze([]),
        tutorialActive: false,
        debugActive: false,
        blockingOverlayActive: false,
        techTreeBlockingOverlayActive: false,
        entityBattleActive: false,
        worldMapHomeActive: false,
        techTreeActive: false,
        formationEditorActive: false,
        topCaptureModeId: 0,
        topCaptureModeKey: 'city',
        canRouteWorldMap: false,
        canRouteTechTree: false,
      });
      var BATTLE_DEFAULTS = Object.freeze({
        schema: 'battle-domain-v1',
        battleScene: null,
        entityBattle: null,
        activeOverlay: 'none',
      });
      function cloneSerializable(value) {
        if (typeof value === 'function' || typeof value === 'undefined') return null;
        if (value == null) return null;
        if (Array.isArray(value))
          return Object.freeze(value.map((item) => cloneSerializable(item)));
        if (typeof value === 'object') {
          const copy = {};
          Object.keys(value)
            .sort()
            .forEach((key) => {
              const next = value[key];
              if (typeof next === 'function' || typeof next === 'undefined') return;
              copy[key] = cloneSerializable(next);
            });
          return Object.freeze(copy);
        }
        return value;
      }
      function readEntry(modalWorld, subtype) {
        return (modalWorld && modalWorld.entries && modalWorld.entries[subtype]) || null;
      }
      function buildModalSnapshot(modalWorld = null) {
        const modal = {};
        MODAL_SUBTYPES.forEach((subtype) => {
          const entry = readEntry(modalWorld, subtype);
          const open = Boolean(entry?.visible);
          modal[subtype] = Object.freeze({
            open,
            token: open ? String(entry.token || '') : '',
            payload: open ? cloneSerializable(entry.payload || {}) : null,
          });
        });
        return Object.freeze(modal);
      }
      function normalizePanelValue(panelKey, value) {
        if (panelKey === 'activeCommandPanel') return String(value || '');
        return Boolean(value);
      }
      function buildPanelSnapshot(panelFacts = {}) {
        const panel = {};
        PANEL_KEYS.forEach((panelKey) => {
          const value = Object.prototype.hasOwnProperty.call(panelFacts, panelKey)
            ? panelFacts[panelKey]
            : PANEL_DEFAULTS[panelKey];
          panel[panelKey] = normalizePanelValue(panelKey, value);
        });
        return Object.freeze(panel);
      }
      function buildModeSnapshot(modeFacts = null) {
        const source = modeFacts && typeof modeFacts === 'object' ? modeFacts : {};
        const mode = {};
        Object.keys(MODE_DEFAULTS).forEach((key) => {
          const value = Object.prototype.hasOwnProperty.call(source, key)
            ? source[key]
            : MODE_DEFAULTS[key];
          mode[key] = cloneSerializable(value);
        });
        return Object.freeze(mode);
      }
      function buildBattleSnapshot(battleFacts = null) {
        if (!battleFacts || typeof battleFacts !== 'object') return BATTLE_DEFAULTS;
        return Object.freeze({
          schema: String(battleFacts.schema || BATTLE_DEFAULTS.schema),
          battleScene: cloneSerializable(battleFacts.battleScene || null),
          entityBattle: cloneSerializable(battleFacts.entityBattle || null),
          activeOverlay: String(battleFacts.activeOverlay || BATTLE_DEFAULTS.activeOverlay),
        });
      }
      function buildRendererSnapshot(facts = {}) {
        return Object.freeze({
          schema: SCHEMA,
          modal: buildModalSnapshot(facts.modalWorld || null),
          panel: buildPanelSnapshot(facts.panel || {}),
          mode: buildModeSnapshot(facts.mode || null),
          battle: buildBattleSnapshot(facts.battle || null),
        });
      }
      function isRendererSnapshot(value) {
        return Boolean(
          value && value.schema === SCHEMA && value.modal && value.panel && value.mode,
        );
      }
      var api = Object.freeze({
        BATTLE_DEFAULTS,
        MODAL_SUBTYPES,
        MODE_DEFAULTS,
        PANEL_DEFAULTS,
        PANEL_KEYS,
        SCHEMA,
        buildRendererSnapshot,
        isRendererSnapshot,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsRendererSnapshotBoundary = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/ecs/domain/BattleDomainOwner.js
  var require_BattleDomainOwner = __commonJS({
    'frontend/js/ecs/domain/BattleDomainOwner.js'(exports, module) {
      'use strict';
      var SCHEMA = 'battle-domain-v1';
      function cloneSerializable(value, seen = []) {
        if (typeof value === 'function' || typeof value === 'undefined') return null;
        if (value == null) return null;
        if (Array.isArray(value))
          return Object.freeze(value.map((item) => cloneSerializable(item, seen)));
        if (typeof value === 'object') {
          if (seen.includes(value)) return null;
          const nextSeen = seen.concat(value);
          const copy = {};
          Object.keys(value)
            .sort()
            .forEach((key) => {
              const next = value[key];
              if (typeof next === 'function' || typeof next === 'undefined') return;
              copy[key] = cloneSerializable(next, nextSeen);
            });
          return Object.freeze(copy);
        }
        return value;
      }
      function normalizeBattleScene(scene = null) {
        if (!scene || typeof scene !== 'object') return null;
        return Object.freeze({
          visible: scene.visible !== false,
          report: cloneSerializable(scene.report || null),
          turnIndex: Math.max(0, Number(scene.turnIndex) || 0),
          startedAt: Number(scene.startedAt) || 0,
          turnStartedAt: Number(scene.turnStartedAt) || 0,
          turnDurationMs: Math.max(0, Number(scene.turnDurationMs) || 0),
        });
      }
      function normalizeEntityBattle(session = null) {
        if (!session || typeof session !== 'object') return null;
        return cloneSerializable(session);
      }
      function activeOverlayFor(battleScene = null, entityBattle = null) {
        if (entityBattle?.visible) return 'entityBattle';
        if (battleScene?.visible) return 'battleScene';
        return 'none';
      }
      function makeOwner({ battleScene = null, entityBattle = null } = {}) {
        const normalizedBattleScene = normalizeBattleScene(battleScene);
        const normalizedEntityBattle = normalizeEntityBattle(entityBattle);
        return Object.freeze({
          schema: SCHEMA,
          battleScene: normalizedBattleScene,
          entityBattle: normalizedEntityBattle,
          activeOverlay: activeOverlayFor(normalizedBattleScene, normalizedEntityBattle),
        });
      }
      function createBattleDomainOwner(initial = {}) {
        return makeOwner(initial);
      }
      function ensureBattleDomainOwner(owner = null) {
        return owner?.schema === SCHEMA ? owner : createBattleDomainOwner();
      }
      function openBattleScene(owner, scene) {
        const base = ensureBattleDomainOwner(owner);
        return makeOwner({ battleScene: scene, entityBattle: base.entityBattle });
      }
      function updateBattleScene(owner, patchOrScene = {}) {
        const base = ensureBattleDomainOwner(owner);
        const current = base.battleScene || {};
        return makeOwner({
          battleScene: { ...current, ...(patchOrScene || {}) },
          entityBattle: base.entityBattle,
        });
      }
      function closeBattleScene(owner) {
        const base = ensureBattleDomainOwner(owner);
        return makeOwner({ battleScene: null, entityBattle: base.entityBattle });
      }
      function openEntityBattle(owner, session) {
        const base = ensureBattleDomainOwner(owner);
        return makeOwner({ battleScene: base.battleScene, entityBattle: session });
      }
      function updateEntityBattle(owner, patchOrSession = {}) {
        const base = ensureBattleDomainOwner(owner);
        const current = base.entityBattle || {};
        return makeOwner({
          battleScene: base.battleScene,
          entityBattle: { ...current, ...(patchOrSession || {}) },
        });
      }
      function closeEntityBattle(owner) {
        const base = ensureBattleDomainOwner(owner);
        return makeOwner({ battleScene: base.battleScene, entityBattle: null });
      }
      function getBattleDomainSnapshot(owner) {
        return ensureBattleDomainOwner(owner);
      }
      var api = Object.freeze({
        SCHEMA,
        closeBattleScene,
        closeEntityBattle,
        createBattleDomainOwner,
        getBattleDomainSnapshot,
        openBattleScene,
        openEntityBattle,
        updateBattleScene,
        updateEntityBattle,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsBattleDomainOwner = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/ecs/mode/EcsModeRuntimeEntry.js
  var require_EcsModeRuntimeEntry = __commonJS({
    'frontend/js/ecs/mode/EcsModeRuntimeEntry.js'(exports, module) {
      var ModeKeys = require_ModeKeys();
      var ModeComponents = require_ModeComponents();
      var ModeResolver = require_ModeResolver();
      var ModeWorld = require_ModeWorld();
      var ModalWorld = require_ModalWorld();
      var InputIntent = require_InputIntent();
      var InputIntentResolver = require_InputIntentResolver();
      var RendererSnapshotBoundary = require_RendererSnapshotBoundary();
      var BattleDomainOwner = require_BattleDomainOwner();
      var EcsModeRuntime = Object.freeze({
        ...ModeKeys,
        ...ModeResolver,
        ...ModeWorld,
        ...InputIntentResolver,
        ModeComponents,
        BattleDomainOwner,
        ModalWorld,
        RendererSnapshotBoundary,
        InputIntent,
        version: 'ecs-mode-runtime-batch-7a',
      });
      if (typeof globalThis !== 'undefined') {
        globalThis.EcsModeRuntime = EcsModeRuntime;
      }
      module.exports = EcsModeRuntime;
    },
  });
  return require_EcsModeRuntimeEntry();
})();
