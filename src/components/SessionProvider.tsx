import { createContext, useContext, ReactNode } from 'react';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

interface SessionContextValue {
  showTimeoutWarning: boolean;
  timeRemaining: number;
  resetTimeout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { showWarning, timeRemaining, resetTimeout } = useSessionTimeout({
    enabled: true,
  });

  return (
    <SessionContext.Provider
      value={{
        showTimeoutWarning: showWarning,
        timeRemaining,
        resetTimeout,
      }}
    >
      {children}
      
      {/* Timeout warning overlay */}
      {showWarning && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Session Expiring</h3>
                <p className="text-sm text-muted-foreground">
                  Time remaining: {Math.floor(timeRemaining / 60000)}:{String(Math.floor((timeRemaining % 60000) / 1000)).padStart(2, '0')}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              Your session will expire due to inactivity. Click anywhere or press any key to stay active.
            </p>
            <button
              onClick={resetTimeout}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
            >
              Continue Session
            </button>
          </div>
        </div>
      )}
    </SessionContext.Provider>
  );
}
