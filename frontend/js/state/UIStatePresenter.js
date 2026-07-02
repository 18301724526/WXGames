(function (global) {
  const UIStatePresenterDelegates = (() => {
    if (global.UIStatePresenterDelegates) return global.UIStatePresenterDelegates;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./UIStatePresenterDelegates');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class UIStatePresenter {
    static POPULATION_PER_OFFICIAL = 100;
  }

  Object.assign(UIStatePresenter, UIStatePresenterDelegates.createStaticMethods());

  global.UIStatePresenter = UIStatePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIStatePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
