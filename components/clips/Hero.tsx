"use client";

import React from "react";

export default function Hero() {
  return (
    <div className="text-center space-y-4">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
        Turn Your Streams into
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand/60">
          {" "}Viral Clips
        </span>
      </h1>
      <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
        AI-powered clip generation that helps you create engaging content from your live streams in seconds.
      </p>
    </div>
  );
}
