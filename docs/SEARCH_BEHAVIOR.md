# Search Behavior

Global search is exposed by `GET /api/search?q=&types=clips,projects,earnings` and powers the command palette.

## Matching

Search normalizes case and punctuation before matching. Results are matched in this order:

- Exact title/field match.
- Prefix match.
- Substring match.
- Fuzzy word match for small typos.

Each returned item includes `relevance` from `0` to `100` and `matchType` (`exact`, `prefix`, `substring`, or `fuzzy`). Results are sorted by relevance inside each group and capped at 10 clips, 10 projects, and 10 earnings.

## Suggestions

The response also includes up to five `suggestions`. Suggestions are derived from matching clip titles, project titles, and earning descriptions, and are shown in the command palette when a query is close to known content.
