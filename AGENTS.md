# Local environment notes

## Shell + Node/npm/nvm setup

The Bash tool runs commands under `/opt/homebrew/bin/bash` 5.3 (Homebrew bash, not macOS's stock 3.2). The shell is non-interactive and non-login, **but `~/.bash_profile` is sourced** by the harness, which sets up the user's customized PATH — including nvm's node directory.

Concretely:

- `node` resolves to `/Users/jonathan/.nvm/versions/node/v24.16.0/bin/node` (the user's nvm default) **without any PATH manipulation**. `node --version` → `v24.16.0`.
- `npm` comes from the same nvm install — no separate setup needed.
- **Do not** prepend `/Users/jonathan/.nvm/versions/node/v24.16.0/bin` to `PATH`. Don't source `nvm.sh`. Don't run `nvm use`. All unnecessary — `node` and `npm` are on the PATH already.

What the shell does **not** pick up:

- `~/.bashrc` is not sourced (interactive-only by default).
- nvm's `.nvmrc` auto-switch (the `cd`-hook that re-runs `nvm use` based on a project's pinned version) does **not** fire — that's an interactive-shell feature. The PATH baked in at shell start is what each Bash invocation gets.

If a project's `.nvmrc` pins a different version than the user's nvm default, the harness will still use the default. If that ever becomes a problem (e.g., a project pins v18 but our default is v24 and something breaks), only then is a one-off PATH override warranted.
