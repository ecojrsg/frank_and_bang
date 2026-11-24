// @Author: Jonathan Serna
// @Date:   2026-11-23 20:57:00
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:57:00

/**
 * Upload local PNG/SVG files from assets/parts-assets/ into the Supabase
 * Storage bucket named "parts-assets".
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, extname, join, relative } from "path";
import { fileURLToPath } from "url";

import { createClient } from "@supabase/supabase-js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const ASSETS_ROOT = join(currentDir, "..", "assets", "parts-assets");
const BUCKET_NAME = "parts-assets";

const MIME_BY_EXTENSION = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Recursively collect all supported image file paths under a directory.
 */
function collectAssetFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectAssetFiles(fullPath));
      continue;
    }
    const ext = extname(fullPath).toLowerCase();
    if (MIME_BY_EXTENSION[ext]) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Upload every collected asset to Supabase Storage with upsert enabled.
 */
async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const files = collectAssetFiles(ASSETS_ROOT);

  for (const filePath of files) {
    const storagePath = relative(ASSETS_ROOT, filePath).replaceAll("\\", "/");
    const contentType = MIME_BY_EXTENSION[extname(filePath).toLowerCase()];
    const buffer = readFileSync(filePath);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) {
      console.error(`Failed to upload ${storagePath}: ${error.message}`);
      process.exit(1);
    }

    console.log(`Uploaded ${storagePath} -> ${BUCKET_NAME}`);
  }

  console.log(`Done. Uploaded ${files.length} asset(s) to ${BUCKET_NAME}.`);
}

main();
