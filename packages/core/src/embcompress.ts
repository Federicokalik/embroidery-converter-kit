/**
 * Greg-Hus decompressor ("EmbCompress") used by HUS / VIP / VP3 bodies.
 * Faithful TypeScript port of pyembroidery/EmbCompress.py (MIT).
 *
 * Fidelity notes (all verified against the Python source and golden vectors):
 * - bit reads past the end of the input behave as if the missing bytes were 0;
 * - decompress() may emit up to one token PAST `uncompressedSize` because the
 *   Python loop tests `len(output) <= size` — callers slice to the size they
 *   need;
 * - the Huffman table is built with exact powers of two (the Python float
 *   division is exact there).
 */

class Huffman {
  private readonly defaultValue: number;
  private readonly lengths: number[] | null;
  private table: number[] | null = null;
  private tableWidth = 0;

  constructor(lengths: number[] | null = null, value = 0) {
    this.defaultValue = value;
    this.lengths = lengths;
  }

  buildTable(): void {
    const lengths = this.lengths;
    if (lengths === null) return;
    this.tableWidth = Math.max(...lengths);
    this.table = [];
    for (let bitLength = 1; bitLength <= this.tableWidth; bitLength++) {
      const size = 1 << (this.tableWidth - bitLength);
      for (let lenIndex = 0; lenIndex < lengths.length; lenIndex++) {
        if (lengths[lenIndex] === bitLength) {
          for (let i = 0; i < size; i++) this.table.push(lenIndex);
        }
      }
    }
  }

  /** Returns [value, bitLength]; must be fed 16 bits of lookahead. */
  lookup(byteLookup: number): [number, number] {
    if (this.table === null) {
      return [this.defaultValue, 0];
    }
    const v = this.table[byteLookup >> (16 - this.tableWidth)]!;
    return [v, this.lengths![v]!];
  }
}

class EmbCompress {
  private bitPosition = 0;
  private inputData: Uint8Array = new Uint8Array(0);
  private blockElements = -1;
  private characterHuffman: Huffman | null = null;
  private distanceHuffman: Huffman | null = null;

  private getBits(startPosInBits: number, length: number): number {
    const endPosInBits = startPosInBits + length - 1;
    const startPosInBytes = Math.floor(startPosInBits / 8);
    const endPosInBytes = Math.floor(endPosInBits / 8);
    let value = 0;
    for (let i = startPosInBytes; i <= endPosInBytes; i++) {
      value <<= 8;
      value |= i < this.inputData.length ? this.inputData[i]! & 0xff : 0;
    }
    const unusedBitsRightOfSample = (8 - ((endPosInBits + 1) % 8)) % 8;
    const maskSampleBits = (1 << length) - 1;
    return (value >>> unusedBitsRightOfSample) & maskSampleBits;
  }

  private pop(bitCount: number): number {
    const value = this.peek(bitCount);
    this.slide(bitCount);
    return value;
  }

  private peek(bitCount: number): number {
    return this.getBits(this.bitPosition, bitCount);
  }

  private slide(bitCount: number): void {
    this.bitPosition += bitCount;
  }

  private readVariableLength(): number {
    let m = this.pop(3);
    if (m !== 7) return m;
    for (let q = 0; q < 13; q++) {
      const s = this.pop(1);
      if (s === 1) m += 1;
      else break;
    }
    return m;
  }

  private loadCharacterLengthHuffman(): Huffman {
    const count = this.pop(5);
    if (count === 0) {
      return new Huffman(null, this.pop(5));
    }
    const lengths: number[] = new Array<number>(count).fill(0);
    let index = 0;
    while (index < count) {
      if (index === 3) {
        // Special index 3: skip up to 3 elements.
        index += this.pop(2);
      }
      lengths[index] = this.readVariableLength();
      index += 1;
    }
    const huffman = new Huffman(lengths, 8);
    huffman.buildTable();
    return huffman;
  }

