# GitHub sync

The user wants each completed change reflected on GitHub in the repository `alinaismailova006-hub/ryadom`, branch `main`.

- Before starting, inspect `git status` and check the remote branch for work by the other collaborator.
- After validating a requested edit, stage the files changed for that task, make a descriptive local commit, and publish it to `main`. Verify the updated branch.
- Prefer a normal Git push when authenticated. If Git CLI authentication is unavailable, use the connected GitHub tools: read the remote head, publish the tracked file changes in a commit based on that head, and fast-forward the remote branch. Local `ryadom.syncedLocal` and `ryadom.syncedRemote` Git config values record the last verified equivalent snapshots. Confirm the remote head matches the recorded value before using a local diff. Update both values after verification.
- Preserve collaborators' changes. If branches have diverged, reconcile before publishing and never force-push.
- Never add local credentials, environment files other than `.env.example`, MySQL files, database exports, or debug logs.
