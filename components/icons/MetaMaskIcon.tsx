import React from "react";

export interface IconProps {
  className?: string;
  size?: number;
}

export const MetaMaskIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 5l7-3 7 3 2 7-4 5-2 4-6-2-6 2-2-4-4-5 2-7z" />
    <path d="M10 9l1 2 1-2" />
    <path d="M14 9l1 2 1-2" />
    <path d="M9 13h6" />
  </svg>
);

export default MetaMaskIcon;
