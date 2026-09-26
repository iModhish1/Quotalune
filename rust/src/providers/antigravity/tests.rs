use super::*;

/// Run a PowerShell snippet for an environment-capability assertion.
#[cfg(windows)]
fn run_env_powershell(script: &str) -> cli_dependencies::CliReadOutput {
    let powershell = system_powershell().expect("system PowerShell");
    let output = cli_dependencies::read_provider_cli_sync_with_timeout(
        &powershell,
        &[
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script,
        ],
        cli_dependencies::ENV_PROBE_TIMEOUT,
    )
    .expect("environment PowerShell probe");
    assert_eq!(output.exit_code, Some(0));
    output
}

#[cfg(windows)]
fn project_fake_processes(fake_source: &str) -> String {
    let script = PROCESS_DISCOVERY_SCRIPT.replacen("Get-CimInstance Win32_Process", fake_source, 1);
    let output = run_env_powershell(&script);
    String::from_utf8(output.stdout).expect("UTF-8 output")
}

#[cfg(windows)]
#[test]
fn powershell_discovery_projects_only_required_process_fields() {
    let fake_source = r#"$fake = @([pscustomobject]@{ Name = 'language_server.exe'; ProcessId = 4242; CommandLine = 'C:\Antigravity\language_server.exe --csrf_token abc123 --extension_server_port 54123 --unrelated private-value' }); $fake"#;
    let stdout = project_fake_processes(fake_source);
    assert!(!stdout.contains("private-value"));
    let process = AntigravityProvider::parse_process_info(&stdout).expect("projected process");
    assert_eq!(process.pid, Some(4242));
    assert_eq!(process.extension_port, Some(54123));
    assert_eq!(process.csrf_token, "abc123");
}

#[cfg(windows)]
#[test]
fn powershell_projection_preserves_ide_precedence_and_equals_flags_in_both_orders() {
    let cli = r#"[pscustomobject]@{ Name = 'agy.exe'; ProcessId = 11; CommandLine = 'C:\Antigravity\agy.exe --unrelated cli-private' }"#;
    let ide = r#"[pscustomobject]@{ Name = 'language_server.exe'; ProcessId = 22; CommandLine = 'C:\Antigravity\language_server.exe --csrf_token=ide-token --extension_server_csrf_token=extension-token --https_server_port=54321 --unrelated ide-private' }"#;
    for fake_source in [
        format!("$fake = @({cli}, {ide}); $fake"),
        format!("$fake = @({ide}, {cli}); $fake"),
    ] {
        let stdout = project_fake_processes(&fake_source);
        assert!(!stdout.contains("cli-private") && !stdout.contains("ide-private"));
        let process = AntigravityProvider::parse_process_info(&stdout).expect("IDE process");
        assert_eq!(process.pid, Some(22));
        assert_eq!(process.extension_port, Some(54321));
        assert_eq!(process.csrf_token, "ide-token");
        assert_eq!(
            process.extension_server_csrf_token.as_deref(),
            Some("extension-token")
        );
        assert_eq!(process.source, ProcessSource::Ide);
    }
}

#[cfg(windows)]
#[test]
fn powershell_projection_handles_cli_only_and_no_matching_process() {
    let cli = r#"$fake = @([pscustomobject]@{ Name = 'agy.exe'; ProcessId = 11; CommandLine = 'C:\Antigravity\agy.exe --unrelated private-value' }); $fake"#;
    let stdout = project_fake_processes(cli);
    assert!(!stdout.contains("private-value"));
    let process = AntigravityProvider::parse_process_info(&stdout).expect("CLI process");
    assert_eq!(process.source, ProcessSource::Cli);
    assert_eq!(process.pid, Some(11));

    let unrelated = r#"$fake = @([pscustomobject]@{ Name = 'other.exe'; ProcessId = 33; CommandLine = 'other.exe --csrf_token secret' }); $fake"#;
    let stdout = project_fake_processes(unrelated);
    assert!(stdout.trim().is_empty());
    assert!(AntigravityProvider::parse_process_info(&stdout).is_none());
}

#[cfg(windows)]
#[test]
fn powershell_discovery_cmdlets_are_available_without_a_user_profile() {
    let output = run_env_powershell(
        "Get-Command Get-CimInstance,Get-NetTCPConnection -ErrorAction Stop | Select-Object -ExpandProperty Name",
    );
    let names = String::from_utf8(output.stdout).expect("UTF-8 output");
    assert!(names.contains("Get-CimInstance"));
    assert!(names.contains("Get-NetTCPConnection"));
}

