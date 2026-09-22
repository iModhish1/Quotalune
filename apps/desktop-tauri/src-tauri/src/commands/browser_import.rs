use super::*;

// ── Browser cookie import commands ────────────────────────────────────

/// Bridge-friendly detected browser entry.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedBrowserBridge {
    /// Stable key used when calling `import_browser_cookies`.
    pub browser_type: String,
    pub display_name: String,
    pub profile_count: usize,
    pub profiles: Vec<BrowserProfileBridge>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserProfileBridge {
    pub id: String,
    pub ordinal: usize,
}

fn profile_id(profile: &quotalis_core::browser::detection::BrowserProfile) -> String {
    use std::hash::{Hash, Hasher};
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    profile.path.hash(&mut hash);
    format!("{:016x}", hash.finish())
}

fn select_profile(
    browser: &mut quotalis_core::browser::detection::DetectedBrowser,
    selected: Option<&str>,
) -> Result<(), String> {
    let index = match selected {
        Some(id) => browser.profiles.iter().position(|p| profile_id(p) == id),
        None if browser.profiles.len() == 1 => Some(0),
        None => None,
    }
    .ok_or("Choose one browser profile explicitly")?;
    let profile = browser.profiles.remove(index);
    browser.profiles = vec![profile];
    Ok(())
}

/// List all browsers detected on this machine that CodexBar can read cookies from.
///
/// On non-Windows platforms (e.g. Linux CI) this returns an empty list because
/// DPAPI is unavailable; the UI should hide/disable the import button in that case.
#[tauri::command]
pub fn list_detected_browsers(provider_id: Option<String>) -> Vec<DetectedBrowserBridge> {
    if provider_id
        .as_deref()
        .and_then(ProviderId::from_cli_name)
        .and_then(super::connection::active_fixture)
        .is_some()
    {
        return vec![DetectedBrowserBridge {
            browser_type: "fixture".into(),
            display_name: "QA browser".into(),
            profile_count: 1,
            profiles: vec![BrowserProfileBridge {
                id: "fixture-only".into(),
                ordinal: 1,
            }],
        }];
    }
    use quotalis_core::browser::detection::BrowserDetector;

    BrowserDetector::detect_all()
        .into_iter()
        .map(|b| DetectedBrowserBridge {
            browser_type: browser_type_key(b.browser_type).to_string(),
            display_name: b.browser_type.display_name().to_string(),
            profile_count: b.profiles.len(),
            profiles: b
                .profiles
                .iter()
                .enumerate()
                .map(|(index, p)| BrowserProfileBridge {
                    id: profile_id(p),
                    ordinal: index + 1,
                })
                .collect(),
        })
        .collect()
}

/// Import cookies for `provider_id` from the named browser and persist them as
/// a manual-cookie override, replacing any existing entry for that provider.
///
/// `browser_type` must be one of the keys returned by `list_detected_browsers`
/// (e.g. `"chrome"`, `"edge"`, `"brave"`).
///
/// Returns the updated manual-cookies list on success.
#[tauri::command]
pub fn import_browser_cookies(
    provider_id: String,
    browser_type: String,
    profile_id: Option<String>,
) -> Result<Vec<CookieInfoBridge>, String> {
    use quotalis_core::browser::cookies::{CookieError, CookieExtractor};
    use quotalis_core::browser::detection::BrowserDetector;

    // Resolve the provider to get its cookie domain.
    let pid = parse_provider_arg(&provider_id)?;
    if !quotalis_core::connection_capabilities::connection_capabilities(pid)
        .supports(quotalis_core::connection_capabilities::ConnectionMethod::BrowserSession)
    {
        return Err("This provider does not support browser sessions".into());
    }
    if let Some(fixture) = super::connection::active_fixture(pid) {
        return if matches!(fixture.scenario.as_str(), "cookieValid" | "connected") {
            Ok(Vec::new()) // simulation: no browser read, no credential store access
        } else {
            Err("Simulated browser session unavailable".into())
        };
    }
    let operation = super::connection::begin_live_connection(pid)?;

    let settings = Settings::load();
    let domain = super::providers::provider_cookie_domain(pid, &settings)
        .ok_or("This provider does not support browser sessions")?;

    // Find the requested browser.
    let browsers = BrowserDetector::detect_all();
    let mut browser = browsers
        .into_iter()
        .find(|b| browser_type_key(b.browser_type) == browser_type.as_str())
        .ok_or_else(|| format!("Browser '{browser_type}' not found or not installed"))?;

    // Restrict extraction before opening a cookie database: never merge accounts.
    select_profile(&mut browser, profile_id.as_deref())?;
    // Extract the cookie header.
    let cookies = CookieExtractor::extract_for_domain(&browser, domain).map_err(|e| match e {
        CookieError::Dpapi(_) => "Browser session could not be decrypted".to_string(),
        _ => "Browser session could not be read".to_string(),
    })?;

    if cookies.is_empty() {
        return Err(format!(
            "No cookies found for {domain} in {}. Make sure you are signed in to that site in the browser.",
            browser.browser_type.display_name()
        ));
    }

    let cookie_header = CookieExtractor::build_cookie_header(&cookies);
    validate_single_line_secret(&cookie_header, "Cookie header", MAX_COOKIE_HEADER_LEN)?;

    // Extraction can finish after Close. Make the protected-store transaction
    // atomic with accepted cancellation, including its read/modify/write.
    operation.commit_if_active(|| {
        let mut manual = ManualCookies::load();
        manual.set(pid.cli_name(), &cookie_header);
        manual
            .save()
            .map_err(|_| "Protected session storage unavailable".to_string())
    })?;

    Ok(get_manual_cookies())
}

/// Map `BrowserType` to a stable lowercase string key used in the IPC bridge.
fn browser_type_key(bt: quotalis_core::browser::detection::BrowserType) -> &'static str {
    use quotalis_core::browser::detection::BrowserType;
    match bt {
        BrowserType::Chrome => "chrome",
        BrowserType::Edge => "edge",
        BrowserType::Brave => "brave",
        BrowserType::Arc => "arc",
        BrowserType::Firefox => "firefox",
        BrowserType::Chromium => "chromium",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use quotalis_core::browser::detection::{BrowserProfile, BrowserType, DetectedBrowser};
    fn browser() -> DetectedBrowser {
        DetectedBrowser {
            browser_type: BrowserType::Edge,
            user_data_dir: "fixture".into(),
            profiles: vec![
                BrowserProfile {
                    name: "one".into(),
                    path: "fixture/one".into(),
                    is_default: true,
                },
                BrowserProfile {
                    name: "two".into(),
                    path: "fixture/two".into(),
                    is_default: false,
                },
            ],
        }
    }
    #[test]
    fn multi_account_import_requires_one_known_profile() {
        let mut browser = browser();
        assert!(select_profile(&mut browser, None).is_err());
        assert!(select_profile(&mut browser, Some("../../outside")).is_err());
        assert_eq!(browser.profiles.len(), 2);
        let id = profile_id(&browser.profiles[1]);
        select_profile(&mut browser, Some(&id)).unwrap();
        assert_eq!(browser.profiles.len(), 1);
        assert_eq!(browser.profiles[0].name, "two");
        assert!(select_profile(&mut browser, None).is_ok());
    }
}
