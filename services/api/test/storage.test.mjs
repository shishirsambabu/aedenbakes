import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  LocalObjectStorage,
  MAX_DOCUMENT_BYTES,
  detectMimeFromBytes,
  extensionForMime,
  validateDocumentUpload,
} from '../dist/storage.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n', 'latin1');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('payload')]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('payload')]);

test('detects the supported document signatures', () => {
  assert.equal(detectMimeFromBytes(PDF), 'application/pdf');
  assert.equal(detectMimeFromBytes(PNG), 'image/png');
  assert.equal(detectMimeFromBytes(JPEG), 'image/jpeg');
  assert.equal(detectMimeFromBytes(Buffer.from('just text')), null);
});

test('validateDocumentUpload accepts allowed types and reports checksum and size', () => {
  const result = validateDocumentUpload(PDF.toString('base64'));
  assert.equal(result.ok, true);
  assert.equal(result.mimeType, 'application/pdf');
  assert.equal(result.sizeBytes, PDF.length);
  assert.equal(result.checksumSha256, createHash('sha256').update(PDF).digest('hex'));
});

test('validateDocumentUpload rejects empty, unrecognized, mismatched, and oversized content', () => {
  assert.equal(validateDocumentUpload('').ok, false);
  assert.equal(validateDocumentUpload(Buffer.from('plain text').toString('base64')).status, 415);
  assert.equal(validateDocumentUpload(PDF.toString('base64'), 'image/png').status, 415);

  const oversized = Buffer.alloc(MAX_DOCUMENT_BYTES + 1);
  PDF.copy(oversized); // give it a valid signature so only the size check can fail
  assert.equal(validateDocumentUpload(oversized.toString('base64')).status, 413);
});

test('extension mapping covers the allowed types', () => {
  assert.deepEqual([...ALLOWED_DOCUMENT_MIME_TYPES], ['application/pdf', 'image/jpeg', 'image/png']);
  assert.equal(extensionForMime('application/pdf'), 'pdf');
  assert.equal(extensionForMime('image/jpeg'), 'jpg');
  assert.equal(extensionForMime('image/png'), 'png');
});

test('LocalObjectStorage round-trips bytes and resists path traversal', () => {
  const root = mkdtempSync(join(tmpdir(), 'aeden-storage-'));
  try {
    const storage = new LocalObjectStorage(root);
    const stored = storage.put('documents/cust_x/doc_1.pdf', PDF);
    assert.equal(stored.sizeBytes, PDF.length);
    assert.equal(storage.exists('documents/cust_x/doc_1.pdf'), true);
    assert.ok(storage.get('documents/cust_x/doc_1.pdf').equals(PDF));

    // Traversal segments are stripped, so the write stays inside the root.
    const escaped = storage.put('../../etc/evil.pdf', PDF);
    assert.equal(escaped.key, '../../etc/evil.pdf');
    assert.equal(storage.exists('etc/evil.pdf'), true);

    storage.remove('documents/cust_x/doc_1.pdf');
    assert.equal(storage.exists('documents/cust_x/doc_1.pdf'), false);
    assert.equal(storage.get('documents/cust_x/doc_1.pdf'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
