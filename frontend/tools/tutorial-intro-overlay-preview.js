(function () {
  localStorage.removeItem(window.TutorialIntroOverlay?.storageKey || 'tutorialIntroAdvisorSeen.v2');

  window.Game = {
    hasServerState: true,
    authView: { loginPanelVisible: false },
    state: {
      gameDay: 1,
      totalBuildings: 0,
      activeCityId: 'capital',
      currentTab: 'military',
      militaryView: 'world',
      cityState: {
        capitalCityId: 'capital',
        activeCityId: 'capital',
        cities: [{ id: 'capital', name: '首都', isCapital: true, totalBuildings: 0 }],
      },
      territoryState: {
        territories: [{ id: 'capital', name: '首都', owner: 'player' }],
        worldMap: {
          tiles: [{ id: 'capital-tile', q: 0, r: 0, siteId: 'capital', site: { id: 'capital', name: '首都' } }],
        },
      },
    },
    enterCity(cityId, options = {}) {
      window.Game.lastEnteredCity = { cityId, tab: options.tab || '' };
      return true;
    },
  };

  const overlay = new window.TutorialIntroOverlay({
    runtime: window,
    game: window.Game,
  });
  window.Game.tutorialIntroOverlay = overlay;
  overlay.start(window.Game.state);
  const params = new URLSearchParams(window.location.search);
  const step = params.get('step');
  if (step === 'city' || step === 'enter') overlay.finishMarch();
  if (step === 'enter') overlay.advanceFromAction({ type: 'openWorldSite', siteId: 'capital' });
})();
