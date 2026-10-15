import { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";

// Back goes one step at a time (GRIZZ, 2026-10-12): while a topic is open on a
// page, the back button (or the phone's back button) closes the topic first,
// and only the next back leaves the page.
export function useStepBack(stepOpen: boolean, closeStep: () => void) {
  const navigation = useNavigation();
  useEffect(() => {
    if (!stepOpen) return;
    return navigation.addListener("beforeRemove", (e) => {
      const type = e.data.action.type;
      if (type !== "GO_BACK" && type !== "POP") return;
      e.preventDefault();
      closeStep();
    });
  }, [navigation, stepOpen, closeStep]);
}