  private loadCharacterHuffman(lengthHuffman: Huffman): Huffman {
    const count = this.pop(9);
    if (count === 0) {
      return new Huffman(null, this.pop(9));
    }
    const lengths: number[] = new Array<number>(count).fill(0);
    let index = 0;
    while (index < count) {
      const [value, bits] = lengthHuffman.lookup(this.peek(16));
      this.slide(bits);
      let c = value;
      if (c === 0) {
        // skip 1
        index += 1;
      } else if (c === 1) {
        // skip 3 + read(4)
        index += 3 + this.pop(4);
      } else if (c === 2) {
        // skip 20 + read(9)
        index += 20 + this.pop(9);
      } else {
        c -= 2;
        lengths[index] = c;
        index += 1;
      }
    }
    const huffman = new Huffman(lengths);
    huffman.buildTable();
    return huffman;
  }

  private loadDistanceHuffman(): Huffman {
    const count = this.pop(5);
    if (count === 0) {
      return new Huffman(null, this.pop(5));
    }
    const lengths: number[] = new Array<number>(count).fill(0);
    for (let i = 0; i < count; i++) {
      lengths[i] = this.readVariableLength();
    }
    const huffman = new Huffman(lengths);
    huffman.buildTable();
    return huffman;
  }

  private loadBlock(): void {
    this.blockElements = this.pop(16);
    const characterLengthHuffman = this.loadCharacterLengthHuffman();
    this.characterHuffman = this.loadCharacterHuffman(characterLengthHuffman);
    this.distanceHuffman = this.loadDistanceHuffman();
  }

  private getToken(): number {
    if (this.blockElements <= 0) this.loadBlock();
    this.blockElements -= 1;
    const [value, bits] = this.characterHuffman!.lookup(this.peek(16));
    this.slide(bits);
    return value;
  }

  private getPosition(): number {
    const [value, bits] = this.distanceHuffman!.lookup(this.peek(16));
    this.slide(bits);
    if (value === 0) return 0;
    const v = value - 1;
    return (1 << v) + this.pop(v);
  }

  decompress(inputData: Uint8Array, uncompressedSize?: number): number[] {
    this.inputData = inputData;
    const outputData: number[] = [];
    this.blockElements = -1;
    const bitsTotal = inputData.length * 8;
    while (
      bitsTotal > this.bitPosition &&
      (uncompressedSize === undefined || outputData.length <= uncompressedSize)
    ) {
      const character = this.getToken();
      if (character <= 255) {
        outputData.push(character);
      } else if (character === 510) {
        break; // END
      } else {
        const length = character - 253; // min length is 3: 256 - 253
        const back = this.getPosition() + 1;
        const position = outputData.length - back;
        // When back <= length the copy overlaps itself; byte-by-byte handles both.
        for (let i = position; i < position + length; i++) {
          outputData.push(outputData[i]!);
        }
      }
    }
    return outputData;
  }
}

/** Decompress a Greg-Hus block. May return up to one element more than `uncompressedSize`. */
export function expand(data: Uint8Array, uncompressedSize?: number): number[] {
  return new EmbCompress().decompress(data, uncompressedSize);
}

/**
 * "Compress" data as a single stored block: a 6-byte preamble that sets up a
 * degenerate 8-bit literal Huffman table, followed by the raw bytes.
 *
 * The preamble matches pyembroidery's EmbCompress.compress EXCEPT the block
 * element count, which the decoder reads as 16 bits MSB-first from the bit
 * stream — pyembroidery writes it little-endian, which only decodes by luck
 * when (lo<<8|hi) ≥ size and crashes otherwise (verified empirically on its
 * own expand). We write the count in decoder order, so the block is
 * self-consistent for every size up to the u16 limit; HUS/VIP writers gate
 * larger inputs with TOO_MANY_RECORDS.
 */
export function compress(data: Uint8Array): Uint8Array {
  if (data.length > 0xffff) {
    throw new RangeError(
      `EmbCompress stored blocks hold at most 65535 bytes (got ${data.length}).`,
    );
  }
  const out = new Uint8Array(6 + data.length);
  out.set([(data.length >> 8) & 0xff, data.length & 0xff, 0x02, 0xa0, 0x01, 0xfe], 0);
  out.set(data, 6);
  return out;
}

/** Reinterpret an unsigned byte (0..255) as a signed 8-bit value. */
export function signed8(v: number): number {
  const b = v & 0xff;
  return b > 127 ? b - 256 : b;
}

/** Reinterpret an unsigned 16-bit value as signed. */
export function signed16(v: number): number {
  const w = v & 0xffff;
  return w > 32767 ? w - 65536 : w;
}
