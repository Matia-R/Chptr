/**
 * Form spacing scale — use these instead of ad-hoc space-y / gap values.
 *
 * Small:  elements that form one unit (title→description, label→input, input→helper)
 * Medium: related controls within the same section
 * Large:  distinct conceptual sections (photo vs profile info, content vs actions)
 *
 * Prefer whitespace over cards/borders for hierarchy.
 */
export const formSpacing = {
  /** Title↔description, label↔input, input↔helper, avatar↔instructions */
  tight: "space-y-1.5",
  tightGap: "gap-1.5",

  /** Related field groups within one section */
  stack: "space-y-5",
  stackGap: "gap-5",

  /** Separate conceptual sections or content→actions */
  section: "space-y-8",
  sectionGap: "gap-8",
} as const;
