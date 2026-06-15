# Visuals for the demo site

These are **placeholder SVGs** so the demo renders out of the box. For a real
client, replace them with the client's images (JPG/PNG) and update the paths in
`../content.json`.

Images here are served at `/visuals/...` and are copied into the build
automatically by `scripts/sync-visuals.mjs`.

| File                | Used by            | Suggested size            |
| ------------------- | ------------------ | ------------------------- |
| `hero.svg`          | Hero background    | Landscape, ~2000px wide   |
| `invitation.svg`    | Event details art  | Portrait                  |
| `gallery/1..3.svg`  | Gallery grid       | Any; portrait looks great |

When you swap in real photos (e.g. `hero.jpg`), update the matching `src` /
`image` paths in `content.json` to point at the new filenames.
