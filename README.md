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
agents_version="<major>.<minor>.<patch>"
agents_commit="<matching-commit-sha>"
```

`depName` matches the component's gitlink path; `packageName` identifies the
GitHub repository used to look up tags. Renovate updates the tag and commit SHA
as a pair. It accepts stable SemVer tags both with and without a `v` prefix;
new DX component releases use no prefix.

For the matching gitlink update, use the same path and stable tag in
`.gitmodules`:

```ini
[submodule ".devcontainer/components/agents"]
  path = .devcontainer/components/agents
  url = https://github.com/<owner>/<repository>.git
  branch = <major>.<minor>.<patch>
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

Preset tags are created by Release Please from Conventional Commits after the
`validate` workflow succeeds on `main`. Merge its release PR to create the
GitHub Release and the tag. New tags omit `v`; existing `v` tags remain valid
and this workflow never renames or deletes them. Published tags should not be
moved or replaced. A preset release does not require a new DX Feature release.

Release Please uses `GITHUB_TOKEN` by default, which cannot create pull requests
unless the repository setting permits it. Otherwise configure a repository
secret named `RELEASE_PLEASE_TOKEN` with a fine-grained token limited to this
repository and contents, issues and pull-request write access. The workflow does
not approve pull requests.

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
