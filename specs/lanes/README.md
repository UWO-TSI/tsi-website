# Lane handoffs

One file per active lane. A lane agent is restarted fresh from its file whenever its context grows large, after each review round, or when the coordinator decides. So the file has to be enough to carry on from with no other memory. David, 2026-10-18: "time to start fresh and reonboard new subagents."

## Every lane agent, on start

1. `CLAUDE.md` is already in your context. Don't read it again.
2. Read `specs/lane-rules.md`. The rules there are hard.
3. Read your lane file here, then the specs it names, then only the `CODEMAP.md` sections for your area. For a file over 40 KB, read the line range `CODEMAP.md` gives instead of the whole file.
4. In your worktree, run `git status` and `git log --oneline -8`. A `[wip]` commit on top is unfinished work from the previous agent. Review it, then finish it or revert it; never build blindly on it.
5. Merge main into your branch if your lane file says main moved.

Don't read `STATE.md`, `archive/`, other lanes' files or old evidence unless your lane file says to. Every file you read stays in your context and is paid for again on every later call.

When the coordinator writes a lane file, it lists the exact files and specs to read first, so the next agent starts editing within a few calls.

## Keeping your file current

Update your lane file at every milestone, and always before you report. It has these sections:

- **Status:** the head SHA, what's done, and what's approved.
- **David's decisions:** his notes verbatim, newest first.
- **Next:** the ordered steps to take now.
- **Tools and gotchas:** the scripts, dev URLs, test files, and traps you hit.

Commit the update on your branch. The coordinator merges it.

## The coordinator

The coordinator merges, pushes, publishes review pages for David, relays his decisions and applies prod migrations. It launches lanes with the agent type `uwotsi-lane` (Opus, high effort: art, look, 3D, tricky bugs) or `uwotsi-lane-light` (Sonnet, high effort: mechanical work with a clear spec). Both are defined in `~/.claude/agents/` on the Mac mini, start with this file's sequence and skip the personal instruction files. Lanes never push, never touch prod and never talk to David directly. Message the coordinator with SendMessage, to "main".
