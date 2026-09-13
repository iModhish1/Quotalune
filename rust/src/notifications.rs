//! System notifications for Quotalis
//!
//! Provides Windows toast notifications for usage alerts

#![allow(
    dead_code,
    reason = "notification helpers are reserved for future alert integration"
)]

use crate::core::ProviderId;
use crate::core::{RateWindow, UsagePace};
use crate::locale::{self, LocaleKey};
use crate::notification_journal::{
    JournalEventKind, NotificationEvent, NotificationJournal,
    ResetObservation as JournalObservation,
};
use crate::settings::Settings;
use crate::sound::{NotificationSoundEvent, play_alert};
use chrono::{DateTime, Local, Timelike, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::borrow::Cow;
use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

mod branding;

/// The Tauri shell resolves the packaged brand asset during startup. Keeping
/// the image path here lets the shared notification engine produce a branded
/// toast without knowing Tauri's platform-specific resource directory.
static TOAST_ICON_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Supply the packaged Quotalis icon used by Windows notifications.
///
/// Calling this more than once is harmless: the first valid packaged path is
/// retained for the life of the process.
pub fn configure_toast_icon(path: PathBuf) {
    if path.is_file() {
        drop(TOAST_ICON_PATH.set(path));
    } else {
        tracing::warn!(?path, "Quotalis toast icon resource was not found");
    }
}

fn toast_icon_path() -> Option<PathBuf> {
    TOAST_ICON_PATH.get().cloned().or_else(|| {
        let source_asset = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../assets/brand/icons/quotaarc-icon-128.png");
        source_asset.is_file().then_some(source_asset)
    })
}

#[derive(Debug, Clone)]
struct ToastIcon {
    path: PathBuf,
    alternate_text: String,
}

fn branded_toast_icon(provider: Option<ProviderId>) -> Option<ToastIcon> {
    if let Some(root) = crate::logging::config_root() {
        match branding::materialize_icon(&root, provider) {
            Ok(icon) => {
                return Some(ToastIcon {
                    path: icon.path,
                    alternate_text: icon.alternate_text,
                });
            }
            Err(error) => tracing::warn!(
                ?provider,
                %error,
                "failed to materialize notification brand icon"
            ),
        }
    }

    toast_icon_path().map(|path| ToastIcon {
        path,
        alternate_text: PUBLIC_APP_NAME.to_string(),
    })
}

fn file_uri(path: &Path) -> String {
    let path = path.to_string_lossy().replace('\\', "/");
    // Tauri resources are canonicalized on Windows and commonly carry \\?\.
    // That filesystem prefix is not a URI authority or query string.
    let path = if let Some(unc) = path.strip_prefix("//?/UNC/") {
        format!("//{unc}")
    } else {
        path.strip_prefix("//?/").unwrap_or(&path).to_string()
    };
    let escaped = path
        .replace('%', "%25")
        .replace(' ', "%20")
        .replace('#', "%23")
        .replace('?', "%3F");
    if escaped.starts_with("//") {
        format!("file:{escaped}")
    } else {
        format!("file:///{escaped}")
    }
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

const PUBLIC_APP_NAME: &str = "Quotalis";

/// URI scheme used only for notification activation. Development and Personal
/// builds must never share a protocol handler because each registration points
/// at its own executable and single-instance lane.
pub const fn notification_protocol_scheme() -> &'static str {
    if crate::paths::is_dev_channel() {
        "quotalis-dev"
    } else {
        "quotalis"
    }
}

/// A bounded destination carried by a native notification click. Provider IDs
/// remain typed, so an untrusted protocol argument cannot become an arbitrary
/// Settings tab, command-line switch, or URL.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotificationDestination {
    Dashboard,
    Provider(ProviderId),
    Providers(ProviderId),
}

pub fn notification_uri(destination: NotificationDestination) -> String {
    let scheme = notification_protocol_scheme();
    match destination {
        NotificationDestination::Dashboard => format!("{scheme}://dashboard"),
        NotificationDestination::Provider(provider) => {
            format!("{scheme}://provider/{}", provider.cli_name())
        }
        NotificationDestination::Providers(provider) => {
            format!("{scheme}://providers/{}", provider.cli_name())
        }
    }
}

/// Parse only the current build channel's notification protocol. This is used
/// by the Tauri shell for both cold launches and single-instance relaunches.
/// Cross-channel URIs fail closed, preventing a Dev toast from raising Personal.
pub fn parse_notification_uri(value: &str) -> Option<NotificationDestination> {
    let value = value.trim();
    let (scheme, target) = value.split_once("://")?;
    if scheme != notification_protocol_scheme() {
        return None;
    }

    let mut segments = target.split('/');
    let route = segments.next()?;
    let provider = segments.next();
    if segments.next().is_some() {
        return None;
    }

    match (route, provider) {
        ("dashboard", None) => Some(NotificationDestination::Dashboard),
        ("provider", Some(provider)) => {
            ProviderId::from_cli_name(provider).map(NotificationDestination::Provider)
        }
        ("providers", Some(provider)) => {
            ProviderId::from_cli_name(provider).map(NotificationDestination::Providers)
        }
        _ => None,
    }
}

/// Build the complete ToastGeneric payload. An explicit local app-logo image
/// makes the notification recognizable even while Windows refreshes its AUMID
/// cache after an upgrade.
///
/// Windows' toast schema defines `appLogoOverride` as the left-side app image
/// and explicitly permits `file:///` sources for desktop apps:
/// https://learn.microsoft.com/en-us/uwp/schemas/tiles/toastschema/element-image
fn toast_template(
    title: &str,
    body: &str,
    icon: Option<&ToastIcon>,
    destination: NotificationDestination,
) -> String {
    let logo = icon.map_or_else(String::new, |icon| {
        format!(
            "<image placement=\"appLogoOverride\" src=\"{}\" alt=\"{}\"/>",
            xml_escape(&file_uri(&icon.path)),
            xml_escape(&icon.alternate_text),
        )
    });
    format!(
        "<toast activationType=\"protocol\" launch=\"{}\"><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text>{logo}</binding></visual><audio silent=\"true\"/></toast>",
        xml_escape(&notification_uri(destination)),
        xml_escape(title),
        xml_escape(body),
    )
}

/// Notification types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum NotificationType {
    /// Usage is approaching limit (high threshold)
    HighUsage,
    /// Usage is critical (critical threshold)
    CriticalUsage,
    /// Usage limit exhausted
    Exhausted,
    /// Usage crossed a user-selected percentage milestone.
    UsageStep(u8),
    /// Provider status issue
    StatusIssue,
    /// Session quota depleted (at 100% usage)
    SessionDepleted,
    /// Session quota restored (back from 100%)
    SessionRestored,
    /// A quota reset observed at its announced boundary.
    ExpectedReset(i64),
    /// A quota reset observed before its announced boundary or without one.
    UnexpectedReset(i64),
    /// The number of available banked reset credits increased.
    BankedResetCredit(u32),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PredictiveWarningWindow {
    Session,
    Weekly,
}

