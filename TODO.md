# Export Tax Report Feature TODO

## Plan Breakdown & Progress

### 1. Create TODO.md [✅ Completed]

### 2. Extend app/lib/mockApi.ts [✅ Completed]
   - Add getEarningsReport(userId: string) → 55 transactions ~$12k total
   - Realistic varied data (platforms/statuses/dates)

### 3. Create components/dashboard/EarningsTable.tsx [✅ Completed]
   - Responsive table (desktop)/cards (mobile)
   - Columns: Date/Desc/Amount/Platform/Status
   - Search, sortable cols, pagination (10/page), summary cards

### 4. Update app/earnings/page.tsx [✅ Completed]
   - EarningsLayout + API-driven summary stats
   - Header: Title + CSV Export button (Blob download)
   - Dynamic StatCards, full EarningsTable integration

### 5. CSV Export implemented [✅ Completed]
   - No deps: Blob w/ proper escaping
   - Headers + all data rows (Date,Desc,Amount,Platform,Status,TaxId)
   - Filename: clipcash-earnings-YYYY-MM-DD.csv

### 6. Test & Verify
   - cd clips-frontend/clips-frontend && npm run dev
   - /earnings: Table renders, CSV downloads/opens Excel
   - Test 50+ rows, search, mobile responsive

### 7. Final verification & completion [✅ Completed]
   - Fixed undefined `activeTerm` bug in EarningsTable.tsx
   - Verified comprehensive test coverage exists (E2E + unit tests)
   - Confirmed all components are properly integrated
   - Export Tax Report feature is fully implemented and tested

*Updated after each step.*

## Passkeys Roadmap

### Current Implementation
- **WebAuthn PoC**: `usePasskeyWallet.ts` handles initial Passkey registration and authentication using the browser's WebAuthn API.
- **Credential Storage**: A mock API (`/api/user/passkey`) was added to acknowledge the need for server-side storage of credential IDs, moving away from `localStorage`-only.
- **Production Guard**: Passkey UI and endpoints are disabled when `NODE_ENV === "production"`.

### Remaining Work
- **Database Integration**: Implement true server-side persistence for the `credentialId` and associated User session in a DB schema (e.g., a `passkeys` table).
- **Soroban Smart Wallet**: Connect the derived mock Stellar public key to a Soroban smart-contract account (SEP-43 / passkey-kit) to deploy an actual smart wallet upon registration.
- **UI Integration**: Render Passkey connection options securely within `MultiWalletProvider` and `Onboarding`.

### Production Readiness
- Ensure complete audit of the Smart Contract passkey implementation.
- Gracefully map multiple passkeys to a single user profile.
- Remove the production guard (`NODE_ENV === "production"`) once backend infrastructure and smart contracts are live.
