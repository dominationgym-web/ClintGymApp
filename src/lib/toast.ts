// Little "Saved" messages (GRIZZ, 2026-11-21 design review): slide in at the top
// and go away by themselves, instead of a box you have to tap OK on. Pop-up
// boxes stay for real questions ("Delete this?"). Shown by <ToastHost />: one
// sits in App and one in each full-screen pop-up (ModalSafeArea), and only the
// newest one on screen shows the message, so it is never hidden behind a pop-up.

export type Toast = { id: number; title: string; message?: string };

let next = 1;
let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const hosts: number[] = [];
let nextHost = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(title: string, message?: string) {
  if (timer) clearTimeout(timer);
  const t: Toast = { id: next++, title, message: message || undefined };
  current = t;
  const words = `${title} ${message ?? ""}`.split(/\s+/).length;
  timer = setTimeout(() => clearToast(t.id), Math.min(7000, 2200 + words * 220));
  emit();
}

export function clearToast(id: number) {
  if (current?.id !== id) return;
  current = null;
  emit();
}

export function currentToast() {
  return current;
}

export function registerHost(): { id: number; remove: () => void } {
  const id = nextHost++;
  hosts.push(id);
  emit();
  return {
    id,
    remove: () => {
      const i = hosts.indexOf(id);
      if (i >= 0) hosts.splice(i, 1);
      emit();
    },
  };
}

export function topHost() {
  return hosts[hosts.length - 1];
}

export function subscribeToast(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
