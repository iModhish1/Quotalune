import {fireEvent,render,screen} from "@testing-library/react";
import {expect,it} from "vitest";

import {PreviewLocaleProvider} from "../i18n/LocaleProvider";
import SurfaceGalleryProof from "./SurfaceGalleryProof";

it("renders every real structure footprint and can inspect light appearance",()=>{
  render(<PreviewLocaleProvider><SurfaceGalleryProof/></PreviewLocaleProvider>);
  expect(screen.getAllByText(/\d+ × \d+ px/)).toHaveLength(14);
  fireEvent.change(screen.getByRole("combobox",{name:"Preview app theme"}),{target:{value:"light"}});
  expect(screen.getByRole("combobox",{name:"Preview app theme"})).toHaveValue("light");
});