impl PredictiveWarningWindow {
    fn localized_label(self, language: crate::settings::Language) -> String {
        locale::get_text(
            language,
            match self {
                Self::Session => LocaleKey::ProviderSession,
                Self::Weekly => LocaleKey::ProviderWeekly,
            },
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct PredictiveResetWindow {
    window_minutes: Option<u32>,
    resets_at: DateTime<Utc>,
}

impl PredictiveResetWindow {
    fn belongs_to_same_cycle(&self, other: &Self) -> bool {
        if self.window_minutes != other.window_minutes {
            return false;
        }
        let tolerance_secs = self
            .window_minutes
            .map(|minutes| i64::from(minutes) * 30)
            .unwrap_or(300)
            .max(300);
        (self.resets_at - other.resets_at).num_seconds().abs() < tolerance_secs
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct PredictiveWarningKey {
    provider: ProviderId,
    identity: String,
    window: PredictiveWarningWindow,
    reset: PredictiveResetWindow,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedPredictiveWarningKey {
    provider: String,
    identity_digest: String,
    window: PredictiveWarningWindow,
    window_minutes: Option<u32>,
    resets_at: i64,
}

impl PersistedPredictiveWarningKey {
    fn from_observation(
        provider: ProviderId,
        identity: &str,
        window: PredictiveWarningWindow,
        reset: &PredictiveResetWindow,
    ) -> Self {
        Self {
            provider: provider.cli_name().to_string(),
            identity_digest: NotificationManager::identity_digest(identity),
            window,
            window_minutes: reset.window_minutes,
            resets_at: reset.resets_at.timestamp(),
        }
    }

    fn belongs_to_same_lane(&self, other: &Self) -> bool {
        self.provider == other.provider
            && self.identity_digest == other.identity_digest
            && self.window == other.window
    }

    fn belongs_to_same_cycle(&self, other: &Self) -> bool {
        if !self.belongs_to_same_lane(other) || self.window_minutes != other.window_minutes {
            return false;
        }
        let tolerance_secs = self
            .window_minutes
            .map(|minutes| i64::from(minutes) * 30)
            .unwrap_or(300)
            .max(300);
        (self.resets_at - other.resets_at).abs() < tolerance_secs
    }
}

impl NotificationType {
    pub fn title(&self) -> &'static str {
        match self {
            NotificationType::HighUsage => "High Usage Warning",
            NotificationType::CriticalUsage => "Critical Usage Alert",
            NotificationType::Exhausted => "Usage Limit Reached",
            NotificationType::UsageStep(_) => "Usage milestone reached",
            NotificationType::StatusIssue => "Provider Status Issue",
            NotificationType::SessionDepleted => "Session Depleted",
            NotificationType::SessionRestored => "Session Restored",
            NotificationType::ExpectedReset(_) => "Quota reset completed",
            NotificationType::UnexpectedReset(_) => "Unexpected quota reset",
            NotificationType::BankedResetCredit(_) => "Reset credit received",
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            NotificationType::HighUsage => "⚠️",
            NotificationType::CriticalUsage => "🔴",
            NotificationType::Exhausted => "🚫",
            NotificationType::UsageStep(_) => "📊",
            NotificationType::StatusIssue => "⚡",
            NotificationType::SessionDepleted => "🔴",
            NotificationType::SessionRestored => "✅",
            NotificationType::ExpectedReset(_) => "✅",
            NotificationType::UnexpectedReset(_) => "⚡",
            NotificationType::BankedResetCredit(_) => "✦",
        }
    }

    fn is_threshold_toast(self) -> bool {
        matches!(
            self,
            NotificationType::HighUsage
                | NotificationType::CriticalUsage
                | NotificationType::Exhausted
        )
    }
}

/// Dedupe identity for threshold toasts.
/// - `account`: stable per-account discriminator (email, token-account id, …).
///   Empty string is the legacy single-account lane.
/// - `window`: rate window id (`"session"`, `"weekly"`, …) so budgets arm independently.
type ThresholdKey = (
    ProviderId,
    String, /* account */
    String, /* window */
    NotificationType,
);

/// Session-transition tracking key: provider + account identity.
type SessionTransitionKey = (ProviderId, String /* account */);
type UsageObservationKey = (
    ProviderId,
    String, /* account */
    String, /* window */
);

const NOTIFICATION_DEDUPE_VERSION: u8 = 1;
const MAX_PERSISTED_NOTIFICATION_KEYS: usize = 512;

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct PersistedNotificationDedupe {
    version: u8,
    sent: Vec<String>,
    predictive: Vec<PersistedPredictiveWarningKey>,
}

/// Notification manager
pub struct NotificationManager {
    /// Track which notifications have been sent to avoid spam
    sent_notifications: std::collections::HashSet<ThresholdKey>,
    /// Privacy-preserving hashes of sent keys restored across app launches.
    durable_sent_notifications: VecDeque<String>,
    durable_predictive_warning_keys: VecDeque<PersistedPredictiveWarningKey>,
    /// Track previous session percent for depleted/restored transitions (per account)
    previous_session_percent: std::collections::HashMap<SessionTransitionKey, f64>,
    previous_usage_percent: std::collections::HashMap<UsageObservationKey, f64>,
    notification_journal: Option<NotificationJournal>,
    predictive_warning_keys: std::collections::HashSet<PredictiveWarningKey>,
    deepseek_pricing_period: Option<String>,
}

impl NotificationManager {
    fn quiet_hours_active(settings: &Settings) -> bool {
        let now = Local::now();
        #[allow(
            clippy::cast_possible_truncation,
            reason = "local clock hours and minutes always fit in u16"
        )]
        let minute = (now.hour() * 60 + now.minute()) as u16;
        settings
            .notification_quiet_hours
            .contains_local_minute(minute)
    }

    pub fn new() -> Self {
        Self {
            sent_notifications: std::collections::HashSet::new(),
            durable_sent_notifications: VecDeque::new(),
            durable_predictive_warning_keys: VecDeque::new(),
            previous_session_percent: std::collections::HashMap::new(),
            previous_usage_percent: std::collections::HashMap::new(),
            notification_journal: Some(NotificationJournal::in_memory()),
            predictive_warning_keys: std::collections::HashSet::new(),
            deepseek_pricing_period: None,
        }
    }

    fn persistence_path() -> Option<PathBuf> {
        crate::logging::config_root().map(|root| root.join("notification-dedupe.json"))
    }

    /// Restore cross-process notification suppression. Corrupt or unknown
    /// versions fail safely to an empty manager; quota fetching must continue.
    pub fn load_persisted() -> Self {
        let path = Self::persistence_path();
        let mut manager = path
            .as_ref()
            .map_or_else(Self::new, |path| Self::load_from(path));
        manager.notification_journal =
            path.map(|path| NotificationJournal::at(path.with_file_name("notifications.db")));
        manager
    }

    pub fn persist(&self) -> std::io::Result<()> {
        let path = Self::persistence_path().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "could not determine notification state path",
            )
        })?;
        self.persist_to(&path)
    }

