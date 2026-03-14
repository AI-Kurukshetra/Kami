'use client';

export type ToastType = 'success' | 'error' | 'warning';

export type ToastEventDetail = {
  type: ToastType;
  message: string;
};

export function showToast(type: ToastType, message: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>('kami-toast', {
      detail: { type, message }
    })
  );
}
