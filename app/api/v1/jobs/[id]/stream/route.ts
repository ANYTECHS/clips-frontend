import { GET as legacyGetJobStream } from "@/app/api/jobs/[id]/stream/route";
import { versionedRoute } from "@/app/api/versioning";
import { requireScope } from "@/app/lib/apiKey";

export const GET = versionedRoute("v1", requireScope("read")(legacyGetJobStream));
