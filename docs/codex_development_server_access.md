# Codex Development Server Access

This server is the dedicated Codex development/test server for this project. It is not the formal production environment.

Purpose:

- Codex may connect to this server for development deployment, inspection, and testing.
- Treat it as the shared development server for home/company Codex sessions.
- Do not waste time asking whether this is production; it is explicitly a development server for this repository.

Connection:

- Host: `47.116.32.216`
- SSH user: `root`
- SSH password source: local workspace file `password.txt`
- API base: `http://47.116.32.216:3000`
- Git deploy remote: `private` -> `http://47.116.32.216:3001/wxgame.git`

Verification:

- Version: `http://47.116.32.216:3000/api/version`
- Health: `http://47.116.32.216:3000/api/health`

Deployment:

```powershell
git push private HEAD:main
```

Operational notes for Codex:

- Before SSH work, read local `password.txt` from the workspace root.
- Do not ask the user again for this development server's address or purpose when this document and `password.txt` are present.
- Do not commit `password.txt` or any file containing the plaintext password.
- This repository's security and hygiene guards intentionally keep credentials out of Git history.
