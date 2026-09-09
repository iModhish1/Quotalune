import {fireEvent, render, screen, within} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import {AnalyticsTable} from "./AnalyticsPrimitives";
describe("analytical table", () => {
  it("sorts real zero and unknown values separately with accessible sort state", () => {
    const rows = [{id:"unknown",value:null},{id:"zero",value:0},{id:"high",value:90}];
    render(<AnalyticsTable rows={rows} rowKey={row => row.id} caption="Independent quota observations" emptyLabel="No data" columns={[{id:"name",title:"Provider",cell:row=>row.id},{id:"value",title:"Used",cell:row=>row.value??"Unavailable",sortValue:row=>row.value}]}/>);
    fireEvent.click(screen.getByRole("button",{name:/Used/}));
    expect(screen.getByRole("columnheader",{name:/Used/})).toHaveAttribute("aria-sort","ascending");
    const sorted = screen.getAllByRole("row").slice(1);
    expect(within(sorted[0]).getByText("zero")).toBeInTheDocument();
    expect(within(sorted[2]).getByText("unknown")).toBeInTheDocument();
    expect(rows[0].id).toBe("unknown");
  });
});