#[test]
fn test_classify_model_families() {
    assert_eq!(classify_model("Claude 3.5 Sonnet"), ModelFamily::Claude);
    assert_eq!(classify_model("claude-4-opus"), ModelFamily::Claude);
    assert_eq!(
        classify_model("Claude Thinking"),
        ModelFamily::ClaudeThinking
    );
    assert_eq!(
        classify_model("claude-3.5-sonnet-thinking"),
        ModelFamily::ClaudeThinking
    );
    assert_eq!(classify_model("Gemini 2.5 Pro Low"), ModelFamily::GeminiPro);
    assert_eq!(classify_model("gemini-pro-low"), ModelFamily::GeminiPro);
    assert_eq!(classify_model("Pro Low Latency"), ModelFamily::GeminiPro);
    assert_eq!(classify_model("Gemini 2.5 Flash"), ModelFamily::GeminiFlash);
    assert_eq!(classify_model("gemini-flash"), ModelFamily::GeminiFlash);
    assert_eq!(classify_model("Flash Model"), ModelFamily::GeminiFlash);
    assert_eq!(classify_model("GPT-4o"), ModelFamily::Other);
    assert_eq!(classify_model("unknown-model"), ModelFamily::Other);
}

#[test]
fn retired_flash_ids_collapse_to_current_wire_id() {
    for id in [
        "gemini-3.6-flash",
        "gemini-3.6-flash-high",
        "gemini-3.5-flash-extra-low",
        "gemini-3-flash-agent",
    ] {
        assert_eq!(canonical_model_id(id), "gemini-3.7-flash");
    }
    assert_eq!(canonical_model_id("gemini-3.7-flash"), "gemini-3.7-flash");
}

#[test]
fn parses_current_language_server_process() {
    let output = r"4242	C:\Users\test\AppData\Local\Programs\Antigravity\resources\bin\language_server.exe --csrf_token 11111111-2222-3333-4444-555555555555 --extension_server_port 54123";

    let process = AntigravityProvider::parse_process_info(output).expect("process info");

    assert_eq!(process.pid, Some(4242));
    assert_eq!(process.extension_port, Some(54123));
    assert_eq!(process.csrf_token, "11111111-2222-3333-4444-555555555555");
    assert_eq!(process.source, ProcessSource::Ide);
}

#[test]
fn parses_language_server_without_extension_server_port() {
    let output = "34564\tC:\\Users\\test\\AppData\\Local\\Programs\\Antigravity\\resources\\bin\\language_server.exe --standalone --override_ide_name antigravity --subclient_type hub --override_ide_version 2.0.11 --https_server_port 0 --csrf_token 68dda2fb-6b26-40c0-aeef-b9a628615714 --app_data_dir antigravity";

    let process =
        AntigravityProvider::parse_process_info(output).expect("process info should be detected");

    assert_eq!(process.pid, Some(34564));
    assert_eq!(process.extension_port, Some(0));
    assert_eq!(process.csrf_token, "68dda2fb-6b26-40c0-aeef-b9a628615714");
    assert_eq!(process.source, ProcessSource::Ide);
}

#[test]
fn parses_language_server_without_any_port_arg() {
    let output = "34564\tC:\\Users\\test\\AppData\\Local\\Programs\\Antigravity\\resources\\bin\\language_server.exe --standalone --csrf_token aabbccdd-1122-3344-5566-778899001122 --app_data_dir antigravity";

    let process =
        AntigravityProvider::parse_process_info(output).expect("process info should be detected");

    assert_eq!(process.pid, Some(34564));
    assert_eq!(process.extension_port, None);
    assert_eq!(process.csrf_token, "aabbccdd-1122-3344-5566-778899001122");
    assert_eq!(process.source, ProcessSource::Ide);
}

#[test]
fn parses_equals_form_args() {
    let output = "34564\tC:\\Users\\test\\AppData\\Local\\Programs\\Antigravity\\resources\\bin\\language_server.exe --csrf_token=68dda2fb-6b26-40c0-aeef-b9a628615714 --https_server_port=61999";

    let process =
        AntigravityProvider::parse_process_info(output).expect("process info should be detected");

    assert_eq!(process.pid, Some(34564));
    assert_eq!(process.extension_port, Some(61999));
    assert_eq!(process.csrf_token, "68dda2fb-6b26-40c0-aeef-b9a628615714");
    assert_eq!(process.source, ProcessSource::Ide);
}

