(function (global) {
  const SharedStepScriptTypeRegistry = (() => {
    if (global.TutorialStepScriptTypeRegistry) return global.TutorialStepScriptTypeRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./StepScriptTypeRegistry');
    }
    return null;
  })();

  function defaultStepKeySource(input = {}) {
    return input.stepKey || '';
  }

  function makeProjection(stepKey = '', scriptType = '', evaluation = {}, runtime = {}) {
    const instructions = Array.isArray(evaluation.instructions)
      ? evaluation.instructions.map((instruction) => SharedStepScriptTypeRegistry.copyData(instruction))
      : [];
    const matchedRuleId = String(evaluation.matchedRuleId || '');
    return {
      schema: 'tutorial-step-projection/v1',
      stepKey,
      scriptType,
      handled: instructions.length > 0,
      matchedRuleId,
      instructions,
      trace: {
        stepKey,
        scriptType,
        ruleId: matchedRuleId,
        cursorKey: String(runtime.cursorKey || ''),
        cursor: String(runtime.cursor || ''),
        instructionTypes: instructions.map((instruction) => instruction.type),
      },
    };
  }

  class StepScriptRunner {
    constructor(options = {}) {
      this.typeRegistry = options.typeRegistry || SharedStepScriptTypeRegistry;
      this.stepKeySource = options.stepKeySource || defaultStepKeySource;
      this.activeStepKey = '';
      this.cursorByKey = new Map();
      this.beforeEffectsEmitted = false;
    }

    activateStep(stepKey = '') {
      if (this.activeStepKey === stepKey) return;
      this.activeStepKey = stepKey;
      this.cursorByKey.clear();
      this.beforeEffectsEmitted = false;
    }

    getRuntime(script = {}) {
      const cursorKey = String(script.cursorKey || '');
      const initialCursor = String(script.initialCursor || '');
      const cursor = cursorKey && this.cursorByKey.has(cursorKey)
        ? this.cursorByKey.get(cursorKey)
        : initialCursor;
      return { cursorKey, cursor };
    }

    emitBeforeEffects(script = {}, evaluation = {}) {
      const beforeEffects = this.typeRegistry.normalizeEffects?.(
        script.beforeEffects || [],
        'beforeEffects',
      ) || [];
      if (this.beforeEffectsEmitted || beforeEffects.length === 0) return evaluation;
      this.beforeEffectsEmitted = true;
      return {
        ...evaluation,
        instructions: [
          { type: 'beforeEffects', effects: this.typeRegistry.copyData(beforeEffects) },
          ...(evaluation.instructions || []),
        ],
      };
    }

    evaluate(input = {}) {
      const stepKey = String(this.stepKeySource(input) || '');
      this.activateStep(stepKey);
      const script = input.config?.[stepKey] || null;
      if (!script) return makeProjection(stepKey);
      const scriptType = String(script.type || '');
      const handler = this.typeRegistry?.get?.(scriptType);
      if (typeof handler !== 'function') {
        throw new TypeError(`StepScriptRunner unknown script type: ${scriptType}`);
      }
      const runtime = this.getRuntime(script);
      const evaluation = this.emitBeforeEffects(
        script,
        handler(script, input.ctx || null, runtime),
      );
      return makeProjection(stepKey, scriptType, evaluation, runtime);
    }

    handleEvent(input = {}) {
      const stepKey = String(this.stepKeySource(input) || '');
      this.activateStep(stepKey);
      const script = input.config?.[stepKey] || null;
      if (!script) return { handled: false, projection: makeProjection(stepKey) };
      const scriptType = String(script.type || '');
      const runtime = this.getRuntime(script);
      const transition = this.typeRegistry?.matchEvent?.(
        scriptType,
        script,
        input.eventName || '',
        input.payload || {},
        runtime,
      );
      if (!transition) {
        return {
          handled: false,
          projection: makeProjection(stepKey, scriptType, {}, runtime),
        };
      }
      if (runtime.cursorKey && transition.nextCursor) {
        this.cursorByKey.set(runtime.cursorKey, transition.nextCursor);
      }
      return {
        handled: true,
        matchedRuleId: transition.matchedRuleId,
        nextCursor: transition.nextCursor,
        nextStep: transition.nextStep,
        projection: this.evaluate(input),
      };
    }
  }

  function create(options = {}) {
    return new StepScriptRunner(options);
  }

  const api = {
    StepScriptRunner,
    create,
    defaultStepKeySource,
  };

  global.TutorialStepScriptRunner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
