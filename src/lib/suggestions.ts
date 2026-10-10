import type { Suggestion, SuggestionStatus } from "@/types/database";

// The suggestion box's entry in the client and trainer menus.
export const SUGGESTION_BOX_MENU_ITEM = {
  key: "suggestionBox",
  title: "Suggestion box",
  summary: "Tell us how to make the app better.",
};

// Suggestion box (0046). The owner sorts each suggestion into one of these.
export const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: "New",
  good_idea: "Good idea",
  not_now: "Not for now",
};

// What the person who made it sees.
export const SUGGESTION_STATUS_FOR_AUTHOR: Record<SuggestionStatus, string> = {
  new: "Sent, waiting to be read",
  good_idea: "Liked: on the list ✓",
  not_now: "Read, not for now",
};

export const SUGGESTION_MAX_LENGTH = 2000;

export function suggestionsWithStatus(list: Suggestion[], status: SuggestionStatus): Suggestion[] {
  return list.filter((s) => s.status === status);
}

/** "Sipho (client) · 10 Oct" */
export function suggestionByline(s: Pick<Suggestion, "author_name" | "author_role" | "created_at">): string {
  const date = new Date(s.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  return `${s.author_name || "Someone"} (${s.author_role}) · ${date}`;
}
