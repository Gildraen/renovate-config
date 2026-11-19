# renovate-config

Shared Renovate configuration for GitHub repositories. The preset provides
recommended rules, GitHub Actions digest pinning, Dev Container updates and
updates to DX component pins, Remote Taskfile references and GitHub MCP images
in `dx-mcp` launchers. Remote Taskfile references retain their owner/repository
identity, so the same manager works across GitHub organizations.

Native HTTP Remote Taskfile includes use:

```yaml
includes:
  base:
    taskfile: https://github.com/<owner>/<repository>/raw/<commit-sha>/taskfiles/base.yml # <version-tag>
```

This host keeps `TASK_REMOTE_TRUSTED_HOSTS=github.com` unchanged. The SHA in the
URL path pins the checkout; Renovate follows the SemVer tag in the trailing
comment and updates both values together.

Fixed component pairs in installer scripts use this annotation format:

```sh
# renovate: datasource=github-tags depName=.devcontainer/components/agents packageName=<owner>/<repository>
agents_version="v<major>.<minor>.<patch>"
agents_commit="<matching-commit-sha>"
```

`depName` matches the component's gitlink path; `packageName` identifies the
GitHub repository used to look up tags. Renovate updates the tag and commit SHA
as a pair and accepts stable SemVer tags only.

For the matching gitlink update, use the same path and stable tag in
`.gitmodules`:

```ini
[submodule ".devcontainer/components/agents"]
  path = .devcontainer/components/agents
  url = https://github.com/<owner>/<repository>.git
  branch = v<major>.<minor>.<patch>
```

Keep `git-submodules` enabled in the consumer configuration; a repository-level
disable overrides this preset.

DX fixes component tag/SHA pairs in its Feature installer; consumers do not
select component revisions through Feature options. The installer manager
updates each pair together, while the native git-submodule manager updates the
matching gitlink from the stable SemVer tag in `.gitmodules`. Both managers use
the same dependency name and Renovate group, and prereleases are excluded.
GitHub Actions and reusable workflow references use Renovate's native GitHub
Actions manager.

Consumer configuration:

```json
{
  "extends": ["github><owner>/renovate-config#<published-preset-tag>"]
}
```

The shared preset is in [default.json](default.json). Repository-specific
rules remain in each consumer's Renovate configuration.

## Preset versions

Consumers pin the shared preset to a published Git tag in `renovate.json`. A
pinned consumer stays on that snapshot when `main` changes. Renovate can propose
a newer stable tag for a pinned preset.

Preset tags are created from validated commits on `main` and are immutable. To
publish a new preset version, validate `main`, create a new annotated `vX.Y.Z`
tag, and push it. Never move or replace a published tag. A preset release does
not require a new DX Feature release.

```sh
git switch main
git pull --ff-only
task validate
task test
read -r -p "Next unique stable version (without v): " VERSION
if [[ ! "$VERSION" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  printf 'Expected a stable SemVer version without a v prefix.\n' >&2
  exit 1
fi
git tag -a "v${VERSION}" -m "Renovate preset v${VERSION}"
git push origin "v${VERSION}"
```

## Development

Shared agent resources are a Git submodule at
`.devcontainer/components/agents`, pinned by the repository's gitlink. Initialize
the recorded checkouts with:

```sh
git submodule update --init --recursive
```

[AGENTS.md](AGENTS.md) loads shared rules through `DX_AGENTS_HOME`, falling back
to that checkout when the variable is absent. The Dev Container sets this path
and exposes shared and project-local agent locations to VS Code.

Validation uses Node.js and Renovate, fetched by `npx`:

```sh
task validate
task test
```

The validator checks configuration syntax and rules, not resolution of the
top-level GitHub preset. A Renovate run resolves [renovate.json](renovate.json)
from the published branch; the local [default.json](default.json) is not a
substitute for that remote preset.
