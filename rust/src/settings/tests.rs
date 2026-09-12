use super::*;

#[test]
fn test_settings_default() {
    let settings = Settings::default();
    assert!(settings.enabled_providers.contains("claude"));
    assert!(settings.enabled_providers.contains("codex"));
    assert_eq!(settings.refresh_interval_secs, 300);
    assert!(settings.show_notifications);
    assert_eq!(
        settings.notification_sound_paths,
        NotificationSoundPaths::default()
    );
    assert_eq!(
        settings.notification_sound_theme,
        NotificationSoundTheme::Windows
    );
    assert_eq!(settings.high_usage_threshold, 70.0);
    assert_eq!(settings.critical_usage_threshold, 90.0);
    assert!(!settings.show_reset_when_exhausted);
    assert!(!settings.predictive_pace_warning_enabled);
    assert!(!settings.float_bar_show_cost);
    assert!(settings.promote_tray_icon);
    assert!(settings.claude_daily_routines_usage_visible);
    assert_eq!(settings.logo_variant, "silver");
    assert_eq!(settings.logo_scale_percent, 116);
    assert!(!settings.claude_allow_reading_claude_code_credentials);
    assert_eq!(
        settings.low_power_mode_preference,
        LowPowerModePreference::Off
    );
}

#[test]
fn logo_appearance_is_backward_compatible_and_normalized() {
    let legacy: Settings = serde_json::from_str(r#"{ "enabled_providers": [] }"#)
        .expect("settings without logo appearance");
    assert_eq!(legacy.logo_variant, "silver");
    assert_eq!(legacy.logo_scale_percent, 116);

    let invalid: Settings = serde_json::from_str(
        r#"{ "enabled_providers": [], "logo_variant": "neon", "logo_scale_percent": 800 }"#,
    )
    .expect("invalid logo appearance is repaired");
    assert_eq!(invalid.logo_variant, "silver");
    assert_eq!(invalid.logo_scale_percent, 125);

    for variant in ["silver", "arctic", "aurora", "ember", "violet"] {
        assert_eq!(normalize_logo_variant(variant), variant);
    }
    assert_eq!(clamp_logo_scale_percent(0), 90);
}

#[test]
fn low_power_mode_migrates_legacy_boolean_and_round_trips_preference() {
    let defaulted: Settings = serde_json::from_str(r#"{ "enabled_providers": [] }"#)
        .expect("missing low power fields defaults off");
    assert_eq!(
        defaulted.low_power_mode_preference,
        LowPowerModePreference::Off
    );

    let legacy: Settings =
        serde_json::from_str(r#"{ "enabled_providers": [], "low_power_mode": true }"#)
            .expect("legacy low_power_mode migrates");
    assert_eq!(legacy.low_power_mode_preference, LowPowerModePreference::On);

    let automatic = Settings {
        low_power_mode_preference: LowPowerModePreference::Automatic,
        ..Settings::default()
    };
    let json = serde_json::to_string(&automatic).expect("serialize low power preference");
    assert!(json.contains(r#""low_power_mode_preference":"automatic""#));
    let loaded: Settings = serde_json::from_str(&json).expect("deserialize low power preference");
    assert_eq!(
        loaded.low_power_mode_preference,
        LowPowerModePreference::Automatic
    );
}

#[test]
fn open_codex_usage_logs_default_off_and_round_trip() {
    let defaulted: Settings = serde_json::from_str(r#"{ "enabled_providers": [] }"#)
        .expect("missing open_codex_usage_logs_enabled defaults false");
    assert!(!defaulted.open_codex_usage_logs_enabled);

    let enabled = Settings {
        open_codex_usage_logs_enabled: true,
        hide_native_codex_cost_when_open_codex_present: true,
        ..Settings::default()
    };
    let json = serde_json::to_string(&enabled).expect("serialize OpenCodex usage opt-in");
    assert!(json.contains(r#""open_codex_usage_logs_enabled":true"#));

    let loaded: Settings = serde_json::from_str(&json).expect("deserialize OpenCodex usage opt-in");
    assert!(loaded.open_codex_usage_logs_enabled);
    assert!(loaded.hide_native_codex_cost_when_open_codex_present);
}

#[test]
fn notification_sound_paths_round_trip_and_default_for_existing_settings() {
    let settings = Settings {
        notification_sound_theme: NotificationSoundTheme::CodexBar,
        notification_sound_paths: NotificationSoundPaths {
            critical_usage: Some(r"C:\sounds\critical.wav".to_string()),
            expected_reset: Some(r"C:\sounds\expected-reset.wav".to_string()),
            unexpected_reset: Some(r"C:\sounds\unexpected-reset.wav".to_string()),
            banked_reset_credit: Some(r"C:\sounds\banked-reset.wav".to_string()),
            ..NotificationSoundPaths::default()
        },
        ..Settings::default()
    };
    let json = serde_json::to_string(&settings).expect("serialize notification sound paths");
    assert!(json.contains("\"criticalUsage\":\"C:\\\\sounds\\\\critical.wav\""));
    assert!(json.contains("\"expectedReset\":\"C:\\\\sounds\\\\expected-reset.wav\""));
    assert!(json.contains("\"unexpectedReset\":\"C:\\\\sounds\\\\unexpected-reset.wav\""));
    assert!(json.contains("\"bankedResetCredit\":\"C:\\\\sounds\\\\banked-reset.wav\""));

    let loaded: Settings =
        serde_json::from_str(&json).expect("deserialize notification sound paths");
    assert_eq!(
        loaded.notification_sound_paths,
        settings.notification_sound_paths
    );
    assert_eq!(
        loaded.notification_sound_theme,
        NotificationSoundTheme::CodexBar
    );

    let legacy: Settings = serde_json::from_str(r#"{ "enabled_providers": [] }"#)
        .expect("deserialize settings without notification sound paths");
    assert_eq!(
        legacy.notification_sound_paths,
        NotificationSoundPaths::default()
    );
    assert_eq!(
        legacy.notification_sound_theme,
        NotificationSoundTheme::Windows
    );
}

#[test]
fn promote_tray_icon_defaults_on_when_missing_from_disk() {
    let loaded: Settings = serde_json::from_str(
        r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300
        }"#,
    )
    .expect("parse settings without promote_tray_icon");
    assert!(loaded.promote_tray_icon);
}

#[test]
fn promote_tray_default_migration_flips_old_false_once() {
    assert!(Settings::should_migrate_promote_tray_default(false, false));
    assert!(!Settings::should_migrate_promote_tray_default(true, false));
    assert!(!Settings::should_migrate_promote_tray_default(false, true));
    assert!(!Settings::should_migrate_promote_tray_default(true, true));
}

#[test]
fn new_warning_and_reset_settings_are_backward_compatible() {
    let loaded: Settings = serde_json::from_str(
        r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300
        }"#,
    )
    .expect("parse legacy settings");

    assert!(!loaded.show_reset_when_exhausted);
    assert!(!loaded.predictive_pace_warning_enabled);
}

#[test]
fn usage_thresholds_inherit_from_window_provider_and_global_levels() {
    let mut settings = Settings::default();
    settings.provider_usage_thresholds.insert(
        "codex".into(),
        UsageThresholdOverride {
            high: Some(75.0),
            critical: None,
        },
    );
    settings.provider_usage_thresholds.insert(
        "codex:weekly".into(),
        UsageThresholdOverride {
            high: None,
            critical: Some(95.0),
        },
    );

    assert_eq!(
        settings.usage_thresholds(ProviderId::Codex, "weekly"),
        UsageThresholds {
            high: 75.0,
            critical: 95.0,
        }
    );
    assert_eq!(
        settings.usage_thresholds(ProviderId::Claude, "session"),
        UsageThresholds {
            high: 70.0,
            critical: 90.0,
        }
    );
}

#[test]
fn five_hour_thresholds_are_preserved_and_inherit_legacy_session_values() {
    let mut settings = Settings::default();
    settings.provider_usage_thresholds.insert(
        "codex:session".into(),
        UsageThresholdOverride {
            high: Some(61.0),
            critical: Some(81.0),
        },
    );

    assert_eq!(
        settings.usage_thresholds(ProviderId::Codex, "fiveHour"),
        UsageThresholds {
            high: 61.0,
            critical: 81.0,
        }
    );

    let loaded: Settings =
        serde_json::from_str(r#"{"provider_usage_thresholds":{"codex:fiveHour":{"high":72.0}}}"#)
            .expect("parse five-hour threshold override");
    assert_eq!(
        loaded.provider_usage_thresholds["codex:fiveHour"].high,
        Some(72.0)
    );
}

#[test]
fn safe_future_window_threshold_ids_survive_normalization() {
    let loaded: Settings = serde_json::from_str(
        r#"{"provider_usage_thresholds":{"codex:model-gpt-6":{"critical":87.0},"codex:bad window":{"high":50.0}}}"#,
    )
    .expect("parse future threshold override");
    assert_eq!(
        loaded.provider_usage_thresholds["codex:model-gpt-6"].critical,
        Some(87.0)
    );
    assert!(
        !loaded
            .provider_usage_thresholds
            .contains_key("codex:bad window")
    );
}

#[test]
fn empty_and_out_of_range_threshold_overrides_are_normalized_on_load() {
    let loaded: Settings = serde_json::from_str(
        r#"{
            "provider_usage_thresholds": {
                "codex": {"high": 120.0},
                "claude": {},
                "codex:weekly": {"critical": -10.0}
            }
        }"#,
    )
    .expect("parse settings");

    assert_eq!(loaded.provider_usage_thresholds.len(), 2);
    assert_eq!(loaded.provider_usage_thresholds["codex"].high, Some(100.0));
    assert_eq!(
        loaded.provider_usage_thresholds["codex:weekly"].critical,
        Some(0.0)
    );
}

#[test]
fn float_bar_defaults_are_safe() {
    let settings = Settings::default();
    assert!(!settings.float_bar_enabled);
    assert_eq!(settings.float_bar_opacity, 80);
    assert_eq!(settings.float_bar_scale, 100);
    assert_eq!(settings.float_bar_orientation, "horizontal");
    assert_eq!(settings.float_bar_style, "floating");
    assert!(!settings.float_bar_click_through);
    assert!(settings.float_bar_provider_ids.is_empty());
    assert!(!settings.float_bar_dark_text);
    assert!(!settings.float_bar_show_reset_inline);
    assert!(!settings.float_bar_show_cost);
}

#[test]
fn main_window_scale_defaults_to_100_percent() {
    let settings = Settings::default();
    assert_eq!(settings.window_scale_percent, 100);
}

#[test]
fn main_window_scale_clamp_pins_to_supported_range() {
    assert_eq!(clamp_window_scale_percent(0), 100);
    assert_eq!(clamp_window_scale_percent(99), 100);
    assert_eq!(clamp_window_scale_percent(100), 100);
    assert_eq!(clamp_window_scale_percent(125), 125);
    assert_eq!(clamp_window_scale_percent(180), 180);
    assert_eq!(clamp_window_scale_percent(250), 250);
    assert_eq!(clamp_window_scale_percent(251), 250);
}

#[test]
fn raw_settings_clamps_main_window_scale_on_load() {
    let json = r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300,
            "window_scale_percent": 300
        }"#;
    let loaded: Settings = serde_json::from_str(json).expect("parse settings");
    assert_eq!(loaded.window_scale_percent, 250);
}

#[test]
fn tray_scale_defaults_to_100_percent() {
    let settings = Settings::default();
    assert_eq!(settings.tray_scale_percent, 100);
}

#[test]
fn tray_scale_clamp_pins_to_supported_range() {
    assert_eq!(clamp_tray_scale_percent(0), 100);
    assert_eq!(clamp_tray_scale_percent(99), 100);
    assert_eq!(clamp_tray_scale_percent(100), 100);
    assert_eq!(clamp_tray_scale_percent(125), 125);
    assert_eq!(clamp_tray_scale_percent(180), 180);
    assert_eq!(clamp_tray_scale_percent(200), 200);
    assert_eq!(clamp_tray_scale_percent(201), 200);
}

#[test]
fn raw_settings_clamps_tray_scale_on_load() {
    let json = r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300,
            "tray_scale_percent": 300
        }"#;
    let loaded: Settings = serde_json::from_str(json).expect("parse settings");
    assert_eq!(loaded.tray_scale_percent, 200);
}

#[test]
fn float_bar_opacity_clamp_pins_to_supported_range() {
    // Below 30 → 30 so the bar isn't accidentally invisible.
    assert_eq!(clamp_float_bar_opacity(0), 30);
    assert_eq!(clamp_float_bar_opacity(29), 30);
    // Within range → unchanged.
    assert_eq!(clamp_float_bar_opacity(45), 45);
    assert_eq!(clamp_float_bar_opacity(80), 80);
    // Above 100 → 100.
    assert_eq!(clamp_float_bar_opacity(150), 100);
    assert_eq!(clamp_float_bar_opacity(255), 100);
}

#[test]
fn float_bar_scale_clamp_pins_to_supported_range() {
    assert_eq!(clamp_float_bar_scale(0), 75);
    assert_eq!(clamp_float_bar_scale(74), 75);
    assert_eq!(clamp_float_bar_scale(100), 100);
    assert_eq!(clamp_float_bar_scale(150), 150);
    assert_eq!(clamp_float_bar_scale(250), 200);
}

#[test]
fn float_bar_orientation_normalization_rejects_unknown_values() {
    assert_eq!(normalize_float_bar_orientation("horizontal"), "horizontal");
    assert_eq!(normalize_float_bar_orientation("vertical"), "vertical");
    // Anything else collapses to horizontal so a corrupt settings file
    // can't poison the renderer with an unknown layout token.
    assert_eq!(normalize_float_bar_orientation(""), "horizontal");
    assert_eq!(normalize_float_bar_orientation("diagonal"), "horizontal");
    assert_eq!(normalize_float_bar_orientation("VERTICAL"), "horizontal");
}

#[test]
fn float_bar_style_normalization_rejects_unknown_values() {
    assert_eq!(normalize_float_bar_style("floating"), "floating");
    assert_eq!(normalize_float_bar_style("taskbar"), "taskbar");
    assert_eq!(normalize_float_bar_style("hud"), "hud");
    assert_eq!(normalize_float_bar_style(""), "floating");
    assert_eq!(normalize_float_bar_style("TASKBAR"), "floating");
    assert_eq!(normalize_float_bar_style("glass"), "floating");
}

#[test]
fn startup_destination_normalization_is_bounded() {
    assert_eq!(normalize_startup_destination("dashboard"), "dashboard");
    assert_eq!(
        normalize_startup_destination("providerDisplay"),
        "providerDisplay"
    );
    assert_eq!(normalize_startup_destination("lastOpened"), "lastOpened");
    assert_eq!(normalize_startup_destination("nonsense"), "providerDisplay");
    assert_eq!(normalize_startup_destination(""), "providerDisplay");
}

#[test]
fn corrupt_startup_destination_on_disk_falls_back_without_discarding_other_settings() {
    let settings: Settings = serde_json::from_value(serde_json::json!({
        "top_arc_scale": 110,
        "startup_destination": "garbage",
    }))
    .unwrap();
    assert_eq!(settings.top_arc_scale, 110);
    assert_eq!(
        normalize_startup_destination(&settings.startup_destination),
        "providerDisplay"
    );
}

#[test]
fn missing_startup_destination_defaults_to_provider_display() {
    let settings: Settings = serde_json::from_value(serde_json::json!({})).unwrap();
    assert_eq!(settings.startup_destination, "providerDisplay");
    assert_eq!(settings.last_settings_tab, None);
}

#[test]
fn last_settings_tab_round_trips() {
    let settings = Settings {
        last_settings_tab: Some("providerDisplay".into()),
        ..Settings::default()
    };
    let restored: Settings =
        serde_json::from_str(&serde_json::to_string(&settings).unwrap()).unwrap();
    assert_eq!(restored.last_settings_tab, Some("providerDisplay".into()));
}

#[test]
fn quota_island_placement_normalization_is_bounded() {
    assert_eq!(normalize_top_arc_placement("top-left"), "top-left");
    assert_eq!(normalize_top_arc_placement("top-center"), "top-center");
    assert_eq!(normalize_top_arc_placement("top-right"), "top-right");
    assert_eq!(normalize_top_arc_placement("free"), "free");
    assert_eq!(normalize_top_arc_placement("bottom-center"), "top-center");
    assert_eq!(normalize_top_arc_placement(""), "top-center");
}

#[test]
fn flow_surface_form_and_anchor_normalization_remain_bounded() {
    assert_eq!(normalize_flow_surface_form("flowline"), "flowline");
    assert_eq!(normalize_flow_surface_form("horizon"), "horizon");
    assert_eq!(normalize_flow_surface_form("petal"), "petal");
    assert_eq!(normalize_flow_surface_form("orbital"), "orbital");
    assert_eq!(normalize_flow_surface_form("lens"), "lens");

    assert_eq!(normalize_flow_surface_anchor("flowline", "left"), "left");
    assert_eq!(
        normalize_flow_surface_anchor("flowline", "bottom"),
        "bottom"
    );
    assert_eq!(normalize_flow_surface_anchor("horizon", "bottom"), "bottom");
    assert_eq!(normalize_flow_surface_anchor("horizon", "left"), "left");
    assert_eq!(
        normalize_flow_surface_anchor("petal", "top-left"),
        "top-left"
    );
    assert_eq!(normalize_flow_surface_anchor("petal", "right"), "right");
    assert_eq!(normalize_flow_surface_anchor("petal", "free"), "free");
    assert_eq!(
        normalize_flow_surface_anchor("orbital", "top-right"),
        "top-right"
    );
    assert_eq!(normalize_flow_surface_anchor("orbital", "left"), "left");
    assert_eq!(
        normalize_flow_surface_anchor("lens", "bottom-left"),
        "bottom-left"
    );
    assert_eq!(normalize_flow_surface_anchor("lens", "free"), "free");
}

#[test]
fn flow_surface_auto_hide_delay_stays_in_a_responsive_range() {
    assert_eq!(clamp_flow_surface_auto_hide_delay(1), 300);
    assert_eq!(clamp_flow_surface_auto_hide_delay(900), 900);
    assert_eq!(clamp_flow_surface_auto_hide_delay(9_000), 3_000);
}

#[test]
fn archived_catalog_values_normalize_to_the_canonical_theme() {
    let s = Settings {
        catalog_theme: "03-solar-ember".to_string(),
        active_profile_catalog_theme: Some("02-aurora-bloom".to_string()),
        surface_catalog_themes: [
            ("taskbar".to_string(), "12-crimson-nova".to_string()),
            ("unknown".to_string(), "03-solar-ember".to_string()),
            ("edge".to_string(), "not-a-theme".to_string()),
        ]
        .into_iter()
        .collect(),
        edge_arc_enabled: true,
        taskbar_arc_enabled: true,
        ..Settings::default()
    };

    let json = serde_json::to_string(&s).expect("serialize");
    let back: Settings = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(back.catalog_theme, "01-obsidian-orbit");
    assert!(back.active_profile_catalog_theme.is_none());
    assert!(back.surface_catalog_themes.is_empty());
    assert!(!back.edge_arc_enabled, "edge overlay is retired on load");
    assert!(
        !back.taskbar_arc_enabled,
        "taskbar overlay is retired on load"
    );
}

#[test]
fn float_bar_settings_round_trip_through_raw() {
    // Serialize a Settings with custom float-bar values then deserialize
    // through the `from = "RawSettings"` path — values must survive intact
    // (after clamping/normalization).
    let s = Settings {
        float_bar_enabled: true,
        float_bar_opacity: 65,
        float_bar_scale: 140,
        float_bar_orientation: "vertical".to_string(),
        float_bar_style: "taskbar".to_string(),
        float_bar_click_through: true,
        float_bar_provider_ids: vec!["claude".into(), "codex".into()],
        float_bar_dark_text: true,
        float_bar_show_reset_inline: true,
        float_bar_show_cost: true,
        ..Settings::default()
    };

    let json = serde_json::to_string(&s).expect("serialize");
    let back: Settings = serde_json::from_str(&json).expect("deserialize");
    assert!(back.float_bar_enabled);
    assert_eq!(back.float_bar_opacity, 65);
    assert_eq!(back.float_bar_scale, 140);
    assert_eq!(back.float_bar_orientation, "vertical");
    assert_eq!(back.float_bar_style, "taskbar");
    assert!(back.float_bar_click_through);
    assert_eq!(back.float_bar_provider_ids, vec!["claude", "codex"]);
    assert!(back.float_bar_dark_text);
    assert!(back.float_bar_show_reset_inline);
    assert!(back.float_bar_show_cost);
}

#[test]
fn float_bar_raw_clamps_out_of_range_opacity_on_load() {
    // Simulate an externally-edited settings.json with a wild opacity.
    let json = r#"{
            "enabled_providers": [],
            "refresh_interval_secs": 300,
            "start_minimized": false,
            "start_at_login": false,
            "show_notifications": true,
            "sound_enabled": true,
            "high_usage_threshold": 70.0,
            "critical_usage_threshold": 90.0,
            "merge_tray_icons": false,
            "show_as_used": true,
            "enable_animations": true,
            "reset_time_relative": true,
            "menu_bar_display_mode": "detailed",
            "disable_keychain_access": false,
            "hide_personal_info": false,
            "float_bar_opacity": 250,
            "float_bar_scale": 250,
            "float_bar_orientation": "diagonal",
            "float_bar_style": "glass"
        }"#;
    let loaded: Settings = serde_json::from_str(json).expect("parse");
    assert_eq!(loaded.float_bar_opacity, 100);
    assert_eq!(loaded.float_bar_scale, 200);
    assert_eq!(loaded.float_bar_orientation, "horizontal");
    assert_eq!(loaded.float_bar_style, "floating");
}

#[test]
fn test_settings_provider_enabled() {
    let settings = Settings::default();
    assert!(settings.is_provider_enabled(ProviderId::Claude));
    assert!(settings.is_provider_enabled(ProviderId::Codex));
    assert!(!settings.is_provider_enabled(ProviderId::Gemini));
    assert!(!settings.is_provider_enabled(ProviderId::Wayfinder));
    assert_eq!(
        settings.gateway_url(ProviderId::Wayfinder),
        "http://127.0.0.1:8088"
    );
}

#[test]
fn wayfinder_gateway_round_trips_without_changing_settings_paths() {
    let mut settings = Settings::default();
    settings.set_gateway_url(
        ProviderId::Wayfinder,
        "https://gateway.example.test/wayfinder/",
    );

    let json = serde_json::to_string(&settings).expect("serialize settings");
    let loaded: Settings = serde_json::from_str(&json).expect("deserialize settings");
    assert_eq!(
        loaded.gateway_url(ProviderId::Wayfinder),
        "https://gateway.example.test/wayfinder/"
    );
}

#[test]
fn test_settings_toggle_provider() {
    let mut settings = Settings::default();

    // Claude starts enabled
    assert!(settings.is_provider_enabled(ProviderId::Claude));

    // Toggle off
    let enabled = settings.toggle_provider(ProviderId::Claude);
    assert!(!enabled);
    assert!(!settings.is_provider_enabled(ProviderId::Claude));

    // Toggle back on
    let enabled = settings.toggle_provider(ProviderId::Claude);
    assert!(enabled);
    assert!(settings.is_provider_enabled(ProviderId::Claude));
}

#[test]
fn test_settings_get_enabled_provider_ids() {
    let settings = Settings::default();
    let enabled = settings.get_enabled_provider_ids();
    assert!(enabled.contains(&ProviderId::Claude));
    assert!(enabled.contains(&ProviderId::Codex));
}

#[test]
fn provider_order_dedupes_unknowns_and_appends_canonical_ids() {
    let order = normalize_provider_order(&[
        "gemini".to_string(),
        "not-a-provider".to_string(),
        "claude".to_string(),
        "gemini".to_string(),
    ]);

    assert_eq!(order[0], "gemini");
    assert_eq!(order[1], "claude");
    assert!(!order.iter().any(|id| id == "not-a-provider"));
    assert_eq!(order.len(), ProviderId::all().len());
}

#[test]
fn enabled_provider_ids_follow_custom_provider_order() {
    let settings = Settings {
        enabled_providers: ["claude", "codex", "gemini"]
            .into_iter()
            .map(str::to_string)
            .collect(),
        provider_order: normalize_provider_order(&[
            "gemini".to_string(),
            "claude".to_string(),
            "codex".to_string(),
        ]),
        ..Settings::default()
    };

    assert_eq!(
        settings.get_enabled_provider_ids(),
        vec![ProviderId::Gemini, ProviderId::Claude, ProviderId::Codex]
    );
}

#[test]
fn test_settings_get_all_providers_status() {
    let settings = Settings::default();
    let status = settings.get_all_providers_status();
    assert_eq!(status.len(), ProviderId::all().len());

    let claude_status = status.iter().find(|s| s.id == "claude").unwrap();
    assert_eq!(claude_status.name, "Claude");
    assert!(claude_status.enabled);

    let gemini_status = status.iter().find(|s| s.id == "gemini").unwrap();
    assert!(!gemini_status.enabled);
}

#[test]
fn test_api_key_provider_catalog_includes_token_providers() {
    let providers = get_api_key_providers();
    for id in [
        ProviderId::Kilo,
        ProviderId::Bedrock,
        ProviderId::Codebuff,
        ProviderId::DeepSeek,
        ProviderId::DeepInfra,
        ProviderId::AiAnd,
        ProviderId::ElevenLabs,
        ProviderId::Deepgram,
        ProviderId::Grok,
        ProviderId::Groq,
        ProviderId::LLMProxy,
        ProviderId::Xai,
    ] {
        assert!(
            providers.iter().any(|provider| provider.id == id),
            "{id} should be configurable from the API Keys UI"
        );
    }
}

#[test]
fn test_t3_chat_is_cookie_configured_not_api_key_configured() {
    let providers = get_api_key_providers();
    assert!(
        !providers
            .iter()
            .any(|provider| provider.id == ProviderId::T3Chat),
        "T3 Chat fetches usage from browser cookies or pasted cURL, not API keys"
    );
}

#[test]
fn test_refresh_interval_options() {
    let options = get_refresh_interval_options();
    assert!(!options.is_empty());
    assert!(options.iter().any(|o| o.value == 60));
    assert!(options.iter().any(|o| o.value == 300));
}

#[test]
fn test_manual_cookies_default() {
    let cookies = ManualCookies::default();
    assert!(cookies.cookies.is_empty());
}

#[test]
fn test_manual_cookies_set_get_remove() {
    let mut cookies = ManualCookies::default();

    // Set a cookie
    cookies.set("claude", "session=abc123");
    assert_eq!(cookies.get("claude"), Some("session=abc123"));

    // Remove it
    cookies.remove("claude");
    assert_eq!(cookies.get("claude"), None);
}

#[test]
fn api_key_display_mask_is_utf8_safe() {
    let mut keys = ApiKeys::default();
    keys.set("openrouter", "🔑🔒漢字abcdefgh🔐", Some("unicode"));

    let display = keys.get_all_for_display();

    assert_eq!(display.len(), 1);
    assert_eq!(display[0].masked_key, "🔑🔒漢字...fgh🔐");
}

#[test]
fn test_start_at_login_command_uses_only_the_executable_path() {
    let path = std::path::PathBuf::from(r"C:\Program Files\QuotaArc\QuotaArc.exe");
    let command = Settings::start_at_login_command(&path);
    assert_eq!(command, "\"C:\\Program Files\\QuotaArc\\QuotaArc.exe\"");
    assert!(!command.contains("menubar"));
}

#[test]
fn test_start_at_login_prefers_desktop_sibling_when_called_from_cli() {
    let temp = tempfile::tempdir().expect("temp dir");
    let cli_path = temp.path().join("codexbar-cli.exe");
    let desktop_path = temp.path().join("codexbar.exe");
    std::fs::write(&cli_path, b"cli").expect("write cli");
    std::fs::write(&desktop_path, b"desktop").expect("write desktop");

    let command = Settings::start_at_login_command(&cli_path);

    assert_eq!(command, format!("\"{}\"", desktop_path.display()));
}

#[test]
fn test_start_at_login_keeps_current_exe_when_desktop_sibling_missing() {
    let temp = tempfile::tempdir().expect("temp dir");
    let cli_path = temp.path().join("codexbar-cli.exe");
    std::fs::write(&cli_path, b"cli").expect("write cli");

    let command = Settings::start_at_login_command(&cli_path);

    assert_eq!(command, format!("\"{}\"", cli_path.display()));
}

#[test]
fn test_start_at_login_repairs_stale_cli_command_after_update() {
    let temp = tempfile::tempdir().expect("temp dir");
    let cli_path = temp.path().join("codexbar-cli.exe");
    let desktop_path = temp.path().join("codexbar.exe");
    std::fs::write(&cli_path, b"cli").expect("write cli");
    std::fs::write(&desktop_path, b"desktop").expect("write desktop");
    let stale_command = format!("\"{}\"", cli_path.display());

    assert!(Settings::start_at_login_command_needs_repair(
        &stale_command,
        &desktop_path
    ));
}

#[test]
fn test_start_at_login_keeps_current_desktop_command_after_update() {
    let temp = tempfile::tempdir().expect("temp dir");
    let desktop_path = temp.path().join("codexbar.exe");
    std::fs::write(&desktop_path, b"desktop").expect("write desktop");
    let current_command = format!("\"{}\"", desktop_path.display());

    assert!(!Settings::start_at_login_command_needs_repair(
        &current_command,
        &desktop_path
    ));
}

#[test]
fn test_start_at_login_repairs_legacy_desktop_command_after_update() {
    let temp = tempfile::tempdir().expect("temp dir");
    let desktop_path = temp.path().join("codexbar.exe");
    let legacy_desktop_path = temp.path().join("codexbar-desktop.exe");
    std::fs::write(&desktop_path, b"desktop").expect("write desktop");
    std::fs::write(&legacy_desktop_path, b"legacy desktop").expect("write legacy desktop");
    let stale_command = format!("\"{}\"", legacy_desktop_path.display());

    assert!(Settings::start_at_login_command_needs_repair(
        &stale_command,
        &legacy_desktop_path
    ));
}

#[test]
fn test_language_defaults_to_english() {
    let settings = Settings::default();
    assert_eq!(settings.ui_language, Language::English);
}

#[test]
fn test_language_all_variants_available() {
    let languages = Language::all();
    assert_eq!(languages.len(), 9);
    assert!(languages.contains(&Language::English));
    assert!(languages.contains(&Language::Chinese));
    assert!(languages.contains(&Language::ChineseTraditional));
    assert!(languages.contains(&Language::Japanese));
    assert!(languages.contains(&Language::Korean));
    assert!(languages.contains(&Language::Spanish));
    assert!(languages.contains(&Language::Russian));
    assert!(languages.contains(&Language::Turkish));
    assert!(languages.contains(&Language::Arabic));
}

#[test]
fn test_language_display_names() {
    assert_eq!(Language::English.display_name(), "English");
    assert_eq!(Language::Chinese.display_name(), "中文");
    assert_eq!(Language::ChineseTraditional.display_name(), "繁體中文");
    assert_eq!(Language::Japanese.display_name(), "日本語");
    assert_eq!(Language::Russian.display_name(), "Русский");
    assert_eq!(Language::Turkish.display_name(), "Türkçe");
    assert_eq!(Language::Arabic.display_name(), "العربية");
}

#[test]
fn test_language_resolves_arabic_aliases() {
    assert_eq!(Language::resolve("arabic"), Some(Language::Arabic));
    assert_eq!(Language::resolve("ar-SA"), Some(Language::Arabic));
    assert_eq!(Language::resolve("العربية"), Some(Language::Arabic));
}

#[test]
fn test_language_resolves_russian_aliases() {
    assert_eq!(Language::resolve("russian"), Some(Language::Russian));
    assert_eq!(Language::resolve("ru-RU"), Some(Language::Russian));
    assert_eq!(Language::resolve("Русский"), Some(Language::Russian));
}

#[test]
fn test_language_resolves_turkish_aliases() {
    assert_eq!(Language::resolve("turkish"), Some(Language::Turkish));
    assert_eq!(Language::resolve("tr-TR"), Some(Language::Turkish));
    assert_eq!(Language::resolve("Türkçe"), Some(Language::Turkish));
    assert_eq!(Language::resolve("turkce"), Some(Language::Turkish));
}

#[test]
fn test_settings_load_missing_language_field_defaults_to_english() {
    // Simulate loading legacy settings JSON without ui_language field
    let legacy_json = r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300,
            "start_minimized": false,
            "ui_language": "english"
        }"#;

    let settings: Result<Settings, _> = serde_json::from_str(legacy_json);
    assert!(settings.is_ok());
    let settings = settings.unwrap();
    assert_eq!(settings.ui_language, Language::English);
}

#[test]
fn test_settings_roundtrip_with_language() {
    use std::io::Write;
    use tempfile::NamedTempFile;

    // Create settings with Chinese language
    let settings = Settings {
        ui_language: Language::Chinese,
        ..Settings::default()
    };

    // Save to a temp file
    let mut temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let json = serde_json::to_string_pretty(&settings).expect("Failed to serialize settings");
    temp_file
        .write_all(json.as_bytes())
        .expect("Failed to write settings");
    let path = temp_file.path().to_path_buf();

    // Read back and verify
    let content = std::fs::read_to_string(&path).expect("Failed to read settings");
    let loaded: Settings = serde_json::from_str(&content).expect("Failed to deserialize settings");

    assert_eq!(loaded.ui_language, Language::Chinese);
}

#[test]
fn test_settings_load_missing_dashboard_fields_defaults_to_analytics2d_balanced() {
    // A settings.json saved before Dashboard Studio existed has neither
    // field at all -- must migrate to the safest default (2D, lowest
    // rendering overhead) rather than surprise a user into 3D.
    let legacy_json = r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300,
            "start_minimized": false
        }"#;
    let settings: Settings = serde_json::from_str(legacy_json)
        .expect("legacy settings without dashboard fields must still load");
    assert_eq!(settings.dashboard_mode, DashboardModeId::Analytics2d);
    assert_eq!(
        settings.dashboard_performance_preset,
        DashboardPerformancePreset::Balanced
    );
    assert!(settings.enabled_providers.contains("claude"));
}

#[test]
fn test_settings_dashboard_fields_roundtrip() {
    use std::io::Write;
    use tempfile::NamedTempFile;

    let settings = Settings {
        dashboard_mode: DashboardModeId::Analytics2d,
        dashboard_performance_preset: DashboardPerformancePreset::HighFidelity,
        ..Settings::default()
    };
    let mut temp_file = NamedTempFile::new().expect("failed to create temp file");
    let json = serde_json::to_string_pretty(&settings).expect("failed to serialize settings");
    temp_file
        .write_all(json.as_bytes())
        .expect("failed to write settings");
    let content = std::fs::read_to_string(temp_file.path()).expect("failed to read settings");
    let loaded: Settings = serde_json::from_str(&content).expect("failed to deserialize settings");

    assert_eq!(loaded.dashboard_mode, DashboardModeId::Analytics2d);
    assert_eq!(
        loaded.dashboard_performance_preset,
        DashboardPerformancePreset::HighFidelity
    );
}

#[test]
fn test_settings_corrupt_dashboard_mode_value_falls_back_without_crashing() {
    // A hand-edited or corrupted value (wrong type, or an unrecognized
    // string) must not take down the rest of the settings file.
    let corrupt_json = r#"{
            "enabled_providers": ["claude"],
            "refresh_interval_secs": 300,
            "start_minimized": false,
            "dashboard_mode": "quantum3d",
            "dashboard_performance_preset": 42
        }"#;
    let settings: Settings = serde_json::from_str(corrupt_json)
        .expect("corrupt dashboard fields must still deserialize");
    assert_eq!(settings.dashboard_mode, DashboardModeId::Analytics2d);
    assert_eq!(
        settings.dashboard_performance_preset,
        DashboardPerformancePreset::Balanced
    );
    assert!(settings.enabled_providers.contains("claude"));
}

#[test]
fn test_settings_load_missing_reset_presentation_field_defaults_to_countdown_only() {
    // Simulate loading a settings.json saved before the Reset Presentation
    // system existed -- must not wipe or corrupt the rest of the file, and
    // must migrate to a config equivalent to the product's pre-existing
    // countdown behavior (never a surprise switch to absolute-date mode).
    let legacy_json = r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300,
            "start_minimized": false
        }"#;

    let settings: Settings = serde_json::from_str(legacy_json)
        .expect("legacy settings without reset_presentation must still load");
    assert_eq!(
        settings.reset_presentation,
        ResetPresentationSettings::default()
    );
    assert_eq!(settings.reset_presentation.preset, "countdownOnly");
    assert_eq!(
        settings.reset_presentation.modules,
        vec!["countdown".to_string()]
    );
    assert_eq!(settings.reset_presentation.timezone_mode, "system");
    // The rest of the file is unaffected.
    assert!(settings.enabled_providers.contains("claude"));
    assert_eq!(settings.refresh_interval_secs, 300);
}

