import {render,screen,fireEvent} from "@testing-library/react";
import {describe,it,expect,vi} from "vitest";
import QuotalisSelect from "./QuotalisSelect";
const options=[{value:"",label:"All providers"},{value:"codex",label:"Codex"},{value:"claude",label:"Claude"}];
describe("QuotalisSelect",()=>{
 it("searches and commits the active option with Enter, returning focus",()=>{
  const change=vi.fn();render(<QuotalisSelect label="Provider" value="" options={options} searchable onChange={change}/>);
  const trigger=screen.getByRole("button",{name:"Provider"});fireEvent.click(trigger);
  const input=screen.getByRole("combobox");expect(input).toHaveFocus();fireEvent.change(input,{target:{value:"cla"}});
  expect(screen.getAllByRole("option")).toHaveLength(1);fireEvent.keyDown(input,{key:"Enter"});
  expect(change).toHaveBeenCalledWith("claude");expect(trigger).toHaveFocus();expect(screen.queryByRole("listbox")).toBeNull();
 });
 it("supports arrows, Home, End and cancels without changing selection",()=>{
  const change=vi.fn();render(<QuotalisSelect label="Provider" value="" options={options} onChange={change}/>);
  const trigger=screen.getByRole("button",{name:"Provider"});fireEvent.keyDown(trigger,{key:"ArrowDown"});
  const panel=screen.getByRole("combobox");fireEvent.keyDown(panel,{key:"End"});
  expect(screen.getByRole("option",{name:"Claude"})).toHaveAttribute("data-active","true");
  fireEvent.keyDown(panel,{key:"Home"});fireEvent.keyDown(panel,{key:"ArrowDown"});
  expect(screen.getByRole("option",{name:"Codex"})).toHaveAttribute("data-active","true");
  fireEvent.keyDown(panel,{key:"Escape"});expect(change).not.toHaveBeenCalled();expect(trigger).toHaveFocus();
 });
 it("closes on outside pointer and handles an empty search without selection",()=>{
  const change=vi.fn();render(<QuotalisSelect label="Provider" value="" options={options} searchable onChange={change}/>);
  fireEvent.click(screen.getByRole("button",{name:"Provider"}));const input=screen.getByRole("combobox");
  fireEvent.change(input,{target:{value:"absent"}});fireEvent.keyDown(input,{key:"ArrowDown"});fireEvent.keyDown(input,{key:"Enter"});
  expect(change).not.toHaveBeenCalled();fireEvent.pointerDown(document.body);expect(screen.queryByRole("listbox")).toBeNull();
 });
});
