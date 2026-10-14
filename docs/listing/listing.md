# Clear Properties — community listing

Paste these into community.obsidian.md. Search (in the app and on the website)
only looks at the **name + short description**, so the short description is
written for search; About is written to convince.

## Short description (≤200, 199 chars)

Delete, remove or strip all properties (YAML frontmatter / front matter metadata) from a note in one click with a button beside the properties block. Undoable. Quick cleanup of old notes, mobile too.

Why this wording (checked with `search_rank.py` against the 2026-10 registry,
8824 plugins; app-search rules: every word must appear as a substring, results
sorted by downloads, a new plugin counts as 0 downloads):

- Matches 24 of 26 test queries (`search-queries.txt`), and for all 24 fewer
  than 5 plugins match, so a new plugin can still show up in the top 5.
- The first draft (127 chars) matched only 7.
- Synonyms on purpose: delete / remove / strip, YAML / frontmatter / front
  matter / metadata, cleanup. "Clean" and "clear" come from the name.
- Not matched: "bulk delete properties" (it works one note at a time, so it
  should not claim bulk) and "reset properties".

## About (≤1000, plain text)

The backend field is plain text: Markdown list markers and emphasis are not
rendered, so this is written as short paragraphs. Paste everything between the lines.

---

Cleaning up old notes often means getting rid of properties you no longer use. Obsidian only lets you delete them one at a time, each through its own menu.

Clear Properties adds a thin line to the left of a note's properties. Hover the properties to see it, click the trash icon on it, and every property is deleted at once, together with the --- lines and the blank lines after them.

The line is drawn like the hairline of the "+ Add property" button, so it stays out of the way and fits most themes. On phones and tablets there is no hover, so there it is always visible: tap it.

Nothing is lost by accident. A notice tells you how many properties were deleted and has an Undo link; in editing view Ctrl+Z / Cmd+Z works too. It works in editing and reading view, and there is a command for a hotkey.

The interface is in English and Chinese, following Obsidian's language.

---

## Icon

`trash-2` (the same icon as the button), any color.

## Categories

1. Editing (primary)
2. Interface

## Screenshots

- Desktop slot: `desktop-1200x800.png` (from `../hero.svg`)
- Mobile slot: `phone-900x1600.png` (from `phone.svg`)
