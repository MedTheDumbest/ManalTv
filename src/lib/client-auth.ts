import { ACTIVE_PROFILE_COOKIE, isProfileId, type ProfileId } from "@/lib/accounts";

export function getActiveProfileId(): ProfileId | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACTIVE_PROFILE_COOKIE}=`));

  if (!cookie) return null;

  let value = cookie.slice(ACTIVE_PROFILE_COOKIE.length + 1);

  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }

  return isProfileId(value) ? value : null;
}