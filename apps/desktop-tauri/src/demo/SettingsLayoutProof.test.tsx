import {render,screen} from "@testing-library/react";
import {expect,it} from "vitest";
import {PreviewLocaleProvider} from "../i18n/LocaleProvider";
import SettingsLayoutProof from "./SettingsLayoutProof";

it("renders a full settings shell proof with the selected navigation and balanced groups",()=>{
  window.history.replaceState({},"","/?window=demo&gen=settings-layout&nav=top&tab=advanced&theme=light");
  const {container}=render(<PreviewLocaleProvider><SettingsLayoutProof/></PreviewLocaleProvider>);
  expect(container.querySelector('.settings[data-navigation="top"]')).not.toBeNull();
  expect(container.querySelector('.settings-body[data-tab="advanced"]')).not.toBeNull();
  expect(screen.getByRole("heading",{name:"Performance"})).toBeInTheDocument();
  expect(screen.getByRole("img",{name:"Quotalis"})).toHaveAttribute("data-quotaarc-mark","official");
});
