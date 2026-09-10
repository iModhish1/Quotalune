import {render,screen} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import LimitPresentationEditor from './LimitPresentationEditor';

const {locale}=vi.hoisted(()=>({locale:{t:(key:string)=>({
  HorizontalBar:'Horizontal bar',VerticalBar:'Vertical bar',CircularRing:'Circular ring',
  IndicatorAppearance:'Indicator appearance',IndicatorShape:'Shape',IndicatorPreviewHelper:'Preview shows an illustrative 65% fill. Your actual limits appear in the provider preview.',
  IndicatorContent:'Content',BarAndPercentage:'Bar and percentage',BarOnly:'Bar only',PercentageOnly:'Percentage only',
  FillDirection:'Fill direction',Clockwise:'Clockwise',Counterclockwise:'Counterclockwise',BottomToTop:'Bottom to top',TopToBottom:'Top to bottom',LeftToRight:'Left to right',RightToLeft:'Right to left',
  PercentageOnlyHelper:'Only the percentage is visible. The bar shape and fill direction are retained for when you show the bar again.',
  LimitPagingHelper:'Two limits appear per page. Use the mouse wheel or page buttons for the rest. This changes only this provider.',UseDefaultIndicator:'Use default indicator',UseGlobalPresentation:'Use global presentation',ProviderPresentationIdentity:'Provider presentation identity',ProviderPresentationIdentityHelper:'Styles values and tracks.',ForProvider:'for',LimitContentAria:'Limit content for',LimitDirectionAria:'Limit direction for',
}[key]??key)}}));

// QuotalisSelect (used internally by the migrated Select control) calls
// useOptionalLocale() too -- both must be mocked, or it throws.
vi.mock('../../../hooks/useLocale',()=>({useLocale:()=>locale,useOptionalLocale:()=>locale}));

it('disables irrelevant fill direction for value-only while retaining the saved shape',()=>{
  // Fill direction is a QuotalisSelect (a <button> trigger), not a native
  // <select> -- no "combobox" role for its non-searchable option count.
  const {rerender}=render(<LimitPresentationEditor provider="Codex" disabled={false} value={{shape:'ring',content:'value',direction:'reverse'}} onChange={vi.fn()}/>);
  expect(screen.getByRole('button',{name:'Limit direction for Codex'})).toBeDisabled();
  expect(screen.getByRole('radio',{name:'Circular ring for Codex'})).toBeChecked();
  rerender(<LimitPresentationEditor provider="Codex" disabled={false} value={{shape:'ring',content:'both',direction:'reverse'}} onChange={vi.fn()}/>);
  expect(screen.getByRole('button',{name:'Limit direction for Codex'})).toBeEnabled();
});
