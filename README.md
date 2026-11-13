# renovate-config

Shared Renovate configuration for Gildraen repositories. The preset provides
recommended rules, GitHub Actions digest pinning, Dev Container updates and
updates to SHA-pinned DX Remote Taskfile references and GitHub MCP images in
versioned `dx-mcp` launchers. Remote Taskfile references retain their repository:
`Gildraen/dx` and `Gildraen/dx-tools` are both supported.

Native HTTP Remote Taskfile includes use:

```yaml
includes:
  base:
    taskfile: https://github.com/Gildraen/dx-tools/raw/6630f37ffdc3a8c51af0f4795145a4743a61584b/taskfiles/base.yml # v0.0.0
```

This host keeps `TASK_REMOTE_TRUSTED_HOSTS=github.com` unchanged. The SHA in the
URL path pins the checkout; Renovate follows the SemVer tag in the trailing
comment and updates both values together. This format is used for both supported
repositories.

The preset also updates SemVer `agentsVersion` and `toolsVersion` options inside the
`ghcr.io/gildraen/dx/dx:*` Dev Container Feature and their `default` fields in
the `.devcontainer/src/dx/devcontainer-feature.json` install manifest. Branch
and commit SHA option values are not matched by these custom managers. The native
Git submodule manager follows the SemVer tag in `.gitmodules` and ignores
prereleases; the parent repository's gitlink pins the corresponding commit SHA.
GitHub Actions and reusable workflow references use Renovate's native GitHub
Actions manager.

DX Feature component updates use the SemVer tag to order releases and pin the
resolved commit SHA for reproducible checkouts. Renovate updates each tag/SHA
pair together and refreshes the digest if a tag moves.

Consumer configuration:

```json
{
  "extends": ["github>Gildraen/renovate-config#v0.0.0"]
}
```

The shared preset is in [default.json](default.json). Repository-specific
rules remain in each consumer's Renovate configuration.

## Preset versions

Consumers pin the shared preset to a published Git tag in `renovate.json`. The
current published tag is `v0.0.0`; a pinned consumer stays on that snapshot when
`main` changes. Renovate can propose a newer SemVer tag for a pinned preset.

Preset tags are created from validated commits on `main` and are immutable. To
publish a new preset version, validate `main`, create a new annotated `vX.Y.Z`
tag, and push it. Never move or replace a published tag. A preset release does
not require a new DX Feature release.

```sh
git switch main
git pull --ff-only
task validate
task test
git tag -a vX.Y.Z -m "Renovate preset vX.Y.Z"
git push origin vX.Y.Z
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

Validation uses Node.js 24.11+ and Renovate 44.222.4, fetched by `npx`:

```sh
task validate
task test
```

The validator checks configuration syntax and rules, not resolution of the
top-level GitHub preset. A Renovate run resolves [renovate.json](renovate.json)
from the published branch; the local [default.json](default.json) is not a
substitute for that remote preset.
