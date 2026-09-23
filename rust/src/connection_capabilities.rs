//! One derived, machine-readable connection-capability model per provider.
//!
//! This is not a second provider registry. Every fact here is derived from the
//! registries that already govern behaviour -- `ProviderId::cookie_domain()`,
//! `settings::get_api_key_providers()`, `TokenAccountSupport::for_provider()`,
//! the `Provider` trait's `supports_*` answers, `profiles::account_capabilities`
//! and `token_periods::token_source` -- plus one curated table of official CLI
//! dependencies (`CLI_DEPENDENCIES`) that did not exist anywhere before.
//! The UI never branches on provider ids for onboarding; it reads this model.

use crate::core::{ProviderId, TokenAccountSupport, TokenInjection, instantiate_provider};
use crate::profiles::account_capabilities;
use crate::settings::get_api_key_providers;
use crate::token_periods::token_source;
use serde::{Deserialize, Serialize};

/// A way a provider can be connected. Only methods a provider genuinely
/// supports are ever offered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionMethod {
    /// A provider-issued key or token entered by the user.
    ApiKey,
    /// A signed-in browser session, imported from a local browser profile or
    /// pasted as a cookie header for the provider's own domain.
    BrowserSession,
    /// The provider's official CLI, which owns the sign-in and session files.
    CliSession,
    /// The provider's own OAuth device flow, driven from Quotalis.
    DeviceFlow,
    /// Reuse an existing local application session; the adapter may fetch usage remotely.
    LocalScanner,
    /// An unauthenticated loopback gateway on this machine.
    LocalGateway,
}

impl ConnectionMethod {
    pub const fn key(self) -> &'static str {
        match self {
            Self::ApiKey => "apiKey",
            Self::BrowserSession => "browserSession",
            Self::CliSession => "cliSession",
            Self::DeviceFlow => "deviceFlow",
            Self::LocalScanner => "localScanner",
            Self::LocalGateway => "localGateway",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MethodRank {
    Recommended,
    Alternative,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodOffer {
    pub method: ConnectionMethod,
    pub rank: MethodRank,
    /// Environment variable Quotalis also honours for this key (informational).
    pub env_var: Option<&'static str>,
    /// The single provider domain a browser session is read from.
    pub browser_domain: Option<&'static str>,
    /// Official page where the user obtains a key or signs in (curated metadata).
    pub help_url: Option<&'static str>,
}

/// How a missing official CLI may be installed. Only curated, official
/// sources; anything else is manual-only with an official instructions URL.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum InstallPolicy {
    /// `winget install --id <id> --exact`.
    Winget { id: &'static str },
    /// `npm install -g <package>`.
    Npm { package: &'static str },
    /// No safe automated source; open the official instructions.
    ManualOnly,
}

/// How an installed CLI's sign-in state is detected without executing it
/// interactively.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionDetection {
    /// A provider-owned credential file exists and is readable.
    AuthFile,
    /// A safe, non-interactive CLI status command.
    StatusCommand,
    /// The usage fetch itself is the only proof.
    UsageFetch,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliDependency {
    pub provider: ProviderId,
    /// Official product name.
    pub tool: &'static str,
    /// Executable names, in resolution order (Windows extensions added by the resolver).
    pub executables: &'static [&'static str],
    pub version_args: &'static [&'static str],
    /// Lowest version Quotalis has verified against; `None` = any.
    pub min_version: Option<&'static str>,
    pub install: InstallPolicy,
    /// Whether the curated install path is expected to prompt for elevation.
    pub install_requires_admin: bool,
    pub docs_url: &'static str,
    pub session_detection: SessionDetection,
    /// Non-interactive sign-in instruction shown after installation.
    pub sign_in_hint: &'static str,
}

/// Curated official CLI dependencies. Every entry needs detection, version
/// handling, an install policy, official metadata and a verification strategy;
/// `cli_dependency_entries_are_complete` enforces it.
pub const CLI_DEPENDENCIES: &[CliDependency] = &[
    CliDependency {
        provider: ProviderId::Codex,
        tool: "OpenAI Codex CLI",
        executables: &["codex"],
        version_args: &["--version"],
        min_version: None,
        install: InstallPolicy::Npm {
            package: "@openai/codex",
        },
        install_requires_admin: false,
        docs_url: "https://github.com/openai/codex",
        session_detection: SessionDetection::AuthFile,
        sign_in_hint: "codex login",
    },
    CliDependency {
        provider: ProviderId::Claude,
        tool: "Claude Code",
        executables: &["claude"],
        version_args: &["--version"],
        min_version: None,
        install: InstallPolicy::Npm {
            package: "@anthropic-ai/claude-code",
        },
        install_requires_admin: false,
        docs_url: "https://code.claude.com/docs/en/setup",
        session_detection: SessionDetection::AuthFile,
        sign_in_hint: "claude",
    },
    CliDependency {
        provider: ProviderId::Gemini,
        tool: "Gemini CLI",
        executables: &["gemini"],
        version_args: &["--version"],
        min_version: None,
        install: InstallPolicy::Npm {
            package: "@google/gemini-cli",
        },
        install_requires_admin: false,
        docs_url: "https://github.com/google-gemini/gemini-cli",
        session_detection: SessionDetection::AuthFile,
        sign_in_hint: "gemini",
    },
    CliDependency {
        provider: ProviderId::Copilot,
        tool: "GitHub CLI",
        executables: &["gh"],
        version_args: &["--version"],
        min_version: None,
        install: InstallPolicy::Winget { id: "GitHub.cli" },
        install_requires_admin: false,
        docs_url: "https://cli.github.com/",
        session_detection: SessionDetection::StatusCommand,
        sign_in_hint: "gh auth login",
    },
    CliDependency {
        provider: ProviderId::VertexAI,
        tool: "Google Cloud CLI",
        executables: &["gcloud"],
        version_args: &["--version"],
        min_version: None,
        install: InstallPolicy::Winget {
            id: "Google.CloudSDK",
        },
        install_requires_admin: true,
        docs_url: "https://cloud.google.com/sdk/docs/install",
        session_detection: SessionDetection::AuthFile,
        sign_in_hint: "gcloud auth application-default login",
    },
    CliDependency {
        provider: ProviderId::Kiro,
        tool: "Kiro CLI",
        executables: &["kiro-cli"],
        version_args: &["--version"],
        min_version: None,
        install: InstallPolicy::ManualOnly,
        install_requires_admin: false,
        docs_url: "https://kiro.dev/docs/cli/",
        session_detection: SessionDetection::UsageFetch,
        sign_in_hint: "kiro-cli login",
    },
    CliDependency {
        provider: ProviderId::Grok,
        tool: "Grok CLI",
        executables: &["grok"],
        version_args: &["--version"],
        min_version: None,
        install: InstallPolicy::ManualOnly,
        install_requires_admin: false,
        docs_url: "https://x.ai/",
        session_detection: SessionDetection::AuthFile,
        sign_in_hint: "grok login",
    },
    CliDependency {
        provider: ProviderId::Doubao,
        tool: "Volcengine Ark CLI",
        executables: &["arkcli"],
        version_args: &["--version"],
        min_version: None,
        install: InstallPolicy::ManualOnly,
        install_requires_admin: false,
        docs_url: "https://www.volcengine.com/docs/82379",
        session_detection: SessionDetection::UsageFetch,
        sign_in_hint: "arkcli auth login",
    },
];

pub fn cli_dependency(provider: ProviderId) -> Option<&'static CliDependency> {
    CLI_DEPENDENCIES.iter().find(|d| d.provider == provider)
}

/// A concrete, shell-free install command: program plus argument vector, built
/// only from curated constants (never from provider or user text).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan {
    pub program: &'static str,
    pub args: Vec<&'static str>,
    pub requires_admin: bool,
    pub package_manager: &'static str,
    pub package: &'static str,
}

pub fn install_plan(dependency: &CliDependency) -> Option<InstallPlan> {
    match dependency.install {
        InstallPolicy::Winget { id } => Some(InstallPlan {
            program: "winget",
            args: vec![
                "install",
                "--id",
                id,
                "--exact",
                "--accept-source-agreements",
                "--accept-package-agreements",
                "--disable-interactivity",
            ],
            requires_admin: dependency.install_requires_admin,
            package_manager: "winget",
            package: id,
        }),
        InstallPolicy::Npm { package } => Some(InstallPlan {
            program: "npm",
            args: vec!["install", "-g", package],
            requires_admin: dependency.install_requires_admin,
            package_manager: "npm",
            package,
        }),
        InstallPolicy::ManualOnly => None,
    }
}

