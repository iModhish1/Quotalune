import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import CollectionsStudio from "./CollectionsStudio";
import {SURFACE_DEMO_PROVIDERS} from "../lib/surfaceDemo";
import type {CollectionLayoutSnapshot} from "../lib/collectionBridge";

const persistedLayout = (): CollectionLayoutSnapshot => ({
  version: 1, revision: 7, view: "horizontal", scale: 100, fields: {},
  groups: [
    {id: "main", items: ["claude", "codex"], x: 20, y: 24},
    {id: "solo-1", items: ["cursor"], x: 180, y: 220},
  ],
});

it("detaches after a saved layout reload without moving an existing solo group", async () => {
  const save = vi.fn(async (layout: CollectionLayoutSnapshot) => ({...layout, revision: 8}));
  const original = persistedLayout();
  render(<CollectionsStudio initialLayout={original} onSave={save}/>);
  fireEvent.click(screen.getByRole("button", {name: "Detach selected"}));
  fireEvent.click(screen.getByRole("button", {name: "Save collection layout"}));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const saved = save.mock.calls[0][0];
  expect(saved.groups).toHaveLength(3);
  expect(saved.groups.find(g => g.id === "solo-1")).toEqual(original.groups[1]);
  expect(saved.groups.find(g => g.items.includes("claude"))?.id).not.toBe("solo-1");
  expect(saved.groups.flatMap(g => g.items).sort()).toEqual(["claude", "codex", "cursor"]);
});

it("gathers in saved order and retains providers with temporarily missing observations", async () => {
  const save = vi.fn(async (layout: CollectionLayoutSnapshot) => layout);
  const original = persistedLayout();
  original.groups = [
    {id: "solo-1", items: ["cursor"], x: 180, y: 220},
    {id: "main", items: ["codex", "claude"], x: 20, y: 24},
  ];
  render(<CollectionsStudio providers={SURFACE_DEMO_PROVIDERS.filter(p => p.id === "codex")} initialLayout={original} onSave={save}/>);
  fireEvent.click(screen.getByRole("button", {name: "Gather all"}));
  fireEvent.click(screen.getByRole("button", {name: "Save collection layout"}));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].groups.map(g => g.items)).toEqual([["cursor", "codex", "claude"]]);
});

it("moves a selected provider to a specific collection without drag and preserves target placement", async () => {
  const save = vi.fn(async (layout: CollectionLayoutSnapshot) => layout);
  render(<CollectionsStudio initialLayout={persistedLayout()} onSave={save}/>);
  fireEvent.click(screen.getByRole("button", {name: "Move selected to Cursor"}));
  fireEvent.click(screen.getByRole("button", {name: "Save collection layout"}));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].groups).toEqual([
    {id: "main", items: ["codex"], x: 20, y: 24},
    {id: "solo-1", items: ["cursor", "claude"], x: 180, y: 220},
  ]);
});
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
  expect(screen.queryByText("Layout saved — live in the Collections window")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Save collection layout"}));
  await waitFor(()=>expect(screen.getByText("Layout saved — live in the Collections window")).toBeInTheDocument());
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
  // Gathering preserves the current group order: detached Claude is last.
  expect(screen.getByRole("button",{name:"Claude quota details"})).toBeInTheDocument();
});
