import { NextResponse } from "next/server";

export interface BillingPlan {
  id: "free" | "pro" | "enterprise";
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  quota: number;
  description: string;
  features: string[];
  popular?: boolean;
}

export async function GET() {
  const plans: BillingPlan[] = [
    {
      id: "free",
      name: "Free",
      price: 0,
      currency: "usd",
      interval: "month",
      quota: 10,
      description: "Perfect for testing and casual clip generation.",
      features: [
        "10 AI transformations per month",
        "720p HD export quality",
        "Standard processing speed",
        "Community support",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: 29,
      currency: "usd",
      interval: "month",
      quota: 100,
      description: "For professional creators & viral clip strategists.",
      features: [
        "100 AI transformations per month",
        "4K Ultra HD export quality",
        "Priority GPU processing",
        "Anime & custom AI style presets",
        "Direct social platform posting",
        "Email & Discord priority support",
      ],
      popular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 99,
      currency: "usd",
      interval: "month",
      quota: 1000,
      description: "High-volume teams, agencies & media networks.",
      features: [
        "1,000 AI transformations per month",
        "8K Ultra HD export quality",
        "Dedicated GPU cluster node",
        "Custom style training & API access",
        "Multi-user team workspaces",
        "24/7 Dedicated account manager & SLA",
      ],
    },
  ];

  return NextResponse.json({ plans });
}