#[test]
fn test_settings_reset_presentation_roundtrips() {
    use std::io::Write;
    use tempfile::NamedTempFile;

    let settings = Settings {
        reset_presentation: ResetPresentationSettings {
            preset: "full".to_string(),
            modules: vec![
                "weekday".to_string(),
                "date".to_string(),
                "time".to_string(),
                "countdown".to_string(),
            ],
            order: vec![
                "weekday".to_string(),
                "date".to_string(),
                "time".to_string(),
                "countdown".to_string(),
                "timezone".to_string(),
            ],
            timezone_mode: "custom".to_string(),
            timezone_id: Some("Asia/Riyadh".to_string()),
            clock_format: "h24".to_string(),
            ..ResetPresentationSettings::default()
        },
        ..Settings::default()
    };

    let mut temp_file = NamedTempFile::new().expect("failed to create temp file");
    let json = serde_json::to_string_pretty(&settings).expect("failed to serialize settings");
    temp_file
        .write_all(json.as_bytes())
        .expect("failed to write settings");
    let content = std::fs::read_to_string(temp_file.path()).expect("failed to read settings");
    let loaded: Settings = serde_json::from_str(&content).expect("failed to deserialize settings");

    assert_eq!(loaded.reset_presentation.preset, "full");
    assert_eq!(loaded.reset_presentation.timezone_mode, "custom");
    assert_eq!(
        loaded.reset_presentation.timezone_id.as_deref(),
        Some("Asia/Riyadh")
    );
    assert_eq!(loaded.reset_presentation.clock_format, "h24");
    assert!(loaded.reset_presentation.is_valid());
}

