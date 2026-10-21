import { GET as legacyGetJob, POST as legacyRestartJob } from "@/app/api/jobs/[id]/route";
import { versionedRoute } from "@/app/api/versioning";
import { requireScope } from "@/app/lib/apiKey";

export const GET = versionedRoute("v1", requireScope("read")(legacyGetJob));
export const POST = versionedRoute("v1", requireScope("write")(legacyRestartJob));
