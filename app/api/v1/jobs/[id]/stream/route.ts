import { GET as legacyGetJobStream } from "@/app/api/jobs/[id]/stream/route";
import { versionedRoute } from "@/app/api/versioning";

export const GET = versionedRoute("v1", legacyGetJobStream);