    fn load_from(path: &Path) -> Self {
        let Ok(raw) = crate::secure_file::read_string(path) else {
            return Self::new();
        };
        let Ok(saved) = serde_json::from_str::<PersistedNotificationDedupe>(&raw) else {
            return Self::new();
        };
        if saved.version != NOTIFICATION_DEDUPE_VERSION {
            return Self::new();
        }
        let mut manager = Self::new();
        for fingerprint in saved
            .sent
            .into_iter()
            .filter(|value| value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit()))
            .rev()
            .take(MAX_PERSISTED_NOTIFICATION_KEYS)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
        {
            if !manager.durable_sent_notifications.contains(&fingerprint) {
                manager.durable_sent_notifications.push_back(fingerprint);
            }
        }
        for key in saved
            .predictive
            .into_iter()
            .filter(|key| {
                key.identity_digest.len() == 64
                    && key
                        .identity_digest
                        .bytes()
                        .all(|byte| byte.is_ascii_hexdigit())
                    && crate::core::cli_name_map().contains_key(key.provider.as_str())
            })
            .rev()
            .take(MAX_PERSISTED_NOTIFICATION_KEYS)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
        {
            if !manager.durable_predictive_warning_keys.contains(&key) {
                manager.durable_predictive_warning_keys.push_back(key);
            }
        }
        manager
    }

    fn persist_to(&self, path: &Path) -> std::io::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let saved = PersistedNotificationDedupe {
            version: NOTIFICATION_DEDUPE_VERSION,
            sent: self.durable_sent_notifications.iter().cloned().collect(),
            predictive: self
                .durable_predictive_warning_keys
                .iter()
                .cloned()
                .collect(),
        };
        let json = serde_json::to_string(&saved)
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
        crate::secure_file::write_string(path, &json)
    }

    fn notification_kind_key(kind: NotificationType) -> String {
        match kind {
            NotificationType::HighUsage => "high".to_string(),
            NotificationType::CriticalUsage => "critical".to_string(),
            NotificationType::Exhausted => "exhausted".to_string(),
            NotificationType::UsageStep(step) => format!("step:{step}"),
            NotificationType::StatusIssue => "status-issue".to_string(),
            NotificationType::SessionDepleted => "session-depleted".to_string(),
            NotificationType::SessionRestored => "session-restored".to_string(),
            NotificationType::ExpectedReset(timestamp) => format!("expected-reset:{timestamp}"),
            NotificationType::UnexpectedReset(timestamp) => {
                format!("unexpected-reset:{timestamp}")
            }
            // A decrease explicitly re-arms this stable lane, so the count is
            // intentionally excluded from the durable identity.
            NotificationType::BankedResetCredit(_) => "banked-reset-credit".to_string(),
        }
    }

    fn identity_digest(identity: &str) -> String {
        let mut digest = Sha256::new();
        digest.update((identity.len() as u64).to_le_bytes());
        digest.update(identity.as_bytes());
        format!("{:x}", digest.finalize())
    }

    fn durable_fingerprint(key: &ThresholdKey) -> String {
        let mut digest = Sha256::new();
        let kind = Self::notification_kind_key(key.3);
        for part in [
            key.0.cli_name(),
            key.1.as_str(),
            key.2.as_str(),
            kind.as_str(),
        ] {
            digest.update((part.len() as u64).to_le_bytes());
            digest.update(part.as_bytes());
        }
        format!("{:x}", digest.finalize())
    }

    fn was_sent(&self, key: &ThresholdKey) -> bool {
        self.sent_notifications.contains(key)
            || self
                .durable_sent_notifications
                .contains(&Self::durable_fingerprint(key))
    }

    /// Returns true only when the event has not been sent in this process or a
    /// previous process. The raw account identity stays in memory only.
    fn mark_sent(&mut self, key: ThresholdKey) -> bool {
        let fingerprint = Self::durable_fingerprint(&key);
        let is_new = !self.sent_notifications.contains(&key)
            && !self.durable_sent_notifications.contains(&fingerprint);
        self.sent_notifications.insert(key);
        if !self.durable_sent_notifications.contains(&fingerprint) {
            self.durable_sent_notifications.push_back(fingerprint);
            while self.durable_sent_notifications.len() > MAX_PERSISTED_NOTIFICATION_KEYS {
                self.durable_sent_notifications.pop_front();
            }
        }
        is_new
    }

    fn forget_sent(&mut self, key: &ThresholdKey) {
        self.sent_notifications.remove(key);
        let fingerprint = Self::durable_fingerprint(key);
        self.durable_sent_notifications
            .retain(|saved| saved != &fingerprint);
    }

    fn forget_threshold_lane(&mut self, provider: ProviderId, account: &str, window: &str) {
        for kind in [
            NotificationType::HighUsage,
            NotificationType::CriticalUsage,
            NotificationType::Exhausted,
        ] {
            self.forget_sent(&(provider, account.to_string(), window.to_string(), kind));
        }
    }

    fn forget_usage_steps(&mut self, provider: ProviderId, account: &str, window: &str) {
        for step in 1..=100 {
            self.forget_sent(&(
                provider,
                account.to_string(),
                window.to_string(),
                NotificationType::UsageStep(step),
            ));
        }
    }

    /// Observe a DeepSeek pricing period and notify once per observed transition.
    /// Intentionally silent; this advisory must not play a notification sound.
    pub fn notify_pricing_transition(&mut self, period: &str, settings: &Settings) {
        let changed = self
            .deepseek_pricing_period
            .as_deref()
            .is_some_and(|previous| previous != period);
        self.deepseek_pricing_period = Some(period.to_string());
        if !settings.show_notifications || !changed || Self::quiet_hours_active(settings) {
            return;
        }
        let label = match period {
            "peak" => "peak",
            "offPeak" => "off-peak",
            _ => "standard/pre-schedule",
        };
        self.show_toast(
            "DeepSeek pricing schedule",
            &format!("DeepSeek is currently in {label} hours."),
            NotificationDestination::Provider(ProviderId::DeepSeek),
            Some(ProviderId::DeepSeek),
        );
    }

    pub fn record_predictive_observation(
        &mut self,
        enabled: bool,
        provider: ProviderId,
        identity: &str,
        window: PredictiveWarningWindow,
        rate_window: &RateWindow,
        pace: &UsagePace,
    ) -> bool {
        if !enabled {
            self.predictive_warning_keys
                .retain(|key| key.provider != provider);
            self.durable_predictive_warning_keys
                .retain(|key| key.provider != provider.cli_name());
            return false;
        }
        if !matches!(provider, ProviderId::Claude | ProviderId::Codex) || identity.is_empty() {
            return false;
        }
        let Some(resets_at) = rate_window.resets_at else {
            return false;
        };
        let key = PredictiveWarningKey {
            provider,
            identity: identity.to_string(),
            window,
            reset: PredictiveResetWindow {
                window_minutes: rate_window.window_minutes,
                resets_at,
            },
        };
        let durable_key =
            PersistedPredictiveWarningKey::from_observation(provider, identity, window, &key.reset);

        let warned_this_cycle = self.predictive_warning_keys.iter().any(|existing| {
            existing.provider == key.provider
                && existing.identity == key.identity
                && existing.window == key.window
                && existing.reset.belongs_to_same_cycle(&key.reset)
        }) || self
            .durable_predictive_warning_keys
            .iter()
            .any(|existing| existing.belongs_to_same_cycle(&durable_key));
        self.predictive_warning_keys.retain(|existing| {
            existing.provider != key.provider
                || existing.identity != key.identity
                || existing.window != key.window
        });
        self.durable_predictive_warning_keys
            .retain(|existing| !existing.belongs_to_same_lane(&durable_key));

        if pace.will_last_to_reset {
            return false;
        }
        if !pace
            .eta_seconds
            .is_some_and(|eta| eta.is_finite() && eta > 0.0)
        {
            return false;
        }

        self.predictive_warning_keys.insert(key);
        self.durable_predictive_warning_keys.push_back(durable_key);
        while self.durable_predictive_warning_keys.len() > MAX_PERSISTED_NOTIFICATION_KEYS {
            self.durable_predictive_warning_keys.pop_front();
        }
        !warned_this_cycle
    }

    pub fn set_predictive_warnings_enabled(&mut self, provider: ProviderId, enabled: bool) {
        if !enabled {
            self.predictive_warning_keys
                .retain(|key| key.provider != provider);
            self.durable_predictive_warning_keys
                .retain(|key| key.provider != provider.cli_name());
        }
    }

    pub fn check_predictive_pace(
        &mut self,
        provider: ProviderId,
        identity: &str,
        window: PredictiveWarningWindow,
        rate_window: &RateWindow,
        pace: &UsagePace,
        settings: &Settings,
    ) {
        if !self.record_predictive_observation(
            settings.show_notifications && settings.predictive_pace_warning_enabled,
            provider,
            identity,
            window,
            rate_window,
            pace,
        ) {
            return;
        }

        if Self::quiet_hours_active(settings) {
            return;
        }

        let eta = format_duration(pace.eta_seconds.unwrap_or_default());
        let provider_name = provider.display_name();
        let window_label = window.localized_label(settings.ui_language);
        let title = locale::format_locale(
            settings.ui_language,
            LocaleKey::PredictivePaceWarningTitle,
            &[provider_name, &window_label],
        );
        let body = locale::format_locale(
            settings.ui_language,
            LocaleKey::PredictivePaceWarningBody,
            &[&eta],
        );
        self.show_toast(
            &title,
            &body,
            NotificationDestination::Provider(provider),
            Some(provider),
        );
        Self::play_notification_sound(NotificationSoundEvent::PredictiveWarning, settings);
    }

    /// Check usage and send notifications if thresholds are crossed.
    ///
    /// `account` is a stable account discriminator (email, token-account id, …).
    /// Pass `""` for single-account providers when no identity is available.
    pub fn check_and_notify(
        &mut self,
        provider: ProviderId,
        account: &str,
        window: &str,
        used_percent: f64,
        settings: &Settings,
    ) {
        if !settings.show_notifications {
            return;
        }

        self.check_usage_step(provider, account, window, used_percent, settings);

        let thresholds = settings.usage_thresholds(provider, window);
        let notification_type = if used_percent >= 100.0 {
            Some(NotificationType::Exhausted)
        } else if used_percent >= thresholds.critical {
            Some(NotificationType::CriticalUsage)
        } else if used_percent >= thresholds.high {
            Some(NotificationType::HighUsage)
        } else {
            // Clear only this provider+account+window's threshold toasts so a cool
            // session on one account cannot re-arm another account's weekly (or
            // another window on the same account) on the next poll.
            self.forget_threshold_lane(provider, account, window);
            None
        };

        if let Some(notif_type) = notification_type.filter(|kind| match kind {
            NotificationType::HighUsage => settings.notification_events.high_usage,
            NotificationType::CriticalUsage => settings.notification_events.critical_usage,
            NotificationType::Exhausted => settings.notification_events.exhausted,
            _ => true,
        }) {
            let key = (
                provider,
                account.to_string(),
                window.to_string(),
                notif_type,
            );
            if self.mark_sent(key.clone()) {
                self.send_notification(provider, window, used_percent, notif_type, settings);
            }
        }
    }

    fn check_usage_step(
        &mut self,
        provider: ProviderId,
        account: &str,
        window: &str,
        used_percent: f64,
        settings: &Settings,
    ) {
        let observation_key = (provider, account.to_string(), window.to_string());
        let previous = self
            .previous_usage_percent
            .insert(observation_key, used_percent.clamp(0.0, 100.0));

        if previous.is_some_and(|value| used_percent < value) {
            self.forget_usage_steps(provider, account, window);
        }

        let Some(step) = settings.usage_step_notification_percent else {
            return;
        };
        let Some(previous) = previous else {
            return;
        };
        if used_percent <= previous || used_percent >= 100.0 {
            return;
        }

        #[allow(
            clippy::cast_possible_truncation,
            reason = "both percentages are clamped to 0..=100 and step is a non-zero u8"
        )]
        let previous_bucket = (previous / f64::from(step)).floor() as u8;
        #[allow(
            clippy::cast_possible_truncation,
            reason = "provider usage is normalized to 0..=100 and step is a non-zero u8"
        )]
        let current_bucket = (used_percent / f64::from(step)).floor() as u8;
        if current_bucket <= previous_bucket {
            return;
        }

        let milestone = current_bucket.saturating_mul(step).min(100);
        let kind = NotificationType::UsageStep(milestone);
        let key = (provider, account.to_string(), window.to_string(), kind);
        if self.mark_sent(key) {
            self.send_notification(provider, window, f64::from(milestone), kind, settings);
        }
    }

    /// Observe a real quota window and classify resets against its previously
    /// announced boundary. A substantial usage drop is accepted as reset
    /// evidence even when the provider omits or delays its next reset time.
    #[allow(
        clippy::too_many_arguments,
        reason = "reset evidence is deliberately explicit: provider/account/window/value/boundary/time/settings"
    )]
    pub fn check_reset_transition(
        &mut self,
        provider: ProviderId,
        account: &str,
        window: &str,
        used_percent: f64,
        resets_at: Option<DateTime<Utc>>,
        observed_at: DateTime<Utc>,
        settings: &Settings,
    ) {
        let observation = JournalObservation::Quota {
            used_percent: if used_percent.is_finite() {
                used_percent.clamp(0.0, 100.0)
            } else {
                used_percent
            },
            resets_at: resets_at.map(|time| time.timestamp()),
            observed_at: observed_at.timestamp(),
        };
        let Some(event) = self.record_reset_observation(provider, account, window, observation)
        else {
            return;
        };
        let expected = event.kind == JournalEventKind::ScheduledResetObserved;
        let fingerprint = resets_at.unwrap_or(observed_at).timestamp();
        let kind = if expected {
            NotificationType::ExpectedReset(fingerprint)
        } else {
            NotificationType::UnexpectedReset(fingerprint)
        };
        let enabled = if expected {
            settings.notification_events.expected_reset
        } else {
            settings.notification_events.unexpected_reset
        };
        if !settings.show_notifications || !enabled {
            return;
        }
        let key = (provider, account.to_string(), window.to_string(), kind);
        if self.mark_sent(key) {
            self.send_notification(provider, window, event.current_value, kind, settings);
        }
    }

    /// Source-timestamped inventory observations persist even when toasts are
    /// disabled. An initial reading is a baseline, never a fabricated arrival.
    pub fn check_banked_reset_credits(
        &mut self,
        provider: ProviderId,
        account: &str,
        available_count: u32,
        observed_at: DateTime<Utc>,
        settings: &Settings,
    ) {
        let observation = JournalObservation::Banked {
            available: available_count,
            observed_at: observed_at.timestamp(),
        };
        let Some(event) =
            self.record_reset_observation(provider, account, "reset-credits", observation)
        else {
            return;
        };
        // The durable toast key intentionally ignores inventory count.
        // The durable key is count-independent, while the in-memory key carries
        // the count. Rearm every count for this lane after an inventory change.
        self.sent_notifications.retain(|key| {
            !(key.0 == provider
                && key.1 == account
                && key.2 == "reset-credits"
                && matches!(key.3, NotificationType::BankedResetCredit(_)))
        });
        self.forget_sent(&(
            provider,
            account.to_string(),
            "reset-credits".to_string(),
            NotificationType::BankedResetCredit(0),
        ));
        if event.kind != JournalEventKind::BankedResetsIncreased
            || !settings.show_notifications
            || !settings.notification_events.banked_reset_credit
        {
            return;
        }
        let kind = NotificationType::BankedResetCredit(available_count);
        let key = (
            provider,
            account.to_string(),
            "reset-credits".to_string(),
            kind,
        );
        if self.mark_sent(key) {
            self.send_notification(
                provider,
                "reset-credits",
                f64::from(available_count),
                kind,
                settings,
            );
        }
    }

    pub fn notification_history(&self) -> Result<&NotificationJournal, String> {
        self.notification_journal
            .as_ref()
            .ok_or_else(|| "Notification history location is unavailable".into())
    }

    fn record_reset_observation(
        &self,
        provider: ProviderId,
        account: &str,
        window: &str,
        observation: JournalObservation,
    ) -> Option<NotificationEvent> {
        match self.notification_history().and_then(|journal| {
            journal.observe(
                provider,
                account,
                window,
                observation,
                Utc::now().timestamp(),
            )
        }) {
            Ok(event) => event,
            Err(error) => {
                tracing::warn!(%error, "Could not record notification observation; history is unavailable");
                None
            }
        }
    }

    /// Send a notification for a status issue
    pub fn notify_status_issue(
        &mut self,
        provider: ProviderId,
        description: &str,
        settings: &Settings,
    ) {
        if !settings.show_notifications || !settings.notification_events.status_issue {
            return;
        }
        let key = (
            provider,
            String::new(),
            String::new(),
            NotificationType::StatusIssue,
        );
        if self.mark_sent(key) {
            self.send_status_notification(provider, description, settings);
        }
    }

    /// Clear status issue notification (when resolved)
    pub fn clear_status_issue(&mut self, provider: ProviderId) {
        self.forget_sent(&(
            provider,
            String::new(),
            String::new(),
            NotificationType::StatusIssue,
        ));
    }

    /// Check session quota transitions (depleted/restored)
    /// Call this with each usage update to detect transitions.
    ///
    /// `account` scopes depleted/restored state so multi-account providers do not
    /// cross-arm session transitions.
    pub fn check_session_transition(
        &mut self,
        provider: ProviderId,
        account: &str,
        current_percent: f64,
        settings: &Settings,
    ) {
        if !settings.show_notifications {
            return;
        }

        const DEPLETED_THRESHOLD: f64 = 99.99; // Consider depleted at 99.99%+

        let transition_key: SessionTransitionKey = (provider, account.to_string());
        let previous_percent = self
            .previous_session_percent
            .get(&transition_key)
            .copied()
            .unwrap_or(0.0);

        // Check for depleted transition: was not depleted, now is
        if previous_percent < DEPLETED_THRESHOLD
            && current_percent >= DEPLETED_THRESHOLD
            && settings.notification_events.session_depleted
        {
            let title =
                Self::notification_title(NotificationType::SessionDepleted, settings.ui_language);
            let body = Self::notification_body(
                provider,
                "session",
                current_percent,
                NotificationType::SessionDepleted,
                settings.ui_language,
            );
            let depleted_key = (
                provider,
                account.to_string(),
                "session".to_string(),
                NotificationType::SessionDepleted,
            );
            if self.mark_sent(depleted_key) && !Self::quiet_hours_active(settings) {
                self.show_toast(
                    &title,
                    &body,
                    NotificationDestination::Provider(provider),
                    Some(provider),
                );
                Self::play_notification_sound(NotificationSoundEvent::SessionDepleted, settings);
            }
        }
        // Check for restored transition: was depleted, now is not
        else if previous_percent >= DEPLETED_THRESHOLD && current_percent < DEPLETED_THRESHOLD {
            // Only notify restored if we previously sent a depleted notification
            let depleted_key = (
                provider,
                account.to_string(),
                "session".to_string(),
                NotificationType::SessionDepleted,
            );
            if self.was_sent(&depleted_key) {
                if settings.notification_events.session_restored
                    && !Self::quiet_hours_active(settings)
                {
                    let title = Self::notification_title(
                        NotificationType::SessionRestored,
                        settings.ui_language,
                    );
                    let body = Self::notification_body(
                        provider,
                        "session",
                        current_percent,
                        NotificationType::SessionRestored,
                        settings.ui_language,
                    );
                    self.show_toast(
                        &title,
                        &body,
                        NotificationDestination::Provider(provider),
                        Some(provider),
                    );
                    Self::play_notification_sound(
                        NotificationSoundEvent::SessionRestored,
                        settings,
                    );
                }
                self.forget_sent(&depleted_key);
            }
        }

        // Update the tracked previous percent for this account
        self.previous_session_percent
            .insert(transition_key, current_percent);
    }

    /// Send a Windows toast notification with sound
    fn send_notification(
        &self,
        provider: ProviderId,
        window: &str,
        used_percent: f64,
        notif_type: NotificationType,
        settings: &Settings,
    ) {
        if Self::quiet_hours_active(settings) {
            return;
        }
        let title = Self::notification_title(notif_type, settings.ui_language);
        let body = Self::notification_body(
            provider,
            window,
            used_percent,
            notif_type,
            settings.ui_language,
        );
        self.show_toast(
            &title,
            &body,
            Self::notification_destination(provider, notif_type),
            Some(provider),
        );
        Self::play_notification_sound(Self::sound_event_for(notif_type), settings);
    }

    fn window_label(window: &str, language: crate::settings::Language) -> Cow<'_, str> {
        match window {
            "session" => Cow::Owned(locale::get_text(language, LocaleKey::ProviderSession)),
            "fiveHour" => Cow::Owned(locale::get_text(language, LocaleKey::PanelFiveHours)),
            "weekly" => Cow::Owned(locale::get_text(language, LocaleKey::ProviderWeekly)),
            "modelSpecific" => Cow::Borrowed("model-specific"),
            "tertiary" => Cow::Borrowed("additional limit"),
            other if other.starts_with("window") && other.ends_with("Minutes") => {
                let minutes = &other[6..other.len() - 7];
                Cow::Owned(format!("{minutes}-minute"))
            }
            other if let Some(name) = other.strip_prefix("extra-") => {
                Cow::Owned(name.replace(['-', '_'], " "))
            }
            other if !other.is_empty() => Cow::Borrowed(other),
            _ => Cow::Borrowed("usage"),
        }
    }

    fn notification_body(
        provider: ProviderId,
        window: &str,
        used_percent: f64,
        notif_type: NotificationType,
        language: crate::settings::Language,
    ) -> String {
        let provider_name = provider.display_name();
        let window_label = Self::window_label(window, language);
        let quota = Self::quota_pair(used_percent, language);
        let (key, suffix) = match notif_type {
            NotificationType::HighUsage => (LocaleKey::NotificationToastHighBody, String::new()),
            NotificationType::CriticalUsage => {
                (LocaleKey::NotificationToastCriticalBody, String::new())
            }
            NotificationType::Exhausted => {
                (LocaleKey::NotificationToastExhaustedBody, String::new())
            }
            NotificationType::UsageStep(milestone) => (
                LocaleKey::NotificationToastMilestoneBody,
                format!("{milestone}%"),
            ),
            NotificationType::StatusIssue => {
                (LocaleKey::NotificationToastStatusBody, String::new())
            }
            NotificationType::SessionDepleted => (
                LocaleKey::NotificationToastSessionDepletedBody,
                String::new(),
            ),
            NotificationType::SessionRestored => (
                LocaleKey::NotificationToastSessionRestoredBody,
                String::new(),
            ),
            NotificationType::ExpectedReset(_) => {
                (LocaleKey::NotificationToastExpectedResetBody, String::new())
            }
            NotificationType::UnexpectedReset(_) => (
                LocaleKey::NotificationToastUnexpectedResetBody,
                String::new(),
            ),
            NotificationType::BankedResetCredit(available) => {
                return locale::format_locale(
                    language,
                    LocaleKey::NotificationToastBankedResetBody,
                    &[provider_name, &available.to_string()],
                );
            }
        };
        locale::format_locale(
            language,
            key,
            &[provider_name, &window_label, &quota, &suffix],
        )
    }

    fn notification_title(
        notif_type: NotificationType,
        language: crate::settings::Language,
    ) -> String {
        let key = match notif_type {
            NotificationType::HighUsage => LocaleKey::HighUsageAlert,
            NotificationType::CriticalUsage => LocaleKey::CriticalUsageAlert,
            NotificationType::Exhausted => LocaleKey::NotificationSoundEventExhausted,
            NotificationType::UsageStep(_) => LocaleKey::UsageStepNotifications,
            NotificationType::StatusIssue => LocaleKey::NotificationSoundEventStatusIssue,
            NotificationType::SessionDepleted => LocaleKey::NotificationSoundEventSessionDepleted,
            NotificationType::SessionRestored => LocaleKey::NotificationSoundEventSessionRestored,
            NotificationType::ExpectedReset(_) => LocaleKey::ExpectedResetNotifications,
            NotificationType::UnexpectedReset(_) => LocaleKey::UnexpectedResetNotifications,
            NotificationType::BankedResetCredit(_) => LocaleKey::BankedResetCreditNotifications,
        };
        locale::get_text(language, key)
    }

    fn notification_destination(
        provider: ProviderId,
        notification_type: NotificationType,
    ) -> NotificationDestination {
        match notification_type {
            NotificationType::ExpectedReset(_)
            | NotificationType::UnexpectedReset(_)
            | NotificationType::BankedResetCredit(_) => NotificationDestination::Dashboard,
            NotificationType::StatusIssue => NotificationDestination::Providers(provider),
            NotificationType::HighUsage
            | NotificationType::CriticalUsage
            | NotificationType::Exhausted
            | NotificationType::UsageStep(_)
            | NotificationType::SessionDepleted
            | NotificationType::SessionRestored => NotificationDestination::Provider(provider),
        }
    }

    fn quota_pair(used_percent: f64, language: crate::settings::Language) -> String {
        let used = used_percent.clamp(0.0, 100.0);
        format!(
            "{used:.0}% {} · {:.0}% {}",
            locale::get_text(language, LocaleKey::DetailCostUsed),
            100.0 - used,
            locale::get_text(language, LocaleKey::DetailCostRemaining),
        )
    }

    fn sound_event_for(notif_type: NotificationType) -> NotificationSoundEvent {
        match notif_type {
            NotificationType::HighUsage => NotificationSoundEvent::HighUsage,
            NotificationType::CriticalUsage => NotificationSoundEvent::CriticalUsage,
            NotificationType::Exhausted => NotificationSoundEvent::Exhausted,
            NotificationType::UsageStep(_) => NotificationSoundEvent::HighUsage,
            NotificationType::StatusIssue => NotificationSoundEvent::StatusIssue,
            NotificationType::SessionDepleted => NotificationSoundEvent::SessionDepleted,
            NotificationType::SessionRestored => NotificationSoundEvent::SessionRestored,
            NotificationType::ExpectedReset(_) => NotificationSoundEvent::ExpectedReset,
            NotificationType::UnexpectedReset(_) => NotificationSoundEvent::UnexpectedReset,
            NotificationType::BankedResetCredit(_) => NotificationSoundEvent::BankedResetCredit,
        }
    }

    fn play_notification_sound(event: NotificationSoundEvent, settings: &Settings) {
        if let Err(error) = play_alert(event, settings) {
            tracing::warn!(?event, %error, "notification sound failed to play");
        }
    }

    fn send_status_notification(
        &self,
        provider: ProviderId,
        description: &str,
        settings: &Settings,
    ) {
        if Self::quiet_hours_active(settings) {
            return;
        }
        let title = Self::notification_title(NotificationType::StatusIssue, settings.ui_language);
        let body = locale::format_locale(
            settings.ui_language,
            LocaleKey::NotificationToastStatusBody,
            &[provider.display_name(), description],
        );
        self.show_toast(
            &title,
            &body,
            NotificationDestination::Providers(provider),
            Some(provider),
        );
        Self::play_notification_sound(NotificationSoundEvent::StatusIssue, settings);
    }

    #[cfg(all(target_os = "windows", not(test)))]
    fn show_toast(
        &self,
        title: &str,
        body: &str,
        destination: NotificationDestination,
        provider: Option<ProviderId>,
    ) {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        use std::sync::Once;

        // Register our AUMID (App User Model ID) exactly once per process so that
        // CreateToastNotifier(AUMID) finds a valid registration rather than
        // silently returning a null notifier.
        static AUMID_INIT: Once = Once::new();
        AUMID_INIT.call_once(ensure_aumid_registered);

        let icon = branded_toast_icon(provider);
        let template = toast_template(title, body, icon.as_ref(), destination);

        // Uses ToastGeneric (Win 10+) and wraps in try/catch so PowerShell exits
        // with code 1 on failure rather than swallowing the error silently.
        // Single-quoted here-string (@'...'@) prevents variable expansion of the
        // XML content by PowerShell.
        let script = format!(
            r#"try {{
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $template = @'
{}
'@
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{}')
    if ($null -eq $notifier) {{ throw "CreateToastNotifier returned null" }}
    $notifier.Show($toast)
}} catch {{
    [System.Console]::Error.WriteLine("Quotalis toast failed: $_")
    exit 1
}}"#,
            template,
            crate::paths::TOAST_AUMID,
        );

        match Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &script,
            ])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
        {
            Ok(_) => tracing::debug!("Toast notification dispatched: {}", title),
            Err(e) => tracing::warn!("Failed to dispatch toast notification '{}': {}", title, e),
        }
    }

    #[cfg(all(target_os = "windows", test))]
    fn show_toast(
        &self,
        _title: &str,
        _body: &str,
        _destination: NotificationDestination,
        _provider: Option<ProviderId>,
    ) {
        // Core unit tests exercise notification state transitions. They must
        // never write AUMID/protocol registry keys or show native toasts.
    }

    #[cfg(not(target_os = "windows"))]
    fn show_toast(
        &self,
        title: &str,
        body: &str,
        _destination: NotificationDestination,
        _provider: Option<ProviderId>,
    ) {
        use std::process::Command;

        // Try notify-send first (works on most Linux distros including WSL with WSLg)
        if let Ok(output) = Command::new("notify-send")
            .args([
                "--app-name=Quotalis",
                "--icon=dialog-information",
                title,
                body,
            ])
            .output()
            && output.status.success()
        {
            tracing::debug!("Sent notification via notify-send: {}", title);
            return;
        }

        tracing::info!("Notification: {} - {}", title, body);
    }
}

