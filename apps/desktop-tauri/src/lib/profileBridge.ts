/**
 * Typed bridge for QuotaArc Profiles / ProviderAccounts commands.
 */
import { invoke } from "@tauri-apps/api/core";
import type { ThemePreference } from "../types/bridge";

export interface CredentialReference {
  source: string;
  id?: string | null;
}

export interface ProviderAccountDto {
  id: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  credentialReference: CredentialReference;
  accent?: string | null;
  tags: string[];
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileSurfacesDto {
  edgeArc: boolean;
  topArc: boolean;
  taskbarArc: boolean;
  floatBar: boolean;
}

export interface ProfileDto {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  /** "auto" | "light" | "dark", or null to inherit the global theme. */
  theme?: ThemePreference | null;
  catalogTheme?: string | null;
  accent?: string | null;
  surfaces: ProfileSurfacesDto;
  accountIds: string[];
  highUsageThreshold: number;
  criticalUsageThreshold: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileStoreDto {
  schemaVersion: number;
  profiles: ProfileDto[];
  accounts: ProviderAccountDto[];
  activeProfileId: string;
}

export function getProfileStore(): Promise<ProfileStoreDto> {
  return invoke("get_profile_store");
}

export function switchProfile(profileId: string): Promise<void> {
  return invoke("switch_profile", { profileId });
}

export function createProfile(name: string, description?: string): Promise<ProfileDto> {
  return invoke("create_profile", { name, description: description ?? null });
}

export function renameProfile(profileId: string, name: string): Promise<void> {
  return invoke("rename_profile", { profileId, name });
}

export function duplicateProfile(profileId: string, newName: string): Promise<ProfileDto> {
  return invoke("duplicate_profile", { profileId, newName });
}

export function deleteProfile(profileId: string): Promise<void> {
  return invoke("delete_profile", { profileId });
}

export function reorderProfiles(profileIds: string[]): Promise<void> {
  return invoke("reorder_profiles", { profileIds });
}

export function updateProfile(patch: {
  profileId: string;
  theme?: ThemePreference | null | undefined;
  catalogTheme?: string | null | undefined;
  accent?: string | null | undefined;
  edgeArc?: boolean;
  topArc?: boolean;
  taskbarArc?: boolean;
  floatBar?: boolean;
}): Promise<void> {
  return invoke("update_profile", patch);
}

export function addAccount(request: {
  provider: string;
  displayName: string;
  profileIds?: string[];
  credentialSource?: string;
  credentialId?: string;
}): Promise<ProviderAccountDto> {
  return invoke("add_account", request);
}

export function updateAccount(patch: {
  accountId: string;
  displayName?: string;
  enabled?: boolean;
  accent?: string | null;
  tags?: string[];
}): Promise<void> {
  return invoke("update_account", patch);
}

export function removeAccount(accountId: string): Promise<void> {
  return invoke("remove_account", { accountId });
}

export function setAccountProfileMembership(
  accountId: string,
  profileId: string,
  member: boolean,
): Promise<void> {
  return invoke("set_account_profile_membership", { accountId, profileId, member });
}
