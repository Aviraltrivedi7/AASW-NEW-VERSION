import fs from "fs";
import path from "path";
import type { Express, Response } from "express";
import { isPublishedGalleryStorageKey } from "../db";
import { ENV } from "./env";

const rootPublicAssetKey = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

// Source-backed website assets are also committed under
// client/public/manus-storage so they stay available when the storage backend
// is not configured (local development without Forge credentials).
const localPublicStorageDir = path.resolve(import.meta.dirname, "../../client/public/manus-storage");

const storageContentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export function normalizePublicStorageKey(key: string) {
  const normalized = key.trim();
  if (!normalized || normalized !== key || normalized.includes("\\") || normalized.includes("..") || normalized.includes("\0")) return null;
  return normalized;
}

export async function canServePublicStorageKey(
  key: string,
  dependencies: { isPublishedGalleryStorageKey?: (storageKey: string) => Promise<boolean> } = {},
) {
  const normalized = normalizePublicStorageKey(key);
  if (!normalized) return false;

  // Existing source-backed public website assets were uploaded at the storage root.
  if (rootPublicAssetKey.test(normalized)) return true;

  // Gallery uploads are public only after an authorized Foundation admin publishes
  // their associated record. Private ID proof, member and MIS keys are never served.
  if (!normalized.startsWith("gallery-media/")) return false;
  const lookup = dependencies.isPublishedGalleryStorageKey ?? isPublishedGalleryStorageKey;
  try {
    return await lookup(normalized);
  } catch (error) {
    // If the publication status cannot be verified, the asset stays private.
    console.error("[StorageProxy] gallery publication lookup failed:", error);
    return false;
  }
}

/**
 * Serves a sanitized storage key from the committed local assets directory.
 * The key has already passed normalizePublicStorageKey (no `..`, backslashes
 * or null bytes) and gallery keys additionally require a published record,
 * so the resolved path stays inside the fixed local directory.
 */
export function serveLocalStorageAsset(key: string, res: Response): boolean {
  const localPath = path.join(localPublicStorageDir, key);
  if (!localPath.startsWith(localPublicStorageDir + path.sep)) return false;
  if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) return false;
  const contentType = storageContentTypes[path.extname(key).toLowerCase()];
  if (!contentType) return false;
  res.set("Cache-Control", "public, max-age=86400");
  res.type(contentType).sendFile(localPath);
  return true;
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!(await canServePublicStorageKey(key))) {
      res.status(404).send("Stored asset was not found");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      // Without storage-backend credentials the committed public assets are
      // served from disk; private and unpublished keys were already rejected
      // by canServePublicStorageKey above.
      if (serveLocalStorageAsset(key, res)) return;
      res.status(500).send("Storage proxy not configured");
      return;
    }

    let forgeApiUrl: string;
    let forgeApiKey: string;
    try {
      forgeApiUrl = new URL(ENV.forgeApiUrl).toString();
      forgeApiKey = ENV.forgeApiKey;
    } catch {
      console.error("[StorageProxy] invalid BUILT_IN_FORGE_API_URL configured");
      res.status(500).send("Storage proxy misconfigured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
