# CLAUDE.md — Utah Valley Research Lab (Stats Website)

## Project
Full-stack research lab management platform.
- `frontend/` — React + Vite
- `backend/` — Express.js + PostgreSQL
- Deploy: Docker on EC2 via GitHub Actions

## Repo
- GitHub: JoeWhiteJr/Utah-Valley-Research-Lab
- SSH: git@github.com:JoeWhiteJr/Utah-Valley-Research-Lab.git

## Rules
- **NEVER push directly to main** — always create a branch and push there first
- Jared always merges PRs himself on GitHub
- Always use SSH for git push/delete

## Task Tracking
Track tasks as GitHub Issues, not local files. Use `/create-ticket` to create issues from Claude Code.
- List open issues: `gh issue list`
- View issue: `gh issue view <number>`
- Close issue: `gh issue close <number>`
- Link to PR: include `Closes #<number>` in the PR description
