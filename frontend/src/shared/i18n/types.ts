export type Language = "en" | "tr";
export type TranslationShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationShape<T[Key]>;
};
export type Translate = (
  key: string,
  variables?: Record<string, string | number>,
) => string;
