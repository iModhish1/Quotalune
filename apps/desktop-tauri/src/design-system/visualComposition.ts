/**
 * Wave 6 Phase 4 — the single pure resolver for "which Provider
 * Presentation identity actually applies, and why."
 *
 * This does NOT replace or duplicate the existing Structure Theme
 * (`themeCatalog.ts`/`themeResolution.ts`) or Provider Presentation
 * identity (`limitPresentation.ts`/`providerPresentationIdentity.ts`)
 * systems — both stay exactly as they are, with all 24 entries each
 * (see docs/validation/VISUAL_THEME_OWNERSHIP.md). It centralizes the
 * ONE piece of logic that was previously implicit and re-derived ad hoc
 * in different places: given a structure theme, an explicit/global
 * presentation choice, and an optional per-provider override, what
 * presentation identity actually renders, and what should the UI tell
 * the user about why.
 *
 * "Follow Structure" IS the existing `identity === "adaptive"` behavior
 * (the real, working, one-way `--pi-*` -> `--surface-*` fallback
 * documented in `providerPresentationIdentity.ts`/`UsageWindowList.css`)
 * — this resolver makes that mechanism explicit and nameable rather than
 * inventing a second one. "Independent" is any other identity, chosen
 * and persisted as such.
 *
 * Precedence (existing architecture, made explicit — mirrors
 * `resolveLimitPresentation`'s provider-override-wins rule):
 *   provider-specific override  →  explicit/global identity  →  default ("adaptive")
 *
 * Pure: no mutable module state, no I/O. Same input always yields the
 * same output.
 */
import {
  PROVIDER_PRESENTATION_IDENTITIES,
  type ProviderPresentationIdentity,
} from "./limitPresentation";

export type ProviderPresentationSource = "followStructure" | "independent";

export type VisualCompositionProvenance =
  // A per-provider override was explicitly set for this provider — even
  // when its value happens to be "adaptive" (visually identical to plain
  // Follow Structure), this stays `providerOverride` provenance: the user
  // made a deliberate per-provider choice, and the UI should say so
  // rather than silently reporting it as inherited.
  | { kind: "providerOverride"; providerId: string }
  | { kind: "independent" }
  | { kind: "followStructure" };

export interface VisualCompositionInput {
  /** The active Structure Theme's slug (CatalogTheme.slug). Carried
   *  through to the result for display/provenance; this resolver does
   *  not (yet) look up per-structure recommended identities, because no
   *  such curated mapping exists in the current theme metadata — see
   *  docs/validation/VISUAL_THEME_OWNERSHIP.md's "Adaptive" section. It
   *  only reads text/muted/track through the existing CSS/`--surface-*`
   *  fallback, which is structure-theme-agnostic in code (though its
   *  resolved values differ per theme via the CSS cascade). */
  structureThemeId: string;
  /** The explicit/global provider-presentation identity, if the user
   *  (or a stored profile/settings value) has one. `undefined` means
   *  "no explicit choice yet" and resolves to the default, "adaptive". */
  identity?: ProviderPresentationIdentity;
  /** A provider-specific override identity, if this composition is being
   *  resolved for one named provider that has its own override stored
   *  (`provider_limit_presentation` in Rust settings). Wins over
   *  `identity` when present. */
  providerOverrideIdentity?: ProviderPresentationIdentity;
  /** The provider this override belongs to, for provenance display.
   *  Required when `providerOverrideIdentity` is set. */
  providerId?: string;
}

export interface ResolvedVisualComposition {
  resolvedStructureThemeId: string;
  /** The provider-presentation identity that actually applies. */
  resolvedProviderPresentationIdentity: ProviderPresentationIdentity;
  presentationSource: ProviderPresentationSource;
  provenance: VisualCompositionProvenance;
}

function isKnownIdentity(value: unknown): value is ProviderPresentationIdentity {
  return (
    typeof value === "string" &&
    (PROVIDER_PRESENTATION_IDENTITIES as readonly string[]).includes(value)
  );
}

/** Safe fallback for any invalid/unknown/deleted identity value. */
const FALLBACK_IDENTITY: ProviderPresentationIdentity = "adaptive";

export function resolveVisualComposition(
  input: VisualCompositionInput,
): ResolvedVisualComposition {
  const override = isKnownIdentity(input.providerOverrideIdentity)
    ? input.providerOverrideIdentity
    : undefined;
  const explicit = isKnownIdentity(input.identity) ? input.identity : undefined;

  const resolvedIdentity: ProviderPresentationIdentity =
    override ?? explicit ?? FALLBACK_IDENTITY;

  const presentationSource: ProviderPresentationSource =
    resolvedIdentity === "adaptive" ? "followStructure" : "independent";

  const provenance: VisualCompositionProvenance = override
    ? { kind: "providerOverride", providerId: input.providerId ?? "unknown" }
    : presentationSource === "followStructure"
      ? { kind: "followStructure" }
      : { kind: "independent" };

  return {
    resolvedStructureThemeId: input.structureThemeId,
    resolvedProviderPresentationIdentity: resolvedIdentity,
    presentationSource,
    provenance,
  };
}
