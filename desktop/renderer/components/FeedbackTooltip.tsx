import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface FeedbackState {
  key: string;
  message: string;
}

export function useFeedbackTooltip(timeoutMs = 1400) {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback(
    (key: string, message: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setFeedback({ key, message });
      timerRef.current = setTimeout(() => setFeedback(null), timeoutMs);
    },
    [timeoutMs]
  );

  const tooltipFor = useCallback(
    (key: string) => (feedback?.key === key ? feedback.message : null),
    [feedback]
  );

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  return { showFeedback, tooltipFor };
}

export function FeedbackTarget({
  children,
  message,
  align = 'center'
}: {
  children: ReactNode;
  message: string | null;
  align?: 'center' | 'left' | 'right';
}) {
  return (
    <span className="feedback-target">
      {children}
      <FeedbackTooltip align={align} message={message} />
    </span>
  );
}

export function FeedbackTooltip({
  message,
  align = 'center'
}: {
  message: string | null;
  align?: 'center' | 'left' | 'right';
}) {
  if (!message) {
    return null;
  }

  return (
    <span className={`feedback-tooltip ${align}`} role="status" title={message}>
      {message}
    </span>
  );
}
