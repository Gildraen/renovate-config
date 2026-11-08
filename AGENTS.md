# Project agent instructions

Before any work, resolve DX_AGENTS_HOME from the process environment. When it
is absent, use the repository's .devcontainer/components/agents checkout.
Read its AGENTS.md and follow the shared guidance. If the checkout is missing,
initialize it with git submodule update --init --recursive before continuing.

This repository owns the shared Renovate preset. Project-specific rules stay
in each consumer repository. Run task validate and task test for changes here.