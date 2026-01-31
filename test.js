import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detect } from './zh-chardet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.join(__dirname, '../zh-chardet.cr/spec/fixtures');

const tests = [
  { file: 'utf-8.txt', expected: ['UTF-8'] },
  { file: 'utf-8-2.txt', expected: ['UTF-8'] },
  { file: 'gb2312.txt', expected: ['GBK', 'GB18030', 'HZ-GB-2312'] }, // GB2312 is a subset of GBK
  { file: 'gb18030.txt', expected: ['GBK', 'GB18030'] },
  { file: 'big5.txt', expected: ['Big5'] },
  { file: 'euc-tw.txt', expected: ['EUC-TW', 'Big5'] }
];

console.log('Running tests...');

let passed = 0;
let failed = 0;

tests.forEach(t => {
  try {
    const filePath = path.join(fixturesDir, t.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping ${t.file}, not found`);
      return;
    }
    const buffer = fs.readFileSync(filePath);
    // Convert Buffer to Uint8Array (node buffers are Uint8Arrays but explicitly to be sure)
    const uint8 = new Uint8Array(buffer);

    const result = detect(uint8);

    // Loose matching because GBK/GB18030 vary by implementation name
    const isMatch = t.expected.some(exp => result.toLowerCase() === exp.toLowerCase()) ||
                    (t.expected.includes('GBK') && result.toUpperCase() === 'GB18030');

    if (isMatch) {
      console.log(`[PASS] ${t.file}: detected ${result}`);
      passed++;
    } else {
      console.error(`[FAIL] ${t.file}: expected ${t.expected.join(' or ')}, got ${result}`);
      failed++;
    }
  } catch (e) {
    console.error(`[ERR] ${t.file}: ${e.message}`);
    failed++;
  }
});

console.log(`\nResult: ${passed} passed, ${failed} failed.`);

if (failed > 0) process.exit(1);