fn format_duration(seconds: f64) -> String {
    // Display-only duration label; the value is ceiled to whole minutes and
    // clamped to at least 1, so only astronomically large inputs could truncate.
    #[allow(
        clippy::cast_possible_truncation,
        reason = "whole-minutes display label; ceil/max bound the value to realistic durations"
    )]
    let total_minutes = (seconds / 60.0).ceil().max(1.0) as i64;
    let days = total_minutes / 1440;
    let hours = (total_minutes % 1440) / 60;
    let minutes = total_minutes % 60;
    if days > 0 {
        format!("{days}d {hours}h")
    } else if hours > 0 {
        format!("{hours}h {minutes}m")
    } else {
        format!("{minutes}m")
    }
}

impl Default for NotificationManager {
    fn default() -> Self {
        Self::new()
    }
}

fn protocol_launch_command(executable: &Path) -> String {
    format!("\"{}\" \"%1\"", executable.to_string_lossy())
}

/// Register the stable Windows AUMID and a channel-specific notification URI
/// protocol. The internal AUMID deliberately remains unchanged for upgrade
/// continuity; only the public DisplayName is Quotalis.
/// `CreateToastNotifier(AUMID)` resolves to a valid notifier instead of returning
/// null. Safe to call multiple times (idempotent registry writes).
///
/// This function never enumerates or deletes historical keys. In particular, a
/// Dev build writes only its `.dev` AUMID and `quotalis-dev` protocol handler,
/// so it cannot mutate the co-installed Personal registration.
#[cfg(target_os = "windows")]
fn ensure_aumid_registered() {
    use winreg::RegKey;
    use winreg::enums::*;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    // HKCU\SOFTWARE\Classes\AppUserModelId\<AUMID> is the documented path for
    // registering Win32 desktop app AUMIDs without a COM server or Start Menu shortcut.
    let aumid_key = format!(
        r"SOFTWARE\Classes\AppUserModelId\{}",
        crate::paths::TOAST_AUMID
    );
    let icon_path = branded_toast_icon(None).map(|icon| icon.path);
    let aumid_result = hkcu.create_subkey(aumid_key).and_then(|(key, _)| {
        key.set_value("DisplayName", &PUBLIC_APP_NAME)?;
        key.set_value("IconBackgroundColor", &"FF10141C")?;
        if let Some(icon_path) = icon_path.as_ref() {
            let icon_path = icon_path.to_string_lossy().into_owned();
            key.set_value("IconUri", &icon_path)?;
        }
        Ok(())
    });

    match aumid_result {
        Ok(()) => tracing::debug!(
            aumid = crate::paths::TOAST_AUMID,
            "Quotalis AUMID registered for Windows notifications"
        ),
        Err(e) => tracing::warn!("Failed to register Quotalis AUMID: {}", e),
    }

    let protocol_key = format!(r"SOFTWARE\Classes\{}", notification_protocol_scheme());
    let protocol_result = std::env::current_exe().and_then(|executable| {
        let (key, _) = hkcu.create_subkey(&protocol_key)?;
        key.set_value("", &format!("URL:{PUBLIC_APP_NAME} notification link"))?;
        key.set_value("URL Protocol", &"")?;
        if let Some(icon_path) = icon_path.as_ref() {
            let icon_path = icon_path.to_string_lossy().into_owned();
            let (icon_key, _) = hkcu.create_subkey(format!(r"{protocol_key}\DefaultIcon"))?;
            icon_key.set_value("", &icon_path)?;
        }
        let (command_key, _) = hkcu.create_subkey(format!(r"{protocol_key}\shell\open\command"))?;
        command_key.set_value("", &protocol_launch_command(&executable))
    });

    match protocol_result {
        Ok(()) => tracing::debug!(
            scheme = notification_protocol_scheme(),
            "Quotalis notification protocol registered"
        ),
        Err(error) => tracing::warn!(
            scheme = notification_protocol_scheme(),
            %error,
            "failed to register Quotalis notification protocol"
        ),
    }
}

