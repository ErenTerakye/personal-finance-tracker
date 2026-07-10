import type { Translate } from "./types";

export function localizedNotice(
  response: { notice: string; notice_code?: string },
  t: Translate,
): string {
  if (!response.notice_code) {
    return response.notice;
  }
  const key = `notices.${response.notice_code}`;
  const translated = t(key);
  return translated === key ? response.notice : translated;
}
