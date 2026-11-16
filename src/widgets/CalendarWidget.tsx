import React from "react";
import { FlexWidget, ListWidget, TextWidget } from "react-native-android-widget";
import { widgetLink, type WidgetView } from "@/lib/calendarWidget";

// The Android home-screen calendar widget (GRIZZ, 2026-11-16): 2 wide and 3
// tall, a stack of cards with the name over the start time. Gold = on now or
// next. Orange with "?" = over but not marked yet. Tap a card to open that
// session's sheet in the app; tap "Today" to open the Today page.

export const CALENDAR_WIDGET_NAME = "TrainerCalendar";

const NAVY = "#0F172A";
const CARD = "#1E293B";
const GOLD = "#D4AF37";
const ORANGE_BG = "#7C2D12";
const ORANGE = "#FDBA74";

export type CalendarWidgetProps =
  | { kind: "view"; view: WidgetView }
  | { kind: "message"; text: string };

function Card({ row }: { row: WidgetView["rows"][number] }) {
  const gold = row.state === "now";
  const over = row.state === "over";
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: widgetLink(row.id) }}
      style={{ width: "match_parent", paddingBottom: 5 }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          backgroundColor: gold ? GOLD : over ? ORANGE_BG : CARD,
          borderRadius: 10,
          borderWidth: over ? 1 : 0,
          borderColor: "#FB923C",
          paddingHorizontal: 9,
          paddingVertical: 5,
        }}
      >
        <TextWidget
          text={row.name}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, fontWeight: "700", color: gold ? NAVY : "#F8FAFC" }}
        />
        <TextWidget
          text={over ? `${row.time} ?` : row.time}
          maxLines={1}
          style={{ fontSize: 12.5, fontWeight: over ? "700" : "400", color: gold ? NAVY : over ? ORANGE : "#CBD5E1" }}
        />
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
        {props.kind === "view" && props.view.rows.length ? (
          <TextWidget text={String(props.view.rows.length + props.view.more)} style={{ fontSize: 13, color: "#94A3B8" }} />
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
            <Card key={row.id} row={row} />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
