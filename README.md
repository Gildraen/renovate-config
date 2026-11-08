# renovate-config

Shared Renovate configuration for Gildraen repositories. The preset provides
recommended rules, GitHub Actions digest pinning, Dev Container updates and
updates to versioned DX Remote Taskfile references.

Consumer configuration:

```json
{
	"extends": ["github>Gildraen/renovate-config"]
}
```

The shared preset is in [default.json](default.json). Repository-specific
rules remain in each consumer's Renovate configuration.
