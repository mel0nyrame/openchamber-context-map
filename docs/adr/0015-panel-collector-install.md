# The panel installs a missing Collector

OpenChamber can install an extension from a Git URL. That path copies the package into `~/.config/openchamber/extensions/context-map` and runs no repository script. The extension then has its panel and Service, but the Collector is an OpenCode plugin that must exist at `~/.config/opencode/plugins/context-map.js`; without it the panel reports `Collector is not running` and has no data.

The Service ships the built `collector/main.js` inside the package. When `/health` reports that no Collector is registered (`reason: "not_found"`), the panel shows an **Install Collector** button. The button calls `POST /collector/install` on the Service. The Service reads its bundled `collector/main.js`, adds the `// @context-map-collector v<version>` header, and writes the file to the OpenCode plugin directory with a temporary file and `rename`, mode 0600. It writes only when the target is missing or carries the marker; a user file, symlink, or directory returns 409 and stays untouched. The panel then asks the user to fully quit OpenCode and reopen it, because OpenCode loads plugins only at process start.

The panel does not install the Collector silently. A missing file is a visible state, and writing into the user's OpenCode configuration is an action the user starts. The same marker and conflict rules as `bun run install` apply, so the two paths cannot overwrite each other's files.

**Considered options**

- Tell link-install users to clone the repository and run `bun run install`: the link install exists to avoid a checkout, and the installer refuses the extension directory that OpenChamber created.
- Let the panel write the file directly: the panel runs in a sandboxed iframe and has no filesystem access.
- Install the Collector automatically on the first panel load: it hides a write to the user's OpenCode configuration and gives no chance to decline.
- Overwrite any existing file: it would destroy the user's own plugins.
- Symlink the Collector: OpenCode loads a copy; the marker and version checks assume a regular file.

**Consequences**

The Service needs write access to `~/.config/opencode/plugins/`; it runs as the user, without a sandbox. The panel installs to the default path only: the host does not pass `XDG_CONFIG_HOME` to a Service, so a user who moved the OpenCode config directory must use `bun run install` from a checkout. A newly written Collector does not load until OpenCode restarts. The panel installs only a missing Collector; an existing but outdated Collector still needs the installer, which also updates the extension. If the `service` capability is not granted, the panel cannot call the endpoint and shows the host failure instead of the button.
