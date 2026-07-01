(function (global) {
  const FormationDeploymentEligibility = (() => {
    if (global.FormationDeploymentEligibility) return global.FormationDeploymentEligibility;
    if (typeof require === 'function') {
      try {
        return require('../../../shared/formationDeploymentEligibility');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  if (FormationDeploymentEligibility) {
    global.FormationDeploymentEligibility = FormationDeploymentEligibility;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormationDeploymentEligibility;
  }
})(typeof window !== 'undefined' ? window : globalThis);
