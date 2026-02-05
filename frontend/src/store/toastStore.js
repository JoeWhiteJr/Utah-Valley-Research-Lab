import { create } from 'zustand'

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: Date.now() + Math.random(), duration: 4000, ...toast },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

export const toast = {
  success: (message) => useToastStore.getState().addToast({ type: 'success', message }),
  error: (message) => useToastStore.getState().addToast({ type: 'error', message, duration: 6000 }),
  warning: (message) => useToastStore.getState().addToast({ type: 'warning', message }),
  info: (message) => useToastStore.getState().addToast({ type: 'info', message }),
}
