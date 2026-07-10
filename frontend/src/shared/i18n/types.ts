export type Language = "en" | "tr";
export type Translate = (
  key: string,
  variables?: Record<string, string | number>,
) => string;
