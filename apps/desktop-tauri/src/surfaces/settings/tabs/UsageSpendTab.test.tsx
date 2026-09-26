import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';

const bridge=vi.hoisted(()=>({
  getSettingsSnapshot:vi.fn(),getUsageSpendSummary:vi.fn(),updateSettings:vi.fn(),writeUsageSpendExport:vi.fn(),
}));
vi.mock('../../../lib/tauri',()=>bridge);
vi.mock('@tauri-apps/plugin-dialog',()=>({save:vi.fn()}));
vi.mock('@tauri-apps/api/event',()=>({listen:vi.fn().mockResolvedValue(()=>{})}));
const {locale}=vi.hoisted(()=>({locale:{t:(key:string)=>key}}));
vi.mock('../../../hooks/useLocale',()=>({useLocale:()=>locale,useOptionalLocale:()=>locale}));

import UsageSpendTab from './UsageSpendTab';

beforeEach(()=>{
  vi.clearAllMocks();
  bridge.getSettingsSnapshot.mockResolvedValue({costSummaryDisplayStyle:'compact'});
  bridge.getUsageSpendSummary.mockReturnValue(new Promise(()=>{}));
});

afterEach(() => vi.restoreAllMocks());

it('renders a structured responsive dashboard rather than loose inline control rows',async()=>{
  const {container}=render(<UsageSpendTab settings={{} as never} set={vi.fn()} saving={false}/>);
  // CostSummaryDisplayStyle is a QuotalisSelect (trigger button), not a
  // native <select> -- no "combobox" role for its non-searchable option count.
  expect(await screen.findByRole('button',{name:'CostSummaryDisplayStyle'})).toBeEnabled();
  expect(screen.getByText('UsageSpendTitle')).toBeInTheDocument();
  expect(screen.getByLabelText('UsageSpendActions')).toHaveClass('usage-spend__toolbar');
  expect(screen.getByRole('group',{name:'UsageSpendHistoryPeriod'})).toHaveClass('usage-spend__periods');
  expect(screen.getByText('UsageSpendEyebrow')).toBeInTheDocument();
  expect(screen.getByText('UsageSpendLocalData')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'UsageSpendCol7d'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'UsageSpendCol30d'})).toBeInTheDocument();
  expect(container.querySelector('.usage-spend__table-frame > .usage-spend-table')).not.toBeNull();
  expect(container.querySelector('.usage-spend__header')).not.toHaveAttribute('style');
  expect(container.querySelector('.usage-spend__filters')).not.toHaveAttribute('style');
});

it('exports a localized share card under the Quotalune filename', async () => {
  bridge.getUsageSpendSummary.mockResolvedValue({
    rows: [],
    contract: {
      providerId: 'all', historyDays: 30, knownCostUsd: null,
      knownZero: false, provenance: 'unknown',
      priceCoverage: { priced: 0, unpriced: 0, unmetered: 0, estimated: 0 },
      priceCoverageRatio: null, historyCoverageEstablished: false,
      tokenMix: { inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null, reasoningTokens: null },
      conversationCount: 0, models: [], projects: [], conversations: [], daily: [], hourlyActivity: [],
      projectSourceStatus: null, customPricingActive: false, imports: [],
    },
  });
  const fillText = vi.fn();
  const ctx = {
    scale: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), fillText,
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 0 }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA==');
  let filename = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filename = this.download;
  });

  render(<UsageSpendTab settings={{} as never} set={vi.fn()} saving={false} />);
  const share = await screen.findByRole('button', { name: 'UsageSpendShare' });
  await waitFor(() => expect(share).toBeEnabled());
  fireEvent.click(share);

  expect(fillText).toHaveBeenCalledWith('UsageSpendShareSubtitle', expect.any(Number), expect.any(Number));
  expect(fillText).toHaveBeenCalledWith('UsageSpendColProvider', expect.any(Number), expect.any(Number));
  expect(fillText).toHaveBeenCalledWith('UsageSpendEmpty', expect.any(Number), expect.any(Number));
  expect(filename).toMatch(/^quotalune-usage-spend-\d{4}-\d{2}-\d{2}\.png$/);
});
