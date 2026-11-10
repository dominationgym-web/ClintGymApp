// One full-screen pop-up at a time on the trainer side: two Modals at once
// don't show on iPhone. A pop-up says when it's open; the others wait.
type Listener = () => void;
const open = new Set<string>();
const listeners = new Set<Listener>();

export const popupOpen = (except?: string) => [...open].some((k) => k !== except);

export function setPopupOpen(key: string, isOpen: boolean) {
  const had = open.has(key);
  if (isOpen) open.add(key);
  else open.delete(key);
  if (had !== isOpen) listeners.forEach((l) => l());
}

export function onPopupChange(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
