/** Growable byte sink / cursor-based source used by the format writers/readers. */

export class ByteWriter {
  private buf = new Uint8Array(256);
  private len = 0;

  get length(): number {
    return this.len;
  }

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  u8(v: number): void {
    this.ensure(1);
    this.buf[this.len++] = v & 0xff;
  }

  i8(v: number): void {
    this.u8(v);
  }

  bytes(data: ArrayLike<number>): void {
    this.ensure(data.length);
    this.buf.set(data, this.len);
    this.len += data.length;
  }

  fill(byte: number, count: number): void {
    this.ensure(count);
    this.buf.fill(byte & 0xff, this.len, this.len + count);
    this.len += count;
  }

  u16le(v: number): void {
    this.u8(v);
    this.u8(v >> 8);
  }

  u16be(v: number): void {
    this.u8(v >> 8);
    this.u8(v);
  }

  u24le(v: number): void {
    this.u8(v);
    this.u8(v >> 8);
    this.u8(v >> 16);
  }

  u24be(v: number): void {
    this.u8(v >> 16);
    this.u8(v >> 8);
    this.u8(v);
  }

  u32le(v: number): void {
    this.u8(v);
    this.u8(v >> 8);
    this.u8(v >> 16);
    this.u8(v >> 24);
  }

  u32be(v: number): void {
    this.u8(v >> 24);
    this.u8(v >> 16);
    this.u8(v >> 8);
    this.u8(v);
  }

  /** Latin-1/ASCII string, one byte per char (matches Python's ascii writes). */
  ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }

  utf8(s: string): void {
    this.bytes(new TextEncoder().encode(s));
  }

  f32le(v: number): void {
    const scratch = new DataView(new ArrayBuffer(4));
    scratch.setFloat32(0, v, true);
    this.bytes(new Uint8Array(scratch.buffer));
  }

  /** Overwrite bytes at an absolute position (for offset back-patching). */
  patchU8(at: number, v: number): void {
    this.buf[at] = v & 0xff;
  }

  patchU16le(at: number, v: number): void {
    this.buf[at] = v & 0xff;
    this.buf[at + 1] = (v >> 8) & 0xff;
  }

  patchU24le(at: number, v: number): void {
    this.buf[at] = v & 0xff;
    this.buf[at + 1] = (v >> 8) & 0xff;
    this.buf[at + 2] = (v >> 16) & 0xff;
  }

  patchU32le(at: number, v: number): void {
    this.patchU16le(at, v);
    this.patchU16le(at + 2, v >> 16);
  }

  patchU32be(at: number, v: number): void {
    this.buf[at] = (v >> 24) & 0xff;
    this.buf[at + 1] = (v >> 16) & 0xff;
    this.buf[at + 2] = (v >> 8) & 0xff;
    this.buf[at + 3] = v & 0xff;
  }

  toBytes(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

export class ByteReader {
  pos = 0;

  constructor(private readonly data: Uint8Array) {}

  get length(): number {
    return this.data.length;
  }

  get eof(): boolean {
    return this.pos >= this.data.length;
  }

  seek(pos: number): void {
    this.pos = pos;
  }

  skip(n: number): void {
    this.pos += n;
  }

  /** Returns -1 past end of data (callers check for stream truncation). */
  u8(): number {
    if (this.pos >= this.data.length) return -1;
    return this.data[this.pos++]!;
  }

  i8(): number {
    const v = this.u8();
    if (v < 0) return v;
    return v > 127 ? v - 256 : v;
  }

  u16le(): number {
    const a = this.u8();
    const b = this.u8();
    if (a < 0 || b < 0) return -1;
    return a | (b << 8);
  }

  u16be(): number {
    const a = this.u8();
    const b = this.u8();
    if (a < 0 || b < 0) return -1;
    return (a << 8) | b;
  }

  i16le(): number {
    const v = this.u16le();
    if (v < 0) return v;
    return v > 0x7fff ? v - 0x10000 : v;
  }

  i16be(): number {
    const v = this.u16be();
    if (v < 0) return v;
    return v > 0x7fff ? v - 0x10000 : v;
  }

  u24le(): number {
    const a = this.u8();
    const b = this.u8();
    const c = this.u8();
    if (a < 0 || b < 0 || c < 0) return -1;
    return a | (b << 8) | (c << 16);
  }

  u24be(): number {
    const a = this.u8();
    const b = this.u8();
    const c = this.u8();
    if (a < 0 || b < 0 || c < 0) return -1;
    return (a << 16) | (b << 8) | c;
  }

  u32le(): number {
    const lo = this.u16le();
    const hi = this.u16le();
    if (lo < 0 || hi < 0) return -1;
    return lo + hi * 0x10000;
  }

  u32be(): number {
    const hi = this.u16be();
    const lo = this.u16be();
    if (hi < 0 || lo < 0) return -1;
    return hi * 0x10000 + lo;
  }

  i32le(): number {
    const v = this.u32le();
    if (v < 0) return v;
    return v > 0x7fffffff ? v - 0x100000000 : v;
  }

  i32be(): number {
    const v = this.u32be();
    if (v < 0) return v;
    return v > 0x7fffffff ? v - 0x100000000 : v;
  }

  slice(n: number): Uint8Array {
    const out = this.data.slice(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  utf8(n: number): string {
    return new TextDecoder().decode(this.slice(n));
  }

  utf16be(n: number): string {
    const raw = this.slice(n);
    let s = '';
    for (let i = 0; i + 1 < raw.length; i += 2) {
      s += String.fromCharCode((raw[i]! << 8) | raw[i + 1]!);
    }
    return s;
  }
}
