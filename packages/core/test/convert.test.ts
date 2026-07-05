import { describe, expect, it } from 'vitest';
import { convert, detectFormat, FormatError, readVip, readZhs } from '../src/index';
import type { Stitch } from '../src/index';
import { loadFixture } from './helpers';

function path(stitches: Stitch[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const s of stitches) {
    if (s.command !== 'STITCH' && s.command !== 'JUMP') continue;
    const last = out[out.length - 1];
    if (last === undefined || last[0] !== s.x || last[1] !== s.y) {
      out.push([s.x, s.y]);
    }
  }
  return out;
}

describe('convert()', () => {
  it('converts VIP → ZHS (extension spellings are normalized)', () => {
    const vip = loadFixture('028-B.vip');
    const a = convert(vip, 'vip', 'zhs');
    const b = convert(vip, '.VIP', 'design.zhs');
    expect(a.bytes).toEqual(b.bytes);
    expect(a.bytes).toEqual(loadFixture('028-B.zhs').map((v, i) => (i === 0x83 ? 0 : v)));
    expect(a.warnings.some((w) => w.code === 'METADATA_0X83_ZEROED')).toBe(true);
  });

  it('re-encodes ZHS → ZHS preserving the functional path', () => {
    const source = loadFixture('028-B.zhs');
    const result = convert(source, 'zhs', 'zhs');
    expect(path(readZhs(result.bytes).stitches)).toEqual(path(readZhs(source).stitches));
  });

  it('rejects unknown formats with an explicit error', () => {
    const vip = loadFixture('028-B.vip');
    expect(() => convert(vip, 'vip', 'docx')).toThrow(FormatError);
    expect(() => convert(vip, 'docx', 'zhs')).toThrow(FormatError);
    // read-only formats have no writer
    expect(() => convert(vip, 'vip', 'sew')).toThrow(FormatError);
  });
});

describe('detectFormat()', () => {
  it('sniffs VIP and ZHS from magic bytes', () => {
    expect(detectFormat(loadFixture('052-Z.vip'))).toBe('vip');
    expect(detectFormat(loadFixture('028-B.zhs'))).toBe('zhs');
    expect(detectFormat(new Uint8Array(200))).toBeUndefined();
  });
});

describe('cross-fixture sanity', () => {
  it('052-Z.vip (no reference .zhs) converts and round-trips functionally', () => {
    const source = readVip(loadFixture('052-Z.vip'));
    const result = convert(loadFixture('052-Z.vip'), 'vip', 'zhs');
    expect(path(readZhs(result.bytes).stitches)).toEqual(path(source.stitches));
  });
});
