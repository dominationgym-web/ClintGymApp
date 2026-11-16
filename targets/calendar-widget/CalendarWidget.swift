import SwiftUI
import WidgetKit

// iPhone home-screen calendar widget (GRIZZ, 2026-11-16, migration 0214).
// Same rules as src/lib/calendarWidget.ts: booked sessions only drop off once
// they're marked trained or cancelled in the app; one that's over but not
// marked stays on top, orange with "?"; the session on now (or next) is gold.

let appGroup = "group.com.dominationgym.consistentchange"
let navy = Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255)
let card = Color(red: 30 / 255, green: 41 / 255, blue: 59 / 255)
let gold = Color(red: 212 / 255, green: 175 / 255, blue: 55 / 255)
let orangeBg = Color(red: 124 / 255, green: 45 / 255, blue: 18 / 255)
let orange = Color(red: 253 / 255, green: 186 / 255, blue: 116 / 255)

struct WidgetSession: Codable {
  let id: String
  let starts_at: String
  let minutes: Int
  let name: String
}

struct WidgetReply: Codable {
  let ok: Bool
  let sessions: [WidgetSession]?
}

enum RowState { case over, now, later }

struct Row: Identifiable {
  let id: String
  let time: String
  let name: String
  let state: RowState
}

struct CalendarEntry: TimelineEntry {
  let date: Date
  let title: String
  let rows: [Row]
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

func makeEntry(_ sessions: [WidgetSession], at now: Date) -> CalendarEntry {
  let cal = Calendar.current
  let clock = DateFormatter()
  clock.dateFormat = "HH:mm"
  var groups: [(Date, [WidgetSession])] = []
  for s in sessions {
    guard let start = parseDate(s.starts_at) else { continue }
    if let i = groups.firstIndex(where: { $0.0 == start }) { groups[i].1.append(s) } else { groups.append((start, [s])) }
  }
  groups.sort { $0.0 < $1.0 }
  var over: [Row] = [], today: [Row] = [], tomorrow: [Row] = []
  let tomorrowDate = cal.date(byAdding: .day, value: 1, to: now)!
  for (start, list) in groups {
    let names = list.map(\.name).sorted()
    let name = list.count == 1 ? shortName(list[0].name) : names.map { String(shortName($0).split(separator: " ").first ?? "") }.joined(separator: " & ")
    let end = start.addingTimeInterval(Double(list.map(\.minutes).max() ?? 0) * 60)
    let row = Row(id: list[0].id, time: clock.string(from: start), name: name, state: .later)
    if end <= now { over.append(Row(id: row.id, time: row.time, name: row.name, state: .over)) }
    else if cal.isDate(start, inSameDayAs: now) { today.append(row) }
    else if cal.isDate(start, inSameDayAs: tomorrowDate) { tomorrow.append(row) }
  }
  var coming = today.isEmpty ? tomorrow : today
  if let first = coming.first { coming[0] = Row(id: first.id, time: first.time, name: first.name, state: .now) }
  let title = (!today.isEmpty || tomorrow.isEmpty) ? "Today" : "Tomorrow"
  return CalendarEntry(date: now, title: title, rows: Array((over + coming).prefix(6)), message: nil)
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> CalendarEntry {
    CalendarEntry(date: Date(), title: "Today", rows: [
      Row(id: "1", time: "06:30", name: "Quraish", state: .over),
      Row(id: "2", time: "07:50", name: "Rob V.", state: .now),
      Row(id: "3", time: "08:30", name: "Sharde K.", state: .later),
    ], message: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> Void) {
    if context.isPreview { completion(placeholder(in: context)); return }
    load { sessions, message in
      completion(message.map { CalendarEntry(date: Date(), title: "Today", rows: [], message: $0) } ?? makeEntry(sessions, at: Date()))
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> Void) {
    load { sessions, message in
      let now = Date()
      let refresh = now.addingTimeInterval(15 * 60)
      if let message = message {
        completion(Timeline(entries: [CalendarEntry(date: now, title: "Today", rows: [], message: message)], policy: .after(refresh)))
        return
      }
      // A new entry as each session starts or ends, so gold and "?" move on time.
      var times: Set<Date> = [now]
      for s in sessions {
        guard let start = parseDate(s.starts_at) else { continue }
        for t in [start, start.addingTimeInterval(Double(s.minutes) * 60)] where t > now && t < now.addingTimeInterval(6 * 3600) {
          times.insert(t)
        }
      }
      let entries = times.sorted().map { makeEntry(sessions, at: $0) }
      completion(Timeline(entries: entries, policy: .after(refresh)))
    }
  }

  func load(_ done: @escaping ([WidgetSession], String?) -> Void) {
    let store = UserDefaults(suiteName: appGroup)
    guard let key = store?.string(forKey: "key"), !key.isEmpty,
      let base = store?.string(forKey: "url"), let anon = store?.string(forKey: "anon"),
      let url = URL(string: "\(base)/rest/v1/rpc/widget_sessions")
    else {
      done([], "Log in to Daily Evolution as a trainer to see your sessions.")
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
        if !reply.ok { done([], "Log in to Daily Evolution to see your sessions."); return }
        let list = reply.sessions ?? []
        if let saved = try? JSONEncoder().encode(list) { store?.set(saved, forKey: "last") }
        done(list, nil)
        return
      }
      // No signal: the last list we had, worked out for the time now.
      if let saved = store?.data(forKey: "last"), let list = try? JSONDecoder().decode([WidgetSession].self, from: saved) {
        done(list, nil)
      } else {
        done([], "No connection. Tap to open the app.")
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
    VStack(alignment: .leading, spacing: 0) {
      Text(row.name).font(.system(size: 13, weight: .bold)).lineLimit(1)
        .foregroundColor(isGold ? navy : .white)
      Text(isOver ? "\(row.time) ?" : row.time).font(.system(size: 12, weight: isOver ? .bold : .regular))
        .foregroundColor(isGold ? navy : isOver ? orange : Color(white: 0.8))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 8).padding(.vertical, 3)
    .background(RoundedRectangle(cornerRadius: 9).fill(isGold ? gold : isOver ? orangeBg : card))
    .overlay(RoundedRectangle(cornerRadius: 9).stroke(isOver ? orange : .clear, lineWidth: 1))
  }
}

struct CalendarWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: CalendarEntry

  var body: some View {
    let fit = family == .systemSmall ? 3 : family == .systemMedium ? 6 : 6
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text(entry.title).font(.system(size: 12, weight: .heavy)).foregroundColor(gold)
        Spacer()
        if !entry.rows.isEmpty { Text("\(entry.rows.count)").font(.system(size: 12)).foregroundColor(.gray) }
      }
      if let message = entry.message {
        Text(message).font(.system(size: 12)).foregroundColor(Color(white: 0.8))
      } else if entry.rows.isEmpty {
        Text("No sessions left").font(.system(size: 12)).foregroundColor(Color(white: 0.8))
      } else if family == .systemSmall {
        ForEach(entry.rows.prefix(fit)) { RowCard(row: $0) }
      } else {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 4) {
          ForEach(entry.rows.prefix(fit)) { row in Link(destination: link(row.id)) { RowCard(row: row) } }
        }
      }
      Spacer(minLength: 0)
    }
    .widgetURL(family == .systemSmall ? link(entry.rows.first?.id) : link(nil))
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
    .description("Your 1 on 1 sessions still to come. Tap one to open it.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