fn make_response(models: Vec<(&str, f64)>) -> UserStatusResponse {
    let json = serde_json::json!({
        "userStatus": {
            "cascadeModelConfigData": {
                "clientModelConfigs": models.iter().map(|(label, remaining)| {
                    serde_json::json!({
                        "label": label,
                        "quotaInfo": {
                            "remainingFraction": remaining
                        }
                    })
                }).collect::<Vec<_>>()
            }
        }
    });
    serde_json::from_value(json).unwrap()
}

#[test]
fn antigravity_extra_windows_preserve_usage_known() {
    let json = serde_json::json!({
        "userStatus": {
            "cascadeModelConfigData": {
                "clientModelConfigs": [
                    {
                        "label": "Gemini 2.5 Pro",
                        "quotaInfo": {"remainingFraction": 0.8}
                    },
                    {
                        "label": "Claude 4 Sonnet",
                        "quotaInfo": {"remainingFraction": null}
                    }
                ]
            }
        }
    });
    let resp: UserStatusResponse = serde_json::from_value(json).unwrap();
    let snap = AntigravityProvider::new().parse_user_status(resp).unwrap();
    let gemini = snap
        .extra_rate_windows
        .iter()
        .find(|window| window.title.contains("Gemini"))
        .unwrap();
    let claude = snap
        .extra_rate_windows
        .iter()
        .find(|window| window.title.contains("Claude"))
        .unwrap();
    assert!(gemini.usage_known);
    assert!(!claude.usage_known);
    assert_eq!(claude.window.used_percent, 0.0);
    assert!(
        claude.window.is_informational,
        "unknown usage must not become a quota percentage"
    );
    assert!(!gemini.window.is_informational);
}

#[test]
fn test_parse_user_status_standard() {
    let resp = make_response(vec![
        ("Claude 3.5 Sonnet", 0.8),
        ("Gemini 2.5 Pro Low", 0.5),
        ("Gemini 2.5 Flash", 0.9),
    ]);
    let provider = AntigravityProvider::new();
    let snap = provider.parse_user_status(resp).unwrap();

    assert!((snap.primary.used_percent - 20.0).abs() < 0.1);
    let sec = snap.secondary.unwrap();
    assert!((sec.used_percent - 50.0).abs() < 0.1);
    let ter = snap.model_specific.unwrap();
    assert!((ter.used_percent - 10.0).abs() < 0.1);
    assert_eq!(snap.extra_rate_windows.len(), 3);
    assert!(
        snap.extra_rate_windows
            .iter()
            .any(|window| window.title == "Gemini 2.5 Flash")
    );
}

#[test]
fn absent_quota_is_not_reported_as_zero_but_an_observed_zero_is_preserved() {
    for json in [
        serde_json::json!({"userStatus": {}}),
        serde_json::json!({"userStatus": {"cascadeModelConfigData": {"clientModelConfigs": []}}}),
        serde_json::json!({"userStatus": {"cascadeModelConfigData": {"clientModelConfigs": [{"label":"Claude", "quotaInfo":{"remainingFraction":null}}]}}}),
    ] {
        let response = serde_json::from_value(json).unwrap();
        let snapshot = AntigravityProvider::new()
            .parse_user_status(response)
            .unwrap();
        assert!(snapshot.primary.is_informational);
    }
    let snapshot = AntigravityProvider::new()
        .parse_user_status(make_response(vec![("Claude", 1.0)]))
        .unwrap();
    assert!(!snapshot.primary.is_informational);
    assert_eq!(snapshot.primary.used_percent, 0.0);
}

#[test]
fn test_parse_user_status_thinking_skipped() {
    let resp = make_response(vec![
        ("Claude Thinking", 0.6),
        ("Claude 3.5 Sonnet", 0.7),
        ("Gemini 2.5 Flash", 0.5),
    ]);
    let provider = AntigravityProvider::new();
    let snap = provider.parse_user_status(resp).unwrap();

    assert!((snap.primary.used_percent - 30.0).abs() < 0.1);
}

#[test]
fn test_parse_user_status_fallback_first() {
    let resp = make_response(vec![("GPT-4o", 0.4), ("Mistral Large", 0.6)]);
    let provider = AntigravityProvider::new();
    let snap = provider.parse_user_status(resp).unwrap();

    assert!((snap.primary.used_percent - 60.0).abs() < 0.1);
    assert!(snap.secondary.is_none());
    assert!(snap.model_specific.is_none());
}

