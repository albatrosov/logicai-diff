# logicAI-diff

A Claude Code skill that replaces prose change summaries with a **logicAI-diff** — a self-contained HTML report styled like the side-by-side git-diff screen in an IDE.

Instead of listing file edits, it shows **only logical, behaviour-level changes** grouped in causal order: what had to change first, what that enabled, and so on down the chain.

## What it looks like

| Left column (Before) | Right column (After) |
|---|---|
| How a behaviour worked before | How it works now |
| Red = removed, Yellow = modified | Green = added or modified |

Each change also lists the files and line ranges it touches — as clickable references that open in your editor, never as code dumps.

## Features

- 🔄 **Runs automatically** after every code edit — no trigger phrase needed
- 🧠 **Logical grouping** — one row per *behaviour change*, not per file or hunk
- 📎 **Clickable file references** — opens the exact line in VS Code, Cursor, PhpStorm, etc.
- 🌗 **Light / dark theme** — follows the OS preference
- 📦 **Zero dependencies** — the renderer is a single Node.js script

## Install

```bash
# Add this marketplace to Claude Code
/plugin marketplace add your-username/logicai-diff

# Install the skill
/plugin install logicai-diff@logicai-diff
```

Or install directly from the repo URL (no marketplace registration needed):

```bash
/plugin install https://github.com/your-username/logicai-diff
```

## Usage

Just edit code. The diff appears automatically at the end of every coding turn.

You can also trigger it manually:
- "show me what changed"
- "summarize the changes"
- "покажи що змінилось"

## Requirements

- Node.js (for `scripts/render.mjs`)
- Claude Code

## License

MIT
