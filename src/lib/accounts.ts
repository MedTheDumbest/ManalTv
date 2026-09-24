export const ACTIVE_PROFILE_COOKIE = "active_profile";

export const PROFILES = {
  manal: { id: "manal", name: "Manal", pin: "2809" },
  amine: { id: "amine", name: "Mohammed Amine", pin: "2103" },
} as const;

export type ProfileId = keyof typeof PROFILES;

export function isProfileId(value: unknown): value is ProfileId {
  return value === "manal" || value === "amine";
}

export function verifyPin(profileId: ProfileId, pin: string): boolean {
  return PROFILES[profileId].pin === pin;
}

export function dataKeyForProfile(profileId: ProfileId): string {
  return `user:${profileId}:data`;
}