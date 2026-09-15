import {render} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import FlowSurface from './flow-surface/FlowSurface';
import {FLOW_SURFACE_FORM_CATALOG} from '../design-system/flowSurface';
import officialMark from '../assets/quotaarc-void-mark.svg';

vi.mock('../hooks/useLocale', () => ({
  useLocale: () => ({ t: (key: string) => key, language: 'english', direction: 'ltr' }),
  useOptionalLocale: () => null,
}));
it.each(FLOW_SURFACE_FORM_CATALOG.map(form=>form.id))('%s uses the official silver logo when hidden',form=>{
  const {container}=render(<FlowSurface catalog="01-obsidian-orbit" state="hidden" providers={[]}
    settings={{form,anchor:'right',scale:100,autoHide:true,autoHideDelayMs:500}}/>);
  const image=container.querySelector('img');
  expect(image).toHaveAttribute('src',officialMark);
  expect(image).toHaveAttribute('draggable','false');
});