/// How Quotalis proves a connection works. Authentication succeeding is never
/// treated as proof; the strategy names the read-only operation used.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum VerificationStrategy {
    /// No read-only usage source can currently verify this provider.
    Unavailable,
    /// The provider's normal read-only usage fetch (the smallest safe read).
    UsageFetch,
    /// Presence and readability of local application data.
    LocalDetection,
    /// A loopback gateway probe.
    GatewayProbe,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SupportStatus {
    Supported,
    Deprecated,
    /// Auto-detected local data only; nothing to connect.
    AutoDetected,
    Unsupported,
}

/// Evidence needed before a reporting feature can be claimed. A shared
/// snapshot field is not proof that a particular adapter/account populates it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReportingEvidence {
    InspectProviderResponse,
    ClassifyProviderResponse,
}

/// Structural reporting contract, separate from observed verification data.
/// Never import optimistic legacy account flags here: they assume resets for
/// every provider and conflate credits with monetary costs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportingCapabilities {
    pub quota_windows: ReportingEvidence,
    pub reset_times: ReportingEvidence,
    pub monetary_observations: ReportingEvidence,
    /// Local token history (Codex sessions, Claude transcripts) exists for this provider.
    pub local_tokens: bool,
    /// Plan names require response evidence; never inferred from credentials.
    pub plan_name: ReportingEvidence,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectionCapabilities {
    pub provider: ProviderId,
    pub display_name: &'static str,
    pub status: SupportStatus,
    pub methods: Vec<MethodOffer>,
    pub cli: Option<&'static CliDependency>,
    pub verification: VerificationStrategy,
    pub reporting: ReportingCapabilities,
    pub dashboard_url: Option<&'static str>,
    pub status_page_url: Option<&'static str>,
}

impl ProviderConnectionCapabilities {
    pub fn recommended(&self) -> Option<ConnectionMethod> {
        self.methods
            .iter()
            .find(|m| m.rank == MethodRank::Recommended)
            .map(|m| m.method)
    }

    pub fn supports(&self, method: ConnectionMethod) -> bool {
        self.methods.iter().any(|m| m.method == method)
    }
}

const LOCAL_SCANNER_PROVIDERS: &[ProviderId] = &[
    ProviderId::Windsurf,
    ProviderId::JetBrains,
    ProviderId::Antigravity,
    ProviderId::Cursor,
];

/// Providers whose sign-in Quotalis supervises through the CLI (`login.rs`).
const CLI_LOGIN_SUPERVISED: &[ProviderId] =
    &[ProviderId::Codex, ProviderId::Claude, ProviderId::Kiro];

/// Providers whose CLI owns sign-in: the supervised logins above plus CLIs
/// whose credential file or status command the adapter reads directly.
fn cli_owns_sign_in(provider: ProviderId) -> bool {
    // Its current adapter probes gcloud/project metadata, not a measured
    // Vertex usage source. Installation/sign-in cannot verify a usage link.
    if provider == ProviderId::VertexAI {
        return false;
    }
    cli_dependency(provider).is_some_and(|d| {
        CLI_LOGIN_SUPERVISED.contains(&provider)
            || d.session_detection != SessionDetection::UsageFetch
            || provider == ProviderId::Doubao
    })
}

