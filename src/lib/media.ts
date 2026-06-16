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
  return `<figure class="pl-card group relative overflow-hidden p-0">
    <div class="overflow-hidden bg-pl-wash">
      <img src="${esc(m.url)}" alt="${esc(m.name ?? "")}" loading="lazy" class="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.03]">
    </div>
    <figcaption class="truncate px-2.5 py-2 text-[11px] text-pl-ink-2">${esc(m.name ?? m.key)}</figcaption>
    <div class="absolute inset-x-0 top-0 flex justify-end gap-1 p-1.5 opacity-0 transition group-hover:opacity-100">
      <button data-copy="${esc(m.url)}" class="rounded-md bg-pl-paper/95 px-2 py-1 text-[11px] font-medium text-pl-ink shadow-sm hover:bg-pl-paper">Copy URL</button>
      <button data-del="${esc(m.key)}" class="rounded-md bg-red-700/90 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-red-700">Delete</button>
    </div>
  </figure>`;
}

async function refresh(): Promise<void> {
  const root = document.getElementById("pl-media")!;
  const res = await fetch("/api/media", { headers: authHeaders() });
  if (res.status === 401) { sessionStorage.removeItem("pl_admin"); root.innerHTML = `<p class="text-red-700">Wrong password. <button onclick="location.reload()" class="font-medium text-pl-gold underline underline-offset-2">Try again</button></p>`; return; }
  if (!res.ok) { root.innerHTML = `<p class="text-red-700">Couldn't load media (${res.status}).</p>`; return; }
  const items = (await res.json()) as MediaItem[];
  root.innerHTML = items.length
    ? `<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">${items.map(tile).join("")}</div>`
    : `<p class="rounded-2xl border border-dashed border-pl-line bg-pl-paper/40 px-6 py-8 text-center text-sm text-pl-muted">No media yet. Upload images here or from any site's editor.</p>`;
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
