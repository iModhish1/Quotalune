import { invoke } from "@tauri-apps/api/core";

/**
 * Wave 1F §22-30: TS mirror of the Rust `StructureQaFixture` struct
 * (surfaces/qa_fixture.rs). Free-text fields intentionally match
 * `demo/ReelPreview.tsx`'s own fixture-state shape (Wave 1E) so the
 * browser-lane and native-lane Dev QA panels describe the same
 * dimensions with the same values.
 */
export interface StructureQaFixture {
  providerCount: number;
  nameLength: "normal" | "long";
  resetLength: "normal" | "long" | "unavailable";
  windows: 1 | 2;
  dataState: "available" | "loading" | "refreshing" | "unavailable" | "error" | "timeout";
  pinned: boolean;
}

export const getStructureQaFixture = (): Promise<StructureQaFixture | null> =>
  invoke("get_structure_qa_fixture");

/** Refused by the backend outside the Dev channel -- see
 * surfaces/qa_fixture.rs's own doc comment for why that gate lives
 * server-side, not just in this file. */
export const setStructureQaFixture = (fixture: StructureQaFixture | null): Promise<void> =>
  invoke("set_structure_qa_fixture", { fixture });

export const resetStructureQaFixture = (): Promise<void> => invoke("reset_structure_qa_fixture");
