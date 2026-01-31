/**
 * zh-chardet.js
 * A pure JS library to detect Chinese encodings (UTF-8, UTF-16, GBK, Big5).
 * @module zh-chardet
 */

/**
 * @typedef {'UTF-8' | 'UTF-16BE' | 'UTF-16LE' | 'GBK' | 'Big5' | 'ISO-2022-CN' | 'HZ-GB-2312' | 'EUC-TW' | 'Unknown'} Encoding
 */

/**
 * Detects encoding of a Uint8Array.
 * @param {Uint8Array} bytes - The input byte buffer to analyze.
 * @param {Object} [options] - Optional configuration.
 * @returns {Encoding} The detected encoding.
 */
export function detect(bytes, options) {
  const len = bytes.length;

  // 1. BOM Check
  if (len >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'UTF-8';
  }
  if (len >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return 'UTF-16BE';
  }
  if (len >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return 'UTF-16LE';
  }

  // Limit sample size for performance if needed, but for correctness use what we have (or up to ~4KB?)
  // Crystal code uses 1024 bytes.
  const sampleSize = Math.min(len, 2048);
  const sample = bytes.subarray(0, sampleSize);

  // 2. ISO-2022-CN and HZ-GB-2312 checks
  // These are 7-bit checks so we can look at the bytes directly or convert to ASCII string
  // ISO-2022-CN: ESC $ ) A, ESC $ ) G ...
  // HZ-GB-2312: ~{ ... ~}

  // Simple byte search for sequences
  if (findSequence(sample, [0x1B, 0x24, 0x29, 0x41]) || // ESC $ ) A
      findSequence(sample, [0x1B, 0x24, 0x29, 0x47]) || // ESC $ ) G
      findSequence(sample, [0x1B, 0x24, 0x2A, 0x48])) { // ESC $ * H
     return 'ISO-2022-CN';
  }

  if (findSequence(sample, [0x7E, 0x7B])) { // ~{
    // Check for closing or other HZ characteristic?
    // HZ usually has ~{ and ~}
    if (findSequence(sample, [0x7E, 0x7D])) { // ~}
      return 'HZ-GB-2312';
    }
  }

  // 3. UTF-8 Validation
  // Check if it is valid UTF-8.
  // We try to decode with fatal=true. If it throws, it's not pure UTF-8 (or truncated).
  // Handle truncation: try to decode ignoring the last few bytes if it fails at the end.
  if (isValidUtf8(sample)) {
    return 'UTF-8';
  }

  // 4. Disambiguate GBK (GB18030) vs Big5 vs EUC-TW
  // We will decode as both and count Hanzi characters.

  /** @type {string[]} */
  const candidates = ['GBK', 'Big5', 'EUC-TW'];

  /** @type {Encoding} */
  let bestEnc = 'Unknown';
  let bestScore = -1;

  for (let i = 0; i < candidates.length; i++) {
      const enc = candidates[i];
      const str = tryDecode(sample, enc);
      let score = -1000; // default low score

      if (str) {
        score = countHan(str);
        // Penalty for replacement chars
        const replacementCount = (str.match(/\uFFFD/g) || []).length;
        score -= replacementCount * 5;

        // Boost for EUC-TW specific sequences (SS2)
        if (enc === 'EUC-TW') {
           let ss2Count = 0;
           for (let j = 0; j < sample.length - 3; j++) {
              if (sample[j] === 0x8E &&
                  sample[j+1] >= 0xA1 && sample[j+1] <= 0xB0 &&
                  sample[j+2] >= 0xA1 && sample[j+2] <= 0xFE &&
                  sample[j+3] >= 0xA1 && sample[j+3] <= 0xFE) {
                 ss2Count++;
                 j += 3; // skip
              }
           }
           score += ss2Count * 5;
        }
      } else if (enc === 'EUC-TW') {
        // Manual heuristic if TextDecoder not supported
        score = 0;
        let ss2Count = 0;
        let validCount = 0;
        let invalidCount = 0;
        for (let j = 0; j < sample.length; ) {
           const b = sample[j];
           if (b < 0x80) {
             j++;
             continue;
           }
           // Check SS2: 0x8E + plane + byte + byte
           if (b === 0x8E && j + 3 < sample.length) {
              if (sample[j+1] >= 0xA1 && sample[j+1] <= 0xB0 &&
                  sample[j+2] >= 0xA1 && sample[j+2] <= 0xFE &&
                  sample[j+3] >= 0xA1 && sample[j+3] <= 0xFE) {
                  ss2Count++;
                  validCount++; // Treat as 1 han
                  j += 4;
                  continue;
              }
           }
           // Check Plane 1: 0xA1-0xFE + 0xA1-0xFE
           if (b >= 0xA1 && b <= 0xFE && j + 1 < sample.length) {
              const b2 = sample[j+1];
              if (b2 >= 0xA1 && b2 <= 0xFE) {
                 validCount++;
                 j += 2;
                 continue;
              }
           }

           // If we are here, it's invalid sequence or partial
           invalidCount++;
           j++;
        }
        if (ss2Count === 0) {
           score = -1000; // Without SS2, we can't distinguish from GBK/Big5 reliably without a decoder
        } else {
           score = validCount + (ss2Count * 5) - (invalidCount * 5);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestEnc = /** @type {Encoding} */ (enc);
      }
  }

  if (bestScore > 0) {
    return bestEnc;
  }

  return bestEnc === 'Unknown' ? 'GBK' : bestEnc;
}

/**
 *
 * @param {Uint8Array} bytes
 * @param {number[]} seq
 * @returns {boolean}
 */
function findSequence(bytes, seq) {
  for (let i = 0; i < bytes.length - seq.length + 1; i++) {
      let match = true;
      for (let j = 0; j < seq.length; j++) {
          if (bytes[i + j] !== seq[j]) {
              match = false;
              break;
          }
      }
      if (match) return true;
  }
  return false;
}

/**
 *
 * @param {Uint8Array} chunk
 * @param {string} enc
 * @returns {string|null}
 */
function tryDecode(chunk, enc) {
  try {
    const decoder = new TextDecoder(enc, { fatal: false });
    // Check if the environment actually supports this encoding
    if (decoder.encoding.toLowerCase().replace(/[-_]/g, '') !== enc.toLowerCase().replace(/[-_]/g, '') &&
        !(enc === 'EUC-TW' && decoder.encoding === 'cns11643')) {
       // mismatched encoding
    }
    return decoder.decode(chunk);
  } catch (e) {
    return null;
  }
}

/**
 *
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
function isValidUtf8(bytes) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch (e) {
    for (let i = 1; i <= 3; i++) {
      if (bytes.length - i <= 0) break;
      try {
          new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, bytes.length - i));
          return true;
      } catch (e2) {}
    }
  }
  return false;
}

/**
 *
 * @param {string} str
 * @returns {number}
 */
function countHan(str) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0x4E00 && code <= 0x9FFF) {
      count++;
    }
  }
  return count;
}
