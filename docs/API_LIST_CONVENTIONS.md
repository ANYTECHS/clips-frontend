# List endpoint conventions

Issue #949. Implemented in `app/api/lib/listQuery.ts`.

Each list endpoint had grown its own conventions. `/api/clips` read `page` +
`pageSize` and sorted implicitly by insertion order; other routes used
different names; none accepted a sort direction. A client couldn't carry a
working query from one endpoint to another, and every new endpoint reinvented
the parsing — usually without validating it.

## Parameters

| Parameter | Meaning |
|---|---|
| `page` | 1-based page number |
| `pageSize` | Rows per page, capped at 100 (default 20) |
| `sort` | Field to sort by — must be in the endpoint's allow-list |
| `order` | `asc` or `desc` |
| `q` | Free-text search across the endpoint's searchable fields |
| `dateFrom` / `dateTo` | Inclusive ISO date range |
| `<field>Min` / `<field>Max` | Inclusive numeric range |
| `<field>` | Exact match; `,` separates multiple values |

## Response

```json
{
  "data": {
    "clips": [],
    "total": 137,
    "page": 2,
    "pageSize": 20,
    "totalPages": 7,
    "sort": "createdAt",
    "order": "desc"
  },
  "error": null
}
```

`total` is the count *before* pagination, so a client can render
"showing 21–40 of 137" without a second request.

## Decisions worth knowing

**Sort fields are an allow-list.** `sort` names a property read off every
record. Taking it straight from the query string lets a caller pick which field
the server touches — which leaks record shape through timing and error
behaviour and, on a database-backed store, is one refactor away from being
injectable. An unknown field is a 400, not a silent `undefined` comparison that
returns rows in arbitrary order the client renders as if sorted.

**An inverted range is a 400.** `durationMin=60&durationMax=10` can only ever
match nothing. Reporting it beats an empty list the caller reads as
"no results".

**Missing values sort last, in both directions.** Ascending with nulls first
would put empty records at the top of the list, which is never what someone
browsing wants to see first.

**Tags narrow, they don't widen.** `?tags=travel,timelapse` requires **both**.
OR would widen the list as the user added tags — the opposite of what a filter
control implies.

**An empty filter means no filter.** An absent query parameter must never
silently empty the list.

**Sorting returns a new array.** Sorting in place would mutate a store's own
array and leave the next caller reading it in whatever order the last request
asked for.

## Adding it to an endpoint

```ts
export const MY_SORT_FIELDS = ["createdAt", "name"] as const;

export const myQuerySchema = createListQuerySchema(MY_SORT_FIELDS).extend({
  status: z.string().optional().default(""),
});
```

Then filter with `matchesAny` / `containsAll` / `withinRange` /
`withinDateRange` / `matchesQuery`, sort with `applySort`, and slice with
`paginate`.
