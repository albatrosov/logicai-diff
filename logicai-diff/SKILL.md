---
name: logicai-diff
description: 'Use this skill immediately and automatically after editing, creating, refactoring, moving, or deleting ANY code in ANY language — every time, without being asked and without any trigger phrase. Reporting code changes is the entire job of this skill: never describe code changes in a prose summary, always run this skill instead. It renders the change as a logicAI-diff — a self-contained HTML file styled like the side-by-side git-diff screen in an IDE (one full-width two-column Before/After table) that describes ONLY the logical, behaviour-level changes, grouped across files and ordered by build sequence, with clickable file:line references but no code. Phrases like "show me what changed", "summarize the changes", "what did you change", or "покажи що змінилось" also trigger it, but they are never required — finishing any code edit is enough. Skip it only on turns with no code changes at all (pure discussion, planning, or reading).'
---

# logicAI-diff

After you edit code, your default instinct is to write a prose summary of what changed. Those summaries blur two very different things together — *mechanical* edits ("renamed `x` to `y`, extracted a helper, added a type") and *logical* changes ("the app now updates the UI optimistically and rolls back on failure"). The person reading almost always cares only about the second kind, told as a story: what had to change first, what that enabled next, and so on down the chain.

This skill replaces that prose summary with a **logicAI-diff**: a self-contained HTML file, rendered like the split (side-by-side) git-diff screen in an IDE, that walks through *only* the logical changes in causal order. Left column = how the behaviour worked **before** (red = removed, yellow = changed). Right column = how it works **now** (green = added or changed). Each logical change also lists the files it touches, split the same way — removed/changed lines (old numbers) on the left, added/changed lines (new numbers) on the right — as references only, never the code itself. The rendered theme follows the reader's device (light/dark). Each reference is a chip showing just the filename; clicking the `/…` toggle reveals the full path, and clicking the filename or path opens that file in your editor (chosen once on first run).

**This runs automatically — the user should not have to ask.** Treat producing a logicAI-diff as the default close-out of any code work: the moment you have created, edited, refactored, moved, or deleted code, generate one. Don't wait for a request like "show me the diff" or "summarize the changes" — those are welcome but never required. The only turn to skip is one with no code changes at all (pure discussion, planning, or reading).

## The one idea that matters: logical change ≠ code change

A **code change** is a single edit in a single place. A **logical change** is a unit of *behaviour* — one thing the project now does differently. A single logical change can span several files and several edits, and grouping them is the whole point.

- If a behaviour lives in one function, the logical change references just that function.
- If achieving it required touching three files, the logical change references all three.

Never emit one row per edited hunk. Ask instead: "what are the handful of behaviour-level changes a teammate would name if they described this work out loud?" Those are your rows. A 12-file refactor might be 3 logical changes; a tightly-scoped fix might be 1.

## Workflow

### 1. Ground yourself in what actually changed

You already know what you edited this session — start there. Then, **if the project is a git repo**, reconcile against the real diff so file paths and line numbers are accurate (this is the only reliable source for exact line ranges):

```bash
git status --short
git diff HEAD        # all uncommitted changes vs the last commit
git diff --staged    # add this if some changes are already staged
```

Use these to confirm *which* files and lines changed; use your session memory to understand *why*. If it isn't a git repo, work from session context and give your best line estimates.

Also capture the absolute repo root so every reference becomes a clickable VS Code link:

```bash
git rev-parse --show-toplevel   # absolute path to the repo root
```

Put it in the JSON's top-level `root`. The renderer then builds `vscode://file/<root>/<relative path>:<line>` for each reference (it uses the first line number in the range). File paths in `refs` stay **repo-relative**; `root` makes them absolute. Omit `root` only if there's no repo — links just won't resolve.

### 2. Identify the logical changes and order them causally

Group the edits into behaviour-level units (see the idea above). Then order them the way you'd tell the story of building this work: the change that had to happen **first** to make the rest possible comes first, then the next link in the chain, down to the last. This is *dependency / narrative* order — not file order, and not the order you happened to type things in.

> Rule of thumb: if change B only makes sense because change A exists, A comes before B.

### 3. Describe the logic — not the code

