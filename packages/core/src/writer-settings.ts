/**
 * Per-format encoder settings — mirrors the module-level constants of the
 * corresponding pyembroidery writers (MAX_JUMP_DISTANCE, MAX_STITCH_DISTANCE,
 * FULL_JUMP, ROUND). write_embroidery merges these into the transcoder
 * settings; our writers pass them to normalize() the same way.
 */
import type { EncoderSettings } from './encoder';

export const DST_SETTINGS: EncoderSettings = {
  maxJump: 121,
  maxStitch: 121,
  fullJump: false,
  round: true,
};

export const EXP_SETTINGS: EncoderSettings = {
  maxJump: 127,
  maxStitch: 127,
  fullJump: true,
  round: true,
};

export const JEF_SETTINGS: EncoderSettings = {
  maxJump: 127,
  maxStitch: 127,
  fullJump: true,
  round: true,
};

export const PEC_SETTINGS: EncoderSettings = {
  maxJump: 2047,
  maxStitch: 2047,
  fullJump: true,
  round: true,
};

export const PES_SETTINGS: EncoderSettings = PEC_SETTINGS;

export const VP3_SETTINGS: EncoderSettings = {
  maxJump: 3200,
  maxStitch: 255,
  fullJump: false,
  round: false,
};

/** XXX deltas are signed-8 with 0x7D–0x7F reserved as control codes. */
export const XXX_SETTINGS: EncoderSettings = {
  maxJump: 124,
  maxStitch: 124,
  fullJump: false,
  round: true,
};

/** HUS/VIP bodies store signed-8 delta streams. */
export const HUS_SETTINGS: EncoderSettings = {
  maxJump: 127,
  maxStitch: 127,
  fullJump: true,
  round: true,
};

export const VIP_SETTINGS: EncoderSettings = HUS_SETTINGS;
