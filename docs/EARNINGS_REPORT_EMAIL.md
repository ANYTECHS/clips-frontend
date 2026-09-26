# Monthly earnings report email

Issue #820.

Creators asked for their monthly earnings automatically, by email, for tax
purposes.

## Flow

1. Creator switches on **Settings → Earnings Reports → Monthly Report Email**.
2. `POST /api/earnings/schedule-report` with `{ enabled: true }` sets
   `User.monthlyEarningsReport`.
3. Vercel Cron hits `POST /api/cron/earnings-reports` at 06:00 UTC on the 1st.
4. The route builds last month's report per opted-in user and emails it with a
   CSV attached.

## Files

| File | Role |
|---|---|
| `prisma/schema.prisma` | `User.monthlyEarningsReport`, `EarningsReportDelivery` |
| `app/api/earnings/schedule-report/route.ts` | GET/POST the preference |
| `app/api/cron/earnings-reports/route.ts` | The monthly sweep |
| `app/api/earnings/shared/report.ts` | CSV + HTML/text templates |
| `app/api/earnings/shared/mailer.ts` | Provider call with attachments |
| `components/settings/MonthlyReportSetting.tsx` | The toggle |
| `vercel.json` | `"0 6 1 * *"` |

## Decisions worth knowing

**Opt-in, not opt-out.** This mail carries a full transaction export. A creator
has to ask for their financial records to be posted to their inbox every
month, rather than having to notice and switch it off.

**Idempotent by `(userId, period)`.** Vercel Cron delivers at least once, and a
retry after a partial failure must not email someone their report twice. The
delivery row is claimed *before* any work, so a crash mid-send doesn't re-send
later. A failed month stays marked `failed` rather than being cleared for
retry — re-sending is a deliberate act, not something a re-run does on its own.

**An empty month is skipped.** An empty "here's your month" email is the
fastest way to get someone to switch the report off.

**The period is computed in UTC.** A creator in UTC+13 running the job at their
local midnight would otherwise see the boundary land a day off, and a tax
export that silently drops or duplicates a day's transactions is worse than one
a few hours out of step with the local calendar.

**Capped at 500 recipients per run.** The route runs inside a function timeout,
and a run killed halfway leaves no record of where it got to. Recipients are
ordered deterministically and already-sent users are skipped via the delivery
log, so a capped run that is re-invoked picks up where it stopped.

**CSV formula injection is neutralised.** Cells starting with `=`, `+`, `-` or
`@` are prefixed with a single quote — a transaction description carrying one
would otherwise execute when an accountant opens the file.

**The email is table-based with inline styles.** Not how anyone would write a
page, but email clients strip `<style>` blocks and have no flexbox.

**Unconfigured email logs rather than sends.** With `RESEND_API_KEY` /
`EMAIL_FROM` unset, the send is logged and reported as success so the cron path
can be exercised locally. That's right for development and wrong for
production, which is why the cron response includes `emailConfigured` — a
production run quietly logging instead of delivering is visible from the
response, not only from the logs.

## Environment

```
CRON_SECRET=...                 # Bearer token the scheduler presents
RESEND_API_KEY=re_...           # unset ⇒ email is logged, not sent
EMAIL_FROM=noreply@clipcash.ai
NEXTAUTH_URL=https://...        # base for the "turn this off" link
```

## Migration

The Prisma schema changes need a migration before this works:

```bash
npx prisma migrate dev --name monthly_earnings_report
```

One is **not** included in this branch — see the PR description.
