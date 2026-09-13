import type {ProfileDto} from './profileBridge';

export function profileCopyName(profiles: readonly ProfileDto[], name: string, suffix: string): string {
  const existing = new Set(profiles.map(profile => profile.name.trim().toLocaleLowerCase()));
  const base = `${name} ${suffix}`;
  let candidate = base;
  for (let number = 2; existing.has(candidate.toLocaleLowerCase()); number++) candidate = `${base} ${number}`;
  return candidate;
}

export function reorderedProfileIds(profiles: readonly ProfileDto[], id: string, delta: -1 | 1): string[] {
  const ids = profiles.map(profile => profile.id);
  const index = ids.indexOf(id), target = index + delta;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}
