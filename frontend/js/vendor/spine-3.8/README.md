# Spine 3.8 Local Runtime

This folder contains the local Spine `3.8.x` web runtime. It is used for assets
exported from Spine `3.8.99`; do not use the `4.x` runtime for these assets.

Primary H5 runtime entry:

```text
frontend/js/vendor/spine-3.8/spine-webgl.js
```

Downloaded source/examples, when present locally for reference only:

```text
frontend/js/vendor/spine-3.8/spine-ts/
```

Do not ship the full `spine-ts/` source/examples folder unless a future build
step explicitly needs it.


Use local project paths only. Do not load this runtime from CDN URLs.