#[test]
fn test_noisy_models_do_not_drive_summary_windows() {
    let resp = make_response(vec![
        ("Gemini 2.5 Flash Image", 0.01),
        ("Gemini 2.5 Pro Lite", 0.02),
        ("Gemini autocomplete internal", 0.03),
        ("Claude 4 Sonnet", 0.8),
        ("Gemini 2.5 Pro Low", 0.6),
        ("Gemini 2.5 Flash", 0.7),
    ]);
    let provider = AntigravityProvider::new();
    let snap = provider.parse_user_status(resp).unwrap();

    assert!((snap.primary.used_percent - 20.0).abs() < 0.1);
    assert!((snap.secondary.unwrap().used_percent - 40.0).abs() < 0.1);
    assert!((snap.model_specific.unwrap().used_percent - 30.0).abs() < 0.1);
    assert!(
        snap.extra_rate_windows
            .iter()
            .any(|window| window.title == "Gemini 2.5 Flash Image")
    );
}

#[test]
fn not_running_error_tells_user_how_to_start() {
    let error = ProviderError::NotInstalled(NOT_RUNNING_MESSAGE.to_string()).to_string();

    assert!(error.contains("Start Google Antigravity and sign in"));
}

// ── agy CLI process matching ───────────────────────────────────────

#[test]
fn detects_agy_exe_cli_process_with_empty_csrf() {
    // agy.exe hosts the language server in-process with no --csrf_token.
    let output =
        "7777\tC:\\Users\\test\\AppData\\Local\\agy\\bin\\agy.exe session --model gemini-2.5-pro";

    let process = AntigravityProvider::parse_process_info(output)
        .expect("agy CLI process should be detected");

    assert_eq!(process.pid, Some(7777));
    assert_eq!(process.source, ProcessSource::Cli);
    assert_eq!(process.csrf_token, "");
    assert!(
        process.csrf_token.is_empty(),
        "agy CLI requires no CSRF token"
    );
    assert_eq!(process.extension_server_csrf_token, None);
    assert_eq!(process.extension_port, None);
}

#[test]
fn detects_quoted_agy_exe_cli_process() {
    // Windows CIM quotes an executable path that contains path separators.
    let output = "7777\t\"C:\\Users\\user\\AppData\\Local\\agy\\bin\\agy.exe\" --model gemini-3.7-flash-high";

    let process = AntigravityProvider::parse_process_info(output)
        .expect("quoted agy CLI process should be detected");

    assert_eq!(process.pid, Some(7777));
    assert_eq!(process.source, ProcessSource::Cli);
    assert!(process.csrf_token.is_empty());
}

#[test]
fn detects_bare_agy_command() {
    // The CLI may appear under the bare `agy` name (no .exe suffix).
    let output = "8888\tagy serve";

    let process = AntigravityProvider::parse_process_info(output)
        .expect("bare agy command should be detected");

    assert_eq!(process.pid, Some(8888));
    assert_eq!(process.source, ProcessSource::Cli);
    assert!(process.csrf_token.is_empty());
}

#[test]
fn detects_antigravity_cli_command() {
    // Upstream also matches antigravity-cli / antigravity_cli.
    let output = "9999\t/opt/homebrew/bin/antigravity-cli status";

    let process = AntigravityProvider::parse_process_info(output)
        .expect("antigravity-cli command should be detected");

    assert_eq!(process.pid, Some(9999));
    assert_eq!(process.source, ProcessSource::Cli);
    assert!(process.csrf_token.is_empty());
}

#[test]
fn ide_match_preferred_over_agy_cli_when_both_running() {
    // When the desktop IDE server and the agy CLI are both running, the
    // CSRF-protected IDE match wins (mirrors upstream process-kind precedence).
    let output = "4242\tC:\\Antigravity\\language_server.exe --csrf_token deadbeef-aaaa-bbbb-cccc-dddddddddddd --extension_server_port 54123\n\
                  7777\tC:\\Users\\test\\AppData\\Local\\agy\\bin\\agy.exe session";

    let process =
        AntigravityProvider::parse_process_info(output).expect("a process should be detected");

    assert_eq!(process.pid, Some(4242));
    assert_eq!(process.source, ProcessSource::Ide);
    assert_eq!(process.csrf_token, "deadbeef-aaaa-bbbb-cccc-dddddddddddd");
}

