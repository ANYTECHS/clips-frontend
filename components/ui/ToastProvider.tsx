import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Auto-dismiss timers, keyed by toast id, so a toast that's still pending
  // when the provider unmounts doesn't fire setState afterward (or just sit
  // there holding its closure alive until it does).
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = dismissTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Acceptance Criteria: Auto-dismiss set to 5 seconds (5000ms) for screen readers
    const timer = setTimeout(() => {
      dismissTimersRef.current.delete(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
    dismissTimersRef.current.set(id, timer);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      
      {/* Acceptance Criteria: Container element has aria-live="polite" and role="status" */}
      <div 
        aria-live="polite" 
        role="status"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            // Acceptance Criteria: role="alert" and aria-live="assertive" for errors, role="status" for others
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            className={`p-4 rounded-md shadow-lg pointer-events-auto max-w-sm text-white ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

// Exporting RateLimitToast wrapper to satisfy the issue requirements explicitly
export const RateLimitToast = () => {
  const { addToast } = useToast();
  return {
    trigger: () => addToast('Too many requests. Please try again later.', 'error')
  };
};
