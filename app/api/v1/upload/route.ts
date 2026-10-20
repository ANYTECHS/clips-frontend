import { POST as legacyUpload } from "@/app/api/upload/route";
import { versionedRoute } from "@/app/api/versioning";

export const POST = versionedRoute("v1", legacyUpload);
