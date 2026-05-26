"use client";

import React from "react";

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
};

export default function Switch({ checked, onChange, ariaLabel }: SwitchProps) {
  const toggle = () => onChange(!checked);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={`relative inline-flex items-center h-7 w-12 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/40 ${
        checked ? "bg-brand" : "bg-surface-hover"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 bg-white rounded-full transform transition-transform duration-200 shadow-sm ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
