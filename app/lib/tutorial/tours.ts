/**
 * The tours themselves (Issue #1065).
 *
 * Each step says what the thing is *for*, not what it is. "Your clips land
 * here once processing finishes" tells a new user something; "This is the
 * clips grid" tells them what they can already see.
 */

import type { Tour, TourId } from "./types";

export const TOURS: Record<TourId, Tour> = {
  dashboard: {
    id: "dashboard",
    name: "Dashboard tour",
    description: "A two-minute look at where everything lives.",
    steps: [
      {
        target: "sidebar-nav",
        title: "Everything starts here",
        body: "Projects, clips, earnings and settings. On a tablet or phone, open it with the menu button.",
        placement: "right",
        route: "/dashboard",
      },
      {
        target: "quick-upload",
        title: "Upload a source video",
        body: "Drop in a long video and the AI finds the moments worth clipping. This is the only step you have to do yourself.",
        placement: "bottom",
      },
      {
        target: "plan-usage",
        title: "Keep an eye on your quota",
        body: "Each transform spends part of your monthly allowance. This fills up as you go.",
        placement: "bottom",
      },
      {
        target: "notifications",
        title: "We'll tell you when it's done",
        body: "Processing runs in the background — you don't have to keep this tab open.",
        placement: "bottom",
      },
    ],
  },

  "create-clip": {
    id: "create-clip",
    name: "Making your first clip",
    description: "How a source video becomes a publishable clip.",
    steps: [
      {
        target: "project-selector",
        title: "Pick a project",
        body: "Projects group clips from the same source video, so a series stays together.",
        placement: "bottom",
        route: "/projects",
      },
      {
        target: "clip-grid",
        title: "Your clips land here",
        body: "Each one gets a virality score. Sort by it to see what's worth posting first.",
        placement: "top",
      },
      {
        target: "clip-preview",
        title: "Check before you publish",
        body: "Preview the clip, then publish or mint it. Anything that needs a moderation review is marked here.",
        placement: "left",
      },
    ],
  },

  earnings: {
    id: "earnings",
    name: "Getting paid",
    description: "Where the money shows up and how to withdraw it.",
    steps: [
      {
        target: "earnings-summary",
        title: "What you've earned",
        body: "Updated as platforms report views. Pending amounts clear once the platform settles.",
        placement: "bottom",
        route: "/earnings",
      },
      {
        target: "wallet-info",
        title: "Your payout wallet",
        body: "Earnings settle to this Stellar address. Change it in settings before your next payout.",
        placement: "top",
      },
    ],
  },
};

export const TOUR_ORDER: TourId[] = ["dashboard", "create-clip", "earnings"];

export function getTour(id: TourId): Tour {
  return TOURS[id];
}
