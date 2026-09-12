import {describe,it,expect} from "vitest";
import {BACKGROUND_CATALOG,backgroundById,customBackgroundId} from "./backgroundCatalog";
describe("workspace background catalog",()=>{
  it("provides four distinct space images in static and animated forms, without palette filler",()=>{
    expect(new Set(BACKGROUND_CATALOG.map(item=>item.id)).size).toBe(10);
    for(const batch of [1]) for(const kind of ["static","animated"]) {
      expect(BACKGROUND_CATALOG.filter(item=>item.batch===batch&&item.kind===kind)).toHaveLength(4);
    }
    expect(new Set(BACKGROUND_CATALOG.filter(item=>item.image).map(item=>item.image)).size).toBe(4);
    expect(backgroundById("motion-12")?.image).toBeTruthy();
  });
  it("never turns unknown IDs or paths into CSS",()=>{
    for(const id of ["../image.png","url(https://example.test)","motion-99","custom:../../settings.json"]) {
      expect(backgroundById(id)).toBeUndefined();expect(customBackgroundId(id)).toBeNull();
    }
    expect(customBackgroundId("custom:03c5b5a4-d164-486a-86b2-c5b8394e055f")).toBe("03c5b5a4-d164-486a-86b2-c5b8394e055f");
  });
});
