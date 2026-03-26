import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', fullWidth = false, children, ...props }, ref) => {
    let variantStyles = '';
    if (variant === 'primary') {
      variantStyles = 'bg-[#17f9bf] text-black hover:bg-[#88ffd9] font-medium shadow-[0_0_15px_rgba(23,249,191,0.3)] hover:shadow-[0_0_25px_rgba(23,249,191,0.5)]';
    } else if (variant === 'secondary') {
      variantStyles = 'bg-gray-800 text-white hover:bg-gray-700';
    } else if (variant === 'outline') {
      variantStyles = 'border border-gray-700 text-white hover:border-[#17f9bf] hover:text-[#17f9bf]';
    }

    return (
      <button
        ref={ref}
        className={`px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${
          fullWidth ? 'w-full' : ''
        } ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
