import { VideoMetadataTags } from '../types/converter';

/**
 * Builds an Apple/QuickTime/MP4 metadata data box:
 * [4-byte size] [4-byte 'data'] [4-byte type] [4-byte locale] [payload]
 * Type codes: 1 = UTF-8 text, 13 = JPEG, 14 = PNG
 */
function createDataBox(typeCode: number, payload: Uint8Array): Uint8Array {
  const size = 16 + payload.length;
  const buf = new Uint8Array(size);
  const v = new DataView(buf.buffer);
  v.setUint32(0, size);
  buf.set([100, 97, 116, 97], 4); // 'data'
  v.setUint32(8, typeCode);
  v.setUint32(12, 0); // locale = 0
  buf.set(payload, 16);
  return buf;
}

/**
 * Builds an MP4 item list tag box (e.g. ©nam, ©ART, ©alb, ©day)
 */
function createStringTagBox(tagFourCC: string, text: string): Uint8Array {
  const enc = new TextEncoder();
  const payload = enc.encode(text);
  const dataBox = createDataBox(1, payload); // 1 = UTF-8
  const size = 8 + dataBox.length;
  const buf = new Uint8Array(size);
  const v = new DataView(buf.buffer);
  v.setUint32(0, size);
  buf.set(enc.encode(tagFourCC), 4);
  buf.set(dataBox, 8);
  return buf;
}

/**
 * Builds an MP4 cover artwork tag box (covr)
 */
function createCoverArtBox(imageBytes: Uint8Array): Uint8Array {
  // Check if PNG or JPEG
  const isPng =
    imageBytes.length > 8 &&
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47;
  const typeCode = isPng ? 14 : 13; // 13 = JPEG, 14 = PNG
  const dataBox = createDataBox(typeCode, imageBytes);
  const size = 8 + dataBox.length;
  const buf = new Uint8Array(size);
  const v = new DataView(buf.buffer);
  v.setUint32(0, size);
  const enc = new TextEncoder();
  buf.set(enc.encode('covr'), 4);
  buf.set(dataBox, 8);
  return buf;
}

/**
 * Concatenates multiple Uint8Arrays
 */
