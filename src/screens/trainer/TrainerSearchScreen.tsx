import React, { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { matchesAll, searchPages, searchWords, TRAINER_PAGES } from "@/lib/appSearch";
import { filterExercises } from "@/lib/exerciseFilter";
import { loadAvailablePrograms } from "@/lib/programQueries";
import { BRAND_GOLD } from "@/lib/brand";
import SearchResults, { type SearchGroup } from "@/components/SearchResults";
import type { Client, Exercise, Program } from "@/types/database";
import type { TrainerStackParamList } from "@/navigation/types";

// Searches the trainer's app: their clients, programs, the exercise library and pages.
export default function TrainerSearchScreen({ navigation }: NativeStackScreenProps<TrainerStackParamList, "Search">) {
  const { trainer } = useAuth();
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trainer) return;
    Promise.all([
      supabase.from("clients").select("*").eq("trainer_id", trainer.id).order("name"),
      loadAvailablePrograms(),
      supabase.from("exercises").select("*").order("sort_order"),
    ]).then(([c, p, e]) => {
      setClients(c.data ?? []);
      setPrograms(p);
      setExercises(e.data ?? []);
      setLoading(false);
    });
  }, [trainer?.id]);

  const words = searchWords(query);
  const pages = searchPages(TRAINER_PAGES, query).filter((p) => p.tab !== "Trainers" || trainer?.is_owner);
  const groups: SearchGroup[] = [
    {
      title: "Clients",
      data: clients
        .filter((c) => matchesAll(`${c.name} ${c.email}`, words))
        .map((c) => ({
          key: `client-${c.id}`,
          title: c.name,
          subtitle: c.email,
          onPress: () => navigation.navigate("ClientDetail", { clientId: c.id }),
        })),
    },
    {
      title: "Programs",
      data: programs
        .filter((p) => matchesAll(`${p.name} ${p.description ?? ""}`, words))
        .map((p) => ({
          key: `program-${p.id}`,
          title: p.name,
          subtitle: p.description,
          onPress: () => navigation.navigate("TrainerTabs", { screen: "Programs" }),
        })),
    },
    {
      title: "Exercises",
      data: (words.length > 0 ? filterExercises(exercises, query) : []).slice(0, 30).map((e) => ({
        key: `exercise-${e.id}`,
        title: e.name,
        subtitle: [e.category, e.home_friendly ? "Home" : null].filter(Boolean).join(" · "),
        videoUrl: e.external_url,
      })),
    },
    {
      title: "Pages",
      data: pages.map((p) => ({
        key: `page-${p.tab}`,
        title: p.title,
        onPress: () => navigation.navigate("TrainerTabs", { screen: p.tab }),
      })),
    },
  ];

  return (
    <SearchResults
      query={query}
      onChangeQuery={setQuery}
      groups={groups}
      loading={loading}
      placeholder="Search clients, programs and exercises"
      accent={BRAND_GOLD}
    />
  );
}