#[test]
fn test_settings_corrupt_reset_presentation_json_never_crashes_and_repairs_on_load() {
    // A hand-edited or partially-corrupted settings.json must still load --
    // the corrupt sub-object is repaired by `.normalized()` (which
    // `Settings::load()` applies), never a panic or a rejected file.
    let corrupt_json = r#"{
            "enabled_providers": ["claude"],
            "refresh_interval_secs": 300,
            "start_minimized": false,
            "reset_presentation": {
                "preset": "not-a-real-preset",
                "modules": ["countdown", "countdown", "made-up-module"],
                "order": [],
                "timezoneMode": "custom",
                "timezoneId": "definitely not iana",
                "clockFormat": "26-hour"
            }
        }"#;

    let settings: Settings = serde_json::from_str(corrupt_json)
        .expect("corrupt reset_presentation must still deserialize");
    let repaired = settings.reset_presentation.normalized();
    assert!(repaired.is_valid());
    assert_eq!(repaired.timezone_id, None);
}

#[test]
fn test_settings_with_utf8_bom_parses_perprovider_tray_mode() {
    let json = "\u{feff}{\n            \"enabled_providers\": [\"claude\", \"codex\"],\n            \"refresh_interval_secs\": 300,\n            \"tray_icon_mode\": \"perprovider\"\n        }";

    let settings: Settings = serde_json::from_str(json.trim_start_matches('\u{feff}')).unwrap();

    assert_eq!(settings.tray_icon_mode, TrayIconMode::PerProvider);
}

