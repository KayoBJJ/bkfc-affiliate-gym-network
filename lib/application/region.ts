export type ApplicationRegion = "Europe" | "MENA" | "LATAM" | "North America" | "Other";

const REGION_COUNTRIES: Record<Exclude<ApplicationRegion, "Other">, readonly string[]> = {
  Europe: ["bulgaria", "spain", "italy", "serbia", "poland", "germany", "france", "netherlands", "belgium", "romania", "greece", "hungary", "croatia", "montenegro", "albania", "north macedonia", "austria", "switzerland", "united kingdom", "ireland", "portugal"],
  MENA: ["uae", "united arab emirates", "saudi arabia", "qatar", "kuwait", "bahrain", "oman", "egypt", "morocco", "tunisia", "jordan", "lebanon"],
  LATAM: ["mexico", "brazil", "argentina", "colombia", "chile", "peru", "uruguay", "paraguay", "ecuador", "venezuela"],
  "North America": ["usa", "united states", "united states of america", "canada"],
};

export function getApplicationRegion(country: string): ApplicationRegion {
  const normalized = country.normalize("NFKC").trim().toLocaleLowerCase("en-US");
  return (Object.entries(REGION_COUNTRIES) as Array<[Exclude<ApplicationRegion, "Other">, readonly string[]]>)
    .find(([, countries]) => countries.includes(normalized))?.[0] ?? "Other";
}
