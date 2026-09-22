import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../../../../hooks/useLocale";
import type { LocaleKey } from "../../../../i18n/keys";
import { importBrowserCookies, listDetectedBrowsers, openExternalUrl, startProviderLogin } from "../../../../lib/tauri";
import {
  INSTALL_OUTCOME_LABEL, METHOD_LABEL, cancelCliInstall, cliRequirementSatisfied, connectionStatusKey,
  detectCliDependency, getCliInstallPlan, installCliDependency, safeExternalUrl, singleMethod, stepsFor, verifyProviderConnection,
  saveProviderConnectionKey, cancelProviderConnectionOperation, getProviderConnectionQaFixture,
  type CliDetection, type ConnectStep, type ConnectionMethod, type ConnectionVerification, type InstallPlan, type ProviderConnectionCapabilities,
} from "../../../../lib/providerConnection";
import type { DetectedBrowserBridge } from "../../../../types/bridge";
import type { ProviderLoginPhaseName, ProviderLoginChallenge } from "../../../../lib/tauri";
import { QuotalisRefreshingBadge } from "../../../../design-system/QuotalisLoadingStates";
import "./ProviderConnectFlow.css";

interface Props {
  capabilities: ProviderConnectionCapabilities;
  onClose: () => void;
  onConnected?: (verification: ConnectionVerification) => void;
}

const CLI_STATUS_KEY: Record<CliDetection["status"]["kind"], LocaleKey> = { missing: "ConnectCliMissing", installed: "ConnectCliInstalled", tooOld: "ConnectCliTooOld", versionUnknown: "ConnectCliVersionUnknown", broken: "ConnectCliBroken" };
const CLI_SESSION_KEY: Record<CliDetection["session"], LocaleKey> = { authenticated: "ConnectCliSignedIn", notSignedIn: "ConnectCliNotSignedIn", unknown: "ConnectCliSessionUnknown" };
const LOGIN_PHASE_KEY: Record<ProviderLoginPhaseName, LocaleKey> = { starting: "V2LoginStarting", waiting: "V2LoginWaiting", completed: "V2LoginCompleted", failed: "V2LoginFailed", timedOut: "V2LoginTimedOut", canceled: "V2LoginCanceled" };

/**
 * One onboarding flow for every provider: Method → Requirements → Configure →
 * Verify → Success, with irrelevant steps skipped per method. Every status is a
 * real detection or verification result; nothing is assumed green.
 */
