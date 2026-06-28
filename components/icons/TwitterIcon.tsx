import React from "react";

export interface IconProps {
  className?: string;
  size?: number;
}

export const TwitterIcon = ({ className, size = 24 }: IconProps) => (
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
  >
    <path d="M22 4s-1 1-2 1.5C19 4.5 18 4 17 4c-2 0-3 2-3 4v1C10 9 7 7 5 5c0 0-3 5 2 7-1 0-2 0-3-.5 0 2 2 4 4 4-1 .5-2 .5-3 .5 1 2 3 3 5 3 6 0 9-5 9-9v-1c1-.5 2-1.5 2-1.5z"></path>
  </svg>
);

export default TwitterIcon;
