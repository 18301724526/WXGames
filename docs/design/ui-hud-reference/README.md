# UI HUD Reference Archive

This folder preserves the visual source material for the canvas-only map HUD pass.

- `user-references/`
  - `layout-reference-v2.webp`: **UI 重做定稿参考图**(853x1844,暗铁/青铜双层金属盘 + 香槟金线性图标)。全部 UI-REDO 切片以它为准做切图/生成素材/取色;色值单源沉淀在 `frontend/js/config/UiThemeTokens.js`。
  - `game-current-ui-screenshot.png`: user-provided current game/UI reference.
  - `strategy-ui-layout-reference.jpg`: user-provided strategy UI layout reference.
- `generated-images/`
  - Original generated images from the UI/HUD iteration session.
- `source-sheets/raw/`
  - Raw generated icon sheets before local sprite processing.
- `source-sheets/processed/`
  - Processed command, utility, and resource icon sheets, prompt files, animation previews, and pipeline metadata.

Runtime HUD assets live in `frontend/assets/art/ui-hud/`. This directory is only for design handoff and source tracing.
