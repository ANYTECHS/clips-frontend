import React from "react";

export interface IconProps {
  className?: string;
  size?: number;
}

export const PhantomIcon = ({ className, size = 24 }: IconProps) => (
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
    <circle cx="12" cy="12" r="10" />
    <path d="M12 7.5v9" />
    <path d="M8.5 9.5h7" />
    <path d="M8.5 14.5h7" />
  </svg>
);

export default PhantomIcon;
