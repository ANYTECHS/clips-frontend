import React, { createContext, useContext, useState, useCallback } from 'react';

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

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Acceptance Criteria: Auto-dismiss set to 5 seconds (5000ms) for screen readers
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      
      {/* Acceptance Criteria: Container element has aria-live="polite" */}
      <div 
        aria-live="polite" 
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            // Acceptance Criteria: role="alert" for errors, role="status" for others
            role={toast.type === 'error' ? 'alert' : 'status'}
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
