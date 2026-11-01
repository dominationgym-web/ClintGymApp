import { useContext, useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { NavigationContext, NavigationRouteContext } from "@react-navigation/native";

// Back goes one step at a time (GRIZZ, 2026-10-12 and 2026-11-01): while a
// topic, fold, day or inside page is open, the phone's Back button (or the
// back arrow at the top) closes it first, and only the next Back leaves the
// page. On a tab's main page, where Back used to close the app straight away,
// it now closes what's open first too.
//
// Each open step registers when it opens, so the one opened last closes
// first. Steps on a page that isn't showing (a page under the current one,
// or another tab) are skipped.

type Step = { screen: string | undefined };
const openSteps: Step[] = [];

// Whether `step` is the latest open step on its page.
function isLatest(step: Step) {
  for (let i = openSteps.length - 1; i >= 0; i--) {
    if (openSteps[i].screen === step.screen) return openSteps[i] === step;
  }
  return false;
}

export function useStepBack(stepOpen: boolean, closeStep: () => void) {
  const navigation = useContext(NavigationContext);
  const route = useContext(NavigationRouteContext);
  const close = useRef(closeStep);
  close.current = closeStep;
  const screen = route?.key;
  useEffect(() => {
    if (!stepOpen) return;
    const step: Step = { screen };
    openSteps.push(step);
    // The phone's Back button. Android calls the newest listener first, so
    // this runs before the app's own "go back a page" handling.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (navigation && !navigation.isFocused()) return false;
      close.current();
      return true;
    });
    // The back arrow at the top of a page.
    const unsub = navigation?.addListener("beforeRemove", (e) => {
      const type = e.data.action.type;
      if (type !== "GO_BACK" && type !== "POP") return;
      e.preventDefault();
      if (isLatest(step)) close.current();
    });
    return () => {
      sub.remove();
      unsub?.();
      const i = openSteps.indexOf(step);
      if (i >= 0) openSteps.splice(i, 1);
    };
  }, [navigation, screen, stepOpen]);
}
