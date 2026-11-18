import React from "react";
import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  variant?: "simple" | "full";
  className?: string;
  size?: number;
}

export default function Logo({ variant = "full", className = "", size = 32 }: LogoProps) {
  if (variant === "simple") {
    return (
      <div
        className={`relative rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.jpeg"
          alt="enclips logo"
          width={size}
          height={size}
          className="object-contain w-full h-full rounded-lg"
          priority
        />
      </div>
    );
  }

  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 text-[20px] font-extrabold tracking-tight text-[#B6FF4A] hover:opacity-90 transition-opacity ${className}`}
    >
      <div
        className="relative rounded-[8px] overflow-hidden flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.jpeg"
          alt="enclips logo"
          width={size}
          height={size}
          className="object-contain w-full h-full rounded-[8px]"
          priority
        />
      </div>
      <span>
      <span className="font-extrabold tracking-tight text-white">en</span>
      <span className="font-extrabold tracking-tight text-[#B6FF4A]">clips</span>
      </span>
    </Link>
  );
}
