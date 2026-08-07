// Generates the two audio files Milestone 9's AudioManager loads: a SFX
// "sprite sheet" (one file, every cue back to back) and a looping music
// track. Both are procedurally SYNTHESIZED from basic waveforms
// (sine/triangle oscillators, ADSR-style envelopes, filtered noise) --
// simple original compositions, not sourced/licensed recordings, so
// there's zero licensing exposure while still being genuinely audible
// (not the digital silence this script produced during Milestone 9 itself).
// Real licensed/commissioned audio can replace these two files later with
// no code changes elsewhere -- AudioManager.js just fetches whatever bytes
// live at these paths.
//
// Rerunnable like assets:optimize / characters:generate -- this script IS
// the source of truth for these two files (no assets-src/ original to
// preserve).
//
// Usage: npm run audio:generate

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SFX_DURATIONS, MUSIC_LOOP_DURATION_SECONDS } from "../src/game/config/GameConfig.js";
import { buildSpriteManifest } from "../src/game/systems/AudioManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/audio");

const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;

// ---------------------------------------------------------------------
// Low-level synthesis primitives
// ---------------------------------------------------------------------

// Percussive envelope: linear attack ramp, then an eased decay to 0 across
// the rest of the note. No flat sustain -- used for anything meant to
// sound "plucked"/struck (bass pulses, kicks, coin/hit/powerup blips)
// rather than held.
function decayEnvelopeAt(t, total, attack, power) {
  if (t < attack) return t / attack;
  const dt = (t - attack) / Math.max(total - attack, 1e-6);
  return Math.pow(Math.max(0, 1 - dt), power);
}

// Held-note envelope: attack ramp, flat sustain, release ramp at the end.
// Used for arpeggio/pad notes and chime-style SFX that should read as a
// sustained tone rather than a struck one.
function sustainEnvelopeAt(t, total, attack, release) {
  if (t < attack) return t / attack;
  if (t > total - release) return Math.max(0, (total - t) / release);
  return 1;
}

function envelopeAt(t, total, env) {
  return env.mode === "decay"
    ? decayEnvelopeAt(t, total, env.attack, env.power)
    : sustainEnvelopeAt(t, total, env.attack, env.release);
}

function waveAt(waveType, phase) {
  switch (waveType) {
    case "sine":
      return Math.sin(phase);
    case "triangle":
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case "square":
      return Math.sign(Math.sin(phase));
    default:
      return Math.sin(phase);
  }
}

// Fixed-frequency oscillator note.
function renderTone(durationSeconds, freq, waveType, env) {
  const n = Math.round(durationSeconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = waveAt(waveType, 2 * Math.PI * freq * t) * envelopeAt(t, durationSeconds, env);
  }
  return out;
}

// Frequency-swept oscillator (e.g. a kick's pitch drop). Phase is
// accumulated incrementally rather than computed as freq*t directly, since
// freq itself changes over time -- avoids phase discontinuities/clicks.
function renderSweep(durationSeconds, startFreq, endFreq, waveType, env) {
  const n = Math.round(durationSeconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = startFreq + (endFreq - startFreq) * (t / durationSeconds);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    out[i] = waveAt(waveType, phase) * envelopeAt(t, durationSeconds, env);
  }
  return out;
}

// Filtered white noise (one-pole lowpass -- lower alpha = more muffled).
// Used for hi-hats/impact texture.
function renderNoise(durationSeconds, env, lowpassAlpha = 1) {
  const n = Math.round(durationSeconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = Math.random() * 2 - 1;
    prev = prev + lowpassAlpha * (s - prev);
    out[i] = prev * envelopeAt(t, durationSeconds, env);
  }
  return out;
}

// "Whoosh": filtered noise whose filter progressively opens up (muffled ->
// brighter) across the note, under a swell-then-fade amplitude envelope.
// Used for the near-miss cue.
function renderWhoosh(durationSeconds) {
  const n = Math.round(durationSeconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const frac = t / durationSeconds;
    const alpha = 0.05 + 0.55 * frac;
    let s = Math.random() * 2 - 1;
    prev = prev + alpha * (s - prev);
    const env = Math.sin(Math.PI * frac); // 0 -> 1 -> 0 swell across the whole note
    out[i] = prev * env;
  }
  return out;
}

function addSamples(target, startSample, samples, gain = 1) {
  for (let i = 0; i < samples.length; i++) {
    const idx = startSample + i;
    if (idx >= 0 && idx < target.length) target[idx] += samples[i] * gain;
  }
}

