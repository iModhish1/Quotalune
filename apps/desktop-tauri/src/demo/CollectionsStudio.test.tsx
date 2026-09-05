import {fireEvent,render,screen} from "@testing-library/react";
import {expect,it} from "vitest";
import CollectionsStudio from "./CollectionsStudio";
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
