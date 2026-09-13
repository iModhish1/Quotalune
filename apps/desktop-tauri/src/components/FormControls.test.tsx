import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {Field, NumberInput, Select, Toggle} from './FormControls';
it('keeps the field name stable when the selected value changes',()=>{
  const options=[{value:'off',label:'Off'},{value:'on',label:'On'}];
  const {rerender}=render(<Field label="Power mode"><Select options={options} value="off" onChange={vi.fn()}/></Field>);
  expect(screen.getByRole('button',{name:'Power mode'})).toHaveTextContent('Off');
  rerender(<Field label="Power mode"><Select options={options} value="on" onChange={vi.fn()}/></Field>);
  expect(screen.getByRole('button',{name:'Power mode'})).toHaveTextContent('On');
  rerender(<Field label="Power mode"><Select ariaLabel="Explicit mode" options={options} value="on" onChange={vi.fn()}/></Field>);
  expect(screen.getByRole('button',{name:'Explicit mode'})).toHaveTextContent('On');
});
it('reserves room for the longest choice and does not shrink on selection',()=>{
  const options=[{value:'one',label:'Single unified icon'},{value:'all',label:'One icon per enabled provider'}];
  const props={options,onChange:vi.fn(),ariaLabel:'Tray mode'};
  const {rerender}=render(<Select {...props} value="all"/>);
  const select=screen.getByRole('button',{name:'Tray mode'});
  const width=select.parentElement!.style.width;
  expect(parseFloat(width)).toBeGreaterThan(200);
  rerender(<Select {...props} value="one"/>);
  expect(select.parentElement!.style.width).toBe(width);
  expect(select).toHaveTextContent('Single unified icon');
});

it('exposes names and descriptions for leading settings switches and number fields',()=>{
  render(<><Field label="Start at Login" description="Open after signing in" leading><Toggle checked={false} onChange={vi.fn()}/></Field>
    <Field label="Refresh interval"><NumberInput value={5} onChange={vi.fn()}/></Field></>);
  expect(screen.getByRole('checkbox',{name:'Start at Login'})).toHaveAccessibleDescription('Open after signing in');
  expect(screen.getByRole('spinbutton',{name:'Refresh interval'})).toHaveValue(5);
});

it('preserves explicit control labels and resolves the nearest field',()=>{
  render(<Field label="Outer"><Field label="Inner"><Toggle checked onChange={vi.fn()}/>
    <Toggle label="Explicit" checked={false} onChange={vi.fn()}/></Field></Field>);
  expect(screen.getByRole('checkbox',{name:'Inner'})).toBeChecked();
  expect(screen.getByRole('checkbox',{name:'Explicit'})).not.toBeChecked();
});