function concatBuffers(bufs: Uint8Array[]): Uint8Array {
  const totalLength = bufs.reduce((acc, b) => acc + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of bufs) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

/**
 * Builds a container atom box: [4-byte size] [4-byte fourcc] [payload]
 */
function createContainerBox(fourCC: string, payload: Uint8Array): Uint8Array {
  const size = 8 + payload.length;
  const buf = new Uint8Array(size);
  const v = new DataView(buf.buffer);
  v.setUint32(0, size);
  const enc = new TextEncoder();
  buf.set(enc.encode(fourCC), 4);
  buf.set(payload, 8);
  return buf;
}

/**
 * Creates the standard Apple QuickTime 'meta' atom box containing 'hdlr' and 'ilst'
 */
function createMetaBox(ilstPayload: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  // Standard 'hdlr' box for metadata
  // size(4) + 'hdlr'(4) + version/flags(4) + pre_defined(4) + handler_type 'mdir'(4) + reserved(12) + name(1)
  const hdlrSize = 33;
  const hdlr = new Uint8Array(hdlrSize);
  const hv = new DataView(hdlr.buffer);
  hv.setUint32(0, hdlrSize);
  hdlr.set(enc.encode('hdlr'), 4);
  hv.setUint32(8, 0); // version & flags
  hv.setUint32(12, 0);
  hdlr.set(enc.encode('mdir'), 16); // handler type
  hdlr.set(enc.encode('appl'), 20);

  // 'ilst' box
  const ilstBox = createContainerBox('ilst', ilstPayload);

  // 'meta' box (has 4-byte version/flags before child boxes)
  const metaPayload = concatBuffers([new Uint8Array(4), hdlr, ilstBox]);
  return createContainerBox('meta', metaPayload);
}

/**
 * Shifts stco (32-bit) and co64 (64-bit) chunk offsets inside a moov atom buffer
 */
function shiftChunkOffsets(moovBuf: Uint8Array, delta: number): void {
  const v = new DataView(moovBuf.buffer, moovBuf.byteOffset, moovBuf.byteLength);
  const enc = new TextDecoder();

  for (let i = 0; i < moovBuf.length - 8; i++) {
    const fourCC = enc.decode(moovBuf.subarray(i + 4, i + 8));
    if (fourCC === 'stco') {
      const boxSize = v.getUint32(i);
      if (boxSize > 12 && i + boxSize <= moovBuf.length) {
        const entryCount = v.getUint32(i + 12);
        let offsetPtr = i + 16;
        for (let j = 0; j < entryCount && offsetPtr + 4 <= i + boxSize; j++) {
          const currentOffset = v.getUint32(offsetPtr);
          v.setUint32(offsetPtr, currentOffset + delta);
          offsetPtr += 4;
        }
      }
    } else if (fourCC === 'co64') {
      const boxSize = v.getUint32(i);
      if (boxSize > 12 && i + boxSize <= moovBuf.length) {
        const entryCount = v.getUint32(i + 12);
        let offsetPtr = i + 16;
        for (let j = 0; j < entryCount && offsetPtr + 8 <= i + boxSize; j++) {
          const high = v.getUint32(offsetPtr);
          const low = v.getUint32(offsetPtr + 4);
          const currentOffset = BigInt(high) * 0x100000000n + BigInt(low);
          const newOffset = currentOffset + BigInt(delta);
          v.setUint32(offsetPtr, Number(newOffset / 0x100000000n));
          v.setUint32(offsetPtr + 4, Number(newOffset & 0xffffffffn));
          offsetPtr += 8;
        }
      }
    }
  }
}

/**
 * Injects MP4 ID3/iTunes metadata tags and cover artwork into an MP4 ArrayBuffer
 */
export async function injectMp4Metadata(
  mp4Buffer: ArrayBuffer,
  tags: VideoMetadataTags | undefined
): Promise<Blob> {
  if (!tags) return new Blob([mp4Buffer], { type: 'video/mp4' });

  const tagBoxes: Uint8Array[] = [];

  if (tags.title && tags.title.trim()) {
    tagBoxes.push(createStringTagBox('\xa9nam', tags.title.trim()));
  }
  if (tags.artist && tags.artist.trim()) {
    tagBoxes.push(createStringTagBox('\xa9ART', tags.artist.trim()));
  }
  if (tags.album && tags.album.trim()) {
    tagBoxes.push(createStringTagBox('\xa9alb', tags.album.trim()));
  }
  if (tags.year && tags.year.trim()) {
    tagBoxes.push(createStringTagBox('\xa9day', tags.year.trim()));
  }

  // Cover image
  if (tags.coverImage) {
    try {
      let imageBytes: Uint8Array;
      if (tags.coverImage instanceof Uint8Array) {
        imageBytes = tags.coverImage;
      } else {
        const arrayBuf = await tags.coverImage.arrayBuffer();
        imageBytes = new Uint8Array(arrayBuf);
      }
      if (imageBytes.length > 0) {
        tagBoxes.push(createCoverArtBox(imageBytes));
      }
    } catch (err) {
      console.warn('Could not read cover image for metadata injection:', err);
    }
  }

  if (tagBoxes.length === 0) {
    return new Blob([mp4Buffer], { type: 'video/mp4' });
  }

  try {
    const rawBuf = new Uint8Array(mp4Buffer);
    const v = new DataView(rawBuf.buffer);
    const enc = new TextDecoder();

    // Find moov box in top-level atoms
    let offset = 0;
    let moovStart = -1;
    let moovSize = 0;

    while (offset < rawBuf.length - 8) {
      let size = v.getUint32(offset);
      const fourCC = enc.decode(rawBuf.subarray(offset + 4, offset + 8));

      if (size === 1) {
        // 64-bit size
        const high = v.getUint32(offset + 8);
        const low = v.getUint32(offset + 12);
        size = Number(BigInt(high) * 0x100000000n + BigInt(low));
      } else if (size === 0) {
        size = rawBuf.length - offset;
      }

      if (fourCC === 'moov') {
        moovStart = offset;
        moovSize = size;
        break;
      }

      offset += size;
    }

    if (moovStart === -1 || moovSize <= 8) {
      return new Blob([mp4Buffer], { type: 'video/mp4' });
    }

    // Build udta box containing meta + ilst
    const ilstPayload = concatBuffers(tagBoxes);
    const metaBox = createMetaBox(ilstPayload);
    const udtaBox = createContainerBox('udta', metaBox);

    const oldMoovBytes = rawBuf.subarray(moovStart, moovStart + moovSize);

    // Create new moov with udta appended
    const newMoovSize = moovSize + udtaBox.length;
    const newMoovBytes = new Uint8Array(newMoovSize);
    newMoovBytes.set(oldMoovBytes, 0);
    newMoovBytes.set(udtaBox, moovSize);

    // Update moov size header
    const moovView = new DataView(newMoovBytes.buffer);
    moovView.setUint32(0, newMoovSize);

    // Shift chunk offsets in stco / co64 by the udtaBox delta
    shiftChunkOffsets(newMoovBytes, udtaBox.length);

    // Construct final MP4 file buffer
    const beforeMoov = rawBuf.subarray(0, moovStart);
    const afterMoov = rawBuf.subarray(moovStart + moovSize);

    const finalFileBytes = concatBuffers([beforeMoov, newMoovBytes, afterMoov]);
    return new Blob([finalFileBytes as unknown as BlobPart], { type: 'video/mp4' });
  } catch (err) {
    console.warn('Metadata injection encountered an error, using original file:', err);
    return new Blob([mp4Buffer as unknown as BlobPart], { type: 'video/mp4' });
  }
}