#[test]
fn test_language_serde_serialization() {
    // Test that Language serializes to lowercase string
    let english = Language::English;
    let chinese = Language::Chinese;
    let chinese_traditional = Language::ChineseTraditional;

    let english_json = serde_json::to_string(&english).unwrap();
    let chinese_json = serde_json::to_string(&chinese).unwrap();
    let chinese_traditional_json = serde_json::to_string(&chinese_traditional).unwrap();

    assert_eq!(english_json, "\"english\"");
    assert_eq!(chinese_json, "\"chinese\"");
    assert_eq!(chinese_traditional_json, "\"chinesetraditional\"");
}

#[test]
fn test_language_serde_deserialization() {
    // Test that lowercase strings deserialize correctly
    let english: Language = serde_json::from_str("\"english\"").unwrap();
    let chinese: Language = serde_json::from_str("\"chinese\"").unwrap();
    let chinese_traditional: Language = serde_json::from_str("\"chinesetraditional\"").unwrap();

    assert_eq!(english, Language::English);
    assert_eq!(chinese, Language::Chinese);
    assert_eq!(chinese_traditional, Language::ChineseTraditional);
}

#[test]
fn test_language_resolves_traditional_chinese_aliases() {
    assert_eq!(
        Language::resolve("chinesetraditional"),
        Some(Language::ChineseTraditional)
    );
    assert_eq!(
        Language::resolve("zh-tw"),
        Some(Language::ChineseTraditional)
    );
    assert_eq!(
        Language::resolve("zh-hant-tw"),
        Some(Language::ChineseTraditional)
    );
    assert_eq!(
        Language::resolve("繁體中文"),
        Some(Language::ChineseTraditional)
    );
}

