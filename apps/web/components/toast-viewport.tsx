'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ToastEventDetail } from '@/lib/toast';

type ToastItem = ToastEventDetail & {
  id: string;
};

const TOAST_TIMEOUT_MS = 4000;

function buildToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const customEvent = event as CustomEvent<ToastEventDetail>;
      const detail = customEvent.detail;

      if (!detail?.message) {
        return;
      }

      const id = buildToastId();
      setItems((prev) => [...prev, { id, ...detail }]);

      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, TOAST_TIMEOUT_MS);
    }

    window.addEventListener('kami-toast', onToast as EventListener);
    return () => {
      window.removeEventListener('kami-toast', onToast as EventListener);
    };
  }, []);

  const hasItems = useMemo(() => items.length > 0, [items]);

  if (!hasItems) {
    return null;
  }

  return (
    <aside className="toastViewport" aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.type}`}>
          {item.message}
        </div>
      ))}
    </aside>
  );
}
