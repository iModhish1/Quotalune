import {useProviderInstances} from "../../../hooks/useProviderInstances";
import {useSettings} from "../../../hooks/useSettings";
import {useLocale} from "../../../hooks/useLocale";
import {composeProviderInstances, DEFAULT_INSTANCE_PRESENTATION} from "../../../lib/providerInstances";
import type {ProviderUsageSnapshot, SettingsSnapshot} from "../../../types/bridge";
import ProviderRail from "./ProviderRail";

export default function ProviderInstancesRail(props: {
  providers: ProviderUsageSnapshot[]; settings: SettingsSnapshot; isDemo: boolean;
  onOpenProviders: (id?: string) => void; onAnalytics: (id?: string) => void;
}) {
  const {t} = useLocale();
  const {settings, update, saving, error} = useSettings(props.settings);
  const accounts = useProviderInstances(!props.isDemo);
  const presentation = settings.providerInstancePresentation ?? DEFAULT_INSTANCE_PRESENTATION;
  const instances = props.isDemo ? undefined : composeProviderInstances(props.providers, accounts.instances, settings.enabledProviders, presentation);
  return <>
    {accounts.error && <p role="status">{t("InstanceLoadUnavailable")}</p>}
    {error && <p role="alert">{t("InstanceSaveFailed")}</p>}
    <ProviderRail {...props} settings={settings} instances={instances} presentation={presentation}
      savingPresentation={saving} onPresentationChange={props.isDemo ? undefined : value => update({providerInstancePresentation: value})}/>
  </>;
}
