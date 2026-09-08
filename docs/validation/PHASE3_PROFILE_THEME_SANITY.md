# Phase 3.6 closure — profile Structure Theme sanity check

Quick, non-blocking verification requested at the start of Phase 4. Real
Dev binary, real IPC, no code changes needed (Phase 3.6's
`resolveCatalogTheme` precedence already handles this).

## Method

1. Set the global theme to `01-obsidian-orbit` (baseline).
2. Created a DEV-only second profile ("Phase4 Sanity B") via the real
   `create_profile` command.
3. `switch_profile` to it, then `set_catalog_theme("smoked-silver",
   "profile")` — sets that profile's own `catalog_theme`, not the global one.
4. Read the real settings snapshot back:
   `{"catalogTheme":"01-obsidian-orbit","activeProfileCatalogTheme":"smoked-silver"}`
   — confirms the profile-level override is genuinely active while the
   global setting is untouched.
5. Captured the Dashboard: `PHASE4_SANITY_PROFILE_B.png` — Trend card's
   structural accent renders silver, matching Smoked Silver.
6. `switch_profile` back to the original "Default" profile. Settings
   snapshot: `{"catalogTheme":"01-obsidian-orbit","activeProfileCatalogTheme":null}`
   — reverted cleanly, no stale value.
7. Captured `PHASE4_SANITY_PROFILE_DEFAULT.png` — Trend card's accent is
   back to teal (Obsidian Orbit).
8. Deleted the DEV-only test profile (`delete_profile`) to leave the
   Dev instance clean.

## Result

Dashboard Structure Theme correctly follows the active profile, with no
stale value on switch-back. **Phase 3 is closed.**