#[test]
fn agy_cli_matches_when_only_cli_running() {
    // No --csrf_token anywhere: only the agy CLI line should match.
    let output = "7777\tC:\\Users\\test\\AppData\\Local\\agy\\bin\\agy.exe";

    let process = AntigravityProvider::parse_process_info(output)
        .expect("agy CLI should be detected when it is the only match");

    assert_eq!(process.source, ProcessSource::Cli);
    assert!(process.csrf_token.is_empty());
}

#[test]
fn non_antigravity_process_without_csrf_is_not_matched() {
    // An unrelated tokenless process must not be mistaken for the agy CLI.
    let output = "1234\tC:\\Windows\\System32\\notepad.exe";

    let process = AntigravityProvider::parse_process_info(output);

    assert!(process.is_none(), "unrelated process must not match");
}

#[test]
fn is_agy_cli_command_matches_known_names() {
    assert!(is_agy_cli_command("agy serve"));
    assert!(is_agy_cli_command(
        "C:\\Users\\test\\AppData\\Local\\agy\\bin\\agy.exe session"
    ));
    assert!(is_agy_cli_command(
        "C:\\Users\\user\\AppData\\Local\\agy\\bin\\AGY.EXE --model gemini-3.7-flash-high"
    ));
    assert!(is_agy_cli_command(
        "\"C:\\Users\\user\\AppData\\Local\\agy\\bin\\agy.exe\" --model gemini-3.7-flash-high"
    ));
    assert!(is_agy_cli_command("/usr/local/bin/antigravity-cli status"));
    assert!(is_agy_cli_command("/opt/antigravity_cli run"));
    assert!(is_agy_cli_command("\"C:\\Tools\\antigravity-cli\" status"));
    assert!(is_agy_cli_command("\"C:\\Tools\\antigravity_cli\" run"));
}

#[test]
fn is_agy_cli_command_rejects_unrelated_names() {
    // A leading path separator prevents `notantigravity-cli` from matching.
    assert!(!is_agy_cli_command(
        "notagy.exe --model gemini-3.7-flash-high"
    ));
    assert!(!is_agy_cli_command(
        "C:\\Tools\\someagy.exe --model gemini-3.7-flash-high"
    ));
    assert!(!is_agy_cli_command("notantigravity-cli status"));
    assert!(!is_agy_cli_command("C:\\Tools\\notantigravity-cli status"));
    assert!(!is_agy_cli_command("C:\\Windows\\System32\\notepad.exe"));
    assert!(!is_agy_cli_command("language_server.exe --csrf_token abc"));
    assert!(!is_agy_cli_command(""));
}

// ── Upstream 0.50.1 #2963: one lane per quota bucket ──────────────────────

#[test]
fn multiple_models_in_same_quota_bucket_collapse_to_one_lane() {
    // Two Claude variants sharing the same remaining fraction (same 5h
    // session bucket) should produce one extra rate window, not two.
    let resp = make_response(vec![
        ("Claude 3.5 Sonnet", 0.8),
        ("Claude 4 Sonnet", 0.8),
        ("Gemini 2.5 Pro Low", 0.5),
    ]);
    let provider = AntigravityProvider::new();
    let snap = provider.parse_user_status(resp).unwrap();
    assert_eq!(
        snap.extra_rate_windows.len(),
        2,
        "models sharing a quota bucket collapse to one lane"
    );
}

#[test]
fn models_in_distinct_quota_buckets_keep_separate_lanes() {
    let resp = make_response(vec![
        ("Claude 3.5 Sonnet", 0.8),
        ("Claude 4 Sonnet", 0.7),
        ("Gemini 2.5 Pro Low", 0.5),
    ]);
    let provider = AntigravityProvider::new();
    let snap = provider.parse_user_status(resp).unwrap();
    assert_eq!(snap.extra_rate_windows.len(), 3);
}

#[test]
fn not_installed_maps_to_local_runtime_offline() {
    // Antigravity's `NotInstalled` reports the local language-server probe
    // finding nothing to talk to: a runtime that is not running, not a
    // credential problem.
    assert_eq!(
        AntigravityProvider::new()
            .error_state_kind(&ProviderError::NotInstalled(NOT_RUNNING_MESSAGE.into())),
        crate::core::ProviderStateKind::LocalRuntimeOffline
    );
}

#[test]
fn probe_failure_maps_to_unknown() {
    // A failed probe (PowerShell unavailable etc.) says nothing about the
    // runtime itself - inconclusive, not offline.
    assert_eq!(
        AntigravityProvider::new().error_state_kind(&ProviderError::NotInstalled(
            "Failed to detect Antigravity process".into()
        )),
        crate::core::ProviderStateKind::Unknown
    );
}
