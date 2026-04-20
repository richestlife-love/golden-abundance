# Project Instructions

## Git Workflow

- When the change is substantial, develop it on a feature branch in a git worktree under `.claude/worktrees/` rather than switching branches in-place. Trivial changes can go directly on `main`.
- When the feature is complete, integrate it into local `main` with `git merge` (not `git rebase`).
- After merging, tag the merge commit with a clear, concise name describing the work (e.g. `auth-read-complete`, `search-v2`). Run `git tag -l` first to see the existing style.
