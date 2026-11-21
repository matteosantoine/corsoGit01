import { describe, expect, it } from "vitest";
import { encodeWav } from "./wav";

const ascii = (v: DataView, o: number, n: number) =>
  String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(o + i)));

describe("encodeWav", () => {
  it("scrive un'intestazione WAV valida (16 kHz, mono, 16 bit)", () => {
    const wav = encodeWav(new Float32Array(16000), 16000);
    const v = new DataView(wav);
    expect(ascii(v, 0, 4)).toBe("RIFF");
    expect(ascii(v, 8, 4)).toBe("WAVE");
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(32000);
    expect(wav.byteLength).toBe(44 + 32000);
  });

  it("converte e limita i campioni", () => {
    const v = new DataView(encodeWav(new Float32Array([0, 1, -1, 5, -5]), 16000));
    expect(v.getInt16(44, true)).toBe(0);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32768);
    expect(v.getInt16(50, true)).toBe(32767);
    expect(v.getInt16(52, true)).toBe(-32768);
  });
});