function normalize(buf, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  if (max > 0) {
    const scale = peak / max;
    for (let i = 0; i < buf.length; i++) buf[i] *= scale;
  }
}

function floatToWavBuffer(samples) {
  const dataSize = samples.length * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = NUM_CHANNELS * (BITS_PER_SAMPLE / 8);

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  buffer.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  buffer.writeUInt16LE(NUM_CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

function writeWav(outPath, samples) {
  const buffer = floatToWavBuffer(samples);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  return buffer.length;
}

// ---------------------------------------------------------------------
// Music: a 4-bar C-G-Am-F progression at 120bpm, repeated 3x to fill
// MUSIC_LOOP_DURATION_SECONDS (24s). Four synthesized layers -- plucked
// bass pulses, a kick+hi-hat beat, and a triangle-wave arpeggio -- mixed
// together, matching the "upbeat runner energy" brief without licensing
// any real recording.
// ---------------------------------------------------------------------
const CHORDS = [
  { bass: 130.81, notes: [261.63, 329.63, 392.0, 523.25] }, // C major (root C4 bass one octave up from usual for a brighter pulse)
  { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0] }, // G major
  { bass: 110.0, notes: [220.0, 261.63, 329.63, 440.0] }, // A minor
  { bass: 87.31, notes: [174.61, 220.0, 261.63, 349.23] }, // F major
];

function renderMusic() {
  const totalSamples = Math.round(MUSIC_LOOP_DURATION_SECONDS * SAMPLE_RATE);
  const buf = new Float32Array(totalSamples);

  const BPM = 120;
  const beatSec = 60 / BPM; // 0.5s
  const barSec = beatSec * 4; // 2s
  const barsTotal = Math.round(MUSIC_LOOP_DURATION_SECONDS / barSec); // 12

  for (let bar = 0; bar < barsTotal; bar++) {
    const chord = CHORDS[bar % CHORDS.length];
    const barStart = bar * barSec;

    // Bass: 4 plucked quarter-note pulses per bar.
    for (let q = 0; q < 4; q++) {
      const t0 = barStart + q * beatSec;
      const note = renderTone(beatSec * 0.9, chord.bass, "sine", { mode: "decay", attack: 0.005, power: 1.6 });
      addSamples(buf, Math.round(t0 * SAMPLE_RATE), note, 0.4);
    }

    // Kick on beats 1 and 3.
    for (const beatIdx of [0, 2]) {
      const t0 = barStart + beatIdx * beatSec;
      const kick = renderSweep(0.18, 150, 45, "sine", { mode: "decay", attack: 0.002, power: 2.5 });
      addSamples(buf, Math.round(t0 * SAMPLE_RATE), kick, 0.55);
    }

    // Hi-hat on every 8th note.
    for (let e = 0; e < 8; e++) {
      const t0 = barStart + e * (beatSec / 2);
      const hat = renderNoise(0.05, { mode: "decay", attack: 0.001, power: 3 }, 0.9);
      addSamples(buf, Math.round(t0 * SAMPLE_RATE), hat, 0.16);
    }

    // Arpeggio: 8 eighth notes cycling root-third-fifth-octave twice per bar.
    for (let e = 0; e < 8; e++) {
      const t0 = barStart + e * (beatSec / 2);
      const freq = chord.notes[e % 4];
      const note = renderTone(beatSec * 0.48, freq, "triangle", { mode: "sustain", attack: 0.008, release: 0.08 });
      addSamples(buf, Math.round(t0 * SAMPLE_RATE), note, 0.22);
    }
  }

  normalize(buf, 0.85);
  return buf;
}

// ---------------------------------------------------------------------
// SFX: each cue is rendered into its own short buffer, then placed at the
// exact sample offset SPRITE_MANIFEST (shared with AudioManager.js) says
// it should live at -- keeps this generator and AudioManager's playback
// offsets from ever drifting apart.
// ---------------------------------------------------------------------
const SFX_RENDERERS = {
  // Two-note ascending "ding", classic coin-pickup chime.
  coin(duration) {
    const buf = new Float32Array(Math.round(duration * SAMPLE_RATE));
    const n1 = renderTone(0.09, 987.77, "sine", { mode: "decay", attack: 0.002, power: 1.2 }); // B5
    const n2 = renderTone(duration - 0.09, 1318.51, "sine", { mode: "decay", attack: 0.002, power: 1.4 }); // E6
    addSamples(buf, 0, n1, 0.8);
    addSamples(buf, Math.round(0.09 * SAMPLE_RATE), n2, 0.9);
    return buf;
  },
  // Low thud: pitch-dropping sine sweep layered with a burst of muffled noise.
  hit(duration) {
    const buf = new Float32Array(Math.round(duration * SAMPLE_RATE));
    const thump = renderSweep(0.16, 110, 40, "sine", { mode: "decay", attack: 0.002, power: 1.8 });
    const grit = renderNoise(0.12, { mode: "decay", attack: 0.001, power: 2.2 }, 0.35);
    addSamples(buf, 0, thump, 0.9);
    addSamples(buf, 0, grit, 0.5);
    return buf;
  },
  // Soft ascending triad chime, "shield up" magical feel.
  shield(duration) {
    const buf = new Float32Array(Math.round(duration * SAMPLE_RATE));
    const notes = [659.25, 783.99, 987.77]; // E5, G5, B5
    notes.forEach((freq, i) => {
      const t0 = i * 0.07;
      const note = renderTone(duration - t0, freq, "triangle", { mode: "sustain", attack: 0.01, release: 0.12 });
      addSamples(buf, Math.round(t0 * SAMPLE_RATE), note, 0.5);
    });
    return buf;
  },
  // Bright 5-note ascending arpeggio, arcade "power up" jingle.
  powerup(duration) {
    const buf = new Float32Array(Math.round(duration * SAMPLE_RATE));
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => {
      const t0 = i * 0.06;
      const dur = Math.max(duration - t0, 0.05);
      const note = renderTone(dur, freq, "triangle", { mode: "decay", attack: 0.004, power: 1.1 });
      addSamples(buf, Math.round(t0 * SAMPLE_RATE), note, 0.55);
    });
    return buf;
  },
  // Filtered-noise whoosh with an opening filter sweep, "close call" cue.
  nearmiss(duration) {
    return renderWhoosh(duration);
  },
  // Ascending triad arpeggio resolving into a held bright chord -- fanfare.
  levelComplete(duration) {
    const buf = new Float32Array(Math.round(duration * SAMPLE_RATE));
    const arpeggio = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    arpeggio.forEach((freq, i) => {
      const t0 = i * 0.1;
      const note = renderTone(0.16, freq, "triangle", { mode: "decay", attack: 0.004, power: 1.4 });
      addSamples(buf, Math.round(t0 * SAMPLE_RATE), note, 0.4);
    });
    const chordStart = 0.4;
    const chordDur = duration - chordStart;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
      const note = renderTone(chordDur, freq, "sine", { mode: "sustain", attack: 0.02, release: 0.35 });
      addSamples(buf, Math.round(chordStart * SAMPLE_RATE), note, 0.32);
    });
    return buf;
  },
  // Slow descending minor-ish sequence, somber "game over" tone.
  gameOver(duration) {
    const buf = new Float32Array(Math.round(duration * SAMPLE_RATE));
    const notes = [440.0, 349.23, 293.66]; // A4, F4, D4
    const step = duration / notes.length;
    notes.forEach((freq, i) => {
      const t0 = i * step;
      const note = renderTone(step * 1.1, freq, "sine", { mode: "sustain", attack: 0.015, release: step * 0.6 });
      addSamples(buf, Math.round(t0 * SAMPLE_RATE), note, 0.55);
    });
    return buf;
  },
};

