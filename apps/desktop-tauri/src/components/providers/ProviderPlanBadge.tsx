/** Only the provider's reported plan; unknown plans are deliberately absent. */
export function ProviderPlanBadge({plan}: {plan?: string | null}) {
  return plan?.trim() ? <bdi className="provider-plan-badge" title={plan}>{plan}</bdi> : null;
}