For each logical change, write a short **before** and **after** in plain language about *behaviour*, not implementation:

- ✅ "Toggling a favourite waited for the server, then refetched the whole list, flashing the UI."
- ❌ "Removed `await api.toggle()` and the `refetchAll()` call from `onClick`."

Pick a `type`:
- `added` — new behaviour with no prior equivalent → leave **before** empty.
- `removed` — behaviour taken away → leave **after** empty.
- `modified` — behaviour replaced or changed → fill both.

### 4. Collect references

For each logical change, list every file it touches and **where** — mirroring the two sides of the real diff:

- `before` — the **old-file** line range for lines that were removed or changed. Renders in the **left** column.
- `after` — the **new-file** line range for lines that were added or changed. Renders in the **right** column.

Read these straight off the hunk headers (`@@ -old +new @@`) and the `-`/`+` lines: the `-` side gives `before`, the `+` side gives `after`. So a pure insertion has only `after`; a pure deletion has only `before`; a genuinely modified spot has both; a brand-new (or deleted) file has only one side. Note this is independent of the change's `type` — a behaviour can be `modified` yet, if you achieved it purely by adding code, every ref is `after`-only. A single ref may carry both sides, and a change may list several files and several ranges. Example: `{ "file": "src/store/favourites.ts", "before": "12-44", "after": "12-58" }`.

### 5. Pick the editor (first run), render, and show it

**Editor — first run only.** Clickable references open in the user's editor. Check for a saved choice first:

```bash
cat ~/.config/logicai-diff/config.json 2>/dev/null
```

If it doesn't exist, ask the user **once** which editor they use — offer three common options and let them name another:

> "Which editor should I open files in? (1) VS Code  (2) Cursor  (3) PhpStorm — or just tell me another."

Map the answer to an open-URL template. Placeholders: `{path}` = absolute path, `{path_enc}` = URL-encoded path, `{line}` = line number.

| Editor | `open_url_template` |
| --- | --- |
| VS Code | `vscode://file{path}:{line}` |
| Cursor | `cursor://file{path}:{line}` |
| Windsurf | `windsurf://file{path}:{line}` |
| PhpStorm | `phpstorm://open?file={path_enc}&line={line}` |
| WebStorm | `webstorm://open?file={path_enc}&line={line}` |
| IntelliJ IDEA | `idea://open?file={path_enc}&line={line}` |

For anything not in this list, work out that editor's URL scheme — search the web if you're unsure — build the `{path}`/`{line}` template, then save it. Persist the choice so you never ask again:

```bash
mkdir -p ~/.config/logicai-diff
cat > ~/.config/logicai-diff/config.json <<'JSON'
{ "editor": "PhpStorm", "open_url_template": "phpstorm://open?file={path_enc}&line={line}" }
JSON
```

On every run, read this file and pass `editor` and `open_url_template` straight into the render JSON.

**Render.** Write the JSON (schema below) to a temp file, then render to an explicit absolute path **in the temp directory** (never inside the repo) and keep that path in a variable:

```bash
OUT="${TMPDIR:-/tmp}/logicai-diff-$(date +%s).html"
node "<skill_dir>/scripts/render.mjs" /tmp/ld.json "$OUT"
```

`render.mjs` is zero-dependency Node and owns all styling and layout — supply only data, so the output is identical across runs. Don't hand-write HTML.

**Show it — prefer inline, fall back to the browser.** Choose by your runtime:

- **Artifact-capable chat surfaces** (claude.ai, the Claude desktop *chat* tab) render HTML inline in the conversation. This is the **preferred** path: surface the HTML that `render.mjs` produced as an inline artifact so the diff appears right in the chat — do **not** open a browser. Use your environment's normal mechanism for showing an HTML artifact (the content is the file at `$OUT` — read it back if you need it). The reader should see the diff in the conversation, not a new tab.
- **File/agent surfaces with no artifact pane** (Claude Code in a terminal, the IDE extensions, the desktop *Code*/Cowork tab) can't render inline, so open the file in the browser:

```bash
open "$OUT"     # macOS;  xdg-open on Linux;  start on Windows
```

  Open only `$OUT`. **Never** run `open .`, `open *.html`, or open any file from the project — its `index.html`, `dist/`, build output, or anything else in the repo. The diff lives in the temp directory, not the repo.

