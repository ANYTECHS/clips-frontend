import React from "react";

interface BackgroundGlowProps {
  variant?: "landing" | "dashboard" | "simple";
}

export default function BackgroundGlow({ variant = "simple" }: BackgroundGlowProps) {
  if (variant === "landing") {
    return (
      <>
        <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-[#39FF14]/[0.06] rounded-full blur-[160px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-[#00C853]/[0.05] rounded-full blur-[130px] pointer-events-none translate-x-1/3" />
        <div className="fixed bottom-0 left-1/2 w-[800px] h-[800px] bg-[#B6FF4A]/[0.03] rounded-full blur-[160px] pointer-events-none -translate-x-1/2 translate-y-1/2" />
      </>
    );
  }

  if (variant === "dashboard") {
    return (
      <>
        <div className="fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-[#00C853]/[0.04] blur-[140px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
        <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-[#39FF14]/[0.03] rounded-full blur-[120px] pointer-events-none translate-x-1/3" />
      </>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#00C853]/[0.04] blur-[120px]" />
      <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-[#39FF14]/[0.03] blur-[100px]" />
    </div>
  );
}
