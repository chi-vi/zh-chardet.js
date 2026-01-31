# zh-chardet.js

A small, pure JavaScript library common Chinese encodings:
- **UTF-8**
- **UTF-16BE / UTF-16LE**
- **GBK** (including GB2312, GB18030)
- **Big5**
- **EUC-TW**
- **ISO-2022-CN**
- **HZ-GB-2312**

Designed for use in Node.js or in the browser (via bundlers like Webpack, Rollup, Vite).

## Installation

```bash
# If publishing to npm
npm install zh-chardet
```

## Usage

### Node.js (ESM)
```js
import fs from 'fs';
import { detect } from 'zh-chardet';

const buffer = fs.readFileSync('some-file.txt');
const encoding = detect(buffer);
console.log('Detected:', encoding);
```

### Browser
Native usage (modern browsers with ES modules):
```html
<script type="module">
  import { detect } from './zh-chardet.js';

  // ... usage same as below
</script>
```

Bundlers (Vite, Webpack, etc.):
```js
import { detect } from 'zh-chardet';

const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function(evt) {
    const buffer = new Uint8Array(evt.target.result);
    // ...
```

## API

### `detect(bytes, [options])`
Detects the encoding of the given byte array.

- **bytes**: `Uint8Array` - The byte buffer to analyze.
- **options**: `Object` - Optional configuration (currently unused, reserved for future).
- **Returns**: `string` - The detected encoding name (e.g., `'UTF-8'`, `'GBK'`).

## Algorithm
1. **BOM Check**: Checks for standard Byte Order Marks.
2. **Escape Sequences**: Checks for ISO-2022-CN and HZ-GB-2312 sequences.
3. **UTF-8 Validation**: Checks if the buffer is valid UTF-8.
4. **Heuristic Analysis**: Uses Han character frequency analysis and specific byte sequence checks (like EUC-TW SS2) to disambiguate between GBK, Big5, and EUC-TW.