#[test]
fn test_theme_defaults_to_auto() {
    let settings = Settings::default();
    assert_eq!(settings.theme, ThemePreference::Auto);
}

#[test]
fn test_theme_all_variants_available() {
    let themes = ThemePreference::all();
    assert_eq!(themes.len(), 3);
    assert!(themes.contains(&ThemePreference::Auto));
    assert!(themes.contains(&ThemePreference::Light));
    assert!(themes.contains(&ThemePreference::Dark));
}

#[test]
fn test_theme_serde_roundtrip() {
    for variant in [
        ThemePreference::Auto,
        ThemePreference::Light,
        ThemePreference::Dark,
    ] {
        let encoded = serde_json::to_string(&variant).unwrap();
        let decoded: ThemePreference = serde_json::from_str(&encoded).unwrap();
        assert_eq!(decoded, variant);
    }
    assert_eq!(
        serde_json::to_string(&ThemePreference::Light).unwrap(),
        "\"light\""
    );
    assert_eq!(
        serde_json::to_string(&ThemePreference::Dark).unwrap(),
        "\"dark\""
    );
    assert_eq!(
        serde_json::to_string(&ThemePreference::Auto).unwrap(),
        "\"auto\""
    );
}

#[test]
fn test_settings_missing_theme_defaults_to_auto() {
    // Legacy settings JSON without the theme field should still parse.
    let legacy_json = r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300,
            "ui_language": "english"
        }"#;

    let settings: Settings = serde_json::from_str(legacy_json).unwrap();
    assert_eq!(settings.theme, ThemePreference::Auto);
}

