import { AlertTriangle, Check, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

type ToastVariant = 'success' | 'warning' | 'error';

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastOptions {
  variant?: ToastVariant;
}

interface FeedbackToastContextValue {
  showToast(message: string, options?: ToastOptions): void;
}

const FeedbackToastContext = createContext<FeedbackToastContextValue | null>(null);

export function FeedbackToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, options: ToastOptions = {}) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToast({
      id: Date.now(),
      message,
      variant: options.variant ?? 'success'
    });
    timerRef.current = setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <FeedbackToastContext.Provider value={value}>
      {children}
      <FeedbackToastViewport toast={toast} />
    </FeedbackToastContext.Provider>
  );
}

export function useFeedbackToast() {
  const context = useContext(FeedbackToastContext);
  if (!context) {
    throw new Error('useFeedbackToast must be used inside FeedbackToastProvider');
  }
  return context;
}

export function FeedbackToastViewport({ toast }: { toast: ToastState | null }) {
  if (!toast) {
    return null;
  }

  const Icon = toast.variant === 'warning' ? AlertTriangle : toast.variant === 'error' ? XCircle : Check;

  return (
    <div aria-live="polite" className="feedback-toast-viewport" role="status">
      <div className={`feedback-toast ${toast.variant}`} key={toast.id} title={toast.message}>
        <Icon size={15} />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
