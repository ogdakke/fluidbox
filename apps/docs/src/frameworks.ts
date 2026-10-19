/** The ways to use fluidbox, in the order the docs tabs show them. */
export const frameworks = [
  { key: "react", label: "React" },
  { key: "vue", label: "Vue" },
  { key: "solid", label: "Solid" },
  { key: "angular", label: "Angular" },
  { key: "elements", label: "Elements" },
  { key: "javascript", label: "JavaScript" },
] as const;

export type Framework = (typeof frameworks)[number]["key"];
