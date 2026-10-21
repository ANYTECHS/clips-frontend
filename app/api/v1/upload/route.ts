import { POST as legacyUpload } from "@/app/api/upload/route";
import { versionedRoute } from "@/app/api/versioning";
import { requireScope } from "@/app/lib/apiKey";

export const POST = versionedRoute("v1", requireScope("write")(legacyUpload));
