// On the laptop (web) version, React Native's Alert.alert does nothing, so
// every "Are you sure?" and every choice made with it would silently fail.
// This swaps in the browser's own dialogs: one button is a plain message, a
// Cancel plus one other is OK / Cancel, and more choices are picked by number.
import { Alert, Platform, type AlertButton } from "react-native";

type Dialogs = {
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
  prompt: (message: string) => string | null;
};

/** Runs the button the person picks, the way Alert.alert would on a phone. */
export function webAlert(dialogs: Dialogs, title: string, message?: string, buttons?: AlertButton[]) {
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  const cancel = list.find((b) => b.style === "cancel");
  const others = list.filter((b) => b !== cancel);

  if (others.length <= 1 && !cancel) {
    dialogs.alert(text);
    others[0]?.onPress?.();
    return;
  }
  if (others.length === 1) {
    if (dialogs.confirm(`${text}\n\nOK = ${others[0].text ?? "OK"}`)) others[0].onPress?.();
    else cancel?.onPress?.();
    return;
  }
  const menu = others.map((b, i) => `${i + 1}. ${b.text ?? ""}`).join("\n");
  const answer = dialogs.prompt(`${text}\n\n${menu}\n\nType the number of your choice:`);
  const picked = answer ? others[Number(answer.trim()) - 1] : undefined;
  if (picked) picked.onPress?.();
  else cancel?.onPress?.();
}

export function setUpWebAlert() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  Alert.alert = (title, message, buttons) =>
    webAlert(
      { alert: (m) => window.alert(m), confirm: (m) => window.confirm(m), prompt: (m) => window.prompt(m) },
      title,
      message,
      buttons,
    );
}
