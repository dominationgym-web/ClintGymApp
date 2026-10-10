import React, { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { CLIENT_PAGES, searchPages, searchSections } from "@/lib/appSearch";
import { clientBrowsable, filterExercises } from "@/lib/exerciseFilter";
import { loadClientProgram } from "@/lib/programQueries";
import { SECTIONS } from "@/lib/sections";
import { BRAND_GOLD } from "@/lib/brand";
import SearchResults, { type SearchGroup } from "@/components/SearchResults";
import type { Exercise } from "@/types/database";
import type { ClientStackParamList } from "@/navigation/types";

// Searches the client's app: pages, the guide sections and the exercises they
// can see (only their program's if the coach hasn't opened the library, 0043).
export default function ClientSearchScreen({ navigation }: NativeStackScreenProps<ClientStackParamList, "Search">) {
  const { client } = useAuth();
  const [query, setQuery] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;
    Promise.all([supabase.from("exercises").select("*").order("sort_order"), loadClientProgram(client.id)]).then(
      ([{ data }, program]) => {
        setExercises(clientBrowsable(data ?? [], program ? program.exercises.map((e) => e.exercise_id) : []));
        setLoading(false);
      },
    );
  }, [client?.id]);

  const searching = query.trim().length > 0;
  const pages = searchPages(CLIENT_PAGES, query).filter((p) => p.tab !== "Reset" || client?.lifestyle_reset_started_at);
  const groups: SearchGroup[] = [
    {
      title: "Pages",
      data: pages.map((p) => ({
        key: `page-${p.tab}`,
        title: p.title,
        onPress: () => navigation.navigate("ClientTabs", { screen: p.tab }),
      })),
    },
    {
      title: "Guides",
      data: searchSections(SECTIONS, query).map((s) => ({
        key: `section-${s.key}`,
        title: s.title,
        subtitle: s.snippet,
        onPress: () => navigation.navigate("Section", { sectionKey: s.key }),
      })),
    },
    {
      title: "Exercises",
      data: (searching ? filterExercises(exercises, query) : []).slice(0, 30).map((e) => ({
        key: `exercise-${e.id}`,
        title: e.name,
        subtitle: e.category,
        videoUrl: e.external_url,
      })),
    },
  ];

  return (
    <SearchResults
      query={query}
      onChangeQuery={setQuery}
      groups={groups}
      loading={loading}
      placeholder="Search exercises, guides and pages"
      accent={BRAND_GOLD}
    />
  );
}
