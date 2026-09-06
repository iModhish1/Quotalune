import {fireEvent,render,screen} from "@testing-library/react";
import {describe,expect,it} from "vitest";

import {PreviewLocaleProvider} from "../i18n/LocaleProvider";
import {THEME_CATALOG} from "../design-system/themeCatalog";
import MaterialProof,{proofAnchorFromSearch,proofFormFromSearch,proofIdentityFromSearch} from "./MaterialProof";

describe("MaterialProof",()=>{
  it("opens a requested valid structure without accepting unknown query values",()=>{
    expect(proofFormFromSearch("?form=seam")).toBe("seam");
    expect(proofFormFromSearch("?form=clockwork")).toBe("lens");
    expect(proofAnchorFromSearch("?anchor=bottom-left")).toBe("bottom-left");
    expect(proofAnchorFromSearch("?anchor=middle")).toBe("right");
    expect(proofIdentityFromSearch("?inspect=01-obsidian-orbit")).toBe("01-obsidian-orbit");
    expect(proofIdentityFromSearch("?inspect=unknown")).toBeNull();
  });
  it("compares every complete identity and can swap the real structure",()=>{
    const {container}=render(<PreviewLocaleProvider><MaterialProof/></PreviewLocaleProvider>);
    expect(screen.getByRole("region",{name:"Theme identity comparison"}).children).toHaveLength(THEME_CATALOG.length);
    expect(screen.getByText("Observatory reticle")).toBeInTheDocument();
    expect(screen.getByText("Titanium shutter")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Proof structure"),{target:{value:"seam"}});
    expect(screen.getAllByLabelText("seam provider selector")).toHaveLength(THEME_CATALOG.length);
    fireEvent.change(screen.getByLabelText("Proof anchor"),{target:{value:"top-left"}});
    expect(container.querySelectorAll('[data-anchor="top-left"]')).toHaveLength(THEME_CATALOG.length);
    fireEvent.change(screen.getByLabelText("Proof app theme"),{target:{value:"light"}});
    expect(container.firstElementChild).toHaveAttribute("data-theme","light");
  });
});
