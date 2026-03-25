interface IconProps {
  className?: string;
  "aria-hidden"?: boolean;
}

export function YouTubeIcon({ className, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden={ariaHidden}
    >
      <title>YouTube</title>
      <path
        d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81z"
        fill="#FF0000"
      />
      <path d="M9.75 15.5l6.25-3.5-6.25-3.5v7z" fill="#fff" />
    </svg>
  );
}
