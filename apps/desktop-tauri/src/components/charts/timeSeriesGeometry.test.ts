import {describe, expect, it} from "vitest";
import {timeSeriesGeometry} from "./timeSeriesGeometry";
describe("time scale and gaps", () => {
  it("positions observations using elapsed time instead of label spacing", () => {
    const result = timeSeriesGeometry([{time: 0, value: 0}, {time: 10, value: 50}, {time: 40, value: 100}], 0, 100, 50, 500, 100, [0,100]);
    expect(result.segments[0].map(p => p.x)).toEqual([0,50,200]);
  });
  it("breaks missing intervals, counter cycles and invalid readings", () => {
    const result = timeSeriesGeometry([{time: 0, value: 0, cycle: 30}, {time: 10, value: 20, cycle: 30}, {time: 20, value: 5, cycle: 60}, {time: 30, value: NaN}, {time: 40, value: 10, cycle: 60}, {time: 80, value: 50, cycle: 90}], 0,100,10,500,100,[0,100]);
    expect(result.segments.map(p => p.length)).toEqual([2,1,1,1]);
  });
  it("keeps a single reading a single point rather than drawing invented history", () => {
    expect(timeSeriesGeometry([{time: 40, value: 0}],0,100,10,500,100,[0,100]).segments[0]).toHaveLength(1);
  });
});
