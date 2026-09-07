use std::collections::HashSet;

use crate::commands::ProviderCatalogEntry;
use quotalis_core::locale::{self, LocaleKey};
use quotalis_core::settings::Language;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TrayMenuEntry {
    pub(crate) id: Option<String>,
    pub(crate) label: String,
    pub(crate) children: Vec<Self>,
    pub(crate) is_separator: bool,
    pub(crate) disabled: bool,
    /// When `Some`, this entry renders as a check/checkbox item.
    /// `true` = checked (enabled), `false` = unchecked (disabled).
    pub(crate) checked: Option<bool>,
}

impl TrayMenuEntry {
    fn item(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id: Some(id.into()),
            label: label.into(),
            children: Vec::new(),
            is_separator: false,
            disabled: false,
            checked: None,
        }
    }

    /// A checkbox menu item. `checked` mirrors the provider's enabled state.
    fn check_item(id: impl Into<String>, label: impl Into<String>, checked: bool) -> Self {
        Self {
            id: Some(id.into()),
            label: label.into(),
            children: Vec::new(),
            is_separator: false,
            disabled: false,
            checked: Some(checked),
        }
    }

    fn submenu(id: impl Into<String>, label: impl Into<String>, children: Vec<Self>) -> Self {
        Self {
            id: Some(id.into()),
            label: label.into(),
            children,
            is_separator: false,
            disabled: false,
            checked: None,
        }
    }

    fn separator() -> Self {
        Self {
            id: None,
            label: String::new(),
            children: Vec::new(),
            is_separator: true,
            disabled: false,
            checked: None,
        }
    }

    pub(crate) fn status_row(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id: Some(id.into()),
            label: label.into(),
            children: Vec::new(),
            is_separator: false,
            disabled: true,
            checked: None,
        }
    }
}

/// Surface visibility toggles reflected as check items in the tray menu.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct SurfaceToggles {
    pub float_bar: bool,
    pub top_arc: bool,
}

#[allow(
    dead_code,
    reason = "kept as the test-default entry point for menu construction"
)]
pub(crate) fn build_tray_menu(
    providers: &[ProviderCatalogEntry],
    status_labels: &[(String, String)],
    enabled_providers: &HashSet<String>,
) -> Vec<TrayMenuEntry> {
    build_tray_menu_with(
        providers,
        status_labels,
        enabled_providers,
        SurfaceToggles::default(),
        &[],
        false,
        Language::English,
    )
}

pub(crate) struct ProfileMenuEntry {
    pub id: String,
    pub name: String,
    pub active: bool,
}

