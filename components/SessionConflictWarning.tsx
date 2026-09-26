import { useSessionSynchronization } from "@/app/hooks/useSessionSynchronization";

export default function SessionConflictWarning() {
  const { conflict, dismissConflict } = useSessionSynchronization();
  if (!conflict) return null;
  return (
    <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 rounded-xl border border-yellow-400/30 bg-yellow-950/90 p-4 text-sm text-yellow-100 shadow-xl">
      <strong>Another session updated this account.</strong> Your changes will use the most recent saved version.
      <button type="button" className="ml-3 underline" onClick={dismissConflict}>Dismiss</button>
    </div>
  );
}
