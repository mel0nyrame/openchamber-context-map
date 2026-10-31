# Commit build artifacts with the source

`panel/main.js`, `service/main.js`, and `collector/main.js` are build artifacts and are still committed to the repository. When OpenChamber installs an extension, it only reads the `package.json` manifest and entry files in the folder and does not run a build: `contributes.service` spawns `service/main.js` directly, and the panel loads `panel/index.html` directly. Keeping the artifacts only locally would leave an installed extension with missing files or stale code. `scripts/build.ts` uses `openchamber-guest-bundle` to produce all three: the panel is an IIFE (a sandboxed iframe cannot load ES modules), and the service and collector are ESM targeting node.

**Considered options**

- Build at install time: requires the host to run a package manager and build scripts; install paths and permissions are not guaranteed, and a build failure becomes an install failure.
- Package a tarball at release time: adds a release pipeline, while the current install method points at a folder or a Git repository.

**Consequences**

After changing `src/`, you must rebuild and commit the artifacts; otherwise the extension in the repository diverges from the source. There is no CI check for artifact freshness; the only confirmation is that `git status` is empty after running `bun run build` before committing.
