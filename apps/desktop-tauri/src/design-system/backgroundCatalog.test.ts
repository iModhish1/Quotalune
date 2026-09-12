import {describe,it,expect} from "vitest";
import {BACKGROUND_CATALOG,backgroundById,customBackgroundId} from "./backgroundCatalog";
describe("workspace background catalog",()=>{
  it("provides three complete batches of static and animated designs with stable unique IDs",()=>{
    expect(new Set(BACKGROUND_CATALOG.map(item=>item.id)).size).toBe(28);
    for(const batch of [1,2,3]) for(const kind of ["static","animated"]) {
      expect(BACKGROUND_CATALOG.filter(item=>item.batch===batch&&item.kind===kind)).toHaveLength(4);
    }
  });
  it("never turns unknown IDs or paths into CSS",()=>{
    for(const id of ["../image.png","url(https://example.test)","motion-99","custom:../../settings.json"]) {
      expect(backgroundById(id)).toBeUndefined();expect(customBackgroundId(id)).toBeNull();
    }
    expect(customBackgroundId("custom:03c5b5a4-d164-486a-86b2-c5b8394e055f")).toBe("03c5b5a4-d164-486a-86b2-c5b8394e055f");
  });
});
