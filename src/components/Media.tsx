/**
 * Media library (React island) — the reusable bank of uploaded images, shared
 * across every site. Ports src/lib/media.ts: list / upload (client-side
 * optimized) / delete / copy-URL, all against /api/media + /api/upload.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Spinner } from "@heroui/react";
import { Topbar, type TopbarNavLink } from "./admin/Topbar";
import { adminFetch, authHeaders, UnauthorizedError } from "./admin/auth";
import { optimizeImage } from "../lib/imageopt";

interface MediaItem {
  id: number;
  key: string;
  url: string;
  name: string | null;
  content_type: string | null;
  size: number | null;
  slug: string | null;
  created_at: string;
}

const NAV: TopbarNavLink[] = [
  { href: "/admin", label: "Sites" },
  { href: "/admin/media", label: "Media library", active: true },
];

export default function Media() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    setUnauthorized(false);
    try {
      const res = await adminFetch("/api/media");
      if (!res.ok) {
        setLoadError(`Couldn't load media (${res.status}).`);
        return;
      }
      setItems((await res.json()) as MediaItem[]);
    } catch (e) {
      if (e instanceof UnauthorizedError) setUnauthorized(true);
      else setLoadError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (files: FileList) => {
      try {
        for (let i = 0; i < files.length; i++) {
          setUploadStatus(`Optimizing & uploading ${i + 1}/${files.length}…`);
          const { blob, name } = await optimizeImage(files[i]);
          const fd = new FormData();
          fd.append("file", blob, name);
          fd.append("slug", "library");
          // FormData uploads must NOT set Content-Type (boundary is auto-set).
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: authHeaders(),
            body: fd,
          });
          if (res.status === 401) {
            setUnauthorized(true);
            setUploadStatus("");
            return;
          }
          if (!res.ok) {
            setUploadStatus("Upload failed.");
            return;
          }
        }
        setUploadStatus("");
        await refresh();
      } catch {
        setUploadStatus("Upload failed.");
      }
    },
    [refresh],
  );

  const onCopy = useCallback((url: string, key: string) => {
    navigator.clipboard?.writeText(new URL(url, location.origin).toString());
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
  }, []);

  const onDelete = useCallback(
    async (key: string) => {
      if (!confirm("Delete this image from the library? Sites still using it will lose it.")) return;
      try {
        await adminFetch(`/api/media?key=${encodeURIComponent(key)}`, { method: "DELETE" });
        await refresh();
      } catch (e) {
        if (e instanceof UnauthorizedError) setUnauthorized(true);
      }
    },
    [refresh],
  );

  const action = (
    <Button variant="primary" size="md" onPress={() => inputRef.current?.click()}>
      <span aria-hidden="true">+</span> Upload
    </Button>
  );

  return (
    <>
      <Topbar pageName="Media library" nav={NAV} action={action} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
        }}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        <h1 className="font-pl-display text-2xl font-medium tracking-[-0.01em] text-pl-ink">Media library</h1>
        <p className="mb-4 mt-1 max-w-2xl text-sm text-pl-muted">
          Everything you upload (here or from a site's editor) lives here so you can reuse it across clients.
        </p>
        <p className="mb-4 min-h-5 text-sm text-pl-gold">{uploadStatus}</p>

        {unauthorized ? (
          <p className="text-red-700">
            Wrong password.{" "}
            <button
              onClick={() => location.reload()}
              className="font-medium text-pl-gold underline underline-offset-2"
            >
              Try again
            </button>
          </p>
        ) : loadError ? (
          <p className="text-red-700">{loadError}</p>
        ) : items === null ? (
          <div className="flex items-center gap-3 text-pl-muted">
            <Spinner size="sm" /> Loading…
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((m) => (
              <MediaTile
                key={m.key}
                item={m}
                copied={copiedKey === m.key}
                onCopy={onCopy}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-pl-line bg-pl-paper/40 px-6 py-8 text-center text-sm text-pl-muted">
            No media yet. Upload images here or from any site's editor.
          </p>
        )}
      </main>
    </>
  );
}

interface MediaTileProps {
  item: MediaItem;
  copied: boolean;
  onCopy: (url: string, key: string) => void;
  onDelete: (key: string) => void;
}

function MediaTile({ item: m, copied, onCopy, onDelete }: MediaTileProps) {
  return (
    <Card className="group relative overflow-hidden p-0">
      <div className="overflow-hidden bg-pl-wash">
        <img
          src={m.url}
          alt={m.name ?? ""}
          loading="lazy"
          className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <figcaption className="truncate px-2.5 py-2 text-[11px] text-pl-ink-2">{m.name ?? m.key}</figcaption>
      <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1.5 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={() => onCopy(m.url, m.key)}
          className="rounded-md bg-pl-paper/95 px-2 py-1 text-[11px] font-medium text-pl-ink shadow-sm hover:bg-pl-paper"
        >
          {copied ? "Copied!" : "Copy URL"}
        </button>
        <button
          onClick={() => onDelete(m.key)}
          className="rounded-md bg-red-700/90 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </Card>
  );
}
