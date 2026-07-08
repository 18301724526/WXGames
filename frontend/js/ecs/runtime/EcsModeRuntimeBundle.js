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
      var {
        CAPTURE_PRIORITY,
        MODAL_BIT_BY_KEY,
        MODAL_MODE_KEYS,
        modeIdForKey,
        modeKeyForId,
        normalizeModeKey,
      } = ModeKeys || {};
      var NON_BLOCKING_MODAL_KEYS = Object.freeze(['modal:commandPanel']);
      var BLOCKING_MODAL_KEYS = Object.freeze(
        (MODAL_MODE_KEYS || []).filter((key) => !NON_BLOCKING_MODAL_KEYS.includes(key)),
      );
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
      var ModeKeys = (() => {
        if (typeof __require === 'function') return require_ModeKeys();
        return globalThis.EcsModeKeys;
      })();
      var MODAL_SUBTYPES = ModeKeys.MODAL_MODE_KEYS;
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
        'activeDockItemIds',
        'showTopBarDebugStats',
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
        activeDockItemIds: Object.freeze([]),
        showTopBarDebugStats: false,
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
        schema: 'battle-owner-v1',
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
          const open = Boolean(entry?.open);
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
        if (panelKey === 'activeDockItemIds') {
          return Object.freeze(Array.isArray(value) ? value.map(String) : []);
        }
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

  // frontend/js/ecs/projection/FogProjection.js
  var require_FogProjection = __commonJS({
    'frontend/js/ecs/projection/FogProjection.js'(exports, module) {
      'use strict';
      var SCHEMA = 'fog-projection-v1';
      function cloneArray(value) {
        return Array.isArray(value) ? value.slice() : [];
      }
      function resolveDependency(options = {}, optionKey = '', globalKey = '') {
        if (options.dependencies?.[optionKey]) return options.dependencies[optionKey];
        if (options[optionKey]) return options[optionKey];
        if (typeof globalThis !== 'undefined' && globalThis[globalKey])
          return globalThis[globalKey];
        return null;
      }
      function resolveFogDependencies(options = {}) {
        return {
          visibilityModel: resolveDependency(options, 'visibilityModel', 'WorldMapVisibilityModel'),
          fogVisualSnapshot: resolveDependency(
            options,
            'fogVisualSnapshot',
            'WorldFogVisualSnapshot',
          ),
          worldMarchSystem: resolveDependency(options, 'worldMarchSystem', 'WorldMarchSystem'),
          fogRevealModel: resolveDependency(options, 'fogRevealModel', 'FogRevealModel'),
        };
      }
      function resolveEpochNowMs(input = {}, options = {}) {
        const value =
          options.epochNowMs ?? options.nowMs ?? options.serverNowMs ?? input.epochNowMs;
        const number = Number(value);
        return Number.isFinite(number) ? number : Number.NaN;
      }
      function requireEpochNowMs(input = {}, options = {}) {
        const nowMs = resolveEpochNowMs(input, options);
        if (!Number.isFinite(nowMs)) {
          throw new Error(
            'FogProjection requires a finite epochNowMs (pass options.epochNowMs from WorldClock); fog reveal is a function of time and must never fall back to stale data',
          );
        }
        return nowMs;
      }
      function collectRevealMissions(input = {}) {
        const worldExplorerState =
          input.worldExplorerState || input.state?.worldExplorerState || {};
        const byId = /* @__PURE__ */ new Map();
        const append = (mission) => {
          if (!mission || typeof mission !== 'object') return;
          const id = String(mission.id || mission.missionId || `mission-${byId.size}`);
          byId.set(id, { ...(byId.get(id) || {}), ...mission });
        };
        (Array.isArray(input.tileMapView?.activeScouts)
          ? input.tileMapView.activeScouts
          : []
        ).forEach(append);
        (Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []).forEach(
          append,
        );
        append(worldExplorerState.activeMission);
        (Array.isArray(worldExplorerState.idleMissions)
          ? worldExplorerState.idleMissions
          : []
        ).forEach(append);
        return [...byId.values()];
      }
      function buildVisibilityActors(
        input = {},
        options = {},
        dependencies = resolveFogDependencies(options),
      ) {
        const nowMs = requireEpochNowMs(input, options);
        if (!dependencies.worldMarchSystem?.buildActors) {
          throw new Error(
            'FogProjection requires WorldMarchSystem.buildActors (load WorldMarchSystem.js first); fog actors must be projected fresh, never read from cached render snapshots',
          );
        }
        const worldExplorerState =
          input.worldExplorerState || input.state?.worldExplorerState || {};
        const fromExplorer = dependencies.worldMarchSystem.buildActors(worldExplorerState, {
          nowMs,
        });
        if (Array.isArray(fromExplorer) && fromExplorer.length) return fromExplorer;
        const activeScouts = input.tileMapView?.activeScouts || [];
        const fromTileMap = dependencies.worldMarchSystem.buildActors(
          { missions: activeScouts },
          { nowMs },
        );
        return Array.isArray(fromTileMap) ? fromTileMap : [];
      }
      function buildRevealSnapshot(
        input = {},
        options = {},
        dependencies = resolveFogDependencies(options),
      ) {
        const nowMs = requireEpochNowMs(input, options);
        if (!dependencies.fogRevealModel?.createSnapshot) {
          throw new Error(
            'FogProjection requires FogRevealModel (load FogRevealModel.js first); reveal strength must be projected for the current instant on every frame',
          );
        }
        return dependencies.fogRevealModel.createSnapshot(collectRevealMissions(input), nowMs);
      }
      function buildVisibilitySnapshot(
        input = {},
        options = {},
        dependencies = resolveFogDependencies(options),
      ) {
        if (!dependencies.visibilityModel?.createSnapshot) return null;
        const tileMapView = input.tileMapView || input.renderSnapshot?.tileMapView || {};
        return dependencies.visibilityModel.createSnapshot(
          {
            territoryState: input.territoryState || input.state?.territoryState || {},
            worldMap: {
              ...(input.worldMap || input.state?.territoryState?.worldMap || tileMapView || {}),
              tiles: Array.isArray(input.tiles)
                ? input.tiles
                : Array.isArray(tileMapView.tiles)
                  ? tileMapView.tiles
                  : [],
            },
            worldExplorerState: input.worldExplorerState || input.state?.worldExplorerState || {},
            missions: input.missions,
          },
          options.visibilityOptions || options,
        );
      }
      function createFogProjection(input = {}, options = {}) {
        const dependencies = resolveFogDependencies(options);
        const epochNowMs = requireEpochNowMs(input, options);
        const renderSnapshot = input.renderSnapshot || null;
        const tileMapView = input.tileMapView || renderSnapshot?.tileMapView || {};
        const viewport = input.viewport || renderSnapshot?.viewport || {};
        const frame = input.frame || renderSnapshot?.frame || {};
        const geometry =
          input.geometry ||
          renderSnapshot?.geometry ||
          tileMapView.geometry ||
          viewport.geometry ||
          {};
        const explicitEntries = cloneArray(input.entries);
        const visibilitySnapshot = buildVisibilitySnapshot(
          {
            ...input,
            tileMapView,
            renderSnapshot,
          },
          options,
          dependencies,
        );
        const visibilityActors = buildVisibilityActors(
          {
            ...input,
            tileMapView,
            renderSnapshot,
          },
          options,
          dependencies,
        );
        const revealSnapshot = buildRevealSnapshot(
          {
            ...input,
            tileMapView,
            renderSnapshot,
          },
          options,
          dependencies,
        );
        const fogVisualSnapshot = dependencies.fogVisualSnapshot?.createSnapshot
          ? dependencies.fogVisualSnapshot.createSnapshot(
              {
                ...input,
                tileMapView,
                viewport,
                frame,
                geometry,
                renderSnapshot,
                visibilitySnapshot,
              },
              options,
            )
          : null;
        const rendererContext =
          fogVisualSnapshot && dependencies.fogVisualSnapshot?.toRendererContext
            ? dependencies.fogVisualSnapshot.toRendererContext(fogVisualSnapshot, options)
            : null;
        const projection = Object.freeze({
          schema: SCHEMA,
          epochNowMs,
          visibilitySnapshot,
          fogVisualSnapshot,
          revealSnapshot,
          rendererContext: rendererContext
            ? Object.freeze({
                ...rendererContext,
                entries: explicitEntries.length
                  ? explicitEntries
                  : cloneArray(rendererContext.entries),
                geometry,
                renderSnapshot,
                epochNowMs,
                actors: cloneArray(input.actors),
                visibilityActors,
                revealSnapshot,
                tileMapView: {
                  ...(rendererContext.tileMapView || {}),
                  sites: Array.isArray(tileMapView.sites)
                    ? tileMapView.sites
                    : Array.isArray(rendererContext.tileMapView?.sites)
                      ? rendererContext.tileMapView.sites
                      : [],
                },
              })
            : null,
          signature: [
            fogVisualSnapshot?.signature || '',
            visibilitySnapshot?.signature || '',
            revealSnapshot?.signature || '',
            visibilityActors.length,
            explicitEntries.length || rendererContext?.entries?.length || 0,
          ].join(':'),
        });
        globalThis.WorldMarchTrace?.logDedup?.('fog:projection', {
          epochNowMs,
          signature: projection.signature,
          actors: visibilityActors.length,
          revealSources: revealSnapshot?.q?.length || 0,
        });
        return projection;
      }
      var api = Object.freeze({
        SCHEMA,
        createFogProjection,
        resolveFogDependencies,
      });
      if (typeof globalThis !== 'undefined') globalThis.EcsFogProjection = api;
      if (typeof module !== 'undefined' && module.exports) module.exports = api;
    },
  });

  // frontend/js/shared/SignatureHash.js
  var require_SignatureHash = __commonJS({
    'frontend/js/shared/SignatureHash.js'(exports, module) {
      (function (global) {
        const FNV_OFFSET_BASIS = 2166136261;
        const FNV_PRIME = 16777619;
        function foldString(hash, text) {
          let next = hash >>> 0;
          for (let i = 0; i < text.length; i += 1) {
            next ^= text.charCodeAt(i);
            next = Math.imul(next, FNV_PRIME);
          }
          return next >>> 0;
        }
        function hashStep(hash, value) {
          return foldString(hash, String(value ?? ''));
        }
        function hashString(input) {
          return foldString(FNV_OFFSET_BASIS, String(input));
        }
        function hashText(value) {
          return foldString(FNV_OFFSET_BASIS, String(value || ''));
        }
        const api = {
          FNV_OFFSET_BASIS,
          FNV_PRIME,
          foldString,
          hashStep,
          hashString,
          hashText,
        };
        global.SignatureHash = api;
        if (typeof module !== 'undefined' && module.exports) module.exports = api;
      })(typeof window !== 'undefined' ? window : globalThis);
    },
  });

  // frontend/js/ecs/foundation/TileCoord.js
  var require_TileCoord = __commonJS({
    'frontend/js/ecs/foundation/TileCoord.js'(exports, module) {
      (function (global) {
        function toNumber(value, fallback = 0) {
          const number = Number(value);
          return Number.isFinite(number) ? number : fallback;
        }
        function toInteger(value, fallback = 0) {
          const number = toNumber(value, fallback);
          return Number.isFinite(number) ? Math.floor(number) : fallback;
        }
        function tileId(x, y) {
          return `tile_${toInteger(x)}_${toInteger(y)}`;
        }
        function readCoordAxis(source = {}, primaryKey = 'x', aliasKey = 'q', fallback = 0) {
          return toInteger(
            source[primaryKey] !== void 0 ? source[primaryKey] : source[aliasKey],
            fallback,
          );
        }
        function normalizeCoord(source = {}, fallback = {}, options = {}) {
          const fallbackX = readCoordAxis(fallback, 'x', 'q', 0);
          const fallbackY = readCoordAxis(fallback, 'y', 'r', 0);
          const x = readCoordAxis(source, 'x', 'q', fallbackX);
          const y = readCoordAxis(source, 'y', 'r', fallbackY);
          const id = options.preserveTileId
            ? String(source.tileId || source.id || tileId(x, y))
            : tileId(x, y);
          return Object.freeze({
            x,
            y,
            q: x,
            r: y,
            tileId: id,
          });
        }
        function normalizeDelta(delta = {}) {
          return Object.freeze({
            x: readCoordAxis(delta, 'x', 'q', 0),
            y: readCoordAxis(delta, 'y', 'r', 0),
          });
        }
        function offset(coord = {}, delta = {}, options = {}) {
          const source = normalizeCoord(coord);
          const step = normalizeDelta(delta);
          return normalizeCoord(
            {
              x: source.x + step.x,
              y: source.y + step.y,
            },
            {},
            options,
          );
        }
        function equals(left = {}, right = {}) {
          const a = normalizeCoord(left);
          const b = normalizeCoord(right);
          return a.x === b.x && a.y === b.y;
        }
        function toAxial(coord = {}) {
          const normalized = normalizeCoord(coord);
          return Object.freeze({
            q: normalized.x,
            r: normalized.y,
            tileId: normalized.tileId,
          });
        }
        const TileCoord = Object.freeze({
          equals,
          normalizeCoord,
          normalizeDelta,
          offset,
          readCoordAxis,
          tileId,
          toAxial,
          toInteger,
          toNumber,
        });
        global.TileCoord = TileCoord;
        if (typeof module !== 'undefined' && module.exports) module.exports = TileCoord;
      })(typeof globalThis !== 'undefined' ? globalThis : window);
    },
  });

  // shared/worldMarchCore.js
  var require_worldMarchCore = __commonJS({
    'shared/worldMarchCore.js'(exports, module) {
      (function (global) {
        const STATUS_ACTIVE = 'active';
        const STATUS_READY = 'ready';
        const STATUS_IDLE = 'idle';
        const STATUS_CANCELLED = 'cancelled';
        const ARRIVAL_NONE = 'none';
        const ARRIVAL_IDLE = 'idle';
        const FINISHED_STATUSES = Object.freeze([STATUS_READY, STATUS_IDLE, STATUS_CANCELLED]);
        const MAX_MANUAL_ROUTE_LENGTH = 16;
        const MARCH_BLOCKED_TERRAINS = Object.freeze(['ocean', 'river']);
        const EPOCH_MILLISECONDS_THRESHOLD = 1e12;
        function toNumber(value, fallback = 0) {
          const number = Number(value);
          return Number.isFinite(number) ? number : fallback;
        }
        function isMarchBlockedTerrain(terrain) {
          return MARCH_BLOCKED_TERRAINS.includes(String(terrain));
        }
        function toInteger(value, fallback = 0) {
          const number = toNumber(value, fallback);
          return Number.isFinite(number) ? Math.floor(number) : fallback;
        }
        function toTimestamp(value, fallback = 0) {
          if (value === null || value === void 0 || value === '') return fallback;
          if (value instanceof Date) {
            const stamp2 = value.getTime();
            return Number.isFinite(stamp2) ? stamp2 : fallback;
          }
          if (
            typeof value === 'number' ||
            (typeof value === 'string' &&
              value.trim() !== '' &&
              /^-?\d+(\.\d+)?$/.test(value.trim()))
          ) {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallback;
            return Math.abs(number) < EPOCH_MILLISECONDS_THRESHOLD ? number * 1e3 : number;
          }
          const stamp = Date.parse(value);
          return Number.isFinite(stamp) ? stamp : fallback;
        }
        function tileId(q, r) {
          return `tile_${toInteger(q)}_${toInteger(r)}`;
        }
        function normalizeCoord(coord = {}, fallback = {}) {
          const source = coord && typeof coord === 'object' ? coord : {};
          const base = fallback && typeof fallback === 'object' ? fallback : {};
          const q = toInteger(source.x ?? source.q, base.x ?? base.q ?? 0);
          const r = toInteger(source.y ?? source.r, base.y ?? base.r ?? 0);
          return {
            q,
            r,
            tileId: tileId(q, r),
          };
        }
        function normalizeRoute(route = []) {
          return (Array.isArray(route) ? route : [])
            .map((step, index) => {
              if (!step || typeof step !== 'object') return null;
              return {
                ...normalizeCoord(step),
                step: Math.max(1, toInteger(step.step, index + 1)),
                revealed: Boolean(step.revealed),
                routeRevealedExplicit: Object.prototype.hasOwnProperty.call(step, 'revealed'),
                revealedAt: step.revealedAt || null,
              };
            })
            .filter(Boolean)
            .sort((a, b) => a.step - b.step);
        }
        function getWrappedDelta(from = {}, to = {}, options = {}) {
          const start = normalizeCoord(from);
          const end = normalizeCoord(to, start);
          const width = toInteger(options.width ?? options.worldWidth, 0);
          const height = toInteger(options.height ?? options.worldHeight, 0);
          const wrapping = options.wrapping !== false;
          const wrapAxis = (delta, size) => {
            if (!wrapping || size <= 0 || Math.abs(delta) <= size / 2) return delta;
            const wrapped = delta > 0 ? delta - size : delta + size;
            return Math.abs(wrapped) < Math.abs(delta) ? wrapped : delta;
          };
          return {
            q: wrapAxis(end.q - start.q, width),
            r: wrapAxis(end.r - start.r, height),
          };
        }
        function buildLinearMarchRoute(origin = {}, target = {}, options = {}) {
          const start = normalizeCoord(origin);
          const end = normalizeCoord(target, start);
          const delta = getWrappedDelta(start, end, options);
          const distance = Math.max(Math.abs(delta.q), Math.abs(delta.r));
          const maxLength = toInteger(options.maxLength ?? options.maxManualRouteLength, 0);
          if (distance <= 0) {
            return { success: false, error: 'EXPLORE_TARGET_IS_ORIGIN', route: [], target: end };
          }
          if (maxLength > 0 && distance > maxLength) {
            return { success: false, error: 'EXPLORE_TARGET_TOO_FAR', route: [], target: end };
          }
          const route = [];
          let q = start.q;
          let r = start.r;
          let remainingQ = delta.q;
          let remainingR = delta.r;
          for (let step = 1; step <= distance; step += 1) {
            const stepQ = Math.sign(remainingQ);
            const stepR = Math.sign(remainingR);
            q += stepQ;
            r += stepR;
            remainingQ -= stepQ;
            remainingR -= stepR;
            const coord = normalizeCoord({ q, r });
            route.push({
              q: coord.q,
              r: coord.r,
              step,
              tileId: coord.tileId,
            });
          }
          const routeTarget = route.at(-1) || end;
          return {
            success: true,
            route,
            target: normalizeCoord(routeTarget, end),
            distance,
          };
        }
        function axisStepDir(dq, dr) {
          if (dr < 0) return '1';
          if (dq < 0) return '2';
          if (dq > 0) return '3';
          if (dr > 0) return '4';
          return '';
        }
        function buildAxisAlignedRoute(origin = {}, target = {}, options = {}) {
          const start = normalizeCoord(origin);
          const end = normalizeCoord(target, start);
          const delta = getWrappedDelta(start, end, options);
          const distance = Math.abs(delta.q) + Math.abs(delta.r);
          const maxLength = toInteger(options.maxLength ?? options.maxManualRouteLength, 0);
          if (distance <= 0) {
            return { success: false, error: 'EXPLORE_TARGET_IS_ORIGIN', route: [], target: end };
          }
          if (maxLength > 0 && distance > maxLength) {
            return { success: false, error: 'EXPLORE_TARGET_TOO_FAR', route: [], target: end };
          }
          const route = [];
          let q = start.q;
          let r = start.r;
          let remainingQ = delta.q;
          let remainingR = delta.r;
          for (let step = 1; step <= distance; step += 1) {
            let stepQ = 0;
            let stepR = 0;
            if (Math.abs(remainingQ) >= Math.abs(remainingR) && remainingQ !== 0) {
              stepQ = Math.sign(remainingQ);
            } else if (remainingR !== 0) {
              stepR = Math.sign(remainingR);
            } else {
              stepQ = Math.sign(remainingQ);
            }
            q += stepQ;
            r += stepR;
            remainingQ -= stepQ;
            remainingR -= stepR;
            const coord = normalizeCoord({ q, r });
            route.push({
              q: coord.q,
              r: coord.r,
              step,
              tileId: coord.tileId,
              dir: axisStepDir(stepQ, stepR),
            });
          }
          const routeTarget = route.at(-1) || end;
          return {
            success: true,
            route,
            target: normalizeCoord(routeTarget, end),
            distance,
          };
        }
        function evaluateLinearMarchRoute(origin = {}, target = {}, options = {}) {
          const plan = options.axisAligned
            ? buildAxisAlignedRoute(origin, target, options)
            : buildLinearMarchRoute(origin, target, options);
          if (!plan.success) return plan;
          const canTraverse =
            typeof options.canTraverse === 'function' ? options.canTraverse : () => true;
          for (const step of plan.route) {
            if (!canTraverse(step)) {
              return {
                success: false,
                error: 'EXPLORE_ROUTE_BLOCKED',
                blockedStep: step,
                route: plan.route.slice(0, Math.max(0, step.step - 1)),
                target: plan.target,
              };
            }
          }
          return plan;
        }
        function hasCoordPair(source = {}) {
          if (!source || typeof source !== 'object') return false;
          const hasX = source.x !== void 0 || source.q !== void 0;
          const hasY = source.y !== void 0 || source.r !== void 0;
          return hasX && hasY;
        }
        function addTileAlias(aliases, value, canonicalId) {
          if (!value || !canonicalId) return;
          const alias = String(value);
          const ids = aliases.get(alias) || /* @__PURE__ */ new Set();
          ids.add(String(canonicalId));
          aliases.set(alias, ids);
        }
        function createRouteTileAliasMap(route = []) {
          const aliases = /* @__PURE__ */ new Map();
          (Array.isArray(route) ? route : []).forEach((step) => {
            if (!hasCoordPair(step)) return;
            const normalized = normalizeCoord(step);
            addTileAlias(aliases, normalized.tileId, normalized.tileId);
            addTileAlias(aliases, step.tileId, normalized.tileId);
            addTileAlias(aliases, step.id, normalized.tileId);
          });
          return aliases;
        }
        function getMissionPath(mission = {}) {
          const origin = normalizeCoord(mission.origin || mission.position || {});
          const route = normalizeRoute(mission.route);
          if (!route.length && mission.status === STATUS_IDLE) {
            return [
              origin,
              normalizeCoord(mission.position || mission.target || mission.origin || {}, origin),
            ];
          }
          return [origin, ...route];
        }
        function getMissionStepDurationMs(mission = {}) {
          const fromMs = toInteger(mission.stepDurationMs, 0);
          if (fromMs > 0) return Math.max(1e3, fromMs);
          return Math.max(1e3, Math.floor(toNumber(mission.stepDurationSeconds, 10) * 1e3));
        }
        function getMissionDurationMs(mission = {}) {
          const route = normalizeRoute(mission.route);
          const stepDurationMs = getMissionStepDurationMs(mission);
          return Math.max(stepDurationMs, route.length * stepDurationMs);
        }
        function isFinishedStatus(status = '') {
          return FINISHED_STATUSES.includes(status);
        }
        function clampUnit(value) {
          return Math.max(0, Math.min(1, toNumber(value)));
        }
        function getMissionProgress(mission = {}, nowMs = 0) {
          const route = normalizeRoute(mission.route);
          if (!route.length) {
            return {
              progress: 0,
              segmentIndex: 0,
              segmentProgress: 0,
              elapsedMs: 0,
              durationMs: 0,
            };
          }
          const durationMs = getMissionDurationMs(mission);
          if (isFinishedStatus(mission.status)) {
            return {
              progress: 1,
              segmentIndex: Math.max(0, route.length - 1),
              segmentProgress: 1,
              elapsedMs: durationMs,
              durationMs,
            };
          }
          const resolvedNowMs = toNumber(nowMs, 0);
          const startedAtMs = toTimestamp(mission.startedAt, resolvedNowMs);
          const elapsedMs = Math.max(0, resolvedNowMs - startedAtMs);
          const progress = clampUnit(elapsedMs / durationMs);
          const scaled = progress * route.length;
          const segmentIndex = Math.min(Math.max(0, route.length - 1), Math.floor(scaled));
          const segmentProgress = progress >= 1 ? 1 : clampUnit(scaled - segmentIndex);
          return { progress, segmentIndex, segmentProgress, elapsedMs, durationMs };
        }
        function isExpiredActiveMission(mission = {}, nowMs = 0) {
          if (!mission || mission.status !== STATUS_ACTIVE) return false;
          const completesAtMs = toTimestamp(mission.completesAt, Number.NaN);
          return Number.isFinite(completesAtMs) && completesAtMs <= toNumber(nowMs, 0);
        }
        function getEffectiveMissionStatus(mission = {}, nowMs = 0) {
          if (isExpiredActiveMission(mission, nowMs)) return STATUS_IDLE;
          return mission.status || '';
        }
        function getArrivalKind(status = '') {
          if (status === STATUS_IDLE) return ARRIVAL_IDLE;
          return ARRIVAL_NONE;
        }
        function getRouteStepRevealTimeMs(mission = {}, step = {}) {
          const startedAtMs = toTimestamp(mission.startedAt, Number.NaN);
          if (!Number.isFinite(startedAtMs)) return Number.NaN;
          const stepIndex = Math.max(1, toInteger(step.step, 1));
          return startedAtMs + getMissionStepDurationMs(mission) * stepIndex;
        }
        function isRouteStepTimeRevealed(mission = {}, step = {}, nowMs = 0) {
          const revealAtMs = getRouteStepRevealTimeMs(mission, step);
          return Number.isFinite(revealAtMs) && revealAtMs <= toNumber(nowMs, 0);
        }
        function createRevealedTileSet(mission = {}) {
          const routeAliases = createRouteTileAliasMap(mission.route);
          const revealed = /* @__PURE__ */ new Set();
          (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [])
            .filter(Boolean)
            .forEach((id) => {
              const aliases = routeAliases.get(String(id));
              if (aliases) {
                aliases.forEach((canonicalId) => revealed.add(canonicalId));
                return;
              }
              revealed.add(String(id));
            });
          return revealed;
        }
        function isRouteStepRevealed(mission = {}, step = {}, nowMs = 0, revealedTileIds = null) {
          if (!step) return false;
          if (step.revealed) return true;
          const status = getEffectiveMissionStatus(mission, nowMs);
          if (isFinishedStatus(status)) return true;
          if (mission.status === STATUS_ACTIVE && isRouteStepTimeRevealed(mission, step, nowMs))
            return true;
          if (step.routeRevealedExplicit) return false;
          const id = step.tileId || tileId(step.q, step.r);
          const revealedSet = revealedTileIds || createRevealedTileSet(mission);
          if (revealedSet.has(id)) return true;
          if (mission.status !== STATUS_ACTIVE) return false;
          return false;
        }
        function getRemainingSeconds(mission = {}, nowMs = 0) {
          if (!mission || isFinishedStatus(mission.status)) return 0;
          const resolvedNowMs = toNumber(nowMs, 0);
          const nextStepAtMs = toTimestamp(mission.nextStepAt, Number.NaN);
          if (Number.isFinite(nextStepAtMs))
            return Math.max(0, Math.ceil((nextStepAtMs - resolvedNowMs) / 1e3));
          const completesAtMs = toTimestamp(mission.completesAt, Number.NaN);
          if (Number.isFinite(completesAtMs))
            return Math.max(0, Math.ceil((completesAtMs - resolvedNowMs) / 1e3));
          const progress = getMissionProgress(mission, resolvedNowMs);
          return Math.max(0, Math.ceil((progress.durationMs - progress.elapsedMs) / 1e3));
        }
        function getTravelRemainingSeconds(mission = {}, nowMs = 0) {
          if (!mission || isFinishedStatus(mission.status)) return 0;
          const progress = getMissionProgress(mission, nowMs);
          return Math.max(0, Math.ceil((progress.durationMs - progress.elapsedMs) / 1e3));
        }
        function deriveMissionForTime(mission = {}, options = {}) {
          if (!mission || typeof mission !== 'object') return null;
          const nowMs = toNumber(options.nowMs, 0);
          const route = normalizeRoute(mission.route);
          const revealedSet = createRevealedTileSet(mission);
          const revealedRoute = route.map((step) => {
            const revealed = isRouteStepRevealed(mission, step, nowMs, revealedSet);
            const revealAtMs = getRouteStepRevealTimeMs(mission, step);
            return {
              ...step,
              revealed,
              revealedAt: step.revealedAt || null,
              revealedAtMs: revealed
                ? Number.isFinite(revealAtMs)
                  ? revealAtMs
                  : nowMs
                : Number.NaN,
            };
          });
          const revealedTileIds = Array.from(
            /* @__PURE__ */ new Set([
              ...revealedSet,
              ...revealedRoute
                .filter((step) => step.revealed)
                .map((step) => step.tileId || tileId(step.q, step.r)),
            ]),
          );
          const status = getEffectiveMissionStatus(mission, nowMs);
          const lastRevealed = [...revealedRoute].reverse().find((step) => step.revealed) || null;
          const nextUnrevealed = revealedRoute.find((step) => !step.revealed) || null;
          const nextStepAtMs = nextUnrevealed
            ? getRouteStepRevealTimeMs(mission, nextUnrevealed)
            : Number.NaN;
          const nextStepAt = mission.nextStepAt || null;
          const routeTarget = route.length ? route[route.length - 1] : null;
          const target = normalizeCoord(
            mission.target || routeTarget,
            routeTarget || mission.position || mission.origin || {},
          );
          const positionSource =
            status === STATUS_IDLE
              ? mission.status === STATUS_IDLE
                ? mission.position || target
                : target
              : lastRevealed || mission.position || mission.origin || target;
          const derived = {
            ...mission,
            status,
            route: revealedRoute,
            revealedTileIds,
            position: normalizeCoord(positionSource, target),
            nextStepAt,
            nextStepAtMs:
              Number.isFinite(nextStepAtMs) && status === STATUS_ACTIVE ? nextStepAtMs : Number.NaN,
          };
          return {
            ...derived,
            remainingSeconds: getRemainingSeconds(derived, nowMs),
          };
        }
        function lerp(a, b, t) {
          return toNumber(a) + (toNumber(b) - toNumber(a)) * clampUnit(t);
        }
        function getCurrentCoord(mission = {}, nowMs = 0) {
          const path = getMissionPath(mission);
          if (path.length <= 1) return path[0] || normalizeCoord({});
          const progress = getMissionProgress(mission, nowMs);
          const from = path[progress.segmentIndex] || path[0];
          const to = path[progress.segmentIndex + 1] || path[path.length - 1];
          return {
            q: lerp(from.q, to.q, progress.segmentProgress),
            r: lerp(from.r, to.r, progress.segmentProgress),
            fromTileId: from.tileId,
            toTileId: to.tileId,
            segmentIndex: progress.segmentIndex,
            segmentProgress: progress.segmentProgress,
            progress: progress.progress,
          };
        }
        function getRouteRenderAheadTileId(mission = {}, nowMs = 0) {
          if (!mission || mission.status !== STATUS_ACTIVE) return null;
          const route = normalizeRoute(mission.route);
          if (!route.length) return null;
          const progress = getMissionProgress(mission, nowMs);
          const step = route[Math.max(0, Math.min(route.length - 1, progress.segmentIndex))];
          return step?.tileId || null;
        }
        function getRouteRenderReadyTileIds(mission = {}, nowMs = 0) {
          return getRouteRenderRevealSources(mission, nowMs)
            .filter((source) => clampUnit(source.strength) > 0)
            .map((source) => source.tileId)
            .filter(Boolean);
        }
        function appendRouteRevealSource(
          sources = [],
          coord = {},
          strength = 1,
          source = 'routeHistory',
        ) {
          const normalized = normalizeCoord(coord);
          if (!normalized.tileId) return sources;
          const nextStrength = clampUnit(strength);
          const existing = sources.find((item) => item.tileId === normalized.tileId);
          if (existing) {
            existing.strength = Math.max(existing.strength, nextStrength);
            return sources;
          }
          sources.push({
            q: normalized.q,
            r: normalized.r,
            tileId: normalized.tileId,
            strength: nextStrength,
            source,
          });
          return sources;
        }
        function getRouteRenderRevealSources(mission = {}, nowMs = 0) {
          if (!mission) return [];
          const route = normalizeRoute(mission.route);
          const revealedSet = createRevealedTileSet(mission);
          const sources = [];
          route.forEach((step) => {
            if (step.revealed || revealedSet.has(step.tileId))
              appendRouteRevealSource(sources, step, 1, 'backendReveal');
          });
          if (mission.status !== STATUS_ACTIVE) return sources;
          if (!route.length) return sources;
          const progress = getMissionProgress(mission, nowMs);
          const completedCount = Math.max(0, Math.min(route.length, progress.segmentIndex));
          route
            .slice(0, completedCount)
            .forEach((step) => appendRouteRevealSource(sources, step, 1));
          const frontierStep = route[progress.segmentIndex];
          const frontierStrength = clampUnit(progress.segmentProgress);
          if (frontierStep && frontierStrength > 0) {
            appendRouteRevealSource(
              sources,
              frontierStep,
              frontierStrength,
              frontierStrength >= 1 ? 'routeHistory' : 'routeFrontier',
            );
          }
          return sources;
        }
        function getRouteRenderRevealSignature(mission = {}, nowMs = 0) {
          const progress = getMissionProgress(mission, nowMs);
          const sources = getRouteRenderRevealSources(mission, nowMs);
          let hash = 2166136261;
          sources.forEach((source) => {
            const text = [source.tileId || '', Math.round(clampUnit(source.strength) * 1e3)].join(
              ':',
            );
            for (let index = 0; index < text.length; index += 1) {
              hash ^= text.charCodeAt(index);
              hash = Math.imul(hash, 16777619);
            }
          });
          return [
            sources.length,
            progress.segmentIndex,
            Math.round(progress.segmentProgress * 1e3),
            (hash >>> 0).toString(36),
          ].join(':');
        }
        function chooseStopTile(mission = {}, nowMs = 0) {
          const path = getMissionPath(mission);
          if (path.length <= 1) return path[0] || normalizeCoord({});
          const progress = getMissionProgress(mission, nowMs);
          const from = path[progress.segmentIndex] || path[0];
          const to = path[progress.segmentIndex + 1] || path[path.length - 1];
          return normalizeCoord(progress.segmentProgress >= 0.5 ? to : from);
        }
        function getConfirmedPosition(mission = {}) {
          const route = normalizeRoute(mission.route);
          const lastRevealed = [...route].reverse().find((step) => step.revealed);
          return normalizeCoord(mission.position || lastRevealed || mission.origin || {});
        }
        function computeMarchState(missionParams = {}, nowMs = 0) {
          const mission = deriveMissionForTime(missionParams, { nowMs }) || {};
          return {
            position: normalizeCoord(
              getCurrentCoord(mission, nowMs),
              mission.position || mission.target || mission.origin || {},
            ),
            revealedTileIds: Array.isArray(mission.revealedTileIds)
              ? mission.revealedTileIds.slice()
              : [],
            route: Array.isArray(mission.route) ? mission.route.slice() : [],
            status: mission.status || '',
            progress: getMissionProgress(mission, nowMs),
            current: getCurrentCoord(mission, nowMs),
            stopTile: chooseStopTile(mission, nowMs),
            renderAheadTileId: getRouteRenderAheadTileId(mission, nowMs),
            renderReadyTileIds: getRouteRenderReadyTileIds(mission, nowMs),
            renderRevealSources: getRouteRenderRevealSources(mission, nowMs),
            renderRevealSignature: getRouteRenderRevealSignature(mission, nowMs),
            remainingSeconds: getRemainingSeconds(mission, nowMs),
            travelRemainingSeconds: getTravelRemainingSeconds(mission, nowMs),
          };
        }
        const WorldMarchCore = {
          STATUS_ACTIVE,
          STATUS_READY,
          STATUS_IDLE,
          STATUS_CANCELLED,
          ARRIVAL_NONE,
          ARRIVAL_IDLE,
          FINISHED_STATUSES,
          MAX_MANUAL_ROUTE_LENGTH,
          MARCH_BLOCKED_TERRAINS,
          toNumber,
          isMarchBlockedTerrain,
          toInteger,
          toTimestamp,
          tileId,
          normalizeCoord,
          normalizeRoute,
          getWrappedDelta,
          buildLinearMarchRoute,
          buildAxisAlignedRoute,
          axisStepDir,
          evaluateLinearMarchRoute,
          getMissionPath,
          getMissionDurationMs,
          getMissionStepDurationMs,
          getMissionProgress,
          isExpiredActiveMission,
          getEffectiveMissionStatus,
          getArrivalKind,
          getRouteStepRevealTimeMs,
          isRouteStepTimeRevealed,
          isRouteStepRevealed,
          deriveMissionForTime,
          getCurrentCoord,
          getRouteRenderAheadTileId,
          getRouteRenderReadyTileIds,
          getRouteRenderRevealSources,
          getRouteRenderRevealSignature,
          chooseStopTile,
          getConfirmedPosition,
          getRemainingSeconds,
          getTravelRemainingSeconds,
          computeMarchState,
        };
        if (typeof module !== 'undefined' && module.exports) {
          module.exports = WorldMarchCore;
        } else {
          global.WorldMarchCore = WorldMarchCore;
        }
      })(globalThis);
    },
  });

  // frontend/js/ecs/system/FogRevealModel.js
  var require_FogRevealModel = __commonJS({
    'frontend/js/ecs/system/FogRevealModel.js'(exports, module) {
      (function (global) {
        const EcsCoreBoundary = (() => {
          if (global.EcsCoreBoundary) return global.EcsCoreBoundary;
          if (typeof module !== 'undefined' && module.exports) {
            try {
              return require_EcsCoreBoundary();
            } catch (_error) {
              return null;
            }
          }
          return null;
        })();
        if (!EcsCoreBoundary) {
          throw new Error('FogRevealModel requires EcsCoreBoundary and bitecs primitives');
        }
        const {
          Types,
          addComponent,
          addEntity,
          createWorld,
          defineComponent,
          defineQuery,
          removeEntity,
        } = EcsCoreBoundary;
        if (
          !Types ||
          !defineComponent ||
          !defineQuery ||
          !createWorld ||
          !addEntity ||
          !addComponent ||
          !removeEntity
        ) {
          throw new Error('FogRevealModel requires the approved BitECS primitive surface');
        }
        const SignatureHash = (() => {
          if (global.SignatureHash) return global.SignatureHash;
          if (typeof module !== 'undefined' && module.exports) {
            try {
              return require_SignatureHash();
            } catch (_error) {
              return null;
            }
          }
          return null;
        })();
        const TileCoord = (() => {
          if (global.TileCoord) return global.TileCoord;
          if (typeof module !== 'undefined' && module.exports) {
            try {
              return require_TileCoord();
            } catch (_error) {
              return null;
            }
          }
          return null;
        })();
        if (!SignatureHash || !TileCoord) {
          throw new Error('FogRevealModel requires SignatureHash and TileCoord');
        }
        const SCHEMA = 'world-fog-reveal-v1';
        const SOURCE_KINDS = Object.freeze(['backendReveal', 'routeHistory', 'routeFrontier']);
        const KIND_INDEX = Object.freeze(
          SOURCE_KINDS.reduce((map, kind, index) => ({ ...map, [kind]: index }), {}),
        );
        const FogRevealSource = defineComponent({
          q: Types.f32,
          r: Types.f32,
          strength: Types.f32,
          kind: Types.ui8,
          missionIndex: Types.ui16,
        });
        const revealQuery = defineQuery([FogRevealSource]);
        function resolveWorldMarchCore() {
          if (global.WorldMarchCore?.getRouteRenderRevealSources) return global.WorldMarchCore;
          if (typeof module !== 'undefined' && module.exports) {
            try {
              return require_worldMarchCore();
            } catch (_error) {
              return null;
            }
          }
          return null;
        }
        function requireFiniteNowMs(nowMs, caller = 'FogRevealModel') {
          const value = Number(nowMs);
          if (!Number.isFinite(value)) {
            throw new Error(
              `${caller} requires a finite nowMs (pass epochNowMs from WorldClock); reveal strength is a function of time and must never be read from stale data`,
            );
          }
          return value;
        }
        function createRevealWorld() {
          return {
            world: createWorld(),
            order: [],
            missionIds: [],
          };
        }
        let sharedRevealWorld = null;
        function getSharedRevealWorld() {
          if (!sharedRevealWorld) sharedRevealWorld = createRevealWorld();
          return sharedRevealWorld;
        }
        function resetRevealWorld(revealWorld) {
          const matches = revealQuery(revealWorld.world);
          const eids = Array.from(matches);
          for (let i = 0; i < eids.length; i += 1) removeEntity(revealWorld.world, eids[i]);
          revealWorld.order = [];
          revealWorld.missionIds = [];
          return revealWorld;
        }
        function normalizeMissionList(missions = []) {
          if (Array.isArray(missions)) return missions.filter((m) => m && typeof m === 'object');
          if (missions && typeof missions === 'object') return [missions];
          return [];
        }
        function runRevealSystem(revealWorld, missions = [], nowMs = Number.NaN) {
          const instant = requireFiniteNowMs(nowMs, 'FogRevealModel.runRevealSystem');
          const core = resolveWorldMarchCore();
          if (!core) {
            throw new Error(
              'FogRevealModel requires WorldMarchCore (load shared/worldMarchCore.js first)',
            );
          }
          resetRevealWorld(revealWorld);
          normalizeMissionList(missions).forEach((mission) => {
            const missionId = String(mission.id || mission.missionId || '');
            const missionIndex = revealWorld.missionIds.length;
            revealWorld.missionIds.push(missionId);
            const sources = core.getRouteRenderRevealSources(mission, instant);
            (Array.isArray(sources) ? sources : []).forEach((source) => {
              const eid = addEntity(revealWorld.world);
              addComponent(revealWorld.world, FogRevealSource, eid);
              FogRevealSource.q[eid] = Number(source.q) || 0;
              FogRevealSource.r[eid] = Number(source.r) || 0;
              FogRevealSource.strength[eid] = Math.max(
                0,
                Math.min(1, Number(source.strength) || 0),
              );
              FogRevealSource.kind[eid] = KIND_INDEX[source.source] ?? KIND_INDEX.routeHistory;
              FogRevealSource.missionIndex[eid] = missionIndex;
              revealWorld.order.push(eid);
            });
          });
          return revealWorld;
        }
        function getRevealSnapshot(revealWorld, nowMs = Number.NaN) {
          const instant = requireFiniteNowMs(nowMs, 'FogRevealModel.getRevealSnapshot');
          const q = [];
          const r = [];
          const tileIds = [];
          const strength = [];
          const kinds = [];
          const missionIndex = [];
          let hash = SignatureHash.FNV_OFFSET_BASIS;
          for (let i = 0; i < revealWorld.order.length; i += 1) {
            const eid = revealWorld.order[i];
            const sq = FogRevealSource.q[eid];
            const sr = FogRevealSource.r[eid];
            const sStrength = FogRevealSource.strength[eid];
            const kind = SOURCE_KINDS[FogRevealSource.kind[eid]] || 'routeHistory';
            const index = FogRevealSource.missionIndex[eid];
            q.push(sq);
            r.push(sr);
            tileIds.push(TileCoord.tileId(Math.round(sq), Math.round(sr)));
            strength.push(sStrength);
            kinds.push(kind);
            missionIndex.push(index);
            hash = SignatureHash.hashStep(
              hash,
              [
                revealWorld.missionIds[index] || '',
                tileIds[i],
                Math.round(sStrength * 1e3),
                kind,
              ].join(':'),
            );
          }
          return Object.freeze({
            schema: SCHEMA,
            nowMs: instant,
            missionIds: [...revealWorld.missionIds],
            q,
            r,
            tileIds,
            strength,
            kinds,
            missionIndex,
            signature: `${q.length}:${(hash >>> 0).toString(36)}`,
          });
        }
        function getMissionRevealSources(snapshot = {}, missionId = '') {
          const id = String(missionId || '');
          const index = Array.isArray(snapshot.missionIds) ? snapshot.missionIds.indexOf(id) : -1;
          if (index < 0) return [];
          const sources = [];
          for (let i = 0; i < (snapshot.missionIndex?.length || 0); i += 1) {
            if (snapshot.missionIndex[i] !== index) continue;
            sources.push({
              q: snapshot.q[i],
              r: snapshot.r[i],
              tileId: snapshot.tileIds[i],
              strength: snapshot.strength[i],
              source: snapshot.kinds[i],
            });
          }
          return sources;
        }
        function createSnapshot(missions = [], nowMs = Number.NaN) {
          const instant = requireFiniteNowMs(nowMs, 'FogRevealModel.createSnapshot');
          const revealWorld = getSharedRevealWorld();
          runRevealSystem(revealWorld, missions, instant);
          const snapshot = getRevealSnapshot(revealWorld, instant);
          global.WorldMarchTrace?.logDedup?.('fog:reveal', {
            missions: snapshot.missionIds.length,
            sources: snapshot.q.length,
            signature: snapshot.signature,
          });
          return snapshot;
        }
        const api = {
          SCHEMA,
          SOURCE_KINDS,
          FogRevealSource,
          revealQuery,
          createRevealWorld,
          runRevealSystem,
          getRevealSnapshot,
          getMissionRevealSources,
          createSnapshot,
        };
        global.FogRevealModel = api;
        if (typeof module !== 'undefined' && module.exports) module.exports = api;
      })(typeof window !== 'undefined' ? window : globalThis);
    },
  });

  // frontend/js/ecs/foundation/WorldClock.js
  var require_WorldClock = __commonJS({
    'frontend/js/ecs/foundation/WorldClock.js'(exports, module) {
      (function (global) {
        const EcsCoreBoundary = (() => {
          if (global.EcsCoreBoundary) return global.EcsCoreBoundary;
          if (typeof module !== 'undefined' && module.exports) {
            try {
              return require_EcsCoreBoundary();
            } catch (_error) {
              return null;
            }
          }
          return null;
        })();
        if (!EcsCoreBoundary) {
          throw new Error('WorldClock requires EcsCoreBoundary and bitecs primitives');
        }
        const {
          Types,
          addComponent,
          addEntity,
          createWorld,
          defineComponent,
          defineQuery,
          hasComponent,
        } = EcsCoreBoundary;
        if (
          !Types ||
          !defineComponent ||
          !defineQuery ||
          !createWorld ||
          !addEntity ||
          !addComponent
        ) {
          throw new Error('WorldClock requires the approved BitECS primitive surface');
        }
        const EPOCH_SECONDS_THRESHOLD = 1e9;
        const EPOCH_MILLISECONDS_THRESHOLD = 1e12;
        const Clock = defineComponent({
          serverEpochAtSyncMs: Types.f64,
          clientMonoAtSyncMs: Types.f64,
          lastSyncedAtEpochMs: Types.f64,
          epochNowMs: Types.f64,
          elapsedMs: Types.f64,
          synced: Types.ui8,
        });
        const clockQuery = defineQuery([Clock]);
        function toNumber(value, fallback = Number.NaN) {
          const number = Number(value);
          return Number.isFinite(number) ? number : fallback;
        }
        function toEpochMs(value, fallback = Number.NaN) {
          if (value === null || value === void 0 || value === '') return fallback;
          if (value instanceof Date) {
            const stamp2 = value.getTime();
            return Number.isFinite(stamp2) ? stamp2 : fallback;
          }
          if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
            const number = Number(value);
            if (Number.isFinite(number)) {
              if (Math.abs(number) >= EPOCH_MILLISECONDS_THRESHOLD) return number;
              if (Math.abs(number) >= EPOCH_SECONDS_THRESHOLD) return number * 1e3;
            }
          }
          const stamp = new Date(value).getTime();
          return Number.isFinite(stamp) ? stamp : fallback;
        }
        function getMonotonicNow(runtime = null) {
          const perfNow = runtime?.performance?.now?.() ?? global.performance?.now?.();
          if (Number.isFinite(Number(perfNow))) return Number(perfNow);
          return Date.now();
        }
        function extractClockPayloadTime(payload = {}) {
          if (!payload || typeof payload !== 'object') return {};
          return {
            serverTime:
              payload.serverTime ??
              payload.authority?.serverTime ??
              payload.authority?.command?.serverTime ??
              payload.timeline?.serverTime ??
              payload.details?.serverTime ??
              payload.details?.timeline?.serverTime ??
              payload.gameState?.serverTime ??
              payload.state?.serverTime,
            serverNowMs:
              payload.nowMs ??
              payload.timeline?.nowMs ??
              payload.details?.timeline?.nowMs ??
              payload.gameState?.nowMs ??
              payload.state?.nowMs,
          };
        }
        function initializeClockComponent(clockWorld, options = {}) {
          const entity = clockWorld.clockEntity;
          Clock.serverEpochAtSyncMs[entity] = Number.NaN;
          Clock.clientMonoAtSyncMs[entity] = Number.NaN;
          Clock.lastSyncedAtEpochMs[entity] = Number.NaN;
          Clock.epochNowMs[entity] = Number.NaN;
          Clock.elapsedMs[entity] = 0;
          Clock.synced[entity] = 0;
          runClockSyncSystem(clockWorld, options);
        }
        function createClockWorld(options = {}) {
          const world = createWorld();
          const clockEntity = addEntity(world);
          addComponent(world, Clock, clockEntity);
          const clockWorld = {
            world,
            clockEntity,
            runtime: options.runtime || null,
          };
          initializeClockComponent(clockWorld, options);
          return clockWorld;
        }
        function getClockEntity(clockWorld = null) {
          if (!clockWorld?.world) return null;
          if (
            Number.isInteger(clockWorld.clockEntity) &&
            hasComponent(clockWorld.world, Clock, clockWorld.clockEntity)
          ) {
            return clockWorld.clockEntity;
          }
          const matches = clockQuery(clockWorld.world);
          return matches.length ? matches[0] : null;
        }
        function runClockSyncSystem(clockWorld = null, options = {}) {
          const entity = getClockEntity(clockWorld);
          if (!Number.isInteger(entity)) return false;
          if (options.runtime) clockWorld.runtime = options.runtime;
          const payloadTimes = extractClockPayloadTime(options);
          const serverEpochMs = toEpochMs(
            options.serverTime ??
              options.serverNowMs ??
              options.epochNowMs ??
              options.nowEpochMs ??
              payloadTimes.serverTime ??
              payloadTimes.serverNowMs,
            Number.NaN,
          );
          if (!Number.isFinite(serverEpochMs)) return false;
          const clientMonoMs = Number.isFinite(Number(options.clientMonoMs))
            ? Number(options.clientMonoMs)
            : getMonotonicNow(clockWorld.runtime);
          const previousEpochNowMs = Clock.synced[entity]
            ? Clock.serverEpochAtSyncMs[entity] +
              Math.max(0, clientMonoMs - Clock.clientMonoAtSyncMs[entity])
            : -Infinity;
          const anchoredEpochMs = Math.max(serverEpochMs, previousEpochNowMs);
          Clock.serverEpochAtSyncMs[entity] = anchoredEpochMs;
          Clock.clientMonoAtSyncMs[entity] = clientMonoMs;
          Clock.lastSyncedAtEpochMs[entity] = Date.now();
          Clock.elapsedMs[entity] = 0;
          Clock.epochNowMs[entity] = anchoredEpochMs;
          Clock.synced[entity] = 1;
          return true;
        }
        function runClockAdvanceSystem(clockWorld = null) {
          const entity = getClockEntity(clockWorld);
          if (!Number.isInteger(entity) || !Clock.synced[entity]) return false;
          const elapsedMs = Math.max(
            0,
            getMonotonicNow(clockWorld.runtime) - Clock.clientMonoAtSyncMs[entity],
          );
          Clock.elapsedMs[entity] = elapsedMs;
          Clock.epochNowMs[entity] = Clock.serverEpochAtSyncMs[entity] + elapsedMs;
          return true;
        }
        function getClockSnapshot(clockWorld = null, fallback = Date.now()) {
          const entity = getClockEntity(clockWorld);
          if (!Number.isInteger(entity) || !Clock.synced[entity]) {
            return Object.freeze({
              entity,
              synced: false,
              epochNowMs: toEpochMs(fallback, Date.now()),
              elapsedMs: 0,
              serverEpochAtSyncMs: Number.NaN,
              clientMonoAtSyncMs: Number.NaN,
              lastSyncedAtEpochMs: Number.NaN,
            });
          }
          runClockAdvanceSystem(clockWorld);
          return Object.freeze({
            entity,
            synced: true,
            epochNowMs: Clock.epochNowMs[entity],
            elapsedMs: Clock.elapsedMs[entity],
            serverEpochAtSyncMs: Clock.serverEpochAtSyncMs[entity],
            clientMonoAtSyncMs: Clock.clientMonoAtSyncMs[entity],
            lastSyncedAtEpochMs: Clock.lastSyncedAtEpochMs[entity],
          });
        }
        function isClockWorld(value = null) {
          return Boolean(
            value &&
            typeof value === 'object' &&
            value.world &&
            Number.isInteger(value.clockEntity) &&
            hasComponent(value.world, Clock, value.clockEntity),
          );
        }
        function getClockWorld(source = {}) {
          if (isClockWorld(source)) return source;
          if (isClockWorld(source?.clockWorld)) return source.clockWorld;
          if (isClockWorld(source?.worldClock)) return source.worldClock;
          if (isClockWorld(source?.host?.worldClock)) return source.host.worldClock;
          if (isClockWorld(source?.runtime?.worldClock)) return source.runtime.worldClock;
          if (isClockWorld(global.__WorldClockShared)) return global.__WorldClockShared;
          return null;
        }
        function getShared(options = {}) {
          const current = global.__WorldClockShared;
          if (isClockWorld(current)) {
            if (options.runtime && current.runtime !== options.runtime)
              current.runtime = options.runtime;
            runClockSyncSystem(current, options);
            return current;
          }
          const clockWorld = createClockWorld(options);
          global.__WorldClockShared = clockWorld;
          return clockWorld;
        }
        function createWorldClock(options = {}) {
          return createClockWorld(options);
        }
        function updateFromPayload(clockWorld = null, payload = {}) {
          if (!payload || typeof payload !== 'object') return false;
          return runClockSyncSystem(clockWorld, payload);
        }
        function getEpochNowMs(source = {}, fallback = Date.now()) {
          const clockWorld = getClockWorld(source);
          if (clockWorld && Clock.synced[clockWorld.clockEntity]) {
            return getClockSnapshot(clockWorld, fallback).epochNowMs;
          }
          const parsedFallback = toEpochMs(fallback, Number.NaN);
          if (Number.isFinite(parsedFallback)) return parsedFallback;
          return arguments.length >= 2 ? Number.NaN : Date.now();
        }
        function sync(source = {}, payload = {}) {
          const clockWorld =
            getClockWorld(source) || getShared({ runtime: source?.runtime || source });
          const synced = updateFromPayload(clockWorld, payload);
          if (source && typeof source === 'object' && !source.worldClock)
            source.worldClock = clockWorld;
          return synced;
        }
        const api = {
          Clock,
          EPOCH_MILLISECONDS_THRESHOLD,
          EPOCH_SECONDS_THRESHOLD,
          clockQuery,
          createClockWorld,
          createWorldClock,
          getClock: getClockWorld,
          getClockEntity,
          getClockWorld,
          getClockSnapshot,
          getEpochNowMs,
          getShared,
          isClockWorld,
          runClockAdvanceSystem,
          runClockSyncSystem,
          sync,
          toEpochMs,
          toNumber,
          updateFromPayload,
        };
        global.WorldClock = api;
        if (typeof module !== 'undefined' && module.exports) module.exports = api;
      })(typeof window !== 'undefined' ? window : globalThis);
    },
  });

  // frontend/js/ecs/projection/WorldMapVisibilityModel.js
  var require_WorldMapVisibilityModel = __commonJS({
    'frontend/js/ecs/projection/WorldMapVisibilityModel.js'(exports, module) {
      (function (global) {
        const EcsCoreBoundary = (() => {
          if (global.EcsCoreBoundary) return global.EcsCoreBoundary;
          if (typeof module !== 'undefined' && module.exports) {
            try {
              return require_EcsCoreBoundary();
            } catch (_error) {
              return null;
            }
          }
          return null;
        })();
        if (!EcsCoreBoundary) {
          throw new Error('WorldMapVisibilityModel requires EcsCoreBoundary and bitecs primitives');
        }
        const {
          Types,
          addComponent,
          addEntity,
          createWorld,
          defineComponent,
          defineQuery,
          removeEntity,
        } = EcsCoreBoundary;
        if (
          !Types ||
          !defineComponent ||
          !defineQuery ||
          !createWorld ||
          !addEntity ||
          !addComponent ||
          !removeEntity
        ) {
          throw new Error('WorldMapVisibilityModel requires the approved BitECS primitive surface');
        }
        const SignatureHash = (() => {
          if (global.SignatureHash) return global.SignatureHash;
          if (typeof module !== 'undefined' && module.exports) {
            try {
              return require_SignatureHash();
            } catch (_error) {
              return null;
            }
          }
          return null;
        })();
        const TileCoord = (() => {
          if (global.TileCoord) return global.TileCoord;
          if (typeof module !== 'undefined' && module.exports) {
            try {
              return require_TileCoord();
            } catch (_error) {
              return null;
            }
          }
          return null;
        })();
        const LEVEL_UNKNOWN = 0;
        const LEVEL_EXPLORED = 1;
        const LEVEL_VISIBLE = 2;
        const LEVEL_CONTROLLED = 3;
        const LEVEL_NAMES = Object.freeze(['unknown', 'explored', 'visible', 'controlled']);
        const LEVEL_BY_VISIBILITY = Object.freeze({
          unknown: LEVEL_UNKNOWN,
          hidden: LEVEL_UNKNOWN,
          undiscovered: LEVEL_UNKNOWN,
          scouted: LEVEL_EXPLORED,
          explored: LEVEL_EXPLORED,
          discovered: LEVEL_EXPLORED,
          visible: LEVEL_VISIBLE,
          controlled: LEVEL_CONTROLLED,
        });
        const FogVisibility = defineComponent({
          q: Types.i32,
          r: Types.i32,
          level: Types.ui8,
          intelLevel: Types.ui8,
        });
        const fogVisibilityQuery = defineQuery([FogVisibility]);
        function toNumber(value, fallback = 0) {
          const number = Number(value);
          return Number.isFinite(number) ? number : fallback;
        }
        function toInteger(value, fallback = 0) {
          return Math.floor(toNumber(value, fallback));
        }
        function tileId(q, r) {
          return TileCoord.tileId(q, r);
        }
        function normalizeCoord(source = {}, fallback = {}) {
          const normalized = TileCoord.normalizeCoord(source, fallback);
          return {
            q: normalized.x,
            r: normalized.y,
            tileId: normalized.tileId,
          };
        }
        function clampLevel(value, fallback = LEVEL_UNKNOWN) {
          const level = toInteger(value, fallback);
          if (level <= LEVEL_UNKNOWN) return LEVEL_UNKNOWN;
          if (level >= LEVEL_CONTROLLED) return LEVEL_CONTROLLED;
          return level;
        }
        function levelName(level) {
          return LEVEL_NAMES[clampLevel(level)] || 'unknown';
        }
        function hashStep(hash, value) {
          return SignatureHash.hashStep(hash, value);
        }
        function normalizeLevel(value, options = {}) {
          if (options.controlled) return LEVEL_CONTROLLED;
          if (Number.isFinite(Number(value))) return clampLevel(value);
          const key = String(value || '')
            .trim()
            .toLowerCase();
          if (Object.prototype.hasOwnProperty.call(LEVEL_BY_VISIBILITY, key))
            return LEVEL_BY_VISIBILITY[key];
          if (options.discovered === false || options.visible === false) return LEVEL_UNKNOWN;
          return options.defaultLevel ?? LEVEL_EXPLORED;
        }
        function getIntelLevel(rawIntel = null, fallback = 0) {
          if (!rawIntel || typeof rawIntel !== 'object') return clampLevel(fallback);
          return clampLevel(rawIntel.level, fallback);
        }
        function readTileVisibility(tile = {}, options = {}) {
          const coord = normalizeCoord(tile);
          const controlled = Boolean(
            tile.controlled ||
            tile.visibility === 'controlled' ||
            tile.siteId === 'capital' ||
            tile.id === 'tile_0_0',
          );
          const discovered = tile.discovered !== false;
          const level = normalizeLevel(tile.visibility, {
            controlled,
            discovered,
            visible: tile.visible,
            defaultLevel: options.defaultDiscoveredLevel ?? LEVEL_EXPLORED,
          });
          return {
            tileId: coord.tileId,
            q: coord.q,
            r: coord.r,
            level,
            visibility: levelName(level),
            intelLevel: Math.max(getIntelLevel(tile.intel, level), level),
          };
        }
        function createVisibilityWorld() {
          return {
            world: createWorld(),
            byId: /* @__PURE__ */ new Map(),
            order: [],
          };
        }
        let sharedVisibilityWorld = null;
        function getSharedVisibilityWorld() {
          if (!sharedVisibilityWorld) sharedVisibilityWorld = createVisibilityWorld();
          return sharedVisibilityWorld;
        }
        function resetVisibilityWorld(visWorld) {
          const matches = fogVisibilityQuery(visWorld.world);
          const eids = Array.from(matches);
          for (let i = 0; i < eids.length; i += 1) removeEntity(visWorld.world, eids[i]);
          visWorld.byId = /* @__PURE__ */ new Map();
          visWorld.order = [];
          return visWorld;
        }
        function upsertTile(visWorld, entry = {}) {
          const id = String(entry.tileId || tileId(entry.q, entry.r));
          const level = clampLevel(entry.level);
          const intelLevel = clampLevel(entry.intelLevel, level);
          const existing = visWorld.byId.get(id);
          if (existing !== void 0) {
            if (level > FogVisibility.level[existing]) FogVisibility.level[existing] = level;
            if (intelLevel > FogVisibility.intelLevel[existing])
              FogVisibility.intelLevel[existing] = intelLevel;
            return existing;
          }
          const eid = addEntity(visWorld.world);
          addComponent(visWorld.world, FogVisibility, eid);
          FogVisibility.q[eid] = toInteger(entry.q);
          FogVisibility.r[eid] = toInteger(entry.r);
          FogVisibility.level[eid] = level;
          FogVisibility.intelLevel[eid] = intelLevel;
          visWorld.byId.set(id, eid);
          visWorld.order.push(eid);
          return eid;
        }
        function getMissionList(worldExplorerState = {}, extraMissions = []) {
          const result = [];
          const append = (mission) => {
            if (mission && typeof mission === 'object') result.push(mission);
          };
          (Array.isArray(extraMissions) ? extraMissions : []).forEach(append);
          (Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []).forEach(
            append,
          );
          append(worldExplorerState.activeMission);
          (Array.isArray(worldExplorerState.idleMissions)
            ? worldExplorerState.idleMissions
            : []
          ).forEach(append);
          return result;
        }
        function hasCoordPair(source = {}) {
          if (!source || typeof source !== 'object') return false;
          const hasQ = source.x !== void 0 || source.q !== void 0;
          const hasR = source.y !== void 0 || source.r !== void 0;
          return hasQ && hasR;
        }
        function addTileAlias(aliases, value, canonicalId) {
          if (!value || !canonicalId) return;
          const alias = String(value);
          const ids = aliases.get(alias) || /* @__PURE__ */ new Set();
          ids.add(String(canonicalId));
          aliases.set(alias, ids);
        }
        function addCoordAliases(aliases, source = {}) {
          if (!hasCoordPair(source)) return;
          const normalized = normalizeCoord(source);
          addTileAlias(aliases, normalized.tileId, normalized.tileId);
          addTileAlias(aliases, source.tileId, normalized.tileId);
          addTileAlias(aliases, source.id, normalized.tileId);
        }
        function createMissionTileAliasMap(mission = {}) {
          const aliases = /* @__PURE__ */ new Map();
          (Array.isArray(mission.route) ? mission.route : []).forEach((step) =>
            addCoordAliases(aliases, step),
          );
          (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) =>
            addCoordAliases(aliases, tile),
          );
          return aliases;
        }
        function createRevealedTileSet(mission = {}) {
          const aliases = createMissionTileAliasMap(mission);
          const revealed = /* @__PURE__ */ new Set();
          (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [])
            .filter(Boolean)
            .forEach((id) => {
              const canonicalIds = aliases.get(String(id));
              if (canonicalIds) {
                canonicalIds.forEach((canonicalId) => revealed.add(canonicalId));
                return;
              }
              revealed.add(String(id));
            });
          return revealed;
        }
        function applyMissionVisibility(visWorld, mission = {}) {
          if (!mission || typeof mission !== 'object') return visWorld;
          const revealedIds = createRevealedTileSet(mission);
          const applyCoord = (coord, level = LEVEL_EXPLORED) => {
            if (!coord || typeof coord !== 'object') return;
            const normalized = normalizeCoord(coord);
            upsertTile(visWorld, {
              tileId: normalized.tileId,
              q: normalized.q,
              r: normalized.r,
              level,
              intelLevel: level,
            });
          };
          (Array.isArray(mission.route) ? mission.route : []).forEach((step) => {
            const normalized = normalizeCoord(step);
            if (step.revealed || revealedIds.has(normalized.tileId)) {
              applyCoord(normalized, LEVEL_EXPLORED);
            }
          });
          (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) => {
            const normalized = normalizeCoord(tile);
            if (tile.revealed || revealedIds.has(normalized.tileId)) {
              applyCoord({ ...tile, ...normalized }, LEVEL_EXPLORED);
            }
          });
          if (mission.position)
            applyCoord(
              mission.position,
              mission.status === 'active' ? LEVEL_VISIBLE : LEVEL_EXPLORED,
            );
          return visWorld;
        }
        function runVisibilitySystem(visWorld, input = {}, options = {}) {
          resetVisibilityWorld(visWorld);
          const territoryState = input.territoryState || {};
          const worldMap = input.worldMap || territoryState.worldMap || {};
          const tiles = Array.isArray(input.tiles)
            ? input.tiles
            : Array.isArray(worldMap.tiles)
              ? worldMap.tiles
              : [];
          for (let i = 0; i < tiles.length; i += 1) {
            upsertTile(visWorld, readTileVisibility(tiles[i], options));
          }
          const worldExplorerState = input.worldExplorerState || {};
          getMissionList(worldExplorerState, input.missions).forEach((mission) =>
            applyMissionVisibility(visWorld, mission),
          );
          return visWorld;
        }
        function getVisibilitySnapshot(visWorld, version = 0) {
          const tileIds = [];
          const q = [];
          const r = [];
          const levels = [];
          const intelLevels = [];
          const indexById = /* @__PURE__ */ Object.create(null);
          const counts = { unknown: 0, explored: 0, visible: 0, controlled: 0 };
          let hash = SignatureHash.FNV_OFFSET_BASIS;
          for (let i = 0; i < visWorld.order.length; i += 1) {
            const eid = visWorld.order[i];
            const tq = FogVisibility.q[eid];
            const tr = FogVisibility.r[eid];
            const id = tileId(tq, tr);
            const level = clampLevel(FogVisibility.level[eid]);
            const intelLevel = clampLevel(FogVisibility.intelLevel[eid], level);
            indexById[id] = i;
            tileIds.push(id);
            q.push(tq);
            r.push(tr);
            levels.push(level);
            intelLevels.push(intelLevel);
            counts[levelName(level)] += 1;
            hash = hashStep(hash, id);
            hash = hashStep(hash, level);
            hash = hashStep(hash, intelLevel);
          }
          return {
            schema: 'world-map-visibility-v1',
            version,
            tileIds,
            q,
            r,
            levels,
            intelLevels,
            indexById,
            counts,
            signature: `${version}:${tileIds.length}:${hash.toString(16)}`,
          };
        }
        function createSnapshot(input = {}, options = {}) {
          const territoryState = input.territoryState || {};
          const worldMap = input.worldMap || territoryState.worldMap || {};
          const version = worldMap.version || input.version || 0;
          const visWorld = getSharedVisibilityWorld();
          runVisibilitySystem(visWorld, input, options);
          return getVisibilitySnapshot(visWorld, version);
        }
        function getLevel(snapshot = {}, id = '') {
          const index = snapshot.indexById?.[String(id)];
          return index === void 0 ? LEVEL_UNKNOWN : clampLevel(snapshot.levels?.[index]);
        }
        function isExplored(snapshot = {}, id = '') {
          return getLevel(snapshot, id) >= LEVEL_EXPLORED;
        }
        function isVisible(snapshot = {}, id = '') {
          return getLevel(snapshot, id) >= LEVEL_VISIBLE;
        }
        function toSerializable(snapshot = {}) {
          return {
            schema: snapshot.schema || 'world-map-visibility-v1',
            version: snapshot.version || 0,
            tileIds: Array.isArray(snapshot.tileIds) ? [...snapshot.tileIds] : [],
            q: Array.isArray(snapshot.q) ? [...snapshot.q] : [],
            r: Array.isArray(snapshot.r) ? [...snapshot.r] : [],
            levels: Array.isArray(snapshot.levels) ? [...snapshot.levels] : [],
            intelLevels: Array.isArray(snapshot.intelLevels) ? [...snapshot.intelLevels] : [],
            indexById: { ...(snapshot.indexById || {}) },
            counts: { ...(snapshot.counts || {}) },
            signature: snapshot.signature || '',
          };
        }
        const api = {
          LEVEL_UNKNOWN,
          LEVEL_EXPLORED,
          LEVEL_VISIBLE,
          LEVEL_CONTROLLED,
          LEVEL_NAMES,
          FogVisibility,
          fogVisibilityQuery,
          createVisibilityWorld,
          runVisibilitySystem,
          getVisibilitySnapshot,
          createSnapshot,
          getLevel,
          isExplored,
          isVisible,
          levelName,
          normalizeCoord,
          normalizeLevel,
          readTileVisibility,
          createMissionTileAliasMap,
          createRevealedTileSet,
          tileId,
          toSerializable,
        };
        global.WorldMapVisibilityModel = api;
        if (typeof module !== 'undefined' && module.exports) module.exports = api;
      })(typeof window !== 'undefined' ? window : globalThis);
    },
  });

  // frontend/js/ecs/mode/EcsModeRuntimeEntry.js
  var require_EcsModeRuntimeEntry = __commonJS({
    'frontend/js/ecs/mode/EcsModeRuntimeEntry.js'(exports, module) {
      var ModeKeys = require_ModeKeys();
      var ModeComponents = require_ModeComponents();
      var ModeResolver = require_ModeResolver();
      var ModeWorld = require_ModeWorld();
      var InputIntent = require_InputIntent();
      var InputIntentResolver = require_InputIntentResolver();
      var RendererSnapshotBoundary = require_RendererSnapshotBoundary();
      var FogProjection = require_FogProjection();
      var FogRevealModel = require_FogRevealModel();
      var WorldClock = require_WorldClock();
      var WorldMapVisibilityModel = require_WorldMapVisibilityModel();
      var EcsModeRuntime = Object.freeze({
        ...ModeKeys,
        ...ModeResolver,
        ...ModeWorld,
        ...InputIntentResolver,
        ModeComponents,
        FogProjection,
        FogRevealModel,
        WorldClock,
        WorldMapVisibilityModel,
        RendererSnapshotBoundary,
        InputIntent,
        version: 'ecs-mode-runtime-modal-store-deshell-v1',
      });
      if (typeof globalThis !== 'undefined') {
        globalThis.EcsModeRuntime = EcsModeRuntime;
      }
      module.exports = EcsModeRuntime;
    },
  });
  return require_EcsModeRuntimeEntry();
})();