export function ProviderConnectFlow({ capabilities, onClose, onConnected }: Props) {
  const { t } = useLocale();
  const id = capabilities.provider;
  const only = singleMethod(capabilities);
  const [method, setMethod] = useState<ConnectionMethod | null>(only);
  const steps = useMemo<ConnectStep[]>(() => (method ? stepsFor(method, capabilities.cli) : ["method"]), [method, capabilities.cli]);
  const [stepIndex, setStepIndex] = useState(0);
  const step: ConnectStep = method ? steps[Math.min(stepIndex, steps.length - 1)] : "method";
  const [detection, setDetection] = useState<CliDetection | null | undefined>(undefined);
  const [detecting, setDetecting] = useState(false);
  const [plan, setPlan] = useState<InstallPlan | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<LocaleKey | null>(null);
  const [browsers, setBrowsers] = useState<DetectedBrowserBridge[]>([]);
  const [browser, setBrowser] = useState("");
  const [profile, setProfile] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [apiKey, setApiKeyDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loginPhase, setLoginPhase] = useState<ProviderLoginPhaseName | null>(null);
  const loginRef = useRef<ReturnType<typeof startProviderLogin> | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<ConnectionVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [simulated, setSimulated] = useState(false);
  useEffect(() => { let mounted = true; void getProviderConnectionQaFixture().then((fixture) => { if (mounted) setSimulated(fixture?.providerId === id); }).catch(() => {}); return () => { mounted = false; }; }, [id]);
  const busyRef = useRef(false);
  const detectingRef = useRef(false);
  const alive = useRef(true);
  const [challenge, setChallenge] = useState<ProviderLoginChallenge | null>(null);
  const fail = () => { if (alive.current) setError(t("ConnectIssueError")); };
  const start = () => { if (busyRef.current) return false; busyRef.current = true; setBusy(true); return true; };
  const finish = () => { busyRef.current = false; if (alive.current) setBusy(false); };

  useEffect(() => {
    alive.current = true;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>("button, input, select, [tabindex]");
    first?.focus();
    return () => {
      alive.current = false;
      void loginRef.current?.cancel().catch(() => {});
      if (busyRef.current || detectingRef.current) void cancelProviderConnectionOperation(id).catch(() => {});
      restoreFocus.current?.focus?.();
    };
  }, [id]);

  const close = useCallback(() => {
    alive.current = false;
    void loginRef.current?.cancel().catch(() => {});
    if (busyRef.current || detectingRef.current) void cancelProviderConnectionOperation(id).catch(() => {});
    onClose();
  }, [id, installing, verifying, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (plan) setPlan(null); else close(); }
      if (event.key === "Tab") {
        const scope = dialogRef.current?.querySelector<HTMLElement>("[role=alertdialog]") ?? dialogRef.current;
        const controls = scope?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex='0']");
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !scope?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !scope?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, plan]);

  const runDetection = useCallback(async () => {
    if (detectingRef.current) return;
    detectingRef.current = true;
    setDetecting(true);
    try {
      setDetection(await detectCliDependency(id));
    } catch (e) {
      fail();
      setDetection(null);
    } finally {
      detectingRef.current = false;
      setDetecting(false);
    }
  }, [id]);

  useEffect(() => {
    if (step !== "requirements") return;
    if (method === "cliSession" || (method === "deviceFlow" && capabilities.cli)) void runDetection();
    if (method === "browserSession") {
      listDetectedBrowsers(id).then((list) => { setBrowsers(list); if (list[0] && !browser) setBrowser(list[0].browserType); }).catch(() => setBrowsers([]));
    }
  }, [step, method, capabilities.cli, runDetection, browser]);

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => {
    if (stepIndex === 0 && !only) { setMethod(null); return; }
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const chooseMethod = (m: ConnectionMethod) => { setApiKeyDraft(""); setReveal(false); setSaved(false); setMethod(m); setStepIndex(0); setResult(null); setError(null); };

  const askInstall = async () => {
    try { setPlan(await getCliInstallPlan(id)); } catch { fail(); }
  };
  const confirmInstall = async () => {
    if (!start()) return;
    setPlan(null); setInstalling(true); setBusy(true); setInstallMessage(null);
    try {
      const r = await installCliDependency(id, true);
      setInstallMessage(INSTALL_OUTCOME_LABEL[r.outcome.kind]);
      if (r.detection) setDetection(r.detection);
    } catch { fail(); }
    finally { setInstalling(false); finish(); }
  };

  const signIn = async () => {
    if (!start()) return;
    setLoginPhase("starting"); setBusy(true);
    const attempt = startProviderLogin(id, {
      onPhase: (phase) => { if (alive.current) setLoginPhase(phase.phase); },
      onChallenge: (value) => { if (alive.current) setChallenge(value); },
    });
    loginRef.current = attempt;
    try { await attempt.completion; } catch { /* phase already reflects failure */ }
    loginRef.current = null; setChallenge(null); finish();
  };

  const importCookies = async () => {
    if (!start()) return;
    setBusy(true); setImportMessage(null);
    try { await importBrowserCookies(id, browser, profile || undefined); setImportMessage(t("ConnectBrowserImported")); setSaved(true); }
    catch { setImportMessage(t("ConnectIssueBrowserSessionMissing")); }
    finally { finish(); }
  };

  const saveKey = async () => {
    if (!apiKey.trim()) return;
    if (!start()) return;
    setBusy(true);
    try { await saveProviderConnectionKey(id, apiKey); setSaved(true); }
    catch { fail(); }
    finally { setApiKeyDraft(""); setReveal(false); finish(); }
  };

  const verify = async () => {
    if (!start()) return;
    setVerifying(true); setBusy(true); setResult(null); setError(null);
    try {
      const v = await verifyProviderConnection(id, method ?? undefined);
      if (!alive.current) return;
      setResult(v);
      if (v.state === "connected") { onConnected?.(v); setStepIndex(steps.indexOf("success")); }
    } catch { fail(); }
    finally { setVerifying(false); finish(); }
  };
  const cancelVerify = async () => { await cancelProviderConnectionOperation(id); };

  const openDocs = (url: string | null | undefined) => { const safe = safeExternalUrl(url); if (safe) void openExternalUrl(safe); };
  const offer = capabilities.methods.find((m) => m.method === method);
  const title = t("ConnectTitle").replace("{}", capabilities.displayName);
  const cliOk = cliRequirementSatisfied(detection);

  return (
    <div className="provider-connect__backdrop" onClick={() => !busy && close()}>
      <section ref={dialogRef} className="provider-connect" role="dialog" aria-modal="true" aria-labelledby="provider-connect-title" aria-busy={busy} onClick={(e) => e.stopPropagation()}>
        <header className="provider-connect__header">
          <h2 id="provider-connect-title"><bdi>{title}</bdi></h2>
          <button type="button" className="provider-connect__close" aria-label={t("ConnectClose")} onClick={close}>×</button>
        </header>
        <ol className="provider-connect__steps" aria-label={t("ConnectStepMethod")}>
          {(method && !only ? ["method" as ConnectStep, ...steps] : steps).map((s) => <li key={s} aria-current={s === step ? "step" : undefined}>{t(STEP_KEY[s])}</li>)}
        </ol>
        {simulated && <p role="status">{t("ProviderQaTitle")} · {t("ProviderQaHelp")}</p>}
        {error && <p role="alert" className="provider-connect__error">{error}</p>}

        {step === "method" && (
          <div className="provider-connect__methods" role="radiogroup" aria-label={t("ConnectStepMethod")}>
            {capabilities.methods.map((m) => (
              <button key={m.method} type="button" role="radio" aria-checked={method === m.method} className="provider-connect__method" onKeyDown={(event) => { if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) { event.preventDefault(); const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>("[role=radio]")); const delta = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1; buttons[(buttons.indexOf(event.currentTarget) + delta + buttons.length) % buttons.length]?.focus(); } }} onClick={() => chooseMethod(m.method)}>
                <strong>{t(METHOD_LABEL[m.method])}</strong>
                <span>{t(m.rank === "recommended" ? "ConnectRecommended" : "ConnectAlternative")}</span>
                {m.browserDomain && <small dir="ltr">{m.browserDomain}</small>}
              </button>
            ))}
          </div>
        )}

        {step === "requirements" && (method === "cliSession" || method === "deviceFlow") && capabilities.cli && (
          <div className="provider-connect__requirements">
            <h3>{t("ConnectStepRequirements")}</h3>
            <ul className="provider-connect__checklist">
              <li data-satisfied={cliOk}>
                <span dir="ltr">{capabilities.cli.tool}</span>
                {detecting ? <QuotalisRefreshingBadge label={t("ConnectCliDetecting")} /> : detection ? <span role="status">{t(CLI_STATUS_KEY[detection.status.kind])}{detection.version && <> · <span dir="ltr">{detection.version}</span></>}</span> : <span role="status">{t("ConnectCliMissing")}</span>}
              </li>
              {detection && detection.status.kind === "tooOld" && <li className="provider-connect__hint" dir="ltr">{detection.status.installed} → {detection.status.required}</li>}
              {detection && cliOk && <li data-satisfied={detection.session === "authenticated"}><span>{t("ConnectCliSignInAction")}</span><span role="status">{t(CLI_SESSION_KEY[detection.session])}</span></li>}
            </ul>
            <div className="provider-connect__actions">
              {detection && !cliOk && detection.installAvailable && !installing && <button type="button" className="btn btn--primary" onClick={() => void askInstall()}>{t("ConnectCliInstallAction")}</button>}
              {installing && <><QuotalisRefreshingBadge label={t("ConnectCliInstalling")} /><button type="button" className="btn btn--ghost" onClick={() => void cancelCliInstall(id)}>{t("ConnectCliInstallCancel")}</button></>}
              <button type="button" className="btn btn--ghost" onClick={() => openDocs(capabilities.cli?.docsUrl)}>{t("ConnectCliOpenDocs")}</button>
              <button type="button" className="btn btn--ghost" onClick={() => void runDetection()} disabled={detecting || installing}>{t("CredsRefreshDetectionAction")}</button>
            </div>
            {installMessage && <p role="status">{t(installMessage)}</p>}
            {plan && (
              <div className="provider-connect__confirm" role="alertdialog" aria-labelledby="provider-connect-install-title">
                <h4 id="provider-connect-install-title">{t("ConnectCliInstallTitle")}</h4>
                <dl>
                  <dt>{t("ConnectCliInstallWhat")}</dt><dd dir="ltr">{capabilities.cli.tool}</dd>
                  <dt>{t("ConnectCliInstallSource")}</dt><dd dir="ltr">{plan.packageManager} · {plan.package}</dd>
                  <dt>{t("ConnectCliInstallCommand")}</dt><dd><code dir="ltr">{[plan.program, ...plan.args].join(" ")}</code></dd>
                  <dt>{t("ConnectCliInstallAdmin")}</dt><dd>{t(plan.requiresAdmin ? "ConnectCliInstallAdminYes" : "ConnectCliInstallNoAdmin")}</dd>
                </dl>
                <div className="provider-connect__actions">
                  <button type="button" className="btn btn--ghost" autoFocus onClick={() => setPlan(null)}>{t("ConnectCancel")}</button>
                  <button type="button" className="btn btn--primary" onClick={() => void confirmInstall()}>{t("ConnectCliInstallConfirm")}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "requirements" && method === "browserSession" && offer && (
          <div className="provider-connect__requirements">
            <h3>{t("ConnectStepRequirements")}</h3>
            <ul className="provider-connect__instructions">
              <li>{t("ConnectBrowserSignedIn")} <strong dir="ltr">{offer.browserDomain}</strong></li>
              <li>{t("ConnectBrowserReads")}</li>
              <li>{t("ConnectBrowserLocal")}</li>
            </ul>
            <div className="provider-connect__actions">
              {offer.helpUrl && <button type="button" className="btn btn--ghost" onClick={() => openDocs(offer.helpUrl)}>{t("ConnectBrowserOpenSite")}</button>}
            </div>
          </div>
        )}

        {step === "configure" && method === "cliSession" && (
          <div className="provider-connect__configure">
            <h3>{t("ConnectStepConfigure")}</h3>
            <p>{t("ConnectCliSignInHint")} <code dir="ltr">{detection?.signInHint ?? capabilities.cli?.tool}</code></p>
            {loginPhase && <p role="status">{t(LOGIN_PHASE_KEY[loginPhase])}</p>}
            <div className="provider-connect__actions">
              {capabilities.cli?.managedLogin ? <button type="button" className="btn btn--primary" onClick={() => void signIn()} disabled={busy}>{t("ConnectCliSignInAction")}</button> : <button type="button" className="btn btn--ghost" onClick={() => openDocs(capabilities.cli?.docsUrl)}>{t("ConnectCliOpenDocs")}</button>}
              {busy && loginRef.current && <button type="button" className="btn btn--ghost" onClick={() => void loginRef.current?.cancel()}>{t("V2Cancel")}</button>}
            </div>
          </div>
        )}

        {step === "configure" && method === "deviceFlow" && (
          <div className="provider-connect__configure">
            <h3>{t("ConnectStepConfigure")}</h3>
            <p>{t("ConnectDeviceIntro")}</p>
            {challenge && <div role="status"><code dir="ltr">{challenge.userCode}</code>{challenge.simulated && <span>{t("ProviderQaTitle")}</span>}{!challenge.simulated && <button type="button" className="btn btn--ghost" onClick={() => { if (challenge.verificationUri === "https://github.com/login/device") openDocs(challenge.verificationUri); }}>{t("ConnectDeviceStart")}</button>}</div>}
            {loginPhase && <p role="status">{t(LOGIN_PHASE_KEY[loginPhase])}</p>}
            <div className="provider-connect__actions">
              <button type="button" className="btn btn--primary" onClick={() => void signIn()} disabled={busy}>{t("ConnectDeviceStart")}</button>
              {busy && loginRef.current && <button type="button" className="btn btn--ghost" onClick={() => void loginRef.current?.cancel()}>{t("ConnectDeviceCancel")}</button>}
            </div>
          </div>
        )}

        {step === "configure" && method === "browserSession" && (
          <div className="provider-connect__configure">
            <h3>{t("ConnectBrowserChoose")}</h3>
            {browsers.length === 0 ? <p role="status">{t("ConnectBrowserNone")}</p> : (
              <label>{t("ConnectBrowserChoose")}
                <select aria-label={t("ConnectBrowserChoose")} value={browser} onChange={(e) => { setBrowser(e.target.value); setProfile(""); }} disabled={busy}>
                  {browsers.map((b) => <option key={b.browserType} value={b.browserType}>{b.displayName} · {b.profileCount} {t("ConnectBrowserProfiles")}</option>)}
                </select>
              </label>
            )}
            {!!browsers.find((b) => b.browserType === browser)?.profiles?.length && <label>{t("ConnectBrowserProfiles")}
              <select aria-label={t("ConnectBrowserProfiles")} value={profile} onChange={(e) => setProfile(e.target.value)} disabled={busy}>
                <option value="">{t("ConnectBrowserChooseProfile")}</option>
                {browsers.find((b) => b.browserType === browser)?.profiles?.map((p) => <option key={p.id} value={p.id}>{t("BrowserCookieProfileSingular")} {p.ordinal}</option>)}
              </select>
            </label>}
            <div className="provider-connect__actions">
              <button type="button" className="btn btn--primary" onClick={() => void importCookies()} disabled={busy || !browser || (!!browsers.find((b) => b.browserType === browser)?.profiles?.length && !profile)}>{t("ConnectBrowserImport")}</button>
            </div>
            {importMessage && <p role="status">{importMessage}</p>}
          </div>
        )}

        {step === "configure" && method === "apiKey" && offer && (
          <div className="provider-connect__configure">
            <h3>{t("ConnectStepConfigure")}</h3>
            {offer.helpUrl && <p>{t("ConnectApiKeyWhere")} <button type="button" className="provider-connect__link" onClick={() => openDocs(offer.helpUrl)}>{t("ConnectApiKeyOpenSite")}</button></p>}
            {offer.envVar && <p className="provider-connect__hint">{t("ConnectApiKeyEnv")} <code dir="ltr">{offer.envVar}</code></p>}
            <label className="provider-connect__secret">{t("ConnectApiKeyLabel")}
              <input type={reveal ? "text" : "password"} autoComplete="off" spellCheck={false} dir="ltr" value={apiKey} onChange={(e) => setApiKeyDraft(e.target.value)} disabled={busy} aria-describedby="provider-connect-key-hint" />
            </label>
            <div className="provider-connect__actions">
              <button type="button" className="btn btn--ghost" aria-pressed={reveal} onClick={() => setReveal((r) => !r)}>{t(reveal ? "ConnectApiKeyHide" : "ConnectApiKeyReveal")}</button>
              <button type="button" className="btn btn--primary" onClick={() => void saveKey()} disabled={busy || !apiKey.trim()}>{t("ConnectApiKeySave")}</button>
            </div>
            <p id="provider-connect-key-hint" role="status">{saved ? t("ConnectApiKeySaved") : apiKey.trim() ? "" : t("ConnectApiKeyEmpty")}</p>
          </div>
        )}

        {step === "verify" && (
          <div className="provider-connect__verify">
            <h3>{t("ConnectStepVerify")}</h3>
            {method === "localScanner" && <p>{t("ConnectScannerIntro")}</p>}
            {method === "localGateway" && <p>{t("ConnectGatewayIntro")}</p>}
            {verifying ? (
              <div className="provider-connect__actions"><QuotalisRefreshingBadge label={t("ConnectVerifying")} /><button type="button" className="btn btn--ghost" onClick={() => void cancelVerify()}>{t("ConnectVerifyCancel")}</button></div>
            ) : (
              <div className="provider-connect__actions"><button type="button" className="btn btn--primary" onClick={() => void verify()}>{result ? t("ConnectRetry") : t("ConnectVerifyAction")}</button></div>
            )}
            {result && result.state !== "connected" && <p role="alert" className="provider-connect__outcome" data-state={result.state}>{t(connectionStatusKey(result.state, result.issue))}</p>}
          </div>
        )}

        {step === "success" && result && (
          <div className="provider-connect__success" role="status">
            <h3>{t("ConnectStateConnected")}</h3>
            <dl>
              {result.method && <><dt>{t("ConnectSuccessVia")}</dt><dd>{t(METHOD_LABEL[result.method])}</dd></>}
              {result.plan && <><dt>{t("ConnectSuccessPlan")}</dt><dd><bdi>{result.plan}</bdi></dd></>}
              <dt>{t("ConnectSuccessWindows")}</dt><dd>{result.windowCount}</dd>
              <dt>{t("ConnectSuccessResets")}</dt><dd>{t(result.resetsKnown ? "ConnectSuccessResetsKnown" : "ConnectSuccessResetsUnknown")}</dd>
              {result.verifiedAt && <><dt>{t("ConnectSuccessVerifiedAt")}</dt><dd dir="ltr">{result.verifiedAt}</dd></>}
            </dl>
          </div>
        )}

        <footer className="provider-connect__footer">
          {step !== "success" && (step !== "method" || !only) && <button type="button" className="btn btn--ghost" onClick={goBack} disabled={busy || (step === "method")}>{t("ConnectBack")}</button>}
          {step !== "success" && step !== "method" && step !== "verify" && <button type="button" className="btn btn--primary" onClick={goNext} disabled={busy || (step === "requirements" && (method === "cliSession" || method === "deviceFlow") && !!capabilities.cli && !cliOk)}>{t("ConnectNext")}</button>}
          {step === "success" && <button type="button" className="btn btn--primary" onClick={close}>{t("ConnectDone")}</button>}
        </footer>
      </section>
    </div>
  );
}

const STEP_KEY: Record<ConnectStep, LocaleKey> = { method: "ConnectStepMethod", requirements: "ConnectStepRequirements", configure: "ConnectStepConfigure", verify: "ConnectStepVerify", success: "ConnectStepSuccess" };
