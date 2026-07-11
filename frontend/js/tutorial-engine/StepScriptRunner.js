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

  function makeProjection(stepKey = '', scriptType = '', evaluation = {}) {
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
        instructionTypes: instructions.map((instruction) => instruction.type),
      },
    };
  }

  class StepScriptRunner {
    constructor(options = {}) {
      this.typeRegistry = options.typeRegistry || SharedStepScriptTypeRegistry;
      this.stepKeySource = options.stepKeySource || defaultStepKeySource;
    }

    evaluate(input = {}) {
      const stepKey = String(this.stepKeySource(input) || '');
      const script = input.config?.[stepKey] || null;
      if (!script) return makeProjection(stepKey);
      const scriptType = String(script.type || '');
      const handler = this.typeRegistry?.get?.(scriptType);
      if (typeof handler !== 'function') {
        throw new TypeError(`StepScriptRunner unknown script type: ${scriptType}`);
      }
      return makeProjection(stepKey, scriptType, handler(script, input.ctx || null));
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
