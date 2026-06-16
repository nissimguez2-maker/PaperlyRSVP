/**
 * Media library (client-side) — your reusable bank of uploaded images, shared
 * across every site. Loaded by src/pages/admin/media.astro.
 */
import { esc } from "./render";
import { optimizeImage } from "./imageopt";

interface MediaItem {
  id: number; key: string; url: string; name: string | null;
  content_type: string | null; size: number | null; slug: string | null; created_at: string;
}

function adminPw(): string {
  let pw = sessionStorage.getItem("pl_admin");
  if (!pw) { pw = window.prompt("Enter the admin password:") || ""; if (pw) sessionStorage.setItem("pl_admin", pw); }
  return pw;
}
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: "Basic " + btoa("admin:" + adminPw()), ...extra };
}

function tile(m: MediaItem): string {
  return `<figure class="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white">
    <img src="${esc(m.url)}" alt="${esc(m.name ?? "")}" loading="lazy" class="aspect-square w-full object-cover">
    <figcaption class="truncate px-2 py-1.5 text-[11px] text-neutral-500">${esc(m.name ?? m.key)}</figcaption>
    <div class="absolute inset-x-0 top-0 flex justify-end gap-1 p-1.5 opacity-0 transition group-hover:opacity-100">
      <button data-copy="${esc(m.url)}" class="rounded bg-white/90 px-2 py-1 text-[11px] shadow hover:bg-white">Copy URL</button>
      <button data-del="${esc(m.key)}" class="rounded bg-red-600/90 px-2 py-1 text-[11px] text-white shadow hover:bg-red-600">Delete</button>
    </div>
  </figure>`;
}

async function refresh(): Promise<void> {
  const root = document.getElementById("pl-media")!;
  const res = await fetch("/api/media", { headers: authHeaders() });
  if (res.status === 401) { sessionStorage.removeItem("pl_admin"); root.innerHTML = `<p class="text-red-600">Wrong password. <button onclick="location.reload()" class="underline">Try again</button></p>`; return; }
  if (!res.ok) { root.innerHTML = `<p class="text-red-600">Couldn't load media (${res.status}).</p>`; return; }
  const items = (await res.json()) as MediaItem[];
  root.innerHTML = items.length
    ? `<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">${items.map(tile).join("")}</div>`
    : `<p class="rounded-2xl border border-dashed border-neutral-200 p-6 text-sm text-neutral-400">No media yet. Upload images here or from any site's editor.</p>`;
}

async function upload(files: FileList): Promise<void> {
  const status = document.getElementById("pl-upload-status")!;
  for (let i = 0; i < files.length; i++) {
    status.textContent = `Optimizing & uploading ${i + 1}/${files.length}…`;
    const { blob, name } = await optimizeImage(files[i]);
    const form = new FormData();
    form.append("file", blob, name);
    form.append("slug", "library");
    const res = await fetch("/api/upload", { method: "POST", headers: authHeaders(), body: form });
    if (!res.ok) { status.textContent = "Upload failed."; return; }
  }
  status.textContent = "";
  await refresh();
}

export function initMedia(): void {
  const input = document.getElementById("pl-upload") as HTMLInputElement | null;
  input?.addEventListener("change", () => { if (input.files?.length) upload(input.files); });

  document.getElementById("pl-media")!.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;
    const copy = t.getAttribute("data-copy");
    const del = t.getAttribute("data-del");
    if (copy) {
      navigator.clipboard?.writeText(new URL(copy, location.origin).toString());
      t.textContent = "Copied!";
      setTimeout(() => (t.textContent = "Copy URL"), 1200);
    } else if (del) {
      if (!confirm("Delete this image from the library? Sites still using it will lose it.")) return;
      await fetch(`/api/media?key=${encodeURIComponent(del)}`, { method: "DELETE", headers: authHeaders() });
      await refresh();
    }
  });
  refresh();
}
