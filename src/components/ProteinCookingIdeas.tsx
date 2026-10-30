import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { BRAND_GOLD } from "@/lib/brand";
import {
  cookingIdeasFor,
  LIGHT_SAUCES,
  PROTEIN_COOKING,
  type CookingIdea,
  type LightSauce,
  type ProteinCooking,
} from "@/lib/proteinCooking";
import { themedStyles } from "@/lib/theme";

// Protein cooking ideas and low-calorie sauces (GRIZZ, 2026-10-27). Everything
// is a tap-to-open line, one open at a time, so the client sees a short list
// instead of a long page.

function Idea({ idea, number, open, onToggle }: { idea: CookingIdea; number: number; open: boolean; onToggle: () => void }) {
  return (
    <View style={[styles.idea, open && styles.ideaOpen]}>
      <Pressable style={styles.row} onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.number}>{number}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.ideaName}>{idea.name}</Text>
          <Text style={styles.why}>{idea.why}</Text>
        </View>
        <Text style={styles.chevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      {open &&
        idea.steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNo}>{i + 1}.</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
    </View>
  );
}

/** One protein's tip and five ideas. */
export function CookingSet({ set }: { set: ProteinCooking }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View>
      <View style={styles.tip}>
        <Text style={styles.tipText}>💡 {set.tip}</Text>
      </View>
      {set.ideas.map((idea, i) => (
        <Idea key={idea.name} idea={idea} number={i + 1} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
      ))}
    </View>
  );
}

/** Every protein as a heading; tap one for its five ideas. */
export default function ProteinCookingIdeas() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={styles.card}>
      <Text style={styles.intro}>Five simple ways to cook each protein, with flavour and without many extra calories. Tap a food, then an idea for the steps.</Text>
      {PROTEIN_COOKING.map((set) => {
        const isOpen = open === set.key;
        return (
          <View key={set.key} style={[styles.fold, isOpen && styles.foldOpen]}>
            <Pressable style={styles.row} onPress={() => setOpen(isOpen ? null : set.key)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
              <Text style={styles.icon}>{set.icon}</Text>
              <Text style={styles.foldTitle}>{set.title}</Text>
              <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
            </Pressable>
            {isOpen && (
              <View style={styles.foldBody}>
                <CookingSet set={set} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Sauce({ sauce, open, onToggle }: { sauce: LightSauce; open: boolean; onToggle: () => void }) {
  return (
    <View style={[styles.fold, open && styles.foldOpen]}>
      <Pressable style={styles.row} onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.icon}>{sauce.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.foldTitle}>{sauce.name}</Text>
          <Text style={styles.why}>
            About {sauce.kcal} kcal a serving · makes {sauce.serves}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      {open && (
        <View style={styles.foldBody}>
          <Text style={styles.label}>GOES WITH</Text>
          <Text style={styles.stepText}>{sauce.goesWith}</Text>
          <Text style={styles.label}>YOU NEED</Text>
          {sauce.ingredients.map((item) => (
            <Text key={item} style={styles.stepText}>
              • {item}
            </Text>
          ))}
          <Text style={styles.label}>HOW TO MAKE IT</Text>
          {sauce.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNo}>{i + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** The low-calorie sauces, each a heading that opens its recipe. */
export function LightSauces() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={styles.card}>
      <Text style={styles.intro}>Sauces add flavour, but shop-bought ones are often full of sugar and oil. These are quick, fresh and light.</Text>
      {LIGHT_SAUCES.map((sauce) => (
        <Sauce key={sauce.name} sauce={sauce} open={open === sauce.name} onToggle={() => setOpen(open === sauce.name ? null : sauce.name)} />
      ))}
    </View>
  );
}

/** The 🍳 next to a protein food in a meal plan: opens that food's ideas. */
export function CookingIdeasLink({ food }: { food: string }) {
  const [visible, setVisible] = useState(false);
  const [sauces, setSauces] = useState(false);
  const set = cookingIdeasFor(food);
  if (!set) return null;
  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={8} accessibilityLabel={`Cooking ideas for ${food}`}>
        <Text style={styles.link}>🍳 Ideas</Text>
      </Pressable>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {set.icon} Cooking ideas: {set.title}
            </Text>
            <ScrollView style={{ maxHeight: 520 }}>
              <CookingSet set={set} />
              <View style={[styles.fold, sauces && styles.foldOpen]}>
                <Pressable style={styles.row} onPress={() => setSauces(!sauces)} accessibilityRole="button" accessibilityState={{ expanded: sauces }}>
                  <Text style={styles.icon}>🥣</Text>
                  <Text style={styles.foldTitle}>Low-calorie sauces</Text>
                  <Text style={styles.chevron}>{sauces ? "▴" : "▾"}</Text>
                </Pressable>
                {sauces && <LightSauces />}
              </View>
            </ScrollView>
            <Pressable style={styles.close} onPress={() => setVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12 },
  intro: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginBottom: 4 },
  fold: { backgroundColor: "#0F172A", borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: "#0F172A" },
  foldOpen: { borderColor: BRAND_GOLD },
  foldBody: { paddingHorizontal: 12, paddingBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  icon: { fontSize: 20 },
  foldTitle: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  chevron: { color: "#94A3B8", fontSize: 18 },
  tip: { backgroundColor: BRAND_GOLD + "1F", borderRadius: 8, padding: 10, marginBottom: 4 },
  tipText: { color: "#F5E7B5", fontSize: 13, lineHeight: 19 },
  idea: { backgroundColor: "#273449", borderRadius: 10, marginTop: 8, paddingBottom: 2 },
  ideaOpen: { paddingBottom: 10 },
  number: { color: "#0F172A", backgroundColor: BRAND_GOLD, width: 24, height: 24, borderRadius: 12, textAlign: "center", lineHeight: 24, fontWeight: "800", fontSize: 13, overflow: "hidden" },
  ideaName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  why: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  stepRow: { flexDirection: "row", paddingHorizontal: 14, marginTop: 4, gap: 6 },
  stepNo: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14, width: 18 },
  stepText: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, flex: 1 },
  label: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginTop: 10, marginBottom: 4 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13, marginLeft: 12 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  close: { backgroundColor: "#334155", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  closeText: { color: "#fff", fontWeight: "700" },
});
