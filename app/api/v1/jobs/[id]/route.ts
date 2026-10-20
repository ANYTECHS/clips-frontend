import {
  GET as legacyGetJob,
  POST as legacyRestartJob,
} from "@/app/api/jobs/[id]/route";
import { versionedRoute } from "@/app/api/versioning";

export const GET = versionedRoute("v1", legacyGetJob);
export const POST = versionedRoute("v1", legacyRestartJob);