pub(crate) fn build_tray_menu_with(
    providers: &[ProviderCatalogEntry],
    status_labels: &[(String, String)],
    enabled_providers: &HashSet<String>,
    surfaces: SurfaceToggles,
    profiles: &[ProfileMenuEntry],
    privacy_mode: bool,
    lang: Language,
) -> Vec<TrayMenuEntry> {
    let mut menu: Vec<TrayMenuEntry> = Vec::new();
    let text = |key| locale::get_text(lang, key);

    // Status rows (one per enabled provider with live usage).
    for (id, label) in status_labels {
        menu.push(TrayMenuEntry::status_row(format!("status_{id}"), label));
    }
    if !status_labels.is_empty() {
        menu.push(TrayMenuEntry::separator());
    }

    // "Open QuotaArc" is the single primary entry point — same action as
    // left-click and a cold/relaunch, per startup_destination. "Dashboard"
    // and "Provider Display" are explicit, unambiguous deep links some
    // users may prefer over whatever "Opens to" currently resolves to —
    // both route through MainRoute, the same vocabulary sidebar navigation
    // and cold launch use (Wave 6 Phase 3). Distinct from "Pop Out Panel"
    // below, a genuinely separate, still-supported compact tray-popover
    // window (TrayPanel.tsx) — not the Dashboard.
    menu.push(TrayMenuEntry::item(
        "open_main_app",
        text(LocaleKey::TrayOpenMainApp),
    ));
    menu.push(TrayMenuEntry::item(
        "dashboard",
        text(LocaleKey::TrayDashboard),
    ));
    menu.push(TrayMenuEntry::item(
        "provider_display",
        text(LocaleKey::TrayProviderDisplayRoute),
    ));
    menu.push(TrayMenuEntry::separator());

    menu.push(TrayMenuEntry::item(
        "refresh",
        text(LocaleKey::TrayRefreshAll),
    ));
    menu.push(TrayMenuEntry::separator());

    // Collections: primary action opens/focuses the main app on the tab
    // Collections currently lives in (see docs/validation/COLLECTIONS_0_10_1.md);
    // the detached native Collections window remains available as an
    // explicit secondary action rather than the only way to reach it.
    menu.push(TrayMenuEntry::item(
        "collections",
        text(LocaleKey::TrayCollections),
    ));
    menu.push(TrayMenuEntry::item(
        "open_collections_window",
        text(LocaleKey::TrayOpenCollectionsWindow),
    ));
    if !profiles.is_empty() {
        // Profile *switching* entries, plus a trailing "Manage Profiles..."
        // that opens the real first-class Profiles destination in the main
        // app (see docs/validation/PROFILES_0_11_0.md) — no more dead end.
        let mut profile_items: Vec<TrayMenuEntry> = profiles
            .iter()
            .map(|p| {
                TrayMenuEntry::check_item(format!("switch_profile:{}", p.id), &p.name, p.active)
            })
            .collect();
        profile_items.push(TrayMenuEntry::separator());
        profile_items.push(TrayMenuEntry::item(
            "manage_profiles",
            text(LocaleKey::TrayManageProfiles),
        ));
        menu.push(TrayMenuEntry::submenu(
            "profiles",
            text(LocaleKey::TrayProfiles),
            profile_items,
        ));
    }
    if !providers.is_empty() {
        let mut provider_items: Vec<TrayMenuEntry> = providers
            .iter()
            .map(|provider| {
                let is_enabled = enabled_providers.contains(&provider.id);
                TrayMenuEntry::check_item(
                    format!("toggle_provider:{}", provider.id),
                    &provider.display_name,
                    is_enabled,
                )
            })
            .collect();
        provider_items.push(TrayMenuEntry::separator());
        provider_items.push(TrayMenuEntry::item(
            "manage_providers",
            text(LocaleKey::TrayManageProviders),
        ));
        menu.push(TrayMenuEntry::submenu(
            "providers",
            text(LocaleKey::TrayProviders),
            provider_items,
        ));
    }
    menu.push(TrayMenuEntry::separator());

    menu.push(TrayMenuEntry::check_item(
        "toggle_float_bar",
        text(LocaleKey::TrayShowFloatBar),
        surfaces.float_bar,
    ));
    menu.push(TrayMenuEntry::check_item(
        "toggle_top_arc",
        text(LocaleKey::TrayShowQuotaIsland),
        surfaces.top_arc,
    ));
    menu.push(TrayMenuEntry::item(
        "pop_out",
        text(LocaleKey::TrayPopOutPanel),
    ));
    menu.push(TrayMenuEntry::separator());

    menu.push(TrayMenuEntry::check_item(
        "toggle_privacy_mode",
        text(LocaleKey::TrayPrivacyMode),
        privacy_mode,
    ));
    menu.push(TrayMenuEntry::separator());

    menu.push(TrayMenuEntry::item(
        "settings",
        text(LocaleKey::TraySettings),
    ));
    menu.push(TrayMenuEntry::item(
        "check_for_updates",
        text(LocaleKey::TrayCheckForUpdates),
    ));
    menu.push(TrayMenuEntry::item("about", text(LocaleKey::MenuAbout)));
    menu.push(TrayMenuEntry::separator());
    menu.push(TrayMenuEntry::item("quit", text(LocaleKey::MenuQuit)));

    menu
}

