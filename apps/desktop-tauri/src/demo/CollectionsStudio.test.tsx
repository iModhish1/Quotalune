import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import CollectionsStudio from "./CollectionsStudio";
import {SURFACE_DEMO_PROVIDERS} from "../lib/surfaceDemo";
it("keeps grouped items safe when a live provider snapshot disappears",()=>{
  const {rerender}=render(<CollectionsStudio providers={SURFACE_DEMO_PROVIDERS}/>);
  rerender(<CollectionsStudio providers={SURFACE_DEMO_PROVIDERS.slice(1)}/>);
  expect(screen.getByRole("button",{name:"claude quota details"})).toBeInTheDocument();
});
it("retains the draft on failed persistence and reports success only after saving",async()=>{
  const save=vi.fn().mockRejectedValueOnce(new Error("revision conflict")).mockImplementationOnce(async layout=>({...layout,revision:1}));
  render(<CollectionsStudio onSave={save}/>);
  fireEvent.click(screen.getByRole("button",{name:"Save collection layout"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("revision conflict");
  expect(screen.queryByText("Layout saved — native collection rendering pending")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Save collection layout"}));
  await waitFor(()=>expect(screen.getByText("Layout saved — native collection rendering pending")).toBeInTheDocument());
});
it("previews views and field changes, and clicks reveal the selected provider",()=>{
  render(<CollectionsStudio/>);
  fireEvent.click(screen.getByRole("button",{name:"Claude quota details"}));
  expect(screen.getByRole("region",{name:"Claude usage details"})).toBeInTheDocument();
  const initial=screen.getByTestId("collection-size").textContent;
  fireEvent.click(screen.getByRole("checkbox",{name:"Provider name"}));
  expect(screen.getByTestId("collection-size").textContent).not.toBe(initial);
  fireEvent.click(screen.getByRole("button",{name:"Grid"}));
  expect(screen.getByRole("button",{name:"Grid"})).toHaveAttribute("aria-pressed","true");
});
it("supports keyboard-accessible detach and regroup without losing providers",()=>{
  render(<CollectionsStudio/>);
  fireEvent.click(screen.getByRole("button",{name:"Detach selected"}));
  expect(screen.getAllByTestId("collection-group")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"Gather all"}));
  expect(screen.getAllByTestId("collection-group")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:"Next providers"}));
  expect(screen.getByRole("button",{name:"Cursor quota details"})).toBeInTheDocument();
});
