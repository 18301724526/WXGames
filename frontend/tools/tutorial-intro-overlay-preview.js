(function () {
  localStorage.removeItem(window.TutorialIntroOverlay?.storageKey || 'tutorialIntroAdvisorSeen.v1');

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
      territoryState: { worldMap: { tiles: [] } },
    },
    enterCity(cityId, options = {}) {
      document.body.dataset.enterCity = `${cityId}:${options.tab || ''}`;
      return true;
    },
  };

  const overlay = new window.TutorialIntroOverlay({
    document,
    runtime: window,
    game: window.Game,
  });
  window.Game.tutorialIntroOverlay = overlay;
  overlay.start(window.Game.state);
  if (new URLSearchParams(window.location.search).get('step') === 'guide') {
    overlay.next();
  }
})();