/// Simple notification function for one-off notifications
pub fn show_notification(title: &str, body: &str) {
    show_notification_to(title, body, NotificationDestination::Dashboard);
}

/// Show a one-off notification with an explicit, typed activation target.
pub fn show_notification_to(title: &str, body: &str, destination: NotificationDestination) {
    let manager = NotificationManager::new();
    let provider = match destination {
        NotificationDestination::Provider(provider)
        | NotificationDestination::Providers(provider) => Some(provider),
        NotificationDestination::Dashboard => None,
    };
    manager.show_toast(title, body, destination, provider);
}

/// Show a provider-authored notification while retaining an independent
/// activation destination. Reset events, for example, open the Dashboard but
/// still carry the provider's mark in the notification body.
pub fn show_provider_notification_to(
    title: &str,
    body: &str,
    provider: ProviderId,
    destination: NotificationDestination,
) {
    let manager = NotificationManager::new();
    manager.show_toast(title, body, destination, Some(provider));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_toast_payload_uses_provider_logo_and_typed_activation() {
        let xml = toast_template(
            "Usage < alert",
            "Claude & OpenAI",
            Some(&ToastIcon {
                path: PathBuf::from(r"C:\Program Files\A&B\quotaarc-icon-128.png"),
                alternate_text: "Claude".to_string(),
            }),
            NotificationDestination::Provider(ProviderId::Claude),
        );

        assert!(xml.contains("Usage &lt; alert"));
        assert!(xml.contains("Claude &amp; OpenAI"));
        assert!(xml.contains("placement=\"appLogoOverride\""));
        assert!(xml.contains("alt=\"Claude\""));
        assert!(xml.contains("activationType=\"protocol\""));
        assert!(xml.contains(&format!(
            "launch=\"{}://provider/claude\"",
            notification_protocol_scheme()
        )));
        assert!(xml.contains("file:///C:/Program%20Files/A&amp;B/quotaarc-icon-128.png"));
        assert!(!xml.contains("alt=\"QuotaArc\""));
        assert!(!xml.contains("alt=\"CodexBar\""));
        assert!(!xml.contains("hint-crop"));
    }

    #[test]
    fn general_toast_payload_uses_quotalis_logo() {
        let xml = toast_template(
            "Quotalis update",
            "The application is ready.",
            Some(&ToastIcon {
                path: PathBuf::from(r"C:\Users\User\Quotalis\notification-assets\quotalis.png"),
                alternate_text: PUBLIC_APP_NAME.to_string(),
            }),
            NotificationDestination::Dashboard,
        );

        assert!(xml.contains("placement=\"appLogoOverride\""));
        assert!(xml.contains("alt=\"Quotalis\""));
        assert!(xml.contains(&format!(
            "launch=\"{}://dashboard\"",
            notification_protocol_scheme()
        )));
    }

    #[test]
    fn toast_icon_handles_canonical_windows_and_unc_paths() {
        assert_eq!(
            file_uri(Path::new(r"\\?\C:\Program Files\Quotalis\icon.png")),
            "file:///C:/Program%20Files/Quotalis/icon.png"
        );
        assert_eq!(
            file_uri(Path::new(r"\\?\UNC\server\share\icon.png")),
            "file://server/share/icon.png"
        );
    }

    #[test]
    fn notification_uris_round_trip_every_registered_provider() {
        for provider in ProviderId::all() {
            for destination in [
                NotificationDestination::Provider(*provider),
                NotificationDestination::Providers(*provider),
            ] {
                let uri = notification_uri(destination);
                assert_eq!(parse_notification_uri(&uri), Some(destination));
            }
        }
        let dashboard = NotificationDestination::Dashboard;
        assert_eq!(
            parse_notification_uri(&notification_uri(dashboard)),
            Some(dashboard)
        );
    }

    #[test]
    fn notification_uri_parser_rejects_cross_channel_and_untrusted_targets() {
        let other_scheme = if crate::paths::is_dev_channel() {
            "quotalis"
        } else {
            "quotalis-dev"
        };
        assert_eq!(
            parse_notification_uri(&format!("{other_scheme}://dashboard")),
            None
        );
        assert_eq!(
            parse_notification_uri(&format!(
                "{}://provider/not-a-provider",
                notification_protocol_scheme()
            )),
            None
        );
        assert_eq!(
            parse_notification_uri(&format!(
                "{}://settings/advanced",
                notification_protocol_scheme()
            )),
            None
        );
        assert_eq!(
            parse_notification_uri(&format!(
                "{}://provider/codex/extra",
                notification_protocol_scheme()
            )),
            None
        );
    }

    #[test]
    fn notification_kinds_route_to_the_expected_product_surface() {
        assert_eq!(
            NotificationManager::notification_destination(
                ProviderId::Codex,
                NotificationType::HighUsage,
            ),
            NotificationDestination::Provider(ProviderId::Codex)
        );
        assert_eq!(
            NotificationManager::notification_destination(
                ProviderId::Claude,
                NotificationType::StatusIssue,
            ),
            NotificationDestination::Providers(ProviderId::Claude)
        );
        assert_eq!(
            NotificationManager::notification_destination(
                ProviderId::Codex,
                NotificationType::ExpectedReset(1),
            ),
            NotificationDestination::Dashboard
        );
    }

    #[test]
    fn protocol_command_quotes_executable_and_activation_uri() {
        assert_eq!(
            protocol_launch_command(Path::new(r"C:\Program Files\Quotalis\Quotalis.exe")),
            r#""C:\Program Files\Quotalis\Quotalis.exe" "%1""#
        );
    }
    use crate::core::{PaceStage, RateWindow, UsagePace};
    use chrono::{DateTime, Duration, Utc};

    #[test]
    fn notification_types_map_to_their_sound_events() {
        let mappings = [
            (
                NotificationType::HighUsage,
                NotificationSoundEvent::HighUsage,
            ),
            (
                NotificationType::CriticalUsage,
                NotificationSoundEvent::CriticalUsage,
            ),
            (
                NotificationType::Exhausted,
                NotificationSoundEvent::Exhausted,
            ),
            (
                NotificationType::StatusIssue,
                NotificationSoundEvent::StatusIssue,
            ),
            (
                NotificationType::SessionDepleted,
                NotificationSoundEvent::SessionDepleted,
            ),
            (
                NotificationType::SessionRestored,
                NotificationSoundEvent::SessionRestored,
            ),
            (
                NotificationType::ExpectedReset(1),
                NotificationSoundEvent::ExpectedReset,
            ),
            (
                NotificationType::UnexpectedReset(2),
                NotificationSoundEvent::UnexpectedReset,
            ),
            (
                NotificationType::BankedResetCredit(3),
                NotificationSoundEvent::BankedResetCredit,
            ),
        ];

        for (notification_type, sound_event) in mappings {
            assert_eq!(
                NotificationManager::sound_event_for(notification_type),
                sound_event
            );
        }
    }

    fn pace(will_last_to_reset: bool, eta_seconds: Option<f64>) -> UsagePace {
        UsagePace {
            stage: PaceStage::Ahead,
            delta_percent: 20.0,
            expected_used_percent: 40.0,
            actual_used_percent: 60.0,
            eta_seconds,
            will_last_to_reset,
        }
    }

    fn window(now: DateTime<Utc>, offset: Duration, minutes: u32) -> RateWindow {
        RateWindow::with_details(60.0, Some(minutes), Some(now + offset), None)
    }

    #[test]
    fn predictive_warning_notifies_once_until_recovery_then_rearms() {
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let window = window(now, Duration::hours(3), 300);
        let risk = pace(false, Some(3600.0));
        let recovery = pace(true, None);
        let mut manager = NotificationManager::new();

        assert!(manager.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &window,
            &risk,
        ));
        assert!(!manager.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &window,
            &risk,
        ));
        assert!(!manager.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &window,
            &recovery,
        ));
        assert!(manager.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &window,
            &risk,
        ));
    }

    #[test]
    fn predictive_warning_reset_jitter_does_not_retrigger() {
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let mut manager = NotificationManager::new();
        let risk = pace(false, Some(3600.0));

        assert!(manager.record_predictive_observation(
            true,
            ProviderId::Codex,
            "oauth:account-a",
            PredictiveWarningWindow::Weekly,
            &window(now, Duration::days(3), 10080),
            &risk,
        ));
        assert!(!manager.record_predictive_observation(
            true,
            ProviderId::Codex,
            "oauth:account-a",
            PredictiveWarningWindow::Weekly,
            &window(now, Duration::days(3) + Duration::minutes(5), 10080),
            &risk,
        ));
    }

    #[test]
    fn predictive_warning_isolates_provider_identity_source_and_window() {
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let reset = window(now, Duration::hours(3), 300);
        let risk = pace(false, Some(3600.0));
        let mut manager = NotificationManager::new();

        for (provider, identity, warning_window) in [
            (
                ProviderId::Claude,
                "cli:person@example.com",
                PredictiveWarningWindow::Session,
            ),
            (
                ProviderId::Claude,
                "oauth:person@example.com",
                PredictiveWarningWindow::Session,
            ),
            (
                ProviderId::Claude,
                "token-account:1",
                PredictiveWarningWindow::Session,
            ),
            (
                ProviderId::Claude,
                "oauth:person@example.com",
                PredictiveWarningWindow::Weekly,
            ),
            (
                ProviderId::Codex,
                "oauth:person@example.com",
                PredictiveWarningWindow::Session,
            ),
        ] {
            assert!(manager.record_predictive_observation(
                true,
                provider,
                identity,
                warning_window,
                &reset,
                &risk,
            ));
        }
    }

    #[test]
    fn predictive_warning_requires_enabled_confident_positive_risk() {
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let reset = window(now, Duration::hours(3), 300);
        let mut manager = NotificationManager::new();

        for (enabled, observation) in [
            (false, pace(false, Some(3600.0))),
            (true, pace(true, None)),
            (true, pace(false, Some(0.0))),
        ] {
            assert!(!manager.record_predictive_observation(
                enabled,
                ProviderId::Claude,
                "oauth:person@example.com",
                PredictiveWarningWindow::Session,
                &reset,
                &observation,
            ));
        }

        assert!(manager.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &reset,
            &pace(false, Some(3600.0)),
        ));
    }

    #[test]
    fn session_below_high_does_not_rearm_weekly_high_toast() {
        // Repro for #198: session cool + weekly hot on every refresh used to
        // clear all provider keys on the session call, then re-fire weekly.
        let mut manager = NotificationManager::new();
        let settings = Settings::default();
        assert!(settings.show_notifications);
        assert!((settings.high_usage_threshold - 70.0).abs() < f64::EPSILON);

        let account = "";
        let weekly_key = (
            ProviderId::Claude,
            account.to_string(),
            "weekly".to_string(),
            NotificationType::HighUsage,
        );

        manager.check_and_notify(ProviderId::Claude, account, "session", 20.0, &settings);
        manager.check_and_notify(ProviderId::Claude, account, "weekly", 76.0, &settings);
        assert!(manager.sent_notifications.contains(&weekly_key));

        // Simulate several refresh cycles: session still cool, weekly still hot.
        for _ in 0..5 {
            manager.check_and_notify(ProviderId::Claude, account, "session", 20.0, &settings);
            manager.check_and_notify(ProviderId::Claude, account, "weekly", 76.0, &settings);
        }
        assert_eq!(
            manager
                .sent_notifications
                .iter()
                .filter(|key| key == &&weekly_key)
                .count(),
            1,
            "weekly high toast must arm only once while still above threshold"
        );

        // Drop weekly below high → re-arm allowed on next climb.
        manager.check_and_notify(ProviderId::Claude, account, "weekly", 50.0, &settings);
        assert!(!manager.sent_notifications.contains(&weekly_key));
        manager.check_and_notify(ProviderId::Claude, account, "weekly", 76.0, &settings);
        assert!(manager.sent_notifications.contains(&weekly_key));
    }

    #[test]
    fn threshold_keys_isolate_session_and_weekly() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();
        let account = "";

        manager.check_and_notify(ProviderId::Claude, account, "session", 75.0, &settings);
        manager.check_and_notify(ProviderId::Claude, account, "weekly", 75.0, &settings);

        assert!(manager.sent_notifications.contains(&(
            ProviderId::Claude,
            account.to_string(),
            "session".to_string(),
            NotificationType::HighUsage,
        )));
        assert!(manager.sent_notifications.contains(&(
            ProviderId::Claude,
            account.to_string(),
            "weekly".to_string(),
            NotificationType::HighUsage,
        )));

        // Cool only session; weekly stays armed.
        manager.check_and_notify(ProviderId::Claude, account, "session", 10.0, &settings);
        assert!(!manager.sent_notifications.contains(&(
            ProviderId::Claude,
            account.to_string(),
            "session".to_string(),
            NotificationType::HighUsage,
        )));
        assert!(manager.sent_notifications.contains(&(
            ProviderId::Claude,
            account.to_string(),
            "weekly".to_string(),
            NotificationType::HighUsage,
        )));
    }

    #[test]
    fn disabled_notification_categories_do_not_arm_but_other_categories_still_work() {
        let mut manager = NotificationManager::new();
        let mut settings = Settings::default();
        settings.notification_events.high_usage = false;

        manager.check_and_notify(ProviderId::Claude, "", "weekly", 75.0, &settings);
        assert!(!manager.sent_notifications.iter().any(|key| {
            key.0 == ProviderId::Claude && key.2 == "weekly" && key.3 == NotificationType::HighUsage
        }));

        manager.check_and_notify(ProviderId::Claude, "", "weekly", 95.0, &settings);
        assert!(manager.sent_notifications.iter().any(|key| {
            key.0 == ProviderId::Claude
                && key.2 == "weekly"
                && key.3 == NotificationType::CriticalUsage
        }));
    }

    #[test]
    fn usage_step_notifications_only_fire_when_crossing_a_configured_milestone() {
        let mut manager = NotificationManager::new();
        let settings = Settings {
            usage_step_notification_percent: Some(10),
            ..Settings::default()
        };

        manager.check_and_notify(ProviderId::Claude, "account", "weekly", 21.0, &settings);
        assert!(
            !manager
                .sent_notifications
                .iter()
                .any(|key| { matches!(key.3, NotificationType::UsageStep(_)) })
        );

        manager.check_and_notify(ProviderId::Claude, "account", "weekly", 29.0, &settings);
        assert!(
            !manager
                .sent_notifications
                .iter()
                .any(|key| { matches!(key.3, NotificationType::UsageStep(_)) })
        );

        manager.check_and_notify(ProviderId::Claude, "account", "weekly", 31.0, &settings);
        assert!(manager.sent_notifications.contains(&(
            ProviderId::Claude,
            "account".to_string(),
            "weekly".to_string(),
            NotificationType::UsageStep(30),
        )));

        manager.check_and_notify(ProviderId::Claude, "account", "weekly", 31.5, &settings);
        assert_eq!(
            manager
                .sent_notifications
                .iter()
                .filter(|key| { matches!(key.3, NotificationType::UsageStep(_)) })
                .count(),
            1
        );
    }

    #[test]
    fn reset_transition_distinguishes_scheduled_and_early_resets() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();
        let start = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let scheduled_at = start + Duration::hours(1);

        manager.check_reset_transition(
            ProviderId::Claude,
            "account",
            "weekly",
            95.0,
            Some(scheduled_at),
            start,
            &settings,
        );
        manager.check_reset_transition(
            ProviderId::Claude,
            "account",
            "weekly",
            3.0,
            Some(scheduled_at + Duration::days(7)),
            scheduled_at + Duration::seconds(30),
            &settings,
        );
        assert!(
            manager
                .sent_notifications
                .iter()
                .any(|key| { matches!(key.3, NotificationType::ExpectedReset(_)) })
        );

        manager.check_reset_transition(
            ProviderId::Claude,
            "account-early",
            "weekly",
            80.0,
            Some(start + Duration::hours(4)),
            start,
            &settings,
        );
        manager.check_reset_transition(
            ProviderId::Claude,
            "account-early",
            "weekly",
            8.0,
            Some(start + Duration::hours(4)),
            start + Duration::minutes(10),
            &settings,
        );
        assert!(
            manager
                .sent_notifications
                .iter()
                .any(|key| { matches!(key.3, NotificationType::UnexpectedReset(_)) })
        );
    }

    #[test]
    fn disabled_reset_category_does_not_suppress_the_other_reset_kind() {
        let mut manager = NotificationManager::new();
        let mut settings = Settings::default();
        settings.notification_events.expected_reset = false;
        let start = DateTime::from_timestamp(1_800_000_000, 0).unwrap();

        manager.check_reset_transition(
            ProviderId::Claude,
            "a",
            "weekly",
            90.0,
            Some(start + Duration::hours(1)),
            start,
            &settings,
        );
        manager.check_reset_transition(
            ProviderId::Claude,
            "a",
            "weekly",
            1.0,
            Some(start + Duration::days(7)),
            start + Duration::hours(1),
            &settings,
        );
        assert!(
            !manager
                .sent_notifications
                .iter()
                .any(|key| matches!(key.3, NotificationType::ExpectedReset(_)))
        );

        manager.check_reset_transition(
            ProviderId::Claude,
            "b",
            "weekly",
            90.0,
            Some(start + Duration::hours(5)),
            start,
            &settings,
        );
        manager.check_reset_transition(
            ProviderId::Claude,
            "b",
            "weekly",
            1.0,
            Some(start + Duration::hours(5)),
            start + Duration::minutes(5),
            &settings,
        );
        assert!(
            manager
                .sent_notifications
                .iter()
                .any(|key| matches!(key.3, NotificationType::UnexpectedReset(_)))
        );
    }

    #[test]
    fn reset_time_jitter_without_usage_drop_is_not_a_reset() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();
        let start = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let announced = start + Duration::hours(4);

        manager.check_reset_transition(
            ProviderId::Claude,
            "account",
            "weekly",
            45.0,
            Some(announced),
            start,
            &settings,
        );
        manager.check_reset_transition(
            ProviderId::Claude,
            "account",
            "weekly",
            45.5,
            Some(announced + Duration::seconds(45)),
            start + Duration::minutes(1),
            &settings,
        );

        assert!(!manager.sent_notifications.iter().any(|key| {
            matches!(
                key.3,
                NotificationType::ExpectedReset(_) | NotificationType::UnexpectedReset(_)
            )
        }));
    }

    #[test]
    fn stale_out_of_order_sample_cannot_create_a_reset_notification() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();
        let start = DateTime::from_timestamp(1_800_000_000, 0).unwrap();

        manager.check_reset_transition(
            ProviderId::Claude,
            "account",
            "weekly",
            88.0,
            Some(start + Duration::hours(4)),
            start,
            &settings,
        );
        manager.check_reset_transition(
            ProviderId::Claude,
            "account",
            "weekly",
            2.0,
            None,
            start - Duration::minutes(1),
            &settings,
        );

        assert!(!manager.sent_notifications.iter().any(|key| {
            matches!(
                key.3,
                NotificationType::ExpectedReset(_) | NotificationType::UnexpectedReset(_)
            )
        }));
    }

    #[test]
    fn repeated_banked_inventory_count_rearms_after_a_decrease() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();
        let key = (
            ProviderId::Codex,
            "account".to_string(),
            "reset-credits".to_string(),
            NotificationType::BankedResetCredit(2),
        );
        for (index, count) in [0, 2, 0, 2].into_iter().enumerate() {
            manager.check_banked_reset_credits(
                ProviderId::Codex,
                "account",
                count,
                DateTime::from_timestamp(1_800_000_000 + i64::try_from(index).unwrap(), 0).unwrap(),
                &settings,
            );
            assert_eq!(manager.sent_notifications.contains(&key), count == 2);
        }
        let history = manager
            .notification_history()
            .unwrap()
            .page(&crate::notification_journal::NotificationQuery::default())
            .unwrap();
        assert_eq!(history.items.len(), 3);
    }

    #[test]
    fn banked_reset_credit_notifies_only_when_the_available_count_increases() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();

        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            0,
            DateTime::from_timestamp(1_800_000_000 + 1, 0).unwrap(),
            &settings,
        );
        assert!(
            !manager
                .sent_notifications
                .iter()
                .any(|key| { matches!(key.3, NotificationType::BankedResetCredit(_)) })
        );

        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            1,
            DateTime::from_timestamp(1_800_000_000 + 2, 0).unwrap(),
            &settings,
        );
        assert!(manager.sent_notifications.contains(&(
            ProviderId::Codex,
            "account".to_string(),
            "reset-credits".to_string(),
            NotificationType::BankedResetCredit(1),
        )));
        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            1,
            DateTime::from_timestamp(1_800_000_000 + 3, 0).unwrap(),
            &settings,
        );
        assert_eq!(
            manager
                .sent_notifications
                .iter()
                .filter(|key| { matches!(key.3, NotificationType::BankedResetCredit(_)) })
                .count(),
            1
        );

        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            0,
            DateTime::from_timestamp(1_800_000_000 + 4, 0).unwrap(),
            &settings,
        );
        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            2,
            DateTime::from_timestamp(1_800_000_000 + 5, 0).unwrap(),
            &settings,
        );
        assert!(manager.sent_notifications.contains(&(
            ProviderId::Codex,
            "account".to_string(),
            "reset-credits".to_string(),
            NotificationType::BankedResetCredit(2),
        )));
    }

    #[test]
    fn disabled_banked_reset_credit_keeps_observing_without_backlog_spam() {
        let mut manager = NotificationManager::new();
        let mut settings = Settings::default();
        settings.notification_events.banked_reset_credit = false;

        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            0,
            DateTime::from_timestamp(1_800_000_000 + 6, 0).unwrap(),
            &settings,
        );
        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            1,
            DateTime::from_timestamp(1_800_000_000 + 7, 0).unwrap(),
            &settings,
        );
        assert!(
            !manager
                .sent_notifications
                .iter()
                .any(|key| { matches!(key.3, NotificationType::BankedResetCredit(_)) })
        );

        settings.notification_events.banked_reset_credit = true;
        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            1,
            DateTime::from_timestamp(1_800_000_000 + 8, 0).unwrap(),
            &settings,
        );
        assert!(
            !manager
                .sent_notifications
                .iter()
                .any(|key| { matches!(key.3, NotificationType::BankedResetCredit(_)) })
        );
        manager.check_banked_reset_credits(
            ProviderId::Codex,
            "account",
            2,
            DateTime::from_timestamp(1_800_000_000 + 9, 0).unwrap(),
            &settings,
        );
        assert!(
            manager
                .sent_notifications
                .iter()
                .any(|key| { matches!(key.3, NotificationType::BankedResetCredit(2)) })
        );
    }

    #[test]
    fn notification_window_labels_are_human_readable() {
        assert_eq!(
            NotificationManager::window_label("fiveHour", crate::settings::Language::English),
            "5h"
        );
        assert_eq!(
            NotificationManager::window_label(
                "window180Minutes",
                crate::settings::Language::English
            ),
            "180-minute"
        );
        assert_eq!(
            NotificationManager::window_label(
                "extra-sonnet-45",
                crate::settings::Language::English
            ),
            "sonnet 45"
        );
    }

    #[test]
    fn notification_bodies_always_explain_used_and_remaining_quota() {
        let high = NotificationManager::notification_body(
            ProviderId::Claude,
            "fiveHour",
            82.0,
            NotificationType::HighUsage,
            crate::settings::Language::English,
        );
        assert!(high.contains("Claude"));
        assert!(high.contains("5h"));
        assert!(high.contains("82% Used · 18% Remaining"), "{high}");

        let reset = NotificationManager::notification_body(
            ProviderId::Codex,
            "weekly",
            7.0,
            NotificationType::ExpectedReset(1),
            crate::settings::Language::English,
        );
        assert!(reset.contains("7% Used · 93% Remaining"));

        let depleted = NotificationManager::notification_body(
            ProviderId::Codex,
            "session",
            100.0,
            NotificationType::SessionDepleted,
            crate::settings::Language::English,
        );
        assert!(depleted.contains("100% Used · 0% Remaining"));

        let arabic = NotificationManager::notification_body(
            ProviderId::Codex,
            "weekly",
            82.0,
            NotificationType::CriticalUsage,
            crate::settings::Language::Arabic,
        );
        assert!(arabic.contains("الأسبوعي"));
        assert!(arabic.contains("82% مستهلك · 18% متبقٍ"), "{arabic}");
    }

    /// Mirrors `notify_usage_thresholds` in the Tauri shell: each refresh
    /// calls session then weekly. Confidence pass for #198 over many cycles.
    #[test]
    fn refresh_loop_session_cool_weekly_hot_toasts_once() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();
        let account = "";
        let weekly_high = (
            ProviderId::Claude,
            account.to_string(),
            "weekly".to_string(),
            NotificationType::HighUsage,
        );

        let mut weekly_fires = 0usize;
        for _ in 0..30 {
            let before = manager.sent_notifications.contains(&weekly_high);
            // Same order as apps/desktop-tauri/.../providers.rs
            manager.check_and_notify(ProviderId::Claude, account, "session", 20.0, &settings);
            manager.check_and_notify(ProviderId::Claude, account, "weekly", 76.0, &settings);
            let after = manager.sent_notifications.contains(&weekly_high);
            if after && !before {
                weekly_fires += 1;
            }
        }

        assert_eq!(
            weekly_fires, 1,
            "weekly high must fire exactly once across 30 refresh cycles"
        );
        assert!(manager.sent_notifications.contains(&weekly_high));
        // Session never armed high while cool.
        assert!(!manager.sent_notifications.contains(&(
            ProviderId::Claude,
            account.to_string(),
            "session".to_string(),
            NotificationType::HighUsage,
        )));
    }

    #[test]
    fn threshold_keys_isolate_accounts_on_same_provider() {
        // Two accounts on the same provider can each fire High once for weekly.
        let mut manager = NotificationManager::new();
        let settings = Settings::default();

        let key_a = (
            ProviderId::Claude,
            "account-a".to_string(),
            "weekly".to_string(),
            NotificationType::HighUsage,
        );
        let key_b = (
            ProviderId::Claude,
            "account-b".to_string(),
            "weekly".to_string(),
            NotificationType::HighUsage,
        );

        manager.check_and_notify(ProviderId::Claude, "account-a", "weekly", 80.0, &settings);
        manager.check_and_notify(ProviderId::Claude, "account-b", "weekly", 80.0, &settings);

        assert!(manager.sent_notifications.contains(&key_a));
        assert!(manager.sent_notifications.contains(&key_b));

        // Re-poll both still hot: neither re-fires (still armed, no second insert).
        manager.check_and_notify(ProviderId::Claude, "account-a", "weekly", 80.0, &settings);
        manager.check_and_notify(ProviderId::Claude, "account-b", "weekly", 80.0, &settings);
        assert_eq!(
            manager
                .sent_notifications
                .iter()
                .filter(|k| k.0 == ProviderId::Claude
                    && k.2 == "weekly"
                    && k.3 == NotificationType::HighUsage)
                .count(),
            2
        );
    }

    #[test]
    fn account_a_session_cool_does_not_clear_account_b_weekly() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();

        let key_b_weekly = (
            ProviderId::Claude,
            "account-b".to_string(),
            "weekly".to_string(),
            NotificationType::HighUsage,
        );

        manager.check_and_notify(ProviderId::Claude, "account-b", "weekly", 80.0, &settings);
        assert!(manager.sent_notifications.contains(&key_b_weekly));

        // Account A session cool must not clear account B weekly armed state.
        manager.check_and_notify(ProviderId::Claude, "account-a", "session", 10.0, &settings);
        assert!(
            manager.sent_notifications.contains(&key_b_weekly),
            "account A session cool must not clear account B weekly threshold key"
        );

        // Account A weekly cool must also not clear account B.
        manager.check_and_notify(ProviderId::Claude, "account-a", "weekly", 10.0, &settings);
        assert!(manager.sent_notifications.contains(&key_b_weekly));
    }

    #[test]
    fn session_transition_isolates_accounts() {
        let mut manager = NotificationManager::new();
        let settings = Settings::default();

        let depleted_a = (
            ProviderId::Claude,
            "account-a".to_string(),
            "session".to_string(),
            NotificationType::SessionDepleted,
        );
        let depleted_b = (
            ProviderId::Claude,
            "account-b".to_string(),
            "session".to_string(),
            NotificationType::SessionDepleted,
        );

        manager.check_session_transition(ProviderId::Claude, "account-a", 50.0, &settings);
        manager.check_session_transition(ProviderId::Claude, "account-a", 100.0, &settings);
        assert!(manager.sent_notifications.contains(&depleted_a));
        assert!(!manager.sent_notifications.contains(&depleted_b));

        // Account B still has quota; restoring A must not affect B's lane.
        manager.check_session_transition(ProviderId::Claude, "account-b", 40.0, &settings);
        manager.check_session_transition(ProviderId::Claude, "account-a", 20.0, &settings);
        assert!(!manager.sent_notifications.contains(&depleted_a));
        assert!(!manager.sent_notifications.contains(&depleted_b));

        // Account B can still fire depleted independently.
        manager.check_session_transition(ProviderId::Claude, "account-b", 100.0, &settings);
        assert!(manager.sent_notifications.contains(&depleted_b));
    }

    #[test]
    fn threshold_dedupe_survives_restart_without_persisting_account_identity() {
        let temp = tempfile::tempdir().expect("create notification state directory");
        let path = temp.path().join("notification-dedupe.json");
        let settings = Settings::default();
        let key = (
            ProviderId::Claude,
            "person@example.com".to_string(),
            "weekly".to_string(),
            NotificationType::HighUsage,
        );

        let mut first = NotificationManager::new();
        first.check_and_notify(
            ProviderId::Claude,
            "person@example.com",
            "weekly",
            80.0,
            &settings,
        );
        first.persist_to(&path).expect("persist notification state");

        let serialized = std::fs::read_to_string(&path).expect("read notification state");
        assert!(!serialized.contains("person@example.com"));
        let mut restored = NotificationManager::load_from(&path);
        assert!(restored.was_sent(&key));

        restored.check_and_notify(
            ProviderId::Claude,
            "person@example.com",
            "weekly",
            10.0,
            &settings,
        );
        assert!(!restored.was_sent(&key));
    }

    #[test]
    fn corrupt_persisted_dedupe_state_fails_closed_to_an_empty_manager() {
        let temp = tempfile::tempdir().expect("create notification state directory");
        let path = temp.path().join("notification-dedupe.json");
        std::fs::write(&path, "not-json").expect("write corrupt state");

        let manager = NotificationManager::load_from(&path);

        assert!(manager.sent_notifications.is_empty());
        assert!(manager.durable_sent_notifications.is_empty());
    }

    #[test]
    fn predictive_dedupe_survives_restart_and_rearms_after_recovery() {
        let temp = tempfile::tempdir().expect("create notification state directory");
        let path = temp.path().join("notification-dedupe.json");
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let rate_window = window(now, Duration::hours(3), 300);
        let risk = pace(false, Some(3600.0));
        let recovery = pace(true, None);

        let mut first = NotificationManager::new();
        assert!(first.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &rate_window,
            &risk,
        ));
        first.persist_to(&path).expect("persist predictive state");

        let serialized = std::fs::read_to_string(&path).expect("read predictive state");
        assert!(!serialized.contains("person@example.com"));
        let mut restored = NotificationManager::load_from(&path);
        assert!(!restored.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &rate_window,
            &risk,
        ));
        assert!(!restored.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &rate_window,
            &recovery,
        ));
        assert!(restored.record_predictive_observation(
            true,
            ProviderId::Claude,
            "oauth:person@example.com",
            PredictiveWarningWindow::Session,
            &rate_window,
            &risk,
        ));
    }
}