#[cfg(test)]
mod tests {
    use super::*;

    fn menu_contains(menu: &[TrayMenuEntry], id: &str) -> bool {
        menu.iter().any(|entry| {
            entry.id.as_deref() == Some(id)
                || (!entry.children.is_empty() && menu_contains(&entry.children, id))
        })
    }

    fn sample_provider_catalog() -> Vec<ProviderCatalogEntry> {
        vec![
            ProviderCatalogEntry {
                id: "codex".into(),
                display_name: "Codex".into(),
                cookie_domain: None,
            },
            ProviderCatalogEntry {
                id: "claude".into(),
                display_name: "Claude".into(),
                cookie_domain: None,
            },
        ]
    }

    fn both_enabled() -> HashSet<String> {
        ["codex".to_string(), "claude".to_string()]
            .into_iter()
            .collect()
    }

    #[test]
    fn check_for_updates_item_is_present() {
        let menu = build_tray_menu(&sample_provider_catalog(), &[], &both_enabled());
        assert!(menu_contains(&menu, "check_for_updates"));
    }

    #[test]
    fn dashboard_is_a_primary_entry_distinct_from_pop_out_panel() {
        // Wave 6 Phase 3: "Dashboard" is a real, unambiguous deep link to
        // MainRoute::Dashboard (PopOutPanel.tsx), alongside "Open QuotaArc"
        // and "Provider Display" — not to be confused with "pop_out", which
        // opens the separate compact tray-popover flyout (TrayPanel.tsx).
        let menu = build_tray_menu(&sample_provider_catalog(), &[], &both_enabled());
        let dashboard = menu
            .iter()
            .find(|e| e.id.as_deref() == Some("dashboard"))
            .expect("dashboard item present");
        assert_eq!(dashboard.label, "Dashboard");

        let pop_out = menu
            .iter()
            .find(|e| e.id.as_deref() == Some("pop_out"))
            .expect("pop_out item present");
        // Regression guard: this item previously carried the label
        // "Pop Out Dashboard" while actually opening TrayPanel, not the
        // Dashboard — a naming mismatch fixed alongside adding the real
        // "Dashboard" entry above.
        assert_eq!(pop_out.label, "Pop Out Panel");
    }

    #[test]
    fn provider_check_items_reflect_enabled_state() {
        let menu = build_tray_menu(
            &sample_provider_catalog(),
            &[],
            &["claude".to_string()].into_iter().collect(),
        );
        let providers_submenu = menu
            .iter()
            .find(|e| e.id.as_deref() == Some("providers"))
            .expect("providers submenu");

        let claude_item = providers_submenu
            .children
            .iter()
            .find(|e| e.id.as_deref() == Some("toggle_provider:claude"))
            .expect("claude item");
        let codex_item = providers_submenu
            .children
            .iter()
            .find(|e| e.id.as_deref() == Some("toggle_provider:codex"))
            .expect("codex item");

        assert_eq!(claude_item.checked, Some(true), "Claude should be checked");
        assert_eq!(codex_item.checked, Some(false), "Codex should be unchecked");
    }

    #[test]
    fn float_bar_toggle_reflects_state() {
        let menu_on = build_tray_menu_with(
            &sample_provider_catalog(),
            &[],
            &both_enabled(),
            /* surfaces = */
            SurfaceToggles {
                float_bar: true,
                top_arc: false,
            },
            &[],
            false,
            Language::English,
        );
        let toggle = menu_on
            .iter()
            .find(|e| e.id.as_deref() == Some("toggle_float_bar"))
            .expect("float bar toggle present");
        assert_eq!(toggle.checked, Some(true));
        assert_eq!(toggle.label, "Show Float Bar");

        let menu_off = build_tray_menu_with(
            &sample_provider_catalog(),
            &[],
            &both_enabled(),
            /* surfaces = */ SurfaceToggles::default(),
            &[],
            false,
            Language::English,
        );
        let toggle = menu_off
            .iter()
            .find(|e| e.id.as_deref() == Some("toggle_float_bar"))
            .expect("float bar toggle present");
        assert_eq!(toggle.checked, Some(false));
    }