If you're unsure whether your surface can render inline, try the inline artifact first and only open the browser if that isn't available.

### 6. Replace the summary — don't duplicate it

This artifact **is** the summary. Shown inline, the rendered diff is the whole answer; opened in a browser, leave just a single terse pointer line in chat (e.g. `logicAI-diff → /tmp/logicai-diff-….html`). Either way, do **not** also write a prose recap of the changes — that prose is the exact thing this skill exists to replace.

## JSON schema

```json
{
  "title": "Short task title (optional)",
  "summary": "One sentence on the overall outcome (optional)",
  "root": "/abs/path/to/repo (optional; from `git rev-parse --show-toplevel`, makes refs clickable)",
  "editor": "VS Code (optional; from config — used for the link tooltip)",
  "open_url_template": "vscode://file{path}:{line} (optional; from config — {path}=abs, {path_enc}=encoded, {line}=line)",
  "changes": [
    {
      "order": 1,
      "type": "modified",
      "title": "Short name of the logical change",
      "before": "How it behaved before (omit/empty for `added`)",
      "after":  "How it behaves now (omit/empty for `removed`)",
      "refs": [
        { "file": "src/store/favourites.ts", "before": "12-44", "after": "12-58" },
        { "file": "src/api/favourites.ts",    "after": "8-22" }
      ]
    }
  ]
}
```

`changes` must already be in causal order — the renderer shows them top-to-bottom exactly as given. `order` is just the displayed number; omit it and the index is used.

## Worked example

A feature where toggling a "favourite" gift card became optimistic. Four edits across four files collapse into four logical changes, in build order:

```json
{
  "title": "Optimistic favourites for gift cards",
  "summary": "Toggling a favourite now updates instantly and rolls back on error, instead of waiting on the server and refetching the whole list.",
  "changes": [
    {
      "order": 1,
      "type": "modified",
      "title": "Store favourites as a keyed cache instead of a flat list",
      "before": "Favourites were held as a flat array and refetched wholesale, so a single card could not be updated without replacing everything.",
      "after": "Favourites live in a map keyed by card id, so one card's state can be flipped in place — the precondition for any optimistic update.",
      "refs": [{ "file": "src/store/favourites.ts", "before": "12-44", "after": "12-58" }]
    },
    {
      "order": 2,
      "type": "added",
      "title": "Optimistic toggle action with rollback",
      "before": "",
      "after": "A new toggle action flips the cached card immediately, fires the API call in the background, and restores the previous value if the call fails.",
      "refs": [
        { "file": "src/store/favourites.ts", "after": "60-104" },
        { "file": "src/api/favourites.ts", "after": "8-22" }
      ]
    },
    {
      "order": 3,
      "type": "modified",
      "title": "Favourite button reflects state instantly",
      "before": "The heart button showed a spinner, awaited the server, then triggered a full list refetch before updating.",
      "after": "The button dispatches the optimistic toggle and updates on the spot — no spinner, no waiting.",
      "refs": [{ "file": "src/components/FavouriteButton.tsx", "before": "18-40", "after": "18-46" }]
    },
    {
      "order": 4,
      "type": "removed",
      "title": "Drop the full-list refetch on every toggle",
      "before": "Each toggle called refetchAllFavourites(), reloading the entire list and causing a visible flash.",
      "after": "",
      "refs": [{ "file": "src/components/FavouritesList.tsx", "before": "70-78" }]
    }
  ]
}
```

This renders as one full-width table: change #1 with a yellow *before* / green *after* (a `modified`), #2 with an empty left cell and green right cell (an `added`), #3 another `modified`, and #4 with a red *before* and empty *after* (a `removed`) — each followed by its file references.

## Anti-patterns

- **One row per hunk or per file.** Group by behaviour instead.
- **Pasting code into the cells.** References only — file names and line numbers.
- **Ordering by filename or edit order.** Order by the build story (dependency order).
- **Writing both the HTML and a prose summary.** The HTML replaces the prose.
- **Inventing line numbers when git was available.** Check the real diff first.
