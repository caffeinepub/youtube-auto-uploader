export async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!data.access_token) {
    throw new Error(data.error_description || "Failed to get access token");
  }
  return data.access_token;
}

// Legacy: only used for small files / fallback
export async function downloadFromDrive(
  fileId: string,
  accessToken: string,
): Promise<Blob> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return response.blob();
}

/**
 * Upload a Google Drive file directly to YouTube using resumable upload.
 * Downloads the file from Drive in 8 MB chunks and streams each chunk
 * to the YouTube resumable upload endpoint — the full file is never
 * held in memory at once.
 */
export async function uploadDriveFileToYouTube(
  fileId: string,
  fileName: string,
  accessToken: string,
  titleOverride?: string,
  descriptionOverride?: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // ── 1. Get Drive file metadata (size + mimeType) ──────────────────────────
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size%2CmimeType`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!metaRes.ok)
    throw new Error(`Drive metadata error: ${metaRes.statusText}`);
  const meta = await metaRes.json();
  if (meta.error) throw new Error(meta.error.message);
  const fileSize = Number.parseInt(meta.size, 10);
  const mimeType: string = meta.mimeType || "video/mp4";

  if (!fileSize || Number.isNaN(fileSize)) {
    throw new Error("Could not determine file size from Google Drive.");
  }

  // ── 2. Initiate YouTube resumable upload ──────────────────────────────────
  const videoMetadata = {
    snippet: {
      title: titleOverride || fileName.replace(/\.[^/.]+$/, ""),
      description:
        descriptionOverride ||
        "Uploaded automatically by YouTube Auto Uploader",
      categoryId: "22",
    },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(fileSize),
        "X-Upload-Content-Type": mimeType,
      },
      body: JSON.stringify(videoMetadata),
    },
  );

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `YouTube initiation failed: ${initRes.status}`,
    );
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload URL.");

  // ── 3. Upload in 8 MB chunks ──────────────────────────────────────────────
  const CHUNK = 8 * 1024 * 1024; // 8 MB (must be multiple of 256 KB)
  let offset = 0;

  while (offset < fileSize) {
    const end = Math.min(offset + CHUNK - 1, fileSize - 1);
    const chunkSize = end - offset + 1;

    // Download this range from Drive
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Range: `bytes=${offset}-${end}`,
        },
      },
    );
    if (!driveRes.ok && driveRes.status !== 206) {
      throw new Error(`Drive download error: ${driveRes.statusText}`);
    }
    const chunk = await driveRes.arrayBuffer();

    // Upload this chunk to YouTube
    const ytRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${offset}-${end}/${fileSize}`,
        "Content-Type": mimeType,
      },
      body: chunk,
    });

    offset = end + 1;
    onProgress?.(Math.round((offset / fileSize) * 100));

    if (offset >= fileSize) {
      // Last chunk — expect 200 or 201 with the video resource
      if (ytRes.status === 200 || ytRes.status === 201) {
        const data = await ytRes.json();
        if (!data.id)
          throw new Error("YouTube upload finished but no video ID returned.");
        return data.id;
      }
      const errData = await ytRes.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message || `YouTube upload error: ${ytRes.status}`,
      );
    }

    // Intermediate chunk — expect 308 Resume Incomplete
    if (ytRes.status !== 308) {
      const errData = await ytRes.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message ||
          `Unexpected status ${ytRes.status} during upload`,
      );
    }
  }

  throw new Error("Upload loop exited without returning a video ID.");
}

export async function uploadToYouTube(
  videoBlob: Blob,
  fileName: string,
  accessToken: string,
  titleOverride?: string,
  descriptionOverride?: string,
): Promise<string> {
  const metadata = {
    snippet: {
      title: titleOverride || fileName.replace(/\.[^/.]+$/, ""),
      description:
        descriptionOverride ||
        "Uploaded automatically by YouTube Auto Uploader",
      categoryId: "22",
    },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    contentDetails: { definition: "hd" },
  };
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append("video", videoBlob);
  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status,contentDetails",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );
  const data = await response.json();
  if (!data.id) {
    throw new Error(data.error?.message || "YouTube upload failed");
  }
  return data.id;
}

export interface DriveFile {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
}

/**
 * Lists ALL video files in a Drive folder, automatically paginating
 * through multiple pages so folders with 500+ videos are fully loaded.
 */
export async function listDriveFiles(
  folderId: string,
  accessToken: string,
): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'video' and trashed = false`,
  );
  const fields = encodeURIComponent(
    "nextPageToken,files(id,name,size,modifiedTime)",
  );

  const allFiles: DriveFile[] = [];
  let pageToken: string | null = null;

  do {
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=${fields}&pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();

    if (!data.files) {
      throw new Error(data.error?.message || "Failed to list Drive files");
    }

    allFiles.push(...(data.files as DriveFile[]));
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  return allFiles;
}
