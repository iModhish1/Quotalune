import {describe,it,expect,vi} from "vitest";
import {render,screen} from "@testing-library/react";
import ResetHorizon,{resetBand} from "./ResetHorizon";
import type {SettingsSnapshot} from "../../../types/bridge";
vi.mock("../../../hooks/useLocale",()=>({useLocale:()=>({t:(key:string)=>key,language:"english"}),useOptionalLocale:()=>null}));
describe("cosmic reset horizon",()=>{
  it("assigns exact boundaries to non-overlapping chronological bands",()=>{
    const now=1700000000000;
    expect([-1,0,.99,1,5.99,6,11.99,12,23.99,24,48].map(hours=>resetBand(now+hours*3600000,now)))
      .toEqual([0,0,0,1,1,2,2,3,3,4,4]);
  });
  it("does not manufacture reset markers when no times are available",()=>{
    const {container}=render(<ResetHorizon models={[]} settings={{} as SettingsSnapshot} now={1700000000000}/>);
    expect(screen.getByText("DashboardResetScheduleEmpty")).toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });
});