function renderSfxSprite() {
  const { manifest, totalDuration } = buildSpriteManifest();
  const totalSamples = Math.round(totalDuration * SAMPLE_RATE);
  const buf = new Float32Array(totalSamples);

  for (const [name, cue] of Object.entries(manifest)) {
    const renderer = SFX_RENDERERS[name];
    if (!renderer) {
      console.warn(`No SFX renderer for cue "${name}" -- left silent.`);
      continue;
    }
    const sound = renderer(cue.duration);
    addSamples(buf, Math.round(cue.offset * SAMPLE_RATE), sound, 1);
  }

  normalize(buf, 0.9);
  return buf;
}

function main() {
  const sfxSamples = renderSfxSprite();
  const sfxBytes = writeWav(path.join(OUT_DIR, "sfx-sprite.wav"), sfxSamples);
  console.log(
    `sfx-sprite.wav: ${Object.keys(SFX_DURATIONS).length} cues -> ${(sfxBytes / 1024).toFixed(1)} KB`
  );

  const musicSamples = renderMusic();
  const musicBytes = writeWav(path.join(OUT_DIR, "music-loop.wav"), musicSamples);
  console.log(`music-loop.wav: ${MUSIC_LOOP_DURATION_SECONDS}s -> ${(musicBytes / 1024).toFixed(1)} KB`);

  console.log("\nDone. Run `npm run assets:check` to confirm the total public/ budget is still met.");
}

main();