pub fn connection_capabilities(provider: ProviderId) -> ProviderConnectionCapabilities {
    let instance = instantiate_provider(provider);
    let metadata = instance.metadata().clone();
    let account = account_capabilities(provider);
    let api_key = get_api_key_providers()
        .into_iter()
        .find(|p| p.id == provider);
    let token_env = TokenAccountSupport::for_provider(provider).and_then(|s| match s.injection {
        TokenInjection::Environment { key } => Some(key),
        TokenInjection::CookieHeader => None,
    });
    let mut methods = Vec::new();

    if provider == ProviderId::Copilot {
        methods.push(MethodOffer {
            method: ConnectionMethod::DeviceFlow,
            rank: MethodRank::Recommended,
            env_var: None,
            browser_domain: None,
            help_url: Some("https://github.com/features/copilot"),
        });
    }
    if cli_owns_sign_in(provider) {
        methods.push(MethodOffer {
            method: ConnectionMethod::CliSession,
            rank: if methods.is_empty() {
                MethodRank::Recommended
            } else {
                MethodRank::Alternative
            },
            env_var: None,
            browser_domain: None,
            help_url: cli_dependency(provider).map(|d| d.docs_url),
        });
    }
    if provider == ProviderId::Wayfinder {
        methods.push(MethodOffer {
            method: ConnectionMethod::LocalGateway,
            rank: MethodRank::Recommended,
            env_var: None,
            browser_domain: None,
            help_url: None,
        });
    }
    let key_env: Option<&'static str> = api_key
        .as_ref()
        .and_then(|p| p.api_key_env_var)
        .or_else(|| token_env.as_deref().map(|s| leak_static(s)));
    if api_key.is_some() || token_env.is_some() || account.supports_api_key {
        methods.push(MethodOffer {
            method: ConnectionMethod::ApiKey,
            rank: if methods.is_empty() {
                MethodRank::Recommended
            } else {
                MethodRank::Alternative
            },
            env_var: key_env,
            browser_domain: None,
            help_url: api_key
                .as_ref()
                .and_then(|p| p.dashboard_url)
                .or(metadata.dashboard_url),
        });
    }
    // A historical cookie domain is not proof of a browser transport. Some
    // adapters retain domains but only read CLI/local state; LongCat declares
    // its working Web source without overriding supports_web().
    if let Some(domain) = provider.cookie_domain()
        && (instance.supports_web()
            || instance
                .available_sources()
                .contains(&crate::core::SourceMode::Web))
    {
        methods.push(MethodOffer {
            method: ConnectionMethod::BrowserSession,
            rank: if methods.is_empty() {
                MethodRank::Recommended
            } else {
                MethodRank::Alternative
            },
            env_var: None,
            browser_domain: Some(domain),
            help_url: metadata.dashboard_url,
        });
    }
    if LOCAL_SCANNER_PROVIDERS.contains(&provider) {
        methods.push(MethodOffer {
            method: ConnectionMethod::LocalScanner,
            rank: if methods.is_empty() {
                MethodRank::Recommended
            } else {
                MethodRank::Alternative
            },
            env_var: None,
            browser_domain: None,
            help_url: metadata.dashboard_url,
        });
    }
    // Exactly one recommendation, even when the first candidate was demoted.
    if !methods.iter().any(|m| m.rank == MethodRank::Recommended)
        && let Some(first) = methods.first_mut()
    {
        first.rank = MethodRank::Recommended;
    }
    let mut seen = std::collections::HashSet::new();
    methods.retain(|m| seen.insert(m.method));
    let verification = match provider {
        ProviderId::VertexAI => VerificationStrategy::Unavailable,
        ProviderId::Wayfinder => VerificationStrategy::GatewayProbe,
        ProviderId::Windsurf | ProviderId::JetBrains => VerificationStrategy::LocalDetection,
        _ => VerificationStrategy::UsageFetch,
    };
    let status = if provider.is_deprecated() {
        SupportStatus::Deprecated
    } else if methods.is_empty() {
        SupportStatus::Unsupported
    } else if methods
        .iter()
        .all(|m| m.method == ConnectionMethod::LocalScanner)
    {
        SupportStatus::AutoDetected
    } else {
        SupportStatus::Supported
    };
    ProviderConnectionCapabilities {
        provider,
        display_name: metadata.display_name,
        status,
        methods,
        cli: cli_dependency(provider),
        verification,
        reporting: ReportingCapabilities {
            quota_windows: ReportingEvidence::InspectProviderResponse,
            reset_times: ReportingEvidence::InspectProviderResponse,
            monetary_observations: ReportingEvidence::ClassifyProviderResponse,
            local_tokens: token_source(provider.cli_name()).is_some(),
            plan_name: ReportingEvidence::InspectProviderResponse,
        },
        dashboard_url: metadata.dashboard_url,
        status_page_url: metadata.status_page_url,
    }
}

/// Environment-variable names from `TokenAccountSupport` are owned `String`s
/// built from constants; interning them keeps the capability model `'static`.
fn leak_static(value: &str) -> &'static str {
    use std::collections::HashSet;
    use std::sync::{Mutex, OnceLock};
    static INTERNED: OnceLock<Mutex<HashSet<&'static str>>> = OnceLock::new();
    let set = INTERNED.get_or_init(|| Mutex::new(HashSet::new()));
    let mut guard = set.lock().expect("intern set");
    if let Some(existing) = guard.get(value) {
        return existing;
    }
    let leaked: &'static str = Box::leak(value.to_string().into_boxed_str());
    guard.insert(leaked);
    leaked
}

