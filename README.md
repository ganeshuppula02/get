# Undoable

**An undo button and guardrails for AI coding agents** (Claude Code, Codex CLI, Gemini CLI, Cursor).

Before an agent's command runs, Undoable checks it:
- **safe** → runs
- **risky** (deletes, overwrites, database changes) → backed up first; undo one action or a whole agent session
- **permanent or protected by your rules** → waits for a person's yes (terminal, dashboard, Slack or Telegram)

## Install

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ganeshuppula02/get/main/install.ps1 | iex
```

Mac and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ganeshuppula02/get/main/install.sh | sh
```

You need Node.js 20 or newer (the Windows installer offers to install it) and Git. Then, in the project your agent works on:

```bash
undoable setup
```

See it work in one minute, on a sample project (no agent needed):

```bash
undoable demo
```

Or ask how any command would be treated:

```bash
undoable check "rm -rf build"                # backed up first
undoable check "DELETE FROM orders WHERE id = 3"   # the rows are backed up first
undoable check "terraform destroy"           # waits for a person
```

## About this repository

This repository only hosts the installers and the packaged program. Undoable is in private early testing; the source code is not public. Free to use for evaluation; see the LICENSE inside the package.

Feedback and questions: message Ganesh Uppula on LinkedIn.
