#!/bin/sh
# Undoable installer for Mac and Linux. Run in a terminal:
#   curl -fsSL https://raw.githubusercontent.com/ganeshuppula02/get/main/install.sh | sh
# What it does: checks for Node.js, downloads Undoable, installs it with npm, and checks that
# the `undoable` command works. Nothing else is changed; it never uses sudo.
set -u

BASE="${UNDOABLE_DOWNLOAD:-https://raw.githubusercontent.com/ganeshuppula02/get/main}"
BASE="${BASE%/}"
say() { printf '%s\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*"; exit 1; }

say ""
say "🛡️  Installing Undoable: an undo button and guardrails for AI coding agents"
say ""

# 1. Node.js 20 or newer (22 or newer for Slack approvals)
major=0
if command -v node >/dev/null 2>&1; then major=$(node --version 2>/dev/null | sed -n 's/^v\([0-9][0-9]*\)\..*/\1/p'); fi
[ -n "$major" ] || major=0
if [ "$major" -lt 20 ]; then
  [ "$major" -gt 0 ] && say "Node.js $major is too old: Undoable needs version 20 or newer." || say "Node.js is not installed. Undoable needs it."
  case "$(uname -s)" in
    Darwin) say "Install it with:  brew install node   (or from https://nodejs.org), then run this line again." ;;
    *) say "Install Node.js LTS from https://nodejs.org (or your package manager), then run this line again." ;;
  esac
  exit 1
fi
command -v npm >/dev/null 2>&1 || fail "npm is missing (it normally comes with Node.js). Reinstall Node.js from https://nodejs.org."
say "✔ Node.js $major"

# 2. Download
tmp=$(mktemp -d 2>/dev/null || mktemp -d -t undoable)
file="$tmp/undoable-cli-latest.tgz"
if [ -d "$BASE" ]; then cp "$BASE/undoable-cli-latest.tgz" "$file" 2>/dev/null # a local folder, for testing
elif command -v curl >/dev/null 2>&1; then curl -fsSL "$BASE/undoable-cli-latest.tgz" -o "$file"
elif command -v wget >/dev/null 2>&1; then wget -q "$BASE/undoable-cli-latest.tgz" -O "$file"
else fail "Neither curl nor wget is installed."; fi
[ -s "$file" ] || fail "Could not download Undoable from $BASE. Check your internet connection and try again."
say "✔ Downloaded"

# 3. Install. If the global folder needs admin rights, install into ~/.local instead of using sudo.
bin=""
if npm install -g --no-fund --no-audit "$file" >"$tmp/npm.log" 2>&1; then
  bin="$(npm prefix -g)/bin"
elif grep -q "EACCES" "$tmp/npm.log"; then
  say "The global npm folder needs admin rights, so installing into ~/.local instead."
  npm install -g --prefix "$HOME/.local" --no-fund --no-audit "$file" >"$tmp/npm.log" 2>&1 || { cat "$tmp/npm.log"; fail "npm could not install Undoable."; }
  bin="$HOME/.local/bin"
else
  cat "$tmp/npm.log"; fail "npm could not install Undoable (see the message above)."
fi
rm -rf "$tmp"

# 4. Check
if command -v undoable >/dev/null 2>&1; then
  printf '\033[32m✔ %s\033[0m\n' "$(undoable 2>/dev/null | head -n 1)"
else
  printf '\033[32m✔ %s\033[0m\n' "$("$bin/undoable" 2>/dev/null | head -n 1)"
  say ""
  say "One more step: $bin is not on your PATH. Add this line to ~/.zshrc or ~/.bashrc, then open a new terminal:"
  say "   export PATH=\"$bin:\$PATH\""
fi
say ""
say "Next: go to a project your AI agent works on, and run setup there:"
say "   cd /path/to/your/project"
say "   undoable setup"
say ""
say "Remove it any time with: undoable remove   then   npm uninstall -g undoable-cli"