#[test]
fn test_settings_roundtrip_with_theme() {
    let settings = Settings {
        theme: ThemePreference::Dark,
        ..Settings::default()
    };
    let json = serde_json::to_string(&settings).unwrap();
    let loaded: Settings = serde_json::from_str(&json).unwrap();
    assert_eq!(loaded.theme, ThemePreference::Dark);
}

// ── Phase 3: provider_configs migration tests ───────────────────────

/// Loading a legacy `settings.json` (with flat per-provider fields)
/// must populate `provider_configs` and surface every value through the
/// per-provider accessors.
#[test]
fn test_legacy_per_provider_fields_migrate_into_provider_configs() {
    // NOTE: placeholder values only — no real cookies/tokens.
    let legacy_json = r#"{
            "enabled_providers": ["claude", "codex"],
            "refresh_interval_secs": 300,
            "codex_cookie_source": "manual",
            "claude_cookie_source": "browser",
            "cursor_cookie_source": "manual",
            "alibaba_cookie_source": "manual",
            "alibaba_cookie_header": "ali=PLACEHOLDER",
            "alibaba_api_region": "cn",
            "zai_api_region": "cn",
            "minimax_api_region": "cn",
            "minimax_api_token": "TOK_PLACEHOLDER",
            "claude_usage_source": "ccusage",
            "codex_usage_source": "manual",
            "codex_openai_web_extras": false,
            "codex_historical_tracking": true,
            "claude_avoid_keychain_prompts": true,
            "opencode_workspace_id": "ws_placeholder",
            "jetbrains_ide_base_path": "C:/JB"
        }"#;

    let settings: Settings = serde_json::from_str(legacy_json).unwrap();

    // Cookie sources
    assert_eq!(settings.cookie_source(ProviderId::Codex), "manual");
    assert_eq!(settings.cookie_source(ProviderId::Claude), "browser");
    assert_eq!(settings.cookie_source(ProviderId::Cursor), "manual");
    assert_eq!(settings.cookie_source(ProviderId::Alibaba), "manual");
    // Untouched providers fall through to the default "manual" to avoid
    // background browser-cookie reads unless the user opts into Automatic.
    assert_eq!(settings.cookie_source(ProviderId::Amp), "manual");

    // Manual cookie headers + api regions
    assert_eq!(
        settings.manual_cookie_header(ProviderId::Alibaba),
        "ali=PLACEHOLDER"
    );
    assert_eq!(settings.api_region(ProviderId::Alibaba), "cn");
    assert_eq!(settings.api_region(ProviderId::Zai), "cn");
    assert_eq!(settings.api_region(ProviderId::MiniMax), "cn");

    // Usage sources
    assert_eq!(settings.usage_source(ProviderId::Claude), "ccusage");
    assert_eq!(settings.usage_source(ProviderId::Codex), "manual");

    // Codex booleans
    assert!(!settings.openai_web_extras(ProviderId::Codex));
    assert!(settings.historical_tracking(ProviderId::Codex));

    // Claude per-provider boolean
    assert!(settings.avoid_keychain_prompts(ProviderId::Claude));

    // Misc per-provider strings
    assert_eq!(
        settings.workspace_id(ProviderId::OpenCode),
        "ws_placeholder"
    );
    assert_eq!(settings.api_token(ProviderId::MiniMax), "TOK_PLACEHOLDER");
    assert_eq!(settings.ide_base_path(ProviderId::JetBrains), "C:/JB");

    // Legacy field-name aliases agree with typed accessors.
    assert_eq!(settings.codex_cookie_source(), "manual");
    assert_eq!(settings.alibaba_api_region(), "cn");
    assert!(settings.codex_historical_tracking());
    assert!(!settings.codex_openai_web_extras());
    assert!(settings.claude_avoid_keychain_prompts());
}

/// Round-trip: build a `Settings` programmatically via the new map +
/// accessors, serialize, parse back, and assert equality of every
/// per-provider field.
#[test]
fn test_provider_configs_roundtrip() {
    let mut settings = Settings::default();
    settings.set_cookie_source(ProviderId::Codex, "manual");
    settings.set_cookie_source(ProviderId::Claude, "browser");
    settings.set_usage_source(ProviderId::Claude, "ccusage");
    settings.set_api_region(ProviderId::Alibaba, "cn");
    settings.set_api_region(ProviderId::Zai, "cn");
    settings.set_manual_cookie_header(ProviderId::Amp, "amp=PLACEHOLDER");
    settings.set_api_token(ProviderId::MiniMax, "TOK_PLACEHOLDER");
    settings.set_workspace_id(ProviderId::OpenCode, "ws_placeholder");
    settings.set_ide_base_path(ProviderId::JetBrains, "C:/JB");
    settings.set_openai_web_extras(ProviderId::Codex, false);
    settings.set_historical_tracking(ProviderId::Codex, true);
    settings.set_avoid_keychain_prompts(ProviderId::Claude, true);

    let json = serde_json::to_string(&settings).unwrap();
    // The legacy flat fields must NOT appear in serialized output.
    assert!(!json.contains("\"codex_cookie_source\""), "json: {json}");
    assert!(!json.contains("\"alibaba_api_region\""), "json: {json}");
    assert!(
        !json.contains("\"claude_avoid_keychain_prompts\""),
        "json: {json}"
    );
    assert!(json.contains("\"provider_configs\""), "json: {json}");

    let loaded: Settings = serde_json::from_str(&json).unwrap();
    assert_eq!(loaded.cookie_source(ProviderId::Codex), "manual");
    assert_eq!(loaded.cookie_source(ProviderId::Claude), "browser");
    assert_eq!(loaded.usage_source(ProviderId::Claude), "ccusage");
    assert_eq!(loaded.api_region(ProviderId::Alibaba), "cn");
    assert_eq!(loaded.api_region(ProviderId::Zai), "cn");
    assert_eq!(
        loaded.manual_cookie_header(ProviderId::Amp),
        "amp=PLACEHOLDER"
    );
    assert_eq!(loaded.api_token(ProviderId::MiniMax), "TOK_PLACEHOLDER");
    assert_eq!(loaded.workspace_id(ProviderId::OpenCode), "ws_placeholder");
    assert_eq!(loaded.ide_base_path(ProviderId::JetBrains), "C:/JB");
    assert!(!loaded.openai_web_extras(ProviderId::Codex));
    assert!(loaded.historical_tracking(ProviderId::Codex));
    assert!(loaded.avoid_keychain_prompts(ProviderId::Claude));
    assert_eq!(
        loaded.provider_configs.get(&ProviderId::Codex),
        settings.provider_configs.get(&ProviderId::Codex)
    );
}

/// New-format files (no legacy flat fields, only `provider_configs`)
/// must load identically.
#[test]
fn test_new_format_provider_configs_only() {
    let json = r#"{
            "enabled_providers": ["claude"],
            "refresh_interval_secs": 300,
            "provider_configs": {
                "codex": { "cookie_source": "manual", "openai_web_extras": false },
                "alibaba": { "api_region": "cn", "manual_cookie_header": "ali=PLACEHOLDER" }
            }
        }"#;

    let settings: Settings = serde_json::from_str(json).unwrap();
    assert_eq!(settings.cookie_source(ProviderId::Codex), "manual");
    assert!(!settings.openai_web_extras(ProviderId::Codex));
    assert_eq!(settings.api_region(ProviderId::Alibaba), "cn");
    assert_eq!(
        settings.manual_cookie_header(ProviderId::Alibaba),
        "ali=PLACEHOLDER"
    );
    // Untouched providers still get their defaults.
    assert_eq!(settings.cookie_source(ProviderId::Claude), "manual");
    assert_eq!(settings.api_region(ProviderId::Zai), "global");
}

/// Default `Settings` should serialize WITHOUT a `provider_configs`
/// field (empty map skipped).
#[test]
fn test_default_settings_skip_empty_provider_configs() {
    let settings = Settings::default();
    let json = serde_json::to_string(&settings).unwrap();
    assert!(
        !json.contains("\"provider_configs\""),
        "empty map should be skipped, json: {json}"
    );
}

