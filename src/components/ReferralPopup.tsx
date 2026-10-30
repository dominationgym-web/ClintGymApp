import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, Share, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { REFERRAL_DISCOUNT_PERCENT, REFERRALS_PER_FREE_MONTH, REFERRAL_WAIT_MONTHS, referralRewards } from "@/lib/trainers";
import { money, referralCreditUseLine, referralCreditValue, referralPopupDue, trainerCurrency } from "@/lib/billing";
import type { BillingPrices } from "@/types/database";
import { themedStyles } from "@/lib/theme";

const shownKey = (trainerId: string) => `referralPopupShownOn:${trainerId}`;

// Explains the referral system the first time an approved trainer opens the
// app, then pops up once a week with what they've earned and banked so far
// (GRIZZ, 2026-10-14). The same numbers live on Profile > Plan & refer.
export default function ReferralPopup() {
  const { trainer } = useAuth();
  const trainerRef = useRef(trainer);
  trainerRef.current = trainer;
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  visibleRef.current = visible;
  const [firstTime, setFirstTime] = useState(false);
  const [counted, setCounted] = useState(0);
  const [prices, setPrices] = useState<BillingPrices | null>(null);

  const check = useCallback(async () => {
    const t = trainerRef.current;
    if (!t || t.is_owner || !t.approved || visibleRef.current) return;
    try {
      const last = await AsyncStorage.getItem(shownKey(t.id));
      if (!referralPopupDue(last, todayIso())) return;
      const [refs, settings] = await Promise.all([
        supabase.rpc("my_referral_progress"),
        supabase.from("billing_settings").select("prices").eq("id", 1).maybeSingle(),
      ]);
      setCounted((refs.data ?? []).filter((r: { counted: boolean }) => r.counted).length);
      setPrices((settings.data?.prices as BillingPrices | undefined) ?? null);
      setFirstTime(!last);
      setVisible(true);
    } catch {
      // Storage or network failed: nothing pops up. It's all on the Profile tab.
    }
  }, []);

  const trainerId = trainer?.id;
  const isApproved = trainer?.approved;
  useEffect(() => {
    if (!trainerId || !isApproved) return;
    check();
    const subscription = AppState.addEventListener("change", (state) => state === "active" && check());
    return () => subscription.remove();
  }, [trainerId, isApproved, check]);

  if (!trainer || !visible) return null;

  const rewards = referralRewards(counted, trainer.referral_credits_used);
  const currency = trainerCurrency(trainer);
  const freeUse = !!trainer.free_use_from;
  const bankedValue = prices ? referralCreditValue(prices, currency, rewards.unused) : null;

  const close = () => {
    setVisible(false);
    AsyncStorage.setItem(shownKey(trainer.id), todayIso()).catch(() => {});
  };

  const share = () =>
    Share.share({
      message: `I coach my clients on the Daily Evolution app. Sign up as a trainer and enter my referral code ${trainer.join_code} to get a free 30-day trial.`,
    });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <ScrollView contentContainerStyle={styles.backdrop}>
        <View style={styles.popup}>
          <Text style={styles.kicker}>{firstTime ? "HOW REFERRALS WORK" : "YOUR WEEKLY REFERRALS"}</Text>
          <Text style={styles.title}>
            {firstTime ? "Bring a trainer, pay less" : rewards.unused > 0 ? "You've got money off banked" : "Bring a trainer, pay less"}
          </Text>

          {firstTime ? (
            <>
              <Text style={styles.step}>1. Share your referral code with another trainer.</Text>
              <Text style={styles.step}>2. They enter it when they sign up and get a free 30-day trial.</Text>
              <Text style={styles.step}>
                3. Once they've been with Daily Evolution for {REFERRAL_WAIT_MONTHS} months after their free trial, you get{" "}
                {REFERRAL_DISCOUNT_PERCENT}% off a month. {REFERRALS_PER_FREE_MONTH} referrals = a free month.
              </Text>
              <Text style={styles.step}>4. {referralCreditUseLine(freeUse)}</Text>
              <Text style={styles.step}>5. If you cancel, any unused referrals are paid out to you.</Text>
            </>
          ) : null}

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{rewards.earned}</Text>
              <Text style={styles.statLabel}>earned</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{rewards.unused}</Text>
              <Text style={styles.statLabel}>banked</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{bankedValue !== null ? money(bankedValue, currency) : `${rewards.unusedPercent}%`}</Text>
              <Text style={styles.statLabel}>off to use</Text>
            </View>
          </View>
          {!firstTime ? <Text style={styles.body}>{referralCreditUseLine(freeUse)}</Text> : null}
          {rewards.unused > 0 && rewards.toNextFreeMonth < REFERRALS_PER_FREE_MONTH ? (
            <Text style={styles.body}>
              {rewards.toNextFreeMonth} more referral{rewards.toNextFreeMonth === 1 ? "" : "s"} and you've banked another free month.
            </Text>
          ) : null}

          <View style={styles.codeBox}>
            <Text style={styles.statLabel}>Your referral code</Text>
            <Text style={styles.code}>{trainer.join_code}</Text>
          </View>
          <Pressable style={styles.button} onPress={share}>
            <Text style={styles.buttonText}>Share with a trainer</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={close}>
            <Text style={styles.secondaryText}>Got it</Text>
          </Pressable>
          <Text style={styles.footnote}>You can see this any time on Profile, under Plan & refer.</Text>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flexGrow: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 24 },
  popup: { backgroundColor: "#0F172A", borderRadius: 16, padding: 22, borderWidth: 1.5, borderColor: BRAND_GOLD },
  kicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 10 },
  step: { color: "#CBD5E1", fontSize: 15, lineHeight: 21, marginBottom: 6 },
  body: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 8 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  stat: { flex: 1, backgroundColor: "#1E293B", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  statNumber: { color: BRAND_GOLD, fontSize: 20, fontWeight: "800" },
  statLabel: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  codeBox: { alignItems: "center", marginTop: 14 },
  code: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: 3, marginTop: 2 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  secondary: { alignItems: "center", padding: 12, marginTop: 4 },
  secondaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  footnote: { color: "#64748B", fontSize: 12, textAlign: "center" },
});
