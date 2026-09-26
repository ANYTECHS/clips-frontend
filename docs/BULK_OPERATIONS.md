# Bulk operations

Issue #1059.

## Pieces

| File | Role |
|---|---|
| `app/hooks/useBulkSelection.ts` | Multi-select state |
| `app/hooks/useBulkOperation.ts` | Chunked execution + progress |
| `components/clips/BulkActionBar.tsx` | The action bar UI |
| `app/api/clips/export/route.ts` | Bulk metadata export (new) |
| `app/api/clips/bulk/route.ts` | Bulk tag / status (existing) |
| `app/api/clips/route.ts` (DELETE) | Bulk soft-delete (existing) |
| `app/api/clips/post/route.ts` | Bulk platform posting (existing) |

Most of the server side already existed. What was missing was the export
endpoint and the entire client half.

## Selection is ids, and it spans pages

The list underneath a selection moves — a filter changes, a page loads, a clip
finishes processing and its status flips. Holding indices means the selection
silently points at different rows after any of that; holding whole objects
means acting on a stale copy. Ids survive re-fetches.

Selection deliberately outlives the current page: a creator tagging a campaign
works through several pages before acting. So `selectAllVisible` **adds** to
the selection rather than replacing it, and the action bar reports
"N on other pages" so nobody is surprised by what a bulk delete covers.

`visibleSelectedIds` narrows to what is on screen, for the tri-state
select-all checkbox.

## Work is chunked

Bulk endpoints cap a request at 100 ids. More than that has to be split, and
splitting is also what makes progress meaningful: one request for 400 clips is
a spinner that either finishes or doesn't, while four requests of 100 give a
bar that moves and a partial result if something fails halfway.

## Partial failure is the normal case

Bulk platform posting talks to four external APIs per clip and some will
reject. Treating the whole operation as failed because one clip did would throw
away the work that succeeded, so each chunk's failures are collected and
reported alongside the successes.

When a request throws at the transport level, every id in that chunk is
recorded as failed — there's no way to tell which ones landed, and
overreporting beats claiming a success we can't see.

Cancelling stops after the in-flight chunk. Completed chunks are **not** rolled
back; the progress readout is the record of what happened.

## Export

`POST /api/clips/export` with `{ clipIds, format: "csv" | "json" }`.

Exports **metadata**, not video files. Zipping and streaming media would be a
long-running job with its own progress and storage lifecycle;
`/api/clips/[id]/download` already handles single files, and the export
includes each clip's `videoUrl`.

Rows come back in the caller's selection order, not store order, so the file
matches what was highlighted on screen.

CSV cells starting with `=`, `+`, `-` or `@` are prefixed with a single quote.
Spreadsheet software reads those as the start of a formula, so a clip titled
`=1+1` — or something less innocent — would execute when the export is opened.

## Wiring it into a list

```tsx
const selection = useBulkSelection(clips.map((c) => c.id));
const bulk = useBulkOperation();

async function bulkDelete() {
  await bulk.run(selection.selectedIds, async (clipIds) => {
    const res = await fetch("/api/clips", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipIds }),
    });
    return chunkResultFromResponse(res, clipIds);
  });
  selection.clear();
  await refetch();
}

<BulkActionBar
  selectedCount={selection.selectedCount}
  visibleSelectedCount={selection.visibleSelectedIds.length}
  progress={bulk.progress}
  onDelete={bulkDelete}
  onExport={bulkExport}
  onPost={bulkPost}
  onTag={openTagDialog}
  onClear={selection.clear}
  onCancel={bulk.cancel}
/>
```

The bar is not mounted anywhere yet — see the PR description.
