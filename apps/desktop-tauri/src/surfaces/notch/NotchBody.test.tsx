import {render} from '@testing-library/react';
import {it,expect} from 'vitest';
import {NotchBody} from './NotchBody';
it('clips the metallic rim to the same contour and keeps mirrored bodies decorative',()=>{
  const {container}=render(<><NotchBody form="satellite" width={108} height={172} mirror/><NotchBody form="satellite" width={108} height={172} mirror={false}/></>);
  const rims=[...container.querySelectorAll('.notch-body__rim')];
  expect(rims).toHaveLength(2);
  expect(rims[0].getAttribute('clip-path')).not.toBe(rims[1].getAttribute('clip-path'));
  for(const rim of rims){
    const svg=rim.closest('svg')!;
    expect(svg).toHaveAttribute('aria-hidden','true');
    expect(rim).toHaveAttribute('fill','none');
    expect(rim.getAttribute('d')).toBe(svg.querySelector('clipPath path')!.getAttribute('d'));
  }
});
