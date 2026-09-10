import {fireEvent, render, screen, within} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import {AnalyticsTable} from "./AnalyticsPrimitives";
describe("analytical table", () => {
  it("sorts real zero and unknown values separately in both directions with accessible sort state", () => {
    const rows = [{id:"unknown",value:null},{id:"zero",value:0},{id:"high",value:90}];
    render(<AnalyticsTable rows={rows} rowKey={row => row.id} caption="Independent quota observations" emptyLabel="No data" columns={[{id:"name",title:"Provider",cell:row=>row.id},{id:"value",title:"Used",cell:row=>row.value??"Unavailable",sortValue:row=>row.value}]}/>);
    fireEvent.click(screen.getByRole("button",{name:/Used/}));
    expect(screen.getByRole("columnheader",{name:/Used/})).toHaveAttribute("aria-sort","ascending");
    const sorted = screen.getAllByRole("row").slice(1);
    expect(within(sorted[0]).getByText("zero")).toBeInTheDocument();
    expect(within(sorted[2]).getByText("unknown")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Used/}));
    expect(screen.getByRole("columnheader",{name:/Used/})).toHaveAttribute("aria-sort","descending");
    const descending = screen.getAllByRole("row").slice(1);
    expect(within(descending[0]).getByText("high")).toBeInTheDocument();
    expect(within(descending[2]).getByText("unknown")).toBeInTheDocument();
    expect(rows[0].id).toBe("unknown");
  });
  it("lets a keyboard-accessible visibility control hide optional columns without hiding the final column", () => {
    render(<AnalyticsTable rows={[{id:"one",value:1}]} rowKey={row=>row.id} caption="Provider operations" emptyLabel="No data" columns={[
      {id:"name",title:"Provider",cell:row=>row.id}, {id:"value",title:"Usage",cell:row=>row.value},
    ]}/>);
    fireEvent.click(screen.getByRole("button", {name: "Columns"}));
    fireEvent.click(screen.getByRole("option", {name:"Usage"}));
    expect(screen.queryByRole("columnheader",{name:"Usage"})).toBeNull();
    expect(screen.getByRole("button", {name: "Columns"})).toHaveTextContent("Columns · 1");
    fireEvent.click(screen.getByRole("option", {name:"Provider"}));
    expect(screen.getByRole("columnheader", {name:"Provider"})).toBeInTheDocument();
  });
  it.each([1_000,10_000])("keeps %i-row histories bounded to one page of DOM while retaining every page", (count) => {
    const rows = Array.from({length:count},(_, index)=>({id:`row-${index}`,value:index}));
    render(<AnalyticsTable rows={rows} rowKey={row=>row.id} caption="Long history" emptyLabel="No data" columns={[{id:"id",title:"Reading",cell:row=>row.id,sortValue:row=>row.value}]}/>);
    expect(screen.getAllByRole("row")).toHaveLength(101);
    expect(screen.getByText("row-0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Next page"}));
    expect(screen.getByText("row-100")).toBeInTheDocument();
    expect(screen.queryByText("row-0")).toBeNull();
  });
});
