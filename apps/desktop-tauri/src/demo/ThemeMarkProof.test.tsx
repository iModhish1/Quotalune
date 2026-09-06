import {render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {THEME_CATALOG} from '../design-system/themeCatalog';
import ThemeMarkProof from './ThemeMarkProof';

it('renders the official mark inside every distinct theme frame',()=>{
  const {container}=render(<ThemeMarkProof/>);
  expect(screen.getAllByRole('img')).toHaveLength(THEME_CATALOG.length);
  for(const theme of THEME_CATALOG){
    const card=container.querySelector<HTMLElement>(`[data-theme-mark="${theme.slug}"]`)!;
    expect(card.style.getPropertyValue('--surface-mark-frame')).toBe(theme.identity!.markFrame);
    expect(withinCard(card,'img')).toHaveAttribute('data-quotaarc-mark','official');
  }
});

function withinCard(card:HTMLElement,selector:string){
  const node=card.querySelector(selector);
  if(!node)throw new Error(`Missing ${selector}`);
  return node;
}
