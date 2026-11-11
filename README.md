# renovate-config

Shared Renovate configuration for Gildraen repositories. The preset provides
recommended rules, GitHub Actions digest pinning, Dev Container updates and
updates to versioned DX Remote Taskfile references and GitHub MCP images in
versioned `dx-mcp` launchers.

DX Feature component updates use the SemVer tag to order releases and pin the
resolved commit SHA for reproducible checkouts. Renovate updates each tag/SHA
pair together and refreshes the digest if a tag moves.

For Task 3.53.1 Remote Taskfile includes, pin the commit in the URL path and
keep the SemVer tag in a trailing comment, for example:
`https://github.com/Gildraen/dx-tools/raw/<commit-sha>/taskfiles/base.yml # v0.1.0-rc.1`.

Consumer configuration:

```json
{
	"extends": ["github>Gildraen/renovate-config"]
}
```

The shared preset is in [default.json](default.json). Repository-specific
rules remain in each consumer's Renovate configuration.
