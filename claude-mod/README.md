# Undoable panel for Claude Code

A live panel beside the chat that shows what [Undoable](https://github.com/ganeshuppula02/get) did in this project while your agent works: what was backed up, what asked you, what your rules stopped, and what's waiting for your OK. Each backed-up action has an **Undo** button, waiting requests have **Approve** and **Block**, and **Undo this session** puts back everything the last agent session changed (after you confirm). The status line shows a one-line summary.

The panel only reads `undoable status --json` and runs the same `undoable` commands you would type. It never changes how Undoable decides anything. It needs Undoable 0.18 or newer:

- Windows: `irm https://raw.githubusercontent.com/ganeshuppula02/get/main/install.ps1 | iex`
- Mac/Linux: `curl -fsSL https://raw.githubusercontent.com/ganeshuppula02/get/main/install.sh | sh`

Open it any time with `/undoable`.
