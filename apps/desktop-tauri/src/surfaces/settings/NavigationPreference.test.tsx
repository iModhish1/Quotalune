import {fireEvent,render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import {PreviewLocaleProvider} from "../../i18n/LocaleProvider";
import NavigationPreference from "./NavigationPreference";
it('shows three illustrated choices and delegates only the explicit selection',()=>{
  const change=vi.fn();const renderChoice=(value:"side"|"top"|"bottom",error=false)=><PreviewLocaleProvider><NavigationPreference value={value} onChange={change} error={error}/></PreviewLocaleProvider>;
  const {container,rerender}=render(renderChoice("side"));
  expect(container.querySelectorAll('.navigation-preference__diagram')).toHaveLength(3);
  expect(screen.getByText('Navigation Layout')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:/Navigation Sidebar/})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:/Navigation Bottom/}));
  expect(change).toHaveBeenCalledExactlyOnceWith('bottom');
  rerender(renderChoice("bottom",true));
  expect(screen.getByRole('button',{name:/Navigation Bottom/})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('alert')).toHaveTextContent('Navigation Save Error');
});
