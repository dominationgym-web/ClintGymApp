import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, Share, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { BRAND_GOLD } from "@/lib/brand";
import { emailShareLink, shoppingList, shoppingListText, whatsappShareLink } from "@/lib/shoppingList";
import type { DietDay } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// The week's shopping list from the client's meal plan (GRIZZ, 2026-10-27).
// When they train, it first asks how many days this week, as training days
// eat more. Then the list shows one shop section at a time (tap a heading to
// open it), and they tap a food to tick it off while they shop.
export default function ShoppingListSheet({
  visible,
  trainingDay,
  restDay,
  trains,
  days,
  onDays,
  onClose,
}: {
  visible: boolean;
  trainingDay: DietDay;
  restDay: DietDay;
  /** Whether they train at all: without training every day is a rest day. */
  trains: boolean;
  /** Training days a week, saved or guessed. */
  days: number;
  /** They picked their training days: saved for next time. */
  onDays: (days: number) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState<"days" | "list">(trains ? "days" : "list");
  const [picked, setPicked] = useState(days);
  const [open, setOpen] = useState(0);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const scroller = useRef<ScrollView>(null);
  // Where each section starts, so opening one brings its heading to the top.
  const tops = useRef<number[]>([]);
  const openSection = (i: number) => {
    const next = open === i ? -1 : i;
    setOpen(next);
    if (next >= 0) setTimeout(() => scroller.current?.scrollTo({ y: tops.current[next] ?? 0, animated: true }), 50);
  };

  useEffect(() => {
    if (!visible) return;
    setPage(trains ? "days" : "list");
    setPicked(days);
    setOpen(0);
  }, [visible]);

  const list = shoppingList(trainingDay, restDay, trains ? picked : 0);
  const total = list.sections.reduce((n, s) => n + s.items.length, 0);
  const tick = (name: string) => {
    const next = new Set(ticked);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setTicked(next);
  };
  // WhatsApp and email work on phones and the laptop; More opens the phone's
  // share menu (SMS, Notes and so on), which some laptop browsers don't have.
  const canShare = Platform.OS !== "web" || (typeof navigator !== "undefined" && typeof navigator.share === "function");
  const openLink = async (url: string, app: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(`Couldn't open ${app}`, "Try another way to send it, or take a screenshot of your list.");
    }
  };
  const send = async () => {
    try {
      await Share.share({ message: shoppingListText(list) });
    } catch {
      Alert.alert("Couldn't send it", "Try WhatsApp or Email instead, or take a screenshot of your list.");
    }
  };
  const dayWord = (n: number) => (n === 1 ? "day" : "days");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {page === "days" ? (
            <View>
              <Text style={styles.title}>🛒 Your shopping list</Text>
              <Text style={styles.question}>How many days are you training this week?</Text>
              <Text style={styles.helper}>Training days have more food, so the list adds up the right amount for your week.</Text>
              <View style={styles.chips}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Pressable key={n} style={[styles.chip, picked === n && styles.chipOn]} onPress={() => setPicked(n)}>
                    <Text style={[styles.chipText, picked === n && styles.chipTextOn]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.note}>
                {picked} training {dayWord(picked)} and {7 - picked} rest {dayWord(7 - picked)}.
              </Text>
              <Pressable
                style={[styles.button, styles.primary]}
                onPress={() => {
                  onDays(picked);
                  setTicked(new Set());
                  setPage("list");
                }}
              >
                <Text style={styles.primaryText}>Make my list</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.secondary]} onPress={onClose}>
                <Text style={styles.secondaryText}>Not now</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.title}>🛒 Your shopping list for the week</Text>
              <Text style={styles.helper}>
                {trains
                  ? `For ${list.trainingDays} training ${dayWord(list.trainingDays)} and ${list.restDays} rest ${dayWord(list.restDays)}. `
                  : "For 7 days of your plan. "}
                Tap a food to tick it off. {ticked.size > 0 ? `${ticked.size} of ${total} in the trolley.` : ""}
              </Text>
              <ScrollView ref={scroller} style={{ flexShrink: 1 }}>
                {list.sections.map((s, i) => {
                  const done = s.items.filter((it) => ticked.has(it.name)).length;
                  return (
                    <View key={s.section} style={styles.section} onLayout={(e) => (tops.current[i] = e.nativeEvent.layout.y)}>
                      <Pressable style={styles.sectionHead} onPress={() => openSection(i)}>
                        <Text style={styles.sectionName}>
                          {s.icon} {s.section}
                        </Text>
                        <Text style={styles.sectionCount}>
                          {done === s.items.length ? "✓ " : ""}
                          {done}/{s.items.length} {open === i ? "▴" : "▾"}
                        </Text>
                      </Pressable>
                      {open === i &&
                        s.items.map((it) => {
                          const on = ticked.has(it.name);
                          return (
                            <Pressable key={it.name} style={styles.item} onPress={() => tick(it.name)} accessibilityLabel={`Tick off ${it.name}`}>
                              <Text style={[styles.box, on && styles.boxOn]}>{on ? "✓" : ""}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.itemName, on && styles.itemDone]}>{it.name}</Text>
                                <Text style={[styles.buy, on && styles.itemDone]}>{it.buy ? `Buy ${it.buy}` : it.need}</Text>
                                {it.buy && <Text style={styles.need}>{it.need} for the week</Text>}
                                {it.check && <Text style={styles.check}>You may have this already: check the cupboard first.</Text>}
                              </View>
                            </Pressable>
                          );
                        })}
                    </View>
                  );
                })}
                <Text style={styles.note}>
                  Rounded up to the packs shops sell, so you may have a little left over. Rice, pasta and other grains are uncooked
                  weights, and meat and fish are raw.
                </Text>
              </ScrollView>
              <Text style={styles.sendLabel}>Send my list</Text>
              <View style={styles.row}>
                <Pressable style={[styles.sendButton, styles.whatsapp]} onPress={() => openLink(whatsappShareLink(shoppingListText(list)), "WhatsApp")}>
                  <Text style={styles.sendText}>💬 WhatsApp</Text>
                </Pressable>
                <Pressable style={[styles.sendButton, styles.secondary]} onPress={() => openLink(emailShareLink(shoppingListText(list)), "your email")}>
                  <Text style={styles.sendText}>✉️ Email</Text>
                </Pressable>
                {canShare && (
                  <Pressable style={[styles.sendButton, styles.secondary]} onPress={send}>
                    <Text style={styles.sendText}>📤 More</Text>
                  </Pressable>
                )}
              </View>
              <Pressable style={[styles.button, styles.primary]} onPress={onClose}>
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
              {trains && (
                <Pressable onPress={() => setPage("days")} hitSlop={8} style={{ marginTop: 12, alignSelf: "center" }}>
                  <Text style={styles.link}>Change my training days</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32, maxHeight: "90%" },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  question: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 6, marginBottom: 4 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  note: { color: "#64748B", fontSize: 12, marginTop: 8, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#0F172A", borderRadius: 8, paddingVertical: 10, minWidth: 40, alignItems: "center" },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "800", fontSize: 15 },
  chipTextOn: { color: "#0F172A" },
  row: { flexDirection: "row", gap: 8 },
  sendLabel: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  sendButton: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  whatsapp: { backgroundColor: "#1F8F4E" },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  flex: { flex: 1 },
  // flexBasis auto, as flex 0 squashes the button's text on the laptop app.
  button: { borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 12, flexBasis: "auto" },
  primary: { backgroundColor: BRAND_GOLD },
  primaryText: { color: "#0F172A", fontWeight: "800" },
  secondary: { backgroundColor: "#334155" },
  secondaryText: { color: "#fff", fontWeight: "700" },
  link: { color: "#38BDF8", fontWeight: "700", fontSize: 13 },
  section: { backgroundColor: "#0F172A", borderRadius: 10, marginBottom: 8, overflow: "hidden" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  sectionName: { color: "#fff", fontWeight: "800", fontSize: 15, flex: 1 },
  sectionCount: { color: BRAND_GOLD, fontWeight: "700" },
  item: { flexDirection: "row", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: "#1E293B" },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#64748B",
    textAlign: "center",
    color: "#0F172A",
    fontWeight: "900",
    lineHeight: 18,
    marginTop: 1,
  },
  boxOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  itemName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  itemDone: { color: "#64748B", textDecorationLine: "line-through" },
  buy: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginTop: 2 },
  need: { color: "#94A3B8", fontSize: 12, marginTop: 1 },
  check: { color: "#38BDF8", fontSize: 12, marginTop: 2 },
});
