import React from "react";
import { FlexWidget, ListWidget, TextWidget } from "react-native-android-widget";
import { widgetLink, type WidgetView } from "@/lib/calendarWidget";

// The Android home-screen calendar widget (GRIZZ, 2026-11-16): 2 wide and 3
// tall, a stack of cards with the name over the start time. Since 2026-11-17
// it shows the same day as 1 on 1 Today: joint names, catch-ups with their
// Catch-up tag, away / cancelled slots and Available gaps in green (free to
// book), and anyone out of a slot in red underneath. Gold = on now or next.
// Orange with "?" = over but not marked yet. Tap a card to open that
// session's sheet in the app; tap a green gap or "Today" to open the Today page.

export const CALENDAR_WIDGET_NAME = "TrainerCalendar";

const NAVY = "#0F172A";
const CARD = "#1E293B";
const GOLD = "#D4AF37";
const ORANGE_BG = "#7C2D12";
const ORANGE = "#FDBA74";
const GREEN_BG = "#14532D";
const GREEN_EDGE = "#22C55E";
const GREEN = "#4ADE80";
const RED = "#F87171";
const TAG = "#FACC15";

export type CalendarWidgetProps =
  | { kind: "view"; view: WidgetView }
  | { kind: "message"; text: string };

function Card({ row }: { row: WidgetView["rows"][number] }) {
  const gold = row.state === "now";
  const over = row.state === "over";
  const green = row.state === "free" || row.state === "open";
  const sub = over ? `${row.time} ?` : row.state === "free" ? `${row.time} · ${row.note ?? "free"}` : row.time;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: widgetLink(row.state === "open" ? null : row.id) }}
      style={{ width: "match_parent", paddingBottom: 5 }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          backgroundColor: gold ? GOLD : over ? ORANGE_BG : green ? GREEN_BG : CARD,
          borderRadius: 10,
          borderWidth: over || green ? 1 : 0,
          borderColor: over ? "#FB923C" : GREEN_EDGE,
          paddingHorizontal: 9,
          paddingVertical: 5,
        }}
      >
        <TextWidget
          text={row.name}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, fontWeight: "700", color: gold ? NAVY : green ? GREEN : "#F8FAFC" }}
        />
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <TextWidget
            text={sub}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 12.5, fontWeight: over || green ? "700" : "400", color: gold ? NAVY : over ? ORANGE : green ? GREEN : "#CBD5E1" }}
          />
          {row.catchUp ? (
            <FlexWidget style={{ marginLeft: 5, backgroundColor: gold ? NAVY : TAG, borderRadius: 4, paddingHorizontal: 4 }}>
              <TextWidget text="Catch-up" style={{ fontSize: 11, fontWeight: "700", color: gold ? GOLD : NAVY }} />
            </FlexWidget>
          ) : null}
        </FlexWidget>
        {row.out ? (
          <TextWidget text={row.out} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: "700", color: gold ? "#7F1D1D" : RED }} />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}

export function CalendarWidget(props: CalendarWidgetProps) {
  const title = props.kind === "view" ? props.view.title : "Today";
  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: NAVY, borderRadius: 22, paddingHorizontal: 7, paddingTop: 8, paddingBottom: 3 }}
    >
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: widgetLink() }}
        style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 5 }}
      >
        <TextWidget text={title} style={{ fontSize: 13, fontWeight: "800", color: GOLD }} />
        {props.kind === "view" && props.view.sessions ? (
          <TextWidget text={String(props.view.sessions)} style={{ fontSize: 13, color: "#94A3B8" }} />
        ) : null}
      </FlexWidget>
      {props.kind === "message" ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: widgetLink() }} style={{ width: "match_parent", paddingHorizontal: 4 }}>
          <TextWidget text={props.text} style={{ fontSize: 13, color: "#CBD5E1" }} />
        </FlexWidget>
      ) : props.view.rows.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: widgetLink() }} style={{ width: "match_parent", paddingHorizontal: 4 }}>
          <TextWidget text="No sessions left" style={{ fontSize: 13, color: "#CBD5E1" }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: "match_parent", width: "match_parent" }}>
          {props.view.rows.map((row) => (
            <Card key={`${row.time}-${row.id}-${row.tomorrow ? 1 : 0}`} row={row} />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
