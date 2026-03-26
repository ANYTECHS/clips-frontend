import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && <label className="text-sm font-medium text-gray-200">{label}</label>}
        <input
          ref={ref}
          className={`w-full px-4 py-3 bg-[#121212] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#17f9bf] focus:border-transparent transition-all ${className}`}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = 'Input';
