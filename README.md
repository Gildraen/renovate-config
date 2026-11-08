# renovate-config

Shared Renovate configuration for Gildraen repositories. The preset provides
recommended rules, GitHub Actions digest pinning, Dev Container updates and
updates to versioned DX Remote Taskfile references and GitHub MCP images in
versioned `dx-mcp` launchers. Remote Taskfile references retain their repository:
`Gildraen/dx` and `Gildraen/dx-tools` are both supported.

Native HTTP Remote Taskfile includes use:

```yaml
includes:
  base:
    taskfile: https://github.com/Gildraen/dx-tools/raw/<ref>/taskfiles/base.yml
```

This host keeps `TASK_REMOTE_TRUSTED_HOSTS=github.com` unchanged. The preset also
recognizes `https://raw.githubusercontent.com/Gildraen/dx-tools/<ref>/taskfiles/base.yml`
and legacy `https://github.com/Gildraen/dx-tools.git//taskfiles/base.yml?ref=<ref>`
includes, for either supported repository. SemVer references are updated;
branches and SHA references are not matched. Task 3.53.1 does not resolve commit
SHAs in the legacy Git URL format; SHA-pinned includes use native HTTP.

The preset also updates SemVer `agentsRef` and `toolsRef` options inside the
`ghcr.io/gildraen/dx/dx:*` Dev Container Feature and their `default` fields in
the `.devcontainer/src/dx/devcontainer-feature.json` install manifest. Branch
and commit SHA option values are not matched by these custom managers. The pilot
retains SHA pins without production tags. Native Git submodule management
updates pinned checkout SHAs from `.gitmodules`; GitHub Actions and reusable
workflow references use Renovate's native GitHub Actions manager.

Consumer configuration:

```json
{
  "extends": ["github>Gildraen/renovate-config#feat/component-extraction"]
}
```

The shared preset is in [default.json](default.json). Repository-specific
rules remain in each consumer's Renovate configuration.

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

The native GitHub Actions workflow runs the same validator and tests. The
validator checks configuration syntax and rules, not resolution of the top-level
GitHub preset. A Renovate run resolves [renovate.json](renovate.json) from the
published branch; the local [default.json](default.json) is not a substitute for
that remote preset.
