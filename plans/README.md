# Animation plans

Written against commit `58df21d`. The working tree was dirty; each plan quotes the code to match and says to stop if that code is gone.

| Plan | Title | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| 001 | Shorten hover reveals | MEDIUM | DONE | — |
| 002 | Press scale on field buttons | MEDIUM | DONE | — |
| 003 | Drop will-change on open popovers | MEDIUM | DONE | — |
| 004 | Hide the dock instantly on ⌘\ | HIGH | DONE | — |

## Order

1. **001** — scrub hover and the subsection grip. Felt on every pass through the panel.
2. **002** — press scale on `FieldButton`. Different file from 001. If 001 already changed the scrub button to `transition-[opacity,transform]`, leave that class in place.
3. **003** — color popover and icon picker. Independent.
4. **004** — ⌘\ and the one sentence in `AGENTS.md`. Do it last so the shortcut check is against the other motion, not instead of it.

No plan edits the same lines. 001 and 004 can both add exports; neither should delete the other's.

## Out of scope

Section height (`grid-template-rows`, 200 / 140ms) and the dock's `top` / `left` travel stay. They are layout on purpose. Context menus stay instant.
