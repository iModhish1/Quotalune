import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProviderDetailWorkspace } from "./ProviderDetailWorkspace";
vi.mock("../../../hooks/useLocale",()=>({useLocale:()=>({t:(key:string)=>key})}));
it("keeps credential drafts mounted while switching task panels", () => {
  render(<ProviderDetailWorkspace overview={<p>Summary</p>} connections={<input aria-label="Credential draft"/>} presentation={<p>Display</p>}/>);
  fireEvent.click(screen.getByRole("tab",{name:"ProviderWorkspaceConnections"}));
  fireEvent.change(screen.getByLabelText("Credential draft"),{target:{value:"unsaved"}});
  fireEvent.click(screen.getByRole("tab",{name:"ProviderWorkspaceOverview"}));
  fireEvent.click(screen.getByRole("tab",{name:"ProviderWorkspaceConnections"}));
  expect(screen.getByLabelText("Credential draft")).toHaveValue("unsaved");
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
});
