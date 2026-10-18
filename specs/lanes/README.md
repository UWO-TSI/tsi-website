# Lane handoffs

One file per active lane. A lane agent is restarted fresh from its file whenever its context grows large, after each review round, or when the coordinator decides. So the file has to be enough to carry on from with no other memory. David, 2026-10-18: "time to start fresh and reonboard new subagents."

## Every lane agent, on start

1. Read `CLAUDE.md`, then `specs/lane-rules.md`. The rules there are hard.
2. Read your lane file here, then the specs it names.
3. In your worktree, run `git status` and `git log --oneline -8`. A `[wip]` commit on top is unfinished work from the previous agent. Review it, then finish it or revert it; never build blindly on it.
4. Merge main into your branch if your lane file says main moved.

## Keeping your file current

Update your lane file at every milestone, and always before you report. It has these sections:

- **Status:** the head SHA, what's done, and what's approved.
- **David's decisions:** his notes verbatim, newest first.
- **Next:** the ordered steps to take now.
- **Tools and gotchas:** the scripts, dev URLs, test files, and traps you hit.

Commit the update on your branch. The coordinator merges it.

## The coordinator

The coordinator merges, pushes, publishes review pages for David, relays his decisions and applies prod migrations. Lanes never push, never touch prod and never talk to David directly. Message the coordinator with SendMessage, to "main".
