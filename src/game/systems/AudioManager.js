import { SFX_SPRITE_URL, MUSIC_LOOP_URL, SFX_DURATIONS, SFX_GAP_SECONDS, MUSIC_BASE_VOLUME } from "../config/GameConfig.js";

// The single source of truth for where each SFX cue lands inside the one
// sprite-sheet file -- both the generator script
// (scripts/generateAudioAssets.js) and this module derive offsets from the
// same SFX_DURATIONS list the same way, so they can never drift apart.
export function buildSpriteManifest() {
  const manifest = {};
  let cursor = 0;
  for (const [name, duration] of Object.entries(SFX_DURATIONS)) {
    manifest[name] = { offset: cursor, duration };
    cursor += duration + SFX_GAP_SECONDS;
  }
  return { manifest, totalDuration: cursor };
}

const { manifest: SPRITE_MANIFEST } = buildSpriteManifest();

// Web Audio API for SFX specifically, NOT HTMLAudioElement -- seeking an
// <audio> element's currentTime to play one region of a sprite sheet has
// real, audible latency (the element has to actually seek/re-buffer),
// which is exactly wrong for a "trigger the instant a coin is grabbed"
// cue. AudioBufferSourceNode.start(when, offset, duration) plays from an
// already-decoded in-memory buffer with no seek step at all.
//
// Music is a plain HTMLAudioElement instead -- it's a long loop with no
// sample-accurate timing requirement, and the browser handles
// buffering/streaming for us instead of decoding a whole track into memory
// up front the way the SFX sprite needs to be.
//
// A single shared instance (like CharacterLoader's) -- Engine.js triggers
// SFX from gameplay events, App.vue drives music/mute from the UI, and
// both need to agree on the same mute state and unlock() call without
// either reaching into the other (Engine never imports Vue; App.vue
// doesn't need a gameEngine reference just to toggle music).
export class AudioManager {
  constructor() {
    this._ctx = null;
    this._sfxBuffer = null;
    this._sfxBufferPromise = null;
    this._sfxGain = null;
    this._musicEl = null;
    this._muted = false;
    this._unlocked = false;
    this._duckTimeout = null;
  }

  // Must be called from inside a real user-gesture event handler
  // (click/tap/submit) -- browsers refuse to start an AudioContext (and
  // often block <audio>.play()) before one ever happens. Idempotent: only
  // the FIRST call does anything, so it's safe to call from multiple
  // gesture handlers (the Lobby's music toggle AND Registration's submit)
  // without worrying about which one fires first.
  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return; // unsupported browser -- every method below silently no-ops via its own null checks

    this._ctx = new AudioCtx();
    this._ctx.resume().catch(() => {}); // belt-and-suspenders -- some browsers create it already-running from a gesture, this is a harmless no-op there
    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = this._muted ? 0 : 1;
    this._sfxGain.connect(this._ctx.destination);

    this._musicEl = new Audio(MUSIC_LOOP_URL);
    this._musicEl.loop = true;
    this._musicEl.volume = this._muted ? 0 : MUSIC_BASE_VOLUME;

    this._loadSfxSprite();
  }

  _loadSfxSprite() {
    if (this._sfxBufferPromise) return this._sfxBufferPromise;
    this._sfxBufferPromise = fetch(SFX_SPRITE_URL)
      .then((res) => res.arrayBuffer())
      .then((buf) => this._ctx.decodeAudioData(buf))
      .then((decoded) => {
        this._sfxBuffer = decoded;
      })
      .catch((err) => console.warn("AudioManager: failed to load SFX sprite", err));
    return this._sfxBufferPromise;
  }

  // Fire-and-forget. No-ops silently (not an error) if called before
  // unlock(), while the sprite is still loading, or for an unknown cue
  // name -- a missing sound should never be the thing that breaks gameplay.
  playSFX(name) {
    if (this._muted || !this._ctx || !this._sfxBuffer) return;
    const cue = SPRITE_MANIFEST[name];
    if (!cue) return;
    const source = this._ctx.createBufferSource();
    source.buffer = this._sfxBuffer;
    source.connect(this._sfxGain);
    source.start(this._ctx.currentTime, cue.offset, cue.duration);
  }

  playMusic() {
    if (!this._musicEl) return;
    // toggleMusic() only ever calls this from inside a real click handler
    // (after unlock()), so a rejection here is NOT the expected pre-gesture
    // autoplay block -- log it so a real failure (e.g. a 404 on
    // MUSIC_LOOP_URL) is visible in the console instead of looking
    // identical to "nothing happened."
    this._musicEl.play().catch((err) => console.warn("AudioManager: music playback failed", err));
  }

  pauseMusic() {
    this._musicEl?.pause();
  }

  get isMusicPlaying() {
    return !!this._musicEl && !this._musicEl.paused;
  }

  setMuted(muted) {
    this._muted = muted;
    if (this._musicEl) this._musicEl.volume = muted ? 0 : MUSIC_BASE_VOLUME;
    if (this._sfxGain) this._sfxGain.gain.value = muted ? 0 : 1;
  }

  // Briefly lowers music volume under an SFX "stinger" (e.g. the level-
  // complete fanfare), then glides back up -- keeps the music from
  // stepping on a moment that's supposed to stand out.
  duck(amount = 0.3, durationMs = 800) {
    if (!this._musicEl || this._muted) return;
    this._musicEl.volume = MUSIC_BASE_VOLUME * amount;
    clearTimeout(this._duckTimeout);
    this._duckTimeout = setTimeout(() => {
      if (!this._muted && this._musicEl) this._musicEl.volume = MUSIC_BASE_VOLUME;
    }, durationMs);
  }
}

export const audioManager = new AudioManager();
