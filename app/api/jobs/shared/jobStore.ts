import type { Job } from "./types";

// Shared in-memory job storage for demo purposes
// Production would use Redis/Database
export const jobStore = new Map<string, Job>();
