import type { BootstrapState } from "../../../types/bridge";
import DashboardHost from "../../dashboard/DashboardHost";
export default function DashboardTab({ state, onOpenProviders }: {state: BootstrapState; onOpenProviders: () => void}) {
  return <DashboardHost state={state} onOpenProviders={onOpenProviders} />;
}
