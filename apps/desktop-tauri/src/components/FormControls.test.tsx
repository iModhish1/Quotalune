import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {Select} from './FormControls';
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
