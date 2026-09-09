import {fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import {SettingsResetAction} from "./SettingsControls";
vi.mock("../../hooks/useLocale",()=>({useLocale:()=>({t:(key:string)=>key})}));
it("resets only after local confirmation, exposes failures and permits cancel",async()=>{
  const reset=vi.fn().mockRejectedValue(new Error("write failed"));
  render(<SettingsResetAction label="Reset layout" onReset={reset}/>);
  fireEvent.click(screen.getByRole("button",{name:"Reset layout"}));
  expect(reset).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button",{name:"Reset layout"}));
  await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("write failed"));
  fireEvent.click(screen.getByRole("button",{name:"V2Cancel"}));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(reset).toHaveBeenCalledTimes(1);
});
