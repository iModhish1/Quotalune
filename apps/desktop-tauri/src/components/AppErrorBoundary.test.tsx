import {fireEvent,render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";

import AppErrorBoundary from "./AppErrorBoundary";

it("replaces a fatal render failure with a recoverable diagnostic",()=>{
  const reload=vi.fn();
  const consoleError=vi.spyOn(console,"error").mockImplementation(()=>{});
  function Broken():never{throw new Error("preview exploded");}
  render(<AppErrorBoundary onReload={reload}><Broken/></AppErrorBoundary>);
  expect(screen.getByRole("heading",{name:"Quotalis could not open this view"})).toBeInTheDocument();
  expect(screen.getByText("preview exploded")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Reload Quotalis"}));
  expect(reload).toHaveBeenCalledOnce();
  consoleError.mockRestore();
});
