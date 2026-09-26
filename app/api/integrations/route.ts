import { NextRequest, NextResponse } from "next/server";
import { paginateItems, parsePaginationParams } from "@/app/api/pagination";

const integrations = [
  {
    id: "zapier",
    name: "Zapier",
    description: "Trigger workflows when clips are ready.",
    events: ["clip.completed", "project.completed"],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send notifications to a channel.",
    events: ["clip.completed", "earning.created"],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Sync clip metadata to a database.",
    events: ["clip.created", "clip.completed"],
  },
  {
    id: "webhook",
    name: "Custom webhook",
    description: "Deliver signed events to any HTTPS endpoint.",
    events: ["*"],
  },
];

export async function GET(request: NextRequest) {
  const { items, meta } = paginateItems(
    integrations,
    parsePaginationParams(new URL(request.url).searchParams, 100)
  );
  return NextResponse.json({ data: items, error: null, meta });
}
