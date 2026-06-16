/**
 * Editor schema.
 *
 * Describes which fields each section exposes in the Studio, so the editor can
 * auto-build its panels. Keep the `key`s in sync with the interfaces in
 * types.ts. To expose a new editable field, add it here — the Studio picks it
 * up automatically.
 */
import type { SectionKey } from "./types";

/** All field variants may carry optional `help` text (shown as a "?" tooltip). */
export type Field =
  | { kind: "text"; key: string; label: string; help?: string; placeholder?: string }
  | { kind: "textarea"; key: string; label: string; help?: string; placeholder?: string }
  | { kind: "image"; key: string; label: string; help?: string }
  | { kind: "number"; key: string; label: string; help?: string; min?: number; max?: number; step?: number }
  | { kind: "datetime"; key: string; label: string; help?: string }
  | { kind: "pdf"; key: string; label: string; help?: string }
  | { kind: "toggle"; key: string; label: string; help?: string }
  | { kind: "link"; key: string; label: string; help?: string }
  | { kind: "list"; key: string; label: string; itemLabel: string; item: Field[]; help?: string };

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
      { kind: "text", key: "downloadLabel", label: "Download-button text", placeholder: "Download invitation (PDF)", help: "Shown only when a PDF is uploaded. Leave blank for the default." },
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
      { kind: "text", key: "calendar.addLabel", label: "Calendar heading text", placeholder: "Add to calendar" },
      { kind: "text", key: "calendar.googleLabel", label: "Google button text", placeholder: "Google" },
      { kind: "text", key: "calendar.appleLabel", label: "Apple/Outlook button text", placeholder: "Apple / Outlook" },
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
      { kind: "text", key: "eyebrow", label: "Eyebrow", help: "Small line above the title." },
      { kind: "text", key: "title", label: "Title" },
      { kind: "text", key: "venue", label: "Venue name" },
      { kind: "textarea", key: "address", label: "Address", help: "Type the full address — the map buttons are built from this automatically." },
      { kind: "text", key: "coords", label: "Exact coordinates (optional)", help: "lat,lng for a precise pin, e.g. 32.0853,34.7818. Leave blank to use the address." },
      { kind: "textarea", key: "body", label: "Note", help: "Parking, accessibility, etc." },
      { kind: "toggle", key: "maps.google", label: "Show Google Maps button" },
      { kind: "toggle", key: "maps.waze", label: "Show Waze button" },
      { kind: "toggle", key: "maps.apple", label: "Show Apple Maps button" },
      { kind: "toggle", key: "maps.embed", label: "Show inline map" },
      { kind: "text", key: "mapLabels.google", label: "Google button text", placeholder: "Google Maps" },
      { kind: "text", key: "mapLabels.waze", label: "Waze button text", placeholder: "Waze" },
      { kind: "text", key: "mapLabels.apple", label: "Apple button text", placeholder: "Apple Maps" },
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
      { kind: "text", key: "deadlineNote", label: "Deadline note", help: "e.g. 'Please respond by 1 May'." },
      { kind: "number", key: "maxGuests", label: "Max guests per person", min: 1, max: 12, step: 1, help: "The highest number a guest can pick in the dropdown (e.g. 2 or 6)." },
      // One RSVP form. Add events (e.g. Wedding, Henna) and the guest answers
      // attending + guests for EACH event. Leave empty for a simple yes/no.
      {
        kind: "list", key: "events", label: "Events (optional)", itemLabel: "Event",
        help: "Add Wedding, Henna, etc. The guest replies to each one. Leave empty for a single RSVP.",
        item: [
          { kind: "text", key: "id", label: "Id (e.g. wedding, henna)", help: "A short code, letters only. Used to keep responses separate." },
          { kind: "text", key: "label", label: "Heading (e.g. Wedding)" },
        ],
      },
      { kind: "toggle", key: "fields.email", label: "Ask for email" },
      { kind: "toggle", key: "fields.phone", label: "Ask for phone" },
      { kind: "toggle", key: "fields.guests", label: "Ask number of guests" },
      { kind: "toggle", key: "fields.guestNames", label: "Ask guest names" },
      { kind: "toggle", key: "fields.dietary", label: "Ask dietary / kashrut notes" },
      { kind: "toggle", key: "fields.message", label: "Ask for a message" },
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
