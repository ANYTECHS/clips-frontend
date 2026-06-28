// TODO(issue #7): Once the real API backend is resolved, replace the re-exports
// below with direct API calls (e.g. to /api/v2/dashboard). Until then, this barrel
// delegates to the single source of truth at app/lib/apiClient.ts.
export {
  fetchDashboardFromAPI,
  fetchUserFromAPI,
  fetchEarningsFromAPI,
} from "../lib/apiClient";
