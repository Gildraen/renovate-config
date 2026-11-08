# renovate-config

Shared Renovate configuration for Gildraen repositories. The preset provides
recommended rules, GitHub Actions digest pinning, Dev Container updates and
updates to versioned DX Remote Taskfile references and GitHub MCP images in
versioned `dx-mcp` launchers.

Consumer configuration:

```json
{
	"extends": ["github>Gildraen/renovate-config#v1.0.0"]
}
```

The shared preset is in [default.json](default.json). Repository-specific
rules remain in each consumer's Renovate configuration.

## Publishing versions

Preset versions use Git tags in `vX.Y.Z` format. A pinned consumer stays on
that preset version when `main` changes; Renovate can propose a later tag as a
dependency update.

To publish a version, validate the preset on the selected commit in `main`,
then create and push a new tag:

```sh
git switch main
git pull --ff-only
npx --yes --package renovate renovate-config-validator default.json
git tag -a v1.0.0 -m "Renovate preset v1.0.0"
git push origin v1.0.0
```

Use the next SemVer tag for each subsequent release. Never move or replace a
published tag. Publishing a preset tag does not require a new DX Feature
release.