/// Per-provider defaults are applied even when the entry is absent.
#[test]
fn test_per_provider_defaults_applied() {
    let settings = Settings::default();
    assert_eq!(settings.cookie_source(ProviderId::Codex), "manual");
    assert_eq!(settings.usage_source(ProviderId::Codex), "auto");
    assert_eq!(settings.api_region(ProviderId::Alibaba), "singapore");
    assert_eq!(settings.api_region(ProviderId::Zai), "global");
    assert_eq!(settings.api_region(ProviderId::MiniMax), "global");
    assert!(settings.openai_web_extras(ProviderId::Codex));
    assert!(!settings.historical_tracking(ProviderId::Codex));
    assert!(!settings.avoid_keychain_prompts(ProviderId::Claude));
}

#[test]
fn codex_spark_usage_visibility_defaults_to_visible_and_roundtrips() {
    let mut settings = Settings::default();
    assert!(settings.codex_spark_usage_visible());

    settings.set_codex_spark_usage_visible(false);
    let serialized = serde_json::to_string(&settings).unwrap();
    let loaded: Settings = serde_json::from_str(&serialized).unwrap();

    assert!(!loaded.codex_spark_usage_visible());
}

#[test]
fn catalog_theme_validation_falls_back_to_default() {
    for slug in [
        "smoked-silver",
        "tidal-glass",
        "ember-alloy",
        "aurora-bloom-material",
        "solar-ember-material",
        "ceramic-pearl-material",
        "sapphire-observatory",
        "eclipse-ember",
        "02-graphite-precision",
        "03-midnight-glass",
        "05-stealth-mono",
        "06-aurora-prism",
        "07-solar-pearl",
        "08-oceanic-glass",
        "09-rose-quartz",
        "10-verdant-halo",
        "11-copper-ember",
        "12-arctic-spectrum",
        "13-lavender-mist",
        "14-sapphire-circuit",
        "15-crimson-atelier",
        "17-jade-pavilion",
        "33-ink-and-gold",
    ] {
        assert_eq!(super::normalize_catalog_theme(slug), slug);
    }
    assert_eq!(
        crate::settings::normalize_catalog_theme("01-obsidian-orbit"),
        "01-obsidian-orbit"
    );
    assert_eq!(
        crate::settings::normalize_catalog_theme("15-astral-dune"),
        "01-obsidian-orbit"
    );
    // Invalid slugs (corrupt file, removed theme) fall back to default.
    assert_eq!(
        crate::settings::normalize_catalog_theme("99-nonexistent"),
        "01-obsidian-orbit"
    );
    assert_eq!(
        crate::settings::normalize_catalog_theme(""),
        "01-obsidian-orbit"
    );
}