    #[test]
    fn profiles_submenu_lists_each_profile_and_ends_with_manage_profiles() {
        let menu = build_tray_menu_with(
            &sample_provider_catalog(),
            &[],
            &both_enabled(),
            SurfaceToggles::default(),
            &[
                ProfileMenuEntry {
                    id: "p1".into(),
                    name: "Default".into(),
                    active: true,
                },
                ProfileMenuEntry {
                    id: "p2".into(),
                    name: "Night".into(),
                    active: false,
                },
            ],
            false,
            Language::English,
        );
        let submenu = menu
            .iter()
            .find(|e| e.id.as_deref() == Some("profiles"))
            .expect("profiles submenu present");

        let default_item = submenu
            .children
            .iter()
            .find(|e| e.id.as_deref() == Some("switch_profile:p1"))
            .expect("Default switch item");
        assert_eq!(default_item.checked, Some(true));
        let night_item = submenu
            .children
            .iter()
            .find(|e| e.id.as_deref() == Some("switch_profile:p2"))
            .expect("Night switch item");
        assert_eq!(night_item.checked, Some(false));

        // Manage Profiles is the real destination for everything switching
        // cannot do (create/rename/duplicate/delete/theme/account assignment)
        // — it must always be present and trail after a separator, not
        // interleaved with the switch list.
        let last = submenu.children.last().expect("submenu has entries");
        assert_eq!(last.id.as_deref(), Some("manage_profiles"));
        assert_eq!(last.label, "Manage Profiles...");
        let separator_before_manage = &submenu.children[submenu.children.len() - 2];
        assert!(separator_before_manage.is_separator);
    }

    #[test]
    fn tray_menu_static_labels_follow_language_but_provider_names_stay_raw() {
        let menu = build_tray_menu_with(
            &sample_provider_catalog(),
            &[],
            &both_enabled(),
            SurfaceToggles::default(),
            &[],
            false,
            Language::Japanese,
        );
        fn label_for<'a>(menu: &'a [TrayMenuEntry], id: &'a str) -> &'a str {
            menu.iter()
                .find(|e| e.id.as_deref() == Some(id))
                .map(|e| e.label.as_str())
                .expect(id)
        }

        assert_eq!(label_for(&menu, "refresh"), "すべて更新");
        // TrayOpenMainApp has no Japanese translation yet — falls back to
        // English, per this repo's established locale-fallback convention.
        assert_eq!(label_for(&menu, "open_main_app"), "Open Quotalis");
        assert_eq!(label_for(&menu, "settings"), "設定...");
        assert_eq!(label_for(&menu, "quit"), "終了");

        let providers = menu
            .iter()
            .find(|e| e.id.as_deref() == Some("providers"))
            .expect("providers submenu");
        // Provider entries first, then a separator and "Manage Providers...".
        let provider_labels: Vec<&str> = providers
            .children
            .iter()
            .filter(|e| !e.is_separator)
            .map(|e| e.label.as_str())
            .collect();
        assert_eq!(
            provider_labels,
            vec!["Codex", "Claude", "Manage Providers..."]
        );
    }

    #[test]
    fn status_rows_appear_at_top_with_separator() {
        let labels = vec![
            ("claude".to_string(), "Claude 60%".to_string()),
            ("codex".to_string(), "Codex 30%".to_string()),
        ];
        let menu = build_tray_menu(&sample_provider_catalog(), &labels, &both_enabled());
        // First two items should be disabled status rows.
        assert_eq!(menu[0].id.as_deref(), Some("status_claude"));
        assert!(menu[0].disabled);
        assert_eq!(menu[1].id.as_deref(), Some("status_codex"));
        assert!(menu[1].disabled);
        // Third item should be a separator.
        assert!(menu[2].is_separator);
    }
}
