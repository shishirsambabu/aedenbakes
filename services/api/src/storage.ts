import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type StoredObject = {
  key: string;
  sizeBytes: number;
  checksumSha256: string;
};

// A minimal filesystem-backed object store used for local/dev document
// storage until R2/S3 credentials are supplied. Keys are namespaced paths;
// traversal segments are stripped so a key can never escape the root.
export class LocalObjectStorage {
  constructor(private readonly root: string) {
    mkdirSync(this.root, { recursive: true });
  }

  private resolveKey(key: string) {
    const safe = key
      .replace(/\\/g, '/')
      .split('/')
      .filter((segment) => segment && segment !== '.' && segment !== '..')
      .join('/');
    if (!safe) {
      throw new Error('Invalid storage key');
    }
    return join(this.root, safe);
  }

  put(key: string, data: Buffer): StoredObject {
    const target = this.resolveKey(key);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    return {
      key,
      sizeBytes: data.length,
      checksumSha256: createHash('sha256').update(data).digest('hex'),
    };
  }

  get(key: string): Buffer | null {
    const target = this.resolveKey(key);
    if (!existsSync(target)) {
      return null;
    }
    return readFileSync(target);
  }

  exists(key: string): boolean {
    return existsSync(this.resolveKey(key));
  }

  remove(key: string): void {
    const target = this.resolveKey(key);
    if (existsSync(target)) {
      rmSync(target);
    }
  }
}

export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type AllowedDocumentMime = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

// Sniffs the file's leading bytes so a caller cannot mislabel content by
// declaring a different MIME type than the actual payload.
export function detectMimeFromBytes(data: Buffer): AllowedDocumentMime | null {
  if (data.length >= 5 && data.toString('latin1', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

export type DocumentUploadValidation =
  | { ok: true; data: Buffer; mimeType: AllowedDocumentMime; sizeBytes: number; checksumSha256: string }
  | { ok: false; status: 400 | 413 | 415; error: string };

// Decodes a base64 upload, enforces the size ceiling, and confirms the bytes
// match an allowed, detectable document type (optionally cross-checking a
// declared MIME type). This is also the natural place to add a malware scan.
export function validateDocumentUpload(contentBase64: string, declaredMime?: string): DocumentUploadValidation {
  const trimmed = contentBase64.trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: 'contentBase64 is empty' };
  }

  let data: Buffer;
  try {
    data = Buffer.from(trimmed, 'base64');
  } catch {
    return { ok: false, status: 400, error: 'contentBase64 is not valid base64' };
  }
  if (data.length === 0) {
    return { ok: false, status: 400, error: 'Uploaded file is empty' };
  }
  if (data.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, status: 413, error: `File exceeds the ${MAX_DOCUMENT_BYTES} byte limit` };
  }

  const detected = detectMimeFromBytes(data);
  if (!detected) {
    return { ok: false, status: 415, error: 'Unsupported or unrecognized file type' };
  }
  if (declaredMime && declaredMime.trim() && declaredMime.trim() !== detected) {
    return { ok: false, status: 415, error: `Declared MIME type ${declaredMime} does not match file content` };
  }

  return {
    ok: true,
    data,
    mimeType: detected,
    sizeBytes: data.length,
    checksumSha256: createHash('sha256').update(data).digest('hex'),
  };
}

export function extensionForMime(mime: AllowedDocumentMime) {
  switch (mime) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    default:
      return 'bin';
  }
}