pub fn all_connection_capabilities() -> Vec<ProviderConnectionCapabilities> {
    ProviderId::all()
        .iter()
        .map(|p| connection_capabilities(*p))
        .collect()
}

/// One row per real provider, for `docs/validation/PROVIDER_CONNECTION_CAPABILITY_MATRIX.json`.
pub fn capability_matrix_json() -> serde_json::Value {
    let rows: Vec<serde_json::Value> = all_connection_capabilities()
        .iter()
        .map(|c| {
            serde_json::json!({
                "provider": c.provider.cli_name(),
                "displayName": c.display_name,
                "status": c.status,
                "iconSource": {"registry": "apps/desktop-tauri/src/components/providers/providerIcons.ts", "key": c.provider.cli_name()},
                "adapterSource": {"factory": "quotalis_core::core::instantiate_provider", "id": c.provider.cli_name()},
                "supportedQuotaWindows": null,
                "quotaWindowEvidence": "Dynamic adapter response; no universal static window promise",
                "resetSource": "Valid timestamp in a non-informational quota row of a verified provider response",
                "tokenSource": token_source(c.provider.cli_name()).map(|_| "device-local scanner"),
                "planSource": "Provider-reported plan when present; never inferred from a credential",
                "liveVerification": "NOT VERIFIED",
                "fixtureCoverage": "method rendering plus connection-state scenarios; not real authentication",
                "localSessionReader": LOCAL_SCANNER_PROVIDERS.contains(&c.provider),
                "methods": c.methods.iter().map(|m| serde_json::json!({
                    "method": m.method, "rank": m.rank, "envVar": m.env_var,
                    "browserDomain": m.browser_domain, "helpUrl": m.help_url,
                })).collect::<Vec<_>>(),
                "cli": c.cli.map(|d| serde_json::json!({
                    "automatedInstallAvailable": false,
                    "managedLogin": CLI_LOGIN_SUPERVISED.contains(&c.provider),
                    "tool": d.tool, "executables": d.executables, "install": d.install,
                    "installRequiresAdmin": d.install_requires_admin, "docsUrl": d.docs_url,
                    "sessionDetection": d.session_detection, "minVersion": d.min_version,
                })),
                "verification": c.verification,
                "reporting": c.reporting,
                "dashboardUrl": c.dashboard_url,
                "statusPageUrl": c.status_page_url,
            })
        })
        .collect();
    serde_json::json!({
        "schemaVersion": 2,
        "source": "quotalis_core::connection_capabilities::capability_matrix_json (derived from the live registry; regenerate with QUOTALIS_WRITE_CAPABILITY_MATRIX=1 cargo test -p quotalis_core capability_matrix_json_is_current)",
        "providerCount": rows.len(),
        "providers": rows,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn every_registry_provider_has_exactly_one_capability_entry_and_no_orphans() {
        let all = all_connection_capabilities();
        assert_eq!(all.len(), ProviderId::all().len());
        let ids: HashSet<_> = all.iter().map(|c| c.provider).collect();
        assert_eq!(ids.len(), ProviderId::all().len());
        for dependency in CLI_DEPENDENCIES {
            assert!(
                ids.contains(&dependency.provider),
                "orphan CLI entry {:?}",
                dependency.provider
            );
        }
    }

    #[test]
    fn no_provider_silently_gets_generic_onboarding() {
        for c in all_connection_capabilities() {
            assert!(
                !c.methods.is_empty() || c.status == SupportStatus::Unsupported,
                "{} has no declared onboarding metadata",
                c.provider.cli_name()
            );
            if c.status != SupportStatus::Unsupported {
                assert_eq!(
                    c.methods
                        .iter()
                        .filter(|m| m.rank == MethodRank::Recommended)
                        .count(),
                    1,
                    "{} must have exactly one recommended method",
                    c.provider.cli_name()
                );
            }
            let unique: HashSet<_> = c.methods.iter().map(|m| m.method).collect();
            assert_eq!(unique.len(), c.methods.len(), "{}", c.provider.cli_name());
        }
        // Every unsupported row must be an explicit, reviewed exception.
        let unsupported: Vec<_> = all_connection_capabilities()
            .into_iter()
            .filter(|c| c.status == SupportStatus::Unsupported)
            .map(|c| c.provider.cli_name())
            .collect();
        assert_eq!(unsupported, vec![ProviderId::VertexAI.cli_name()]);
    }

    #[test]
    fn methods_are_derived_from_real_registries_never_invented() {
        for c in all_connection_capabilities() {
            for m in &c.methods {
                match m.method {
                    ConnectionMethod::BrowserSession => {
                        assert_eq!(m.browser_domain, c.provider.cookie_domain());
                    }
                    ConnectionMethod::DeviceFlow => assert_eq!(c.provider, ProviderId::Copilot),
                    ConnectionMethod::LocalGateway => assert_eq!(c.provider, ProviderId::Wayfinder),
                    ConnectionMethod::CliSession => assert!(c.cli.is_some()),
                    ConnectionMethod::ApiKey => assert!(
                        get_api_key_providers().iter().any(|p| p.id == c.provider)
                            || TokenAccountSupport::for_provider(c.provider).is_some_and(
                                |support| matches!(
                                    support.injection,
                                    TokenInjection::Environment { .. }
                                )
                            )
                            || account_capabilities(c.provider).supports_api_key
                    ),
                    ConnectionMethod::LocalScanner => {
                        assert!(LOCAL_SCANNER_PROVIDERS.contains(&c.provider));
                    }
                }
            }
        }
        // No provider offers an OAuth flow Quotalis owns: only GitHub's device flow exists.
        assert!(
            !connection_capabilities(ProviderId::OpenRouter).supports(ConnectionMethod::DeviceFlow)
        );
        assert_eq!(
            connection_capabilities(ProviderId::Copilot).recommended(),
            Some(ConnectionMethod::DeviceFlow)
        );
        assert_eq!(
            connection_capabilities(ProviderId::Codex).recommended(),
            Some(ConnectionMethod::CliSession)
        );
        assert_eq!(
            connection_capabilities(ProviderId::OpenRouter).recommended(),
            Some(ConnectionMethod::ApiKey)
        );
        assert_eq!(
            connection_capabilities(ProviderId::Amp).recommended(),
            Some(ConnectionMethod::ApiKey)
        );
        assert!(
            !connection_capabilities(ProviderId::Amp).supports(ConnectionMethod::BrowserSession)
        );
        assert!(!connection_capabilities(ProviderId::Amp).supports(ConnectionMethod::CliSession));
        assert_eq!(
            connection_capabilities(ProviderId::Perplexity).recommended(),
            Some(ConnectionMethod::BrowserSession)
        );
        assert_eq!(
            connection_capabilities(ProviderId::Windsurf).status,
            SupportStatus::AutoDetected
        );
        assert_eq!(
            connection_capabilities(ProviderId::Wayfinder).verification,
            VerificationStrategy::GatewayProbe
        );
        assert_eq!(
            connection_capabilities(ProviderId::KimiK2).status,
            SupportStatus::Deprecated
        );
    }

    #[test]
    fn alibaba_and_mistral_offer_only_recommended_browser_sessions() {
        for (provider, domain) in [
            (ProviderId::Alibaba, "modelstudio.console.alibabacloud.com"),
            (ProviderId::Mistral, "admin.mistral.ai"),
        ] {
            let capability = connection_capabilities(provider);
            assert_eq!(capability.methods.len(), 1, "{provider}");
            assert_eq!(
                capability.recommended(),
                Some(ConnectionMethod::BrowserSession),
                "{provider}"
            );
            assert_eq!(capability.methods[0].browser_domain, Some(domain));
            assert!(matches!(
                TokenAccountSupport::for_provider(provider)
                    .expect("cookie-backed providers retain stored token support")
                    .injection,
                TokenInjection::CookieHeader
            ));
        }
    }

    #[test]
    fn doubao_offers_the_read_only_cli_usage_route() {
        let capability = connection_capabilities(ProviderId::Doubao);
        assert!(capability.supports(ConnectionMethod::CliSession));
        assert!(capability.supports(ConnectionMethod::ApiKey));
        assert!(!capability.supports(ConnectionMethod::BrowserSession));
    }

    #[test]
    fn vertex_ai_project_metadata_is_not_an_onboarding_usage_method() {
        let capability = connection_capabilities(ProviderId::VertexAI);
        assert_eq!(capability.status, SupportStatus::Unsupported);
        assert!(capability.methods.is_empty());
        assert_eq!(capability.verification, VerificationStrategy::Unavailable);
    }

    #[test]
    fn browser_offers_require_a_real_web_transport_not_just_a_domain() {
        let invalid: Vec<_> = all_connection_capabilities()
            .into_iter()
            .filter(|capability| capability.supports(ConnectionMethod::BrowserSession))
            .filter(|capability| {
                let adapter = instantiate_provider(capability.provider);
                !adapter.supports_web()
                    && !adapter
                        .available_sources()
                        .contains(&crate::core::SourceMode::Web)
            })
            .map(|capability| capability.provider.cli_name())
            .collect();
        assert!(
            invalid.is_empty(),
            "Browser offers without a web adapter: {invalid:?}"
        );
        for provider in [
            ProviderId::Codex,
            ProviderId::Gemini,
            ProviderId::Kiro,
            ProviderId::Antigravity,
        ] {
            assert!(!connection_capabilities(provider).supports(ConnectionMethod::BrowserSession));
        }
        assert!(
            connection_capabilities(ProviderId::LongCat).supports(ConnectionMethod::BrowserSession)
        );
    }

    #[test]
    fn cli_dependency_entries_are_complete() {
        let mut seen = HashSet::new();
        for d in CLI_DEPENDENCIES {
            assert!(
                seen.insert(d.provider),
                "duplicate CLI entry {:?}",
                d.provider
            );
            assert!(!d.tool.is_empty() && !d.executables.is_empty() && !d.version_args.is_empty());
            assert!(d.docs_url.starts_with("https://"), "{}", d.tool);
            assert!(!d.sign_in_hint.is_empty());
            for exe in d.executables {
                assert!(
                    exe.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'),
                    "{exe}"
                );
            }
            match d.install {
                InstallPolicy::Winget { id } => {
                    assert!(id.chars().all(|c| c.is_ascii_alphanumeric() || c == '.'))
                }
                InstallPolicy::Npm { package } => assert!(
                    package
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || "@/-.".contains(c))
                ),
                InstallPolicy::ManualOnly => {}
            }
        }
    }

    #[test]
    fn install_plans_are_argument_vectors_from_constants_only() {
        let mut automated = 0;
        for d in CLI_DEPENDENCIES {
            let Some(plan) = install_plan(d) else {
                assert_eq!(d.install, InstallPolicy::ManualOnly);
                continue;
            };
            automated += 1;
            assert!(["winget", "npm"].contains(&plan.program));
            for arg in &plan.args {
                assert!(
                    !arg.contains(['|', '&', ';', '$', '`', '"', '\'', '\n']),
                    "{arg}"
                );
                assert!(!arg.contains(char::is_whitespace), "{arg}");
            }
            assert!(plan.args.contains(&plan.package));
            assert_eq!(plan.requires_admin, d.install_requires_admin);
        }
        assert_eq!(automated, 5);
    }

    #[test]
    fn reporting_flags_preserve_data_semantics() {
        let codex = connection_capabilities(ProviderId::Codex);
        let claude = connection_capabilities(ProviderId::Claude);
        let gemini = connection_capabilities(ProviderId::Gemini);
        assert!(codex.reporting.local_tokens && claude.reporting.local_tokens);
        assert!(!gemini.reporting.local_tokens);
        for provider in all_connection_capabilities() {
            assert_eq!(
                provider.reporting.quota_windows,
                ReportingEvidence::InspectProviderResponse
            );
            assert_eq!(
                provider.reporting.reset_times,
                ReportingEvidence::InspectProviderResponse
            );
            assert_eq!(
                provider.reporting.monetary_observations,
                ReportingEvidence::ClassifyProviderResponse
            );
            let json = serde_json::to_value(provider.reporting).unwrap();
            assert!(
                json.get("costs").is_none(),
                "credits never imply spend support"
            );
            assert!(
                json.get("resetWindows").is_none(),
                "no blanket reset promise"
            );
        }
    }

    #[test]
    fn capability_matrix_json_is_current() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../docs/validation/PROVIDER_CONNECTION_CAPABILITY_MATRIX.json");
        let generated = format!(
            "{}\n",
            serde_json::to_string_pretty(&capability_matrix_json()).unwrap()
        );
        if std::env::var_os("QUOTALIS_WRITE_CAPABILITY_MATRIX").is_some() {
            std::fs::write(&path, &generated).unwrap();
        }
        let committed = std::fs::read_to_string(&path).unwrap_or_default();
        assert_eq!(
            committed.replace("\r\n", "\n"),
            generated,
            "capability matrix JSON is stale; regenerate with QUOTALIS_WRITE_CAPABILITY_MATRIX=1"
        );
    }
}
