import React, { useEffect, useState } from "react";
import { Clipboard, Text } from "react-native";
import Pressable from "@/components/Pressable";
import { themedStyles } from "@/lib/theme";

// Copies the trainer's code so they can paste it into WhatsApp or an email to
// clients and other trainers (GRIZZ, 2026-11-06). Shows "Copied ✓" for a moment.
export default function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Pressable
      style={styles.button}
      onPress={() => {
        try {
          Clipboard.setString(code);
          setCopied(true);
        } catch {
          // Nothing to do: the code is on screen to type out.
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={`Copy code ${code}`}
    >
      <Text style={styles.text}>{copied ? "Copied ✓" : "Copy code"}</Text>
    </Pressable>
  );
}

const styles = themedStyles({
  button: { borderColor: "#D4AF37", borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, marginTop: 8 },
  text: { color: "#D4AF37", fontWeight: "700" },
});