#[test]
fn taskbar_arc_scale_defaults_when_absent_and_migrates_old_settings() {
    let absent: Settings = serde_json::from_str(r#"{ "enabled_providers": [] }"#)
        .expect("settings without taskbar_arc_scale load safely");
    assert_eq!(absent.taskbar_arc_scale, 100, "migration default is 100%");
    // Independence: a file carrying only a top_arc_scale must not move the
    // taskbar scale.
    let top_only: Settings =
        serde_json::from_str(r#"{ "enabled_providers": [], "top_arc_scale": 180 }"#)
            .expect("top-only scale loads");
    assert_eq!(top_only.top_arc_scale, 180);
    assert_eq!(top_only.taskbar_arc_scale, 100);
}

#[test]
fn taskbar_arc_scale_clamps_and_round_trips_independently() {
    let clamped: Settings = serde_json::from_str(
        r#"{ "enabled_providers": [], "taskbar_arc_scale": 250, "top_arc_scale": 10 }"#,
    )
    .expect("corrupt scales clamp");
    assert_eq!(clamped.taskbar_arc_scale, 200);
    assert_eq!(clamped.top_arc_scale, 75);

    let settings = Settings {
        taskbar_arc_scale: 135,
        top_arc_scale: 90,
        ..Settings::default()
    };
    let json = serde_json::to_string(&settings).expect("serialize");
    let loaded: Settings = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(loaded.taskbar_arc_scale, 135);
    assert_eq!(loaded.top_arc_scale, 90);
}

#[test]
fn notification_event_preferences_default_on_and_round_trip_independently() {
    let defaults: Settings = serde_json::from_str(r#"{ "enabled_providers": [] }"#)
        .expect("legacy settings load notification defaults");
    assert!(defaults.notification_events.high_usage);
    assert!(defaults.notification_events.session_restored);
    assert!(defaults.notification_events.expected_reset);
    assert!(defaults.notification_events.unexpected_reset);
    assert!(defaults.notification_events.banked_reset_credit);

    let mut settings = Settings::default();
    settings.notification_events.status_issue = false;
    settings.notification_events.session_depleted = false;
    settings.notification_events.expected_reset = false;
    settings.notification_events.banked_reset_credit = false;
    let json = serde_json::to_string(&settings).expect("serialize notification preferences");
    let loaded: Settings =
        serde_json::from_str(&json).expect("deserialize notification preferences");
    assert!(!loaded.notification_events.status_issue);
    assert!(!loaded.notification_events.session_depleted);
    assert!(!loaded.notification_events.expected_reset);
    assert!(loaded.notification_events.unexpected_reset);
    assert!(!loaded.notification_events.banked_reset_credit);
    assert!(loaded.notification_events.critical_usage);
}

#[test]
fn notification_quiet_hours_cover_same_day_overnight_and_full_day_ranges() {
    let mut quiet = NotificationQuietHours {
        enabled: true,
        start_minute: 22 * 60,
        end_minute: 7 * 60,
    };
    assert!(quiet.contains_local_minute(23 * 60));
    assert!(quiet.contains_local_minute(6 * 60 + 59));
    assert!(!quiet.contains_local_minute(12 * 60));

    quiet.start_minute = 9 * 60;
    quiet.end_minute = 17 * 60;
    assert!(quiet.contains_local_minute(9 * 60));
    assert!(!quiet.contains_local_minute(17 * 60));

    quiet.start_minute = 0;
    quiet.end_minute = 0;
    assert!(quiet.contains_local_minute(12 * 60));
    quiet.enabled = false;
    assert!(!quiet.contains_local_minute(0));
}

#[test]
fn usage_step_notification_interval_defaults_off_and_clamps_on_load() {
    let defaults = Settings::default();
    assert_eq!(defaults.usage_step_notification_percent, None);

    let low: Settings = serde_json::from_str(r#"{"usage_step_notification_percent":0}"#)
        .expect("parse disabled step interval");
    assert_eq!(low.usage_step_notification_percent, None);

    let high: Settings = serde_json::from_str(r#"{"usage_step_notification_percent":140}"#)
        .expect("parse oversized step interval");
    assert_eq!(high.usage_step_notification_percent, Some(100));
}

/// Quotalis rebrand settings/profile compatibility proof (owner spec
/// section 6): a settings.json fixture shaped like a real legacy QuotaArc
/// file -- provider config, theme selection, provider presentation (Follow
/// Structure/Independent), Reset Display configuration, Dashboard mode,
/// Dashboard performance preset, and surface (Top Arc) configuration --
/// must deserialize into the current `Settings` struct with every field
/// intact. The on-disk settings schema was not touched by the Quotalis
/// rebrand (only branding text and the crate/event names were), so this is
/// the same deserialization path any real install already exercises; this
/// test proves it executably rather than asserting it by construction.
#[test]
fn legacy_quotaarc_settings_fixture_survives_intact() {
    let legacy_json = r#"{
        "enabled_providers": ["claude", "codex", "gemini"],
        "refresh_interval_secs": 180,
        "catalog_theme": "smoked-silver",
        "reset_time_relative": false,
        "show_reset_when_exhausted": true,
        "dashboard_mode": "providers3d",
        "dashboard_performance_preset": "highFidelity",
        "global_limit_presentation": {
            "shape": "vertical",
            "content": "value",
            "direction": "reverse",
            "identity": "precision"
        },
        "top_arc_enabled": true,
        "top_arc_placement": "top-left",
        "top_arc_opacity": 80,
        "hide_personal_info": true
    }"#;

    let settings: Settings =
        serde_json::from_str(legacy_json).expect("legacy settings fixture must still load");

    // Provider config
    assert!(settings.enabled_providers.contains("claude"));
    assert!(settings.enabled_providers.contains("codex"));
    assert!(settings.enabled_providers.contains("gemini"));
    assert_eq!(settings.refresh_interval_secs, 180);

    // Theme selection
    assert_eq!(settings.catalog_theme, "smoked-silver");

    // Reset Display configuration
    assert!(!settings.reset_time_relative);
    assert!(settings.show_reset_when_exhausted);

    // Dashboard mode + performance preset (Dashboard Studio, Phase 2)
    assert_eq!(settings.dashboard_mode, DashboardModeId::Analytics2d);
    assert_eq!(
        settings.dashboard_performance_preset,
        DashboardPerformancePreset::HighFidelity
    );

    // Provider presentation (Follow Structure ["adaptive"] vs an independent
    // per-provider identity token, e.g. "precision")
    assert_eq!(settings.global_limit_presentation.identity, "precision");
    assert_eq!(settings.global_limit_presentation.shape, "vertical");

    // Surface configuration (Top Arc)
    assert!(settings.top_arc_enabled);
    assert_eq!(settings.top_arc_placement, "top-left");
    assert_eq!(settings.top_arc_opacity, 80);

    // A field with no special migration logic, to prove the fixture is not
    // silently discarding unrelated data either.
    assert!(settings.hide_personal_info);

    // Collections layout was not present in the fixture -- must default
    // safely, not fail the whole parse (matches the existing lenient
    // RawSettings migration pattern used throughout this struct).
    assert_eq!(
        settings.collection_layout,
        crate::settings::collections::CollectionLayout::default()
    );
}

/// Companion to the above: a legacy profiles.json fixture (the separate
/// on-disk store `ProfileStore` owns) must also deserialize intact.
#[test]
fn legacy_quotaarc_profiles_fixture_survives_intact() {
    let legacy_profiles_json = r#"{
        "schemaVersion": 1,
        "activeProfileId": "prof-work",
        "profiles": [
            { "id": "prof-work", "name": "Work" }
        ],
        "accounts": []
    }"#;

    let store: crate::profiles::ProfileStore = serde_json::from_str(legacy_profiles_json)
        .expect("legacy profiles fixture must still load");
    assert_eq!(store.active_profile_id, "prof-work");
    assert_eq!(store.profiles.len(), 1);
    assert_eq!(store.profiles[0].name, "Work");
}

/// Phase 5.2 Demo Mode settings: default off, real defaults on first
/// enable, and a corrupt/out-of-range on-disk value clamps instead of
/// producing a degenerate (zero-provider) or panicking state.
#[test]
fn demo_mode_defaults_off_with_sane_defaults() {
    let defaulted: Settings = serde_json::from_str(r#"{ "enabled_providers": [] }"#)
        .expect("missing demo fields default sanely");
    assert!(!defaulted.demo_mode_enabled);
    assert_eq!(defaulted.demo_provider_mode, DemoProviderMode::Curated);
    assert_eq!(defaulted.demo_provider_count, DEFAULT_DEMO_PROVIDER_COUNT);
    assert!(defaulted.demo_provider_ids.is_empty());
    assert_eq!(defaulted.demo_scenario, DemoScenario::ConnectedShowcase);
    assert_eq!(defaulted.demo_history_days, 7);
}

#[test]
fn demo_mode_settings_round_trip() {
    let enabled = Settings {
        demo_mode_enabled: true,
        demo_provider_mode: DemoProviderMode::Custom,
        demo_provider_count: 12,
        demo_provider_ids: vec!["codex".to_string(), "claude".to_string()],
        demo_scenario: DemoScenario::HighUsage,
        demo_seed: 42,
        demo_history_days: 30,
        ..Settings::default()
    };
    let json = serde_json::to_string(&enabled).expect("serialize demo settings");
    assert!(json.contains(r#""demo_mode_enabled":true"#));

    let loaded: Settings = serde_json::from_str(&json).expect("deserialize demo settings");
    assert!(loaded.demo_mode_enabled);
    assert_eq!(loaded.demo_provider_mode, DemoProviderMode::Custom);
    assert_eq!(loaded.demo_provider_count, 12);
    assert_eq!(loaded.demo_provider_ids, vec!["codex", "claude"]);
    assert_eq!(loaded.demo_scenario, DemoScenario::HighUsage);
    assert_eq!(loaded.demo_seed, 42);
    assert_eq!(loaded.demo_history_days, 30);
}

#[test]
fn demo_provider_count_clamps_a_corrupt_on_disk_value_instead_of_zero_providers() {
    let too_high: Settings =
        serde_json::from_str(r#"{ "enabled_providers": [], "demo_provider_count": 999 }"#)
            .expect("oversized demo_provider_count must clamp, not fail");
    assert_eq!(too_high.demo_provider_count, MAX_DEMO_PROVIDER_COUNT);

    let zero: Settings =
        serde_json::from_str(r#"{ "enabled_providers": [], "demo_provider_count": 0 }"#)
            .expect("zero demo_provider_count must fall back to the real default");
    assert_eq!(zero.demo_provider_count, DEFAULT_DEMO_PROVIDER_COUNT);
}

#[test]
fn demo_history_days_only_ever_persists_7_or_30() {
    let odd: Settings =
        serde_json::from_str(r#"{ "enabled_providers": [], "demo_history_days": 15 }"#)
            .expect("an odd demo_history_days must normalize, not fail");
    assert_eq!(odd.demo_history_days, 7);
}

#[test]
fn workspace_preferences_roundtrip_and_invalid_field_isolation() {
    let settings: Settings = serde_json::from_str(r#"{"workspace_preferences":{"density":"compact","navigation":"bottom"},"refresh_interval_secs":123}"#).unwrap();
    assert_eq!(
        settings.workspace_preferences.as_ref().unwrap().density,
        "compact"
    );
    assert_eq!(
        settings.workspace_preferences.as_ref().unwrap().navigation,
        "bottom"
    );
    let encoded = serde_json::to_string(&settings).unwrap();
    let restored: Settings = serde_json::from_str(&encoded).unwrap();
    assert_eq!(
        restored.workspace_preferences,
        settings.workspace_preferences
    );
    let invalid: Settings = serde_json::from_str(r#"{"workspace_preferences":{"density":false,"navigation":"invalid"},"refresh_interval_secs":123}"#).unwrap();
    assert_eq!(
        invalid.workspace_preferences.unwrap(),
        WorkspacePreferences::default()
    );
    assert_eq!(invalid.refresh_interval_secs, 123);
}

#[test]
fn workspace_sidebar_migration_bounds_and_roundtrip() {
    for (fields, width, collapsed) in [
        (r#"{}"#, 232, false),
        (r#"{"sidebarWidth":312,"sidebarCollapsed":true}"#, 312, true),
        (r#"{"sidebarWidth":0}"#, 184, false),
        (r#"{"sidebarWidth":999999}"#, 360, false),
        (
            r#"{"sidebarWidth":"bad","sidebarCollapsed":"true"}"#,
            232,
            false,
        ),
    ] {
        let json = format!(r#"{{"workspace_preferences":{fields},"refresh_interval_secs":123}}"#);
        let settings: Settings = serde_json::from_str(&json).unwrap();
        let prefs = settings.workspace_preferences.as_ref().unwrap();
        assert_eq!(prefs.sidebar_width, width);
        assert_eq!(prefs.sidebar_collapsed, collapsed);
        assert_eq!(settings.refresh_interval_secs, 123);
        let restored: Settings =
            serde_json::from_str(&serde_json::to_string(&settings).unwrap()).unwrap();
        assert_eq!(
            restored.workspace_preferences,
            settings.workspace_preferences
        );
    }
}

#[test]
fn workspace_background_fields_are_isolated_and_preserve_layout() {
    for (background, motion, intensity, expected) in [
        (
            "aurora",
            "interactive",
            "subtle",
            ("aurora", "interactive", "subtle"),
        ),
        (
            "starfield",
            "static",
            "vivid",
            ("starfield", "static", "vivid"),
        ),
        ("none", "static", "balanced", ("none", "static", "balanced")),
        ("bad", "bad", "bad", ("cosmic", "static", "balanced")),
    ] {
        let json = serde_json::json!({"workspace_preferences": {
            "density":"compact", "navigation":"bottom", "sidebarWidth":288, "sidebarCollapsed":true,
            "background":background,"backgroundMotion":motion,"backgroundIntensity":intensity
        }});
        let settings: Settings = serde_json::from_value(json).unwrap();
        let p = settings.workspace_preferences.as_ref().unwrap();
        assert_eq!(
            (
                p.background.as_str(),
                p.background_motion.as_str(),
                p.background_intensity.as_str()
            ),
            expected
        );
        assert_eq!(p.sidebar_width, 288);
        assert!(p.sidebar_collapsed);
        assert_eq!(p.density, "compact");
        assert_eq!(p.navigation, "bottom");
        let restored: Settings =
            serde_json::from_str(&serde_json::to_string(&settings).unwrap()).unwrap();
        assert_eq!(
            restored.workspace_preferences,
            settings.workspace_preferences
        );
    }
}
