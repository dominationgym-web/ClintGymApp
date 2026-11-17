import SwiftUI
import WidgetKit

// iPhone home-screen calendar widget (GRIZZ, 2026-11-16, migration 0214;
// same day as 1 on 1 Today since 2026-11-17, migration 0217). This is a
// line-for-line copy of src/lib/calendarWidget.ts and dayRows() in
// src/lib/liveSessions.ts (the code the app's Today list uses), so change
// them together: every session, joint sessions as one line, catch-ups with
// their Catch-up tag, away / cancelled slots and Available gaps in green,
// anyone out of a slot in red underneath. A name only drops off once it's
// marked trained; one that's over but not marked stays on top, orange with
// "?"; the session on now (or next) is gold.

let appGroup = "group.com.dominationgym.consistentchange"
let navy = Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255)
let card = Color(red: 30 / 255, green: 41 / 255, blue: 59 / 255)
let gold = Color(red: 212 / 255, green: 175 / 255, blue: 55 / 255)
let orangeBg = Color(red: 124 / 255, green: 45 / 255, blue: 18 / 255)
let orange = Color(red: 253 / 255, green: 186 / 255, blue: 116 / 255)
let greenBg = Color(red: 20 / 255, green: 83 / 255, blue: 45 / 255)
let greenEdge = Color(red: 34 / 255, green: 197 / 255, blue: 94 / 255)
let green = Color(red: 74 / 255, green: 222 / 255, blue: 128 / 255)
let red = Color(red: 248 / 255, green: 113 / 255, blue: 113 / 255)
let tagYellow = Color(red: 250 / 255, green: 204 / 255, blue: 21 / 255)

struct WidgetSession: Codable {
  let id: String
  let starts_at: String
  let minutes: Int
  let name: String
  let status: String
  let charge: String?
  let cancelled_by: String?
  let away_id: String?
  let stop_id: String?
  let note: String?
  let makeup_for: String?
  let client_id: String?
  let guest_name: String?
  let client_disputed_at: String?
}

struct WidgetSettings: Codable {
  let day_start: String?
  let day_end: String?
  let minutes: Int?
}

struct WidgetReply: Codable {
  let ok: Bool
  let sessions: [WidgetSession]?
  let settings: WidgetSettings?
}

struct SavedDay: Codable {
  let sessions: [WidgetSession]
  let settings: WidgetSettings?
}

enum RowState { case over, now, later, free, open }

struct Row: Identifiable {
  /** The session a tap opens; "" opens the Today page. */
  let session: String
  let time: String
  let name: String
  let state: RowState
  var catchUp: Bool = false
  var note: String? = nil
  var out: String? = nil
  var id: String { "\(time)-\(session)-\(name)" }
}

struct CalendarEntry: TimelineEntry {
  let date: Date
  let title: String
  let rows: [Row]
  let sessions: Int
  let message: String?
}

func parseDate(_ s: String) -> Date? {
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let d = f.date(from: s) { return d }
  f.formatOptions = [.withInternetDateTime]
  return f.date(from: s)
}

func shortName(_ full: String) -> String {
  let parts = full.split(separator: " ").map(String.init)
  guard let first = parts.first else { return "Client" }
  if parts.count == 1 { return first }
  return "\(first) \(parts.last!.prefix(1).uppercased())."
}

func firstName(_ full: String) -> String { String(shortName(full).split(separator: " ").first ?? "") }

func names(_ list: [WidgetSession]) -> String {
  list.count == 1 ? shortName(list[0].name) : list.map { firstName($0.name) }.joined(separator: " & ")
}

func clockText(_ d: Date) -> String {
  let c = Calendar.current.dateComponents([.hour, .minute], from: d)
  return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
}

