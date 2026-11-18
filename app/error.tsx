'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="space-y-6 max-w-md">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold tracking-[0.1em] uppercase">
          <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
          Application Error
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tight">
          Something went wrong!
        </h1>
        
        <p className="text-[#a1a1aa] text-lg">
          We encountered an unexpected error. Don&apos;t worry, your data is safe.
          Our team has been notified.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button
            onClick={() => reset()}
            className="px-8 py-3 bg-brand text-black font-bold rounded-xl hover:bg-brand/90 transition-all shadow-[0_0_20px_rgba(0,229,143,0.3)] active:scale-95"
          >
            Try again
          </button>
          
          <Link
            href="/"
            className="px-8 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all active:scale-95"
          >
            Go Home
          </Link>
        </div>
        
        {error.digest && (
          <p className="text-[#71717A] text-xs pt-8">
            Error ID: <code className="bg-white/5 px-1 rounded">{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
