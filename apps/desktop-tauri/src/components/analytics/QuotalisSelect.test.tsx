import {render,screen,fireEvent} from "@testing-library/react";
import {describe,it,expect,vi} from "vitest";
import QuotalisSelect from "./QuotalisSelect";
const options=[{value:"",label:"All providers"},{value:"codex",label:"Codex"},{value:"claude",label:"Claude"}];
it("keeps options inside their owning dialog so native modal inertness cannot block them",()=>{
 const change=vi.fn();render(<dialog open aria-label="Account"><QuotalisSelect label="Position" value="codex" options={options} onChange={change}/></dialog>);
 fireEvent.click(screen.getByRole("button",{name:"Position"}));
 expect(screen.getByRole("dialog")).toContainElement(screen.getByRole("listbox"));
 fireEvent.click(screen.getByRole("option",{name:"Claude"}));
 expect(change).toHaveBeenCalledWith("claude");
 expect(screen.getByRole("button",{name:"Position"})).toHaveFocus();
});
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

it("skips disabled options and closes if the trigger becomes disabled",()=>{
 const change=vi.fn();const opts=[{value:"a",label:"First"},{value:"b",label:"Blocked",disabled:true},{value:"c",label:"Last"}];
 const {rerender}=render(<QuotalisSelect label="Choice" value="a" options={opts} onChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'Choice'}));fireEvent.keyDown(screen.getByRole('combobox'),{key:'ArrowDown'});fireEvent.keyDown(screen.getByRole('combobox'),{key:'Enter'});expect(change).toHaveBeenCalledWith('c');
 fireEvent.click(screen.getByRole('button',{name:'Choice'}));rerender(<QuotalisSelect label="Choice" value="a" options={opts} onChange={change} disabled/>);expect(screen.queryByRole('listbox')).toBeNull();
});
