import {render,screen} from "@testing-library/react";
import {expect,it} from "vitest";
import StructurePreview from "./StructurePreview";
it("renders the real provider gauge while keeping provider identity independent from the theme",()=>{
  const {container}=render(<StructurePreview form="satellite" catalog="ember-alloy"/>);
  expect(container.querySelector('[stroke="#10a37f"]')).not.toBeNull();
  expect(container.querySelector('[inert]')).not.toBeNull();
});

it("shows the truthful compact footprint when requested",()=>{
  render(<StructurePreview form="lens" showDimensions/>);
  expect(screen.getByText("178 × 76 px")).toBeInTheDocument();
});

it("carries the selected identity motion into its hover preview",()=>{
  const {container}=render(<StructurePreview form="satellite" catalog="sapphire-observatory" expanded/>);
  const preview=container.querySelector<HTMLElement>(".structure-preview")!;
  expect(preview).toHaveAttribute("data-motion-character","reticle");
  expect(preview.style.getPropertyValue("--qa-theme-motion-enter-y")).toBe("-5px");
});
