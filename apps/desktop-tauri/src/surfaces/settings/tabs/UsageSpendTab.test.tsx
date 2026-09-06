import {render,screen} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';

const bridge=vi.hoisted(()=>({
  getSettingsSnapshot:vi.fn(),getUsageSpendSummary:vi.fn(),updateSettings:vi.fn(),writeUsageSpendExport:vi.fn(),
}));
vi.mock('../../../lib/tauri',()=>bridge);
vi.mock('@tauri-apps/plugin-dialog',()=>({save:vi.fn()}));
vi.mock('@tauri-apps/api/event',()=>({listen:vi.fn().mockResolvedValue(()=>{})}));
vi.mock('../../../hooks/useLocale',()=>({useLocale:()=>({t:(key:string)=>key})}));

import UsageSpendTab from './UsageSpendTab';

beforeEach(()=>{
  vi.clearAllMocks();
  bridge.getSettingsSnapshot.mockResolvedValue({costSummaryDisplayStyle:'compact'});
  bridge.getUsageSpendSummary.mockReturnValue(new Promise(()=>{}));
});

it('renders a structured responsive dashboard rather than loose inline control rows',async()=>{
  const {container}=render(<UsageSpendTab settings={{} as never} set={vi.fn()} saving={false}/>);
  expect(await screen.findByRole('combobox',{name:'CostSummaryDisplayStyle'})).toBeEnabled();
  expect(screen.getByText('UsageSpendTitle')).toBeInTheDocument();
  expect(screen.getByLabelText('Usage and spend actions')).toHaveClass('usage-spend__toolbar');
  expect(screen.getByRole('group',{name:'History period'})).toHaveClass('usage-spend__periods');
  expect(container.querySelector('.usage-spend__table-frame > .usage-spend-table')).not.toBeNull();
  expect(container.querySelector('.usage-spend__header')).not.toHaveAttribute('style');
  expect(container.querySelector('.usage-spend__filters')).not.toHaveAttribute('style');
});