func dayKey(_ d: Date) -> String {
  let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
  return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

func mins(_ t: String?, _ fallback: Int) -> Int {
  let p = (t ?? "").split(separator: ":").compactMap { Int($0) }
  return p.count >= 2 && p[0] <= 23 && p[1] <= 59 ? p[0] * 60 + p[1] : fallback
}

func startOf(_ s: WidgetSession) -> Date { parseDate(s.starts_at) ?? .distantPast }
func endOf(_ s: WidgetSession) -> Date { startOf(s).addingTimeInterval(Double(s.minutes) * 60) }
func isOut(_ s: WidgetSession) -> Bool { s.status == "cancelled" || s.status == "no_show" }
func isAway(_ s: WidgetSession) -> Bool { s.status == "cancelled" && s.away_id != nil }
func isOnHold(_ s: WidgetSession) -> Bool { isAway(s) && (s.note ?? "").hasPrefix("On hold") }

// sessionKind() in liveSessions.ts, the parts needsSorting() looks at.
func needsSorting(_ s: WidgetSession, _ now: Date) -> Bool {
  if s.status == "done" { return s.client_disputed_at != nil }
  if s.status == "booked" { return endOf(s) < now }
  if s.status == "cancelled" { return s.cancelled_by != "trainer" && s.charge == nil }
  return false
}

func freedSlot(_ s: WidgetSession, _ now: Date) -> Bool {
  isAway(s) || (isOut(s) && startOf(s) > now)
}

func personKey(_ s: WidgetSession) -> String {
  if let c = s.client_id { return "c:\(c)" }
  let g = (s.guest_name ?? "").lowercased().split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
  return g.isEmpty ? "id:\(s.id)" : "g:\(g)"
}

func withoutReplaced(_ list: [WidgetSession]) -> [WidgetSession] {
  let live = Set(list.filter { $0.status == "booked" || $0.status == "done" }.map { "\($0.starts_at)|\(personKey($0))" })
  return list.filter { !(isOut($0) && live.contains("\($0.starts_at)|\(personKey($0))")) }
}

func jointLines(_ list: [WidgetSession]) -> [[WidgetSession]] {
  var out: [[WidgetSession]] = []
  for s in withoutReplaced(list) {
    if s.status != "removed", let i = out.firstIndex(where: { $0[0].status != "removed" && $0[0].starts_at == s.starts_at }) {
      out[i].append(s)
    } else {
      out.append([s])
    }
  }
  return out
}

func openSlots(_ settings: WidgetSettings?, _ booked: [(Int, Int)]) -> [Int] {
  let start = mins(settings?.day_start, 5 * 60), end = mins(settings?.day_end, 20 * 60)
  let len = max(15, settings?.minutes ?? 60)
  let busy = booked.map { (from: $0.0, to: $0.0 + $0.1) }.sorted { $0.from < $1.from } + [(from: end, to: end)]
  var out: [Int] = []
  var at = start
  for b in busy {
    while at + len <= min(b.from, end) { out.append(at); at += len }
    at = max(at, b.to)
  }
  return out
}

func whyOut(_ s: WidgetSession) -> String {
  if isAway(s) { return isOnHold(s) ? "on hold" : "away" }
  return s.status == "no_show" ? "no-show" : "cancelled"
}

// dayRows() in liveSessions.ts, then the widget's rows for that day.
func dayView(_ sessions: [WidgetSession], _ day: String, _ settings: WidgetSettings?, _ now: Date) -> [Row] {
  let onDay = sessions.filter { dayKey(startOf($0)) == day }
  let booked = onDay.filter { $0.status != "removed" && !needsSorting($0, now) }
  let freed = onDay.contains { $0.status == "removed" && $0.stop_id != nil }
  let today = dayKey(now)
  let nowMins = mins(clockText(now), 0)
  let taken = onDay.filter { $0.status == "booked" || $0.status == "done" || freedSlot($0, now) }.map { (mins(clockText(startOf($0)), 0), $0.minutes) }
  let open = day < today ? [] : openSlots(settings, taken).filter { day > today || $0 > nowMins }
  var items: [(time: String, order: Int, line: [WidgetSession]?)] = []
  for (i, line) in jointLines(booked).enumerated() {
    items.append((time: clockText(startOf(line[0])), order: i, line: line))
  }
  if !booked.isEmpty || freed {
    for (i, m) in open.enumerated() {
      items.append((time: String(format: "%02d:%02d", m / 60, m % 60), order: 10000 + i, line: nil))
    }
  }
  items.sort { $0.time == $1.time ? $0.order < $1.order : $0.time < $1.time }

  var rows: [Row] = []
  for item in items {
    guard let all = item.line else {
      rows.append(Row(session: "", time: item.time, name: "Available", state: .open))
      continue
    }
    if all.allSatisfy({ freedSlot($0, now) }) {
      if (all.map(endOf).max() ?? now) <= now { continue }
      var seen: [String] = []
      for w in all.map(whyOut) where !seen.contains(w) { seen.append(w) }
      let why = seen.joined(separator: " / ")
      rows.append(Row(session: all[0].id, time: item.time, name: names(all), state: .free, note: why.prefix(1).uppercased() + String(why.dropFirst()) + " · free"))
      continue
    }
    let here = all.filter { !isOut($0) }
    let stillBooked = here.filter { $0.status == "booked" }
    guard let first = stillBooked.first else { continue }
    let gone = all.filter(isOut)
    rows.append(Row(
      session: first.id, time: item.time, name: names(here), state: .later,
      catchUp: here.contains { $0.makeup_for != nil },
      out: gone.isEmpty ? nil : gone.map { "\(firstName($0.name)) \(whyOut($0))" }.joined(separator: " · ")))
  }
  if let i = rows.firstIndex(where: { $0.state == .later }) {
    let r = rows[i]
    rows[i] = Row(session: r.session, time: r.time, name: r.name, state: .now, catchUp: r.catchUp, note: r.note, out: r.out)
  }
  return rows
}

func isSession(_ r: Row) -> Bool { r.state == .over || r.state == .now || r.state == .later }

func makeEntry(_ sessions: [WidgetSession], _ settings: WidgetSettings?, at now: Date) -> CalendarEntry {
  let over: [Row] = jointLines(sessions.filter { $0.status == "booked" && endOf($0) <= now }).map { all in
    Row(session: all[0].id, time: clockText(startOf(all[0])), name: names(all), state: .over, catchUp: all.contains { $0.makeup_for != nil })
  }
  let todayRows = dayView(sessions, dayKey(now), settings, now)
  let anyLeft = todayRows.contains { $0.state == .now || $0.state == .later }
  let tomorrowRows = anyLeft ? [] : dayView(sessions, dayKey(Calendar.current.date(byAdding: .day, value: 1, to: now)!), settings, now)
  let showTomorrow = !anyLeft && tomorrowRows.contains { $0.state == .now || $0.state == .later }
  let rows = over + (showTomorrow ? tomorrowRows : todayRows)
  return CalendarEntry(date: now, title: showTomorrow ? "Tomorrow" : "Today", rows: rows, sessions: rows.filter(isSession).count, message: nil)
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> CalendarEntry {
    CalendarEntry(date: Date(), title: "Today", rows: [
      Row(session: "1", time: "06:30", name: "Quraish", state: .over),
      Row(session: "2", time: "07:10", name: "Jade & Camilla", state: .now),
      Row(session: "3", time: "07:50", name: "Steven B.", state: .free, note: "Away · free"),
      Row(session: "4", time: "08:30", name: "Divyesh", state: .later, catchUp: true, out: "Bianca away"),
    ], sessions: 3, message: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> Void) {
    if context.isPreview { completion(placeholder(in: context)); return }
    load { day, message in
      completion(message.map { CalendarEntry(date: Date(), title: "Today", rows: [], sessions: 0, message: $0) } ?? makeEntry(day.sessions, day.settings, at: Date()))
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> Void) {
    load { day, message in
      let now = Date()
      let refresh = now.addingTimeInterval(15 * 60)
      if let message = message {
        completion(Timeline(entries: [CalendarEntry(date: now, title: "Today", rows: [], sessions: 0, message: message)], policy: .after(refresh)))
        return
      }
      // A new entry as each session starts or ends, so gold, "?" and the gaps move on time.
      var times: Set<Date> = [now]
      for s in day.sessions {
        for t in [startOf(s), endOf(s)] where t > now && t < now.addingTimeInterval(6 * 3600) {
          times.insert(t)
        }
      }
      let entries = times.sorted().map { makeEntry(day.sessions, day.settings, at: $0) }
      completion(Timeline(entries: entries, policy: .after(refresh)))
    }
  }

  func load(_ done: @escaping (SavedDay, String?) -> Void) {
    let empty = SavedDay(sessions: [], settings: nil)
    let store = UserDefaults(suiteName: appGroup)
    guard let key = store?.string(forKey: "key"), !key.isEmpty,
      let base = store?.string(forKey: "url"), let anon = store?.string(forKey: "anon"),
      let url = URL(string: "\(base)/rest/v1/rpc/widget_day")
    else {
      done(empty, "Log in to Daily Evolution as a trainer to see your sessions.")
      return
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue(anon, forHTTPHeaderField: "apikey")
    req.setValue("Bearer \(anon)", forHTTPHeaderField: "Authorization")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["p_key": key])
    req.timeoutInterval = 15
    URLSession.shared.dataTask(with: req) { data, _, _ in
      if let data = data, let reply = try? JSONDecoder().decode(WidgetReply.self, from: data) {
        if !reply.ok { done(empty, "Log in to Daily Evolution to see your sessions."); return }
        let day = SavedDay(sessions: reply.sessions ?? [], settings: reply.settings)
        if let saved = try? JSONEncoder().encode(day) { store?.set(saved, forKey: "day") }
        done(day, nil)
        return
      }
      // No signal: the last day we had, worked out for the time now.
      if let saved = store?.data(forKey: "day"), let day = try? JSONDecoder().decode(SavedDay.self, from: saved) {
        done(day, nil)
      } else {
        done(empty, "No connection. Tap to open the app.")
      }
    }.resume()
  }
}

func link(_ id: String?) -> URL {
  URL(string: id.map { "consistentchange://widget-session/\($0)" } ?? "consistentchange://widget-session")!
}

struct RowCard: View {
  let row: Row
  var body: some View {
    let isGold = row.state == .now, isOver = row.state == .over
    let isGreen = row.state == .free || row.state == .open
    let sub = isOver ? "\(row.time) ?" : row.state == .free ? "\(row.time) · \(row.note ?? "free")" : row.time
    VStack(alignment: .leading, spacing: 0) {
      Text(row.name).font(.system(size: 13, weight: .bold)).lineLimit(1)
        .foregroundColor(isGold ? navy : isGreen ? green : .white)
      HStack(spacing: 4) {
        Text(sub).font(.system(size: 12, weight: isOver || isGreen ? .bold : .regular)).lineLimit(1)
          .foregroundColor(isGold ? navy : isOver ? orange : isGreen ? green : Color(white: 0.8))
        if row.catchUp {
          Text("Catch-up").font(.system(size: 10, weight: .bold)).lineLimit(1)
            .padding(.horizontal, 3)
            .foregroundColor(isGold ? gold : navy)
            .background(RoundedRectangle(cornerRadius: 3).fill(isGold ? navy : tagYellow))
        }
      }
      if let out = row.out {
        Text(out).font(.system(size: 11, weight: .bold)).lineLimit(1).foregroundColor(isGold ? Color(red: 0.5, green: 0.11, blue: 0.11) : red)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 8).padding(.vertical, 3)
    .background(RoundedRectangle(cornerRadius: 9).fill(isGold ? gold : isOver ? orangeBg : isGreen ? greenBg : card))
    .overlay(RoundedRectangle(cornerRadius: 9).stroke(isOver ? orange : isGreen ? greenEdge : .clear, lineWidth: 1))
  }
}

struct CalendarWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: CalendarEntry

  var body: some View {
    let fit = family == .systemSmall ? 3 : 6
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text(entry.title).font(.system(size: 12, weight: .heavy)).foregroundColor(gold)
        Spacer()
        if entry.sessions > 0 { Text("\(entry.sessions)").font(.system(size: 12)).foregroundColor(.gray) }
      }
      if let message = entry.message {
        Text(message).font(.system(size: 12)).foregroundColor(Color(white: 0.8))
      } else if entry.rows.isEmpty {
        Text("No sessions left").font(.system(size: 12)).foregroundColor(Color(white: 0.8))
      } else if family == .systemSmall {
        ForEach(entry.rows.prefix(fit)) { RowCard(row: $0) }
      } else {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 4) {
          ForEach(entry.rows.prefix(fit)) { row in Link(destination: link(row.session.isEmpty ? nil : row.session)) { RowCard(row: row) } }
        }
      }
      Spacer(minLength: 0)
    }
    .widgetURL(family == .systemSmall ? link(entry.rows.first(where: { !$0.session.isEmpty })?.session) : link(nil))
    .containerBackground(navy, for: .widget)
  }
}

@main
struct CalendarWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CalendarWidget", provider: Provider()) { entry in
      CalendarWidgetView(entry: entry)
    }
    .configurationDisplayName("Today's sessions")
    .description("Your 1 on 1 day, the same as Today: sessions, catch-ups and free slots. Tap one to open it.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
