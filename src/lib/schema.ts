/**
 * Editor schema.
 *
 * Describes which fields each section exposes in the Studio, so the editor can
 * auto-build its panels. Keep the `key`s in sync with the interfaces in
 * types.ts. To expose a new editable field, add it here — the Studio picks it
 * up automatically.
 */
import type { SectionKey } from "./types";

export type Field =
  | { kind: "text"; key: string; label: string }
  | { kind: "textarea"; key: string; label: string }
  | { kind: "image"; key: string; label: string }
  | { kind: "number"; key: string; label: string; min?: number; max?: number; step?: number }
  | { kind: "datetime"; key: string; label: string }
  | { kind: "pdf"; key: string; label: string }
  | { kind: "link"; key: string; label: string }
  | { kind: "list"; key: string; label: string; itemLabel: string; item: Field[] };

export interface SectionSchema {
  key: SectionKey;
  /** Friendly name shown in the editor (English; the editor UI is for you). */
  title: string;
  fields: Field[];
}

export const SECTION_SCHEMAS: SectionSchema[] = [
  {
    key: "pages",
    title: "Invitation (PDF)",
    fields: [
      { kind: "pdf", key: "images", label: "Upload your invitation PDF" },
      { kind: "text", key: "title", label: "Heading above (optional)" },
      { kind: "textarea", key: "body", label: "Text above (optional)" },
      {
        kind: "list", key: "images", label: "Pages", itemLabel: "Page",
        item: [{ kind: "image", key: "src", label: "Image" }],
      },
    ],
  },
  // Free blocks — editor is bespoke (see studio.ts customEditor); no schema fields.
  { key: "custom", title: "Free blocks", fields: [] },
  {
    key: "hero",
    title: "Hero / cover",
    fields: [
      { kind: "text", key: "eyebrow", label: "Eyebrow (small line above)" },
      { kind: "text", key: "title", label: "Title (names)" },
      { kind: "text", key: "subtitle", label: "Subtitle" },
      { kind: "text", key: "date", label: "Date" },
      { kind: "text", key: "location", label: "Location" },
      { kind: "image", key: "image", label: "Background image" },
      { kind: "number", key: "overlay", label: "Photo darkening", min: 0, max: 1, step: 0.05 },
      { kind: "link", key: "cta", label: "Button" },
    ],
  },
  {
    key: "eventDetails",
    title: "Event details",
    fields: [
      { kind: "text", key: "eyebrow", label: "Eyebrow" },
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "body", label: "Intro paragraph" },
      { kind: "image", key: "image", label: "Invitation image" },
      {
        kind: "list", key: "items", label: "Details", itemLabel: "Detail",
        item: [
          { kind: "text", key: "label", label: "Label" },
          { kind: "text", key: "value", label: "Value" },
        ],
      },
      // Add-to-calendar (optional). Set a start to show the buttons.
      { kind: "datetime", key: "calendar.start", label: "Add-to-calendar: start" },
      { kind: "datetime", key: "calendar.end", label: "Add-to-calendar: end (optional)" },
      { kind: "text", key: "calendar.location", label: "Add-to-calendar: location (optional)" },
    ],
  },
  {
    key: "schedule",
    title: "Schedule",
    fields: [
      { kind: "text", key: "eyebrow", label: "Eyebrow" },
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "body", label: "Intro" },
      {
        kind: "list", key: "items", label: "Items", itemLabel: "Moment",
        item: [
          { kind: "text", key: "time", label: "Time" },
          { kind: "text", key: "title", label: "Title" },
          { kind: "textarea", key: "description", label: "Description" },
        ],
      },
    ],
  },
  {
    key: "location",
    title: "Location",
    fields: [
      { kind: "text", key: "eyebrow", label: "Eyebrow" },
      { kind: "text", key: "title", label: "Title" },
      { kind: "text", key: "venue", label: "Venue name" },
      { kind: "textarea", key: "address", label: "Address" },
      { kind: "textarea", key: "body", label: "Note" },
      { kind: "text", key: "mapUrl", label: "Directions link (Google/Waze)" },
      { kind: "text", key: "mapEmbedUrl", label: "Embedded map URL (optional)" },
    ],
  },
  {
    key: "gallery",
    title: "Gallery",
    fields: [
      { kind: "text", key: "eyebrow", label: "Eyebrow" },
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "body", label: "Intro" },
      {
        kind: "list", key: "images", label: "Photos", itemLabel: "Photo",
        item: [
          { kind: "image", key: "src", label: "Image" },
          { kind: "text", key: "alt", label: "Description (for accessibility)" },
        ],
      },
    ],
  },
  {
    key: "rsvp",
    title: "RSVP form",
    fields: [
      { kind: "text", key: "eyebrow", label: "Eyebrow" },
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "body", label: "Intro" },
      { kind: "text", key: "deadlineNote", label: "Deadline note" },
      // Leave empty for a single RSVP form. Add events (e.g. Wedding, Henna) to
      // show one form each — responses are tracked separately per event.
      {
        kind: "list", key: "events", label: "Separate RSVP blocks (optional)", itemLabel: "Event",
        item: [
          { kind: "text", key: "id", label: "Id (e.g. wedding, henna)" },
          { kind: "text", key: "label", label: "Heading (e.g. Wedding)" },
        ],
      },
    ],
  },
  {
    key: "contact",
    title: "Contact form",
    fields: [
      { kind: "text", key: "eyebrow", label: "Eyebrow" },
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "body", label: "Intro" },
    ],
  },
  {
    key: "faq",
    title: "FAQ",
    fields: [
      { kind: "text", key: "eyebrow", label: "Eyebrow" },
      { kind: "text", key: "title", label: "Title" },
      {
        kind: "list", key: "items", label: "Questions", itemLabel: "Question",
        item: [
          { kind: "text", key: "question", label: "Question" },
          { kind: "textarea", key: "answer", label: "Answer" },
        ],
      },
    ],
  },
];

export const SCHEMA_BY_KEY: Record<string, SectionSchema> = Object.fromEntries(
  SECTION_SCHEMAS.map((s) => [s.key, s]),
);
