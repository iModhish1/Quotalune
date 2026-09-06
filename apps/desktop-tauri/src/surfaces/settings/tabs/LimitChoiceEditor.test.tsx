import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import LimitChoiceEditor from './LimitChoiceEditor';

vi.mock('../../../hooks/useLocale',()=>({useLocale:()=>({t:(key:string)=>({
  LimitsShown:'Limits shown',
  LimitsShownHelper:'Select each available limit independently. Selected items appear in this order.',
  UseProviderLimitDefaults:'Use provider defaults',
  NoLimitsReported:'No limits reported yet. Refresh or connect this provider to choose its limits.',
  Unavailable:'Unavailable',ShowLimit:'Show',LimitPosition:'Position',MoveLimitEarlier:'Move earlier',MoveLimitLater:'Move later',ForProvider:'for',
}[key]??key)})}));

it('keeps session and 5-hour independent, with explicit ordering and missing choices',()=>{
  const change=vi.fn();
  render(<LimitChoiceEditor provider="Codex" choices={[{id:'session',label:'Session'},{id:'five',label:'5-hour'}]}
    selected={['five','session','missing']} disabled={false} onChange={change}/>);
  fireEvent.click(screen.getByRole('checkbox',{name:'Show Session for Codex'}));
  expect(change).toHaveBeenLastCalledWith(['five','missing']);
  fireEvent.click(screen.getByRole('button',{name:'Move earlier Session for Codex'}));
  expect(change).toHaveBeenLastCalledWith(['session','five','missing']);
  expect(screen.getByText('Unavailable · missing')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});
