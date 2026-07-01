(function (global) {
  function getMountedGame(shell) {
    return shell?.lastGame && shell.lastGame !== shell ? shell.lastGame : null;
  }

  function getUiStateOwner(shell) {
    return getMountedGame(shell) || shell;
  }

  const CanvasGameShellHostAccess = { getMountedGame, getUiStateOwner };

  global.CanvasGameShellHostAccess = CanvasGameShellHostAccess;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameShellHostAccess;
})(typeof window !== 'undefined' ? window : globalThis);
