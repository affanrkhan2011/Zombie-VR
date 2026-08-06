// Web Audio API Synthesizer for Zombie VR Game

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private heartbeatInterval: number | null = null;

  constructor() {
    // AudioContext will be initialized on first user click/touch
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ambientGain) {
      this.ambientGain.gain.value = muted ? 0 : 0.15;
    }
  }

  // Play Gunshot Sound
  public playGunshot() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Noise buffer for blast
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.25);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    // Punch sub-oscillator
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(180, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    noise.start(now);
    subOsc.start(now);
    noise.stop(now + 0.3);
    subOsc.stop(now + 0.15);
  }

  // Laser Beam Zap/Hum sound
  public playLaserZap() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Zombie Groan / Screech
  public playZombieGroan(pitchMultiplier: number = 1.0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.8;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90 * pitchMultiplier, now);
    osc.frequency.linearRampToValueAtTime(140 * pitchMultiplier, now + 0.3);
    osc.frequency.linearRampToValueAtTime(60 * pitchMultiplier, now + duration);

    // LFO for scary pitch tremor
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(12, now);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(osc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + duration);
    osc.stop(now + duration);
  }

  // Zombie Attack / Bite sound
  public playZombieAttack() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Crunch noise
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (i % 50 === 0 ? 2.5 : 0.8);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    noise.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Target Hit Sound (Ding / Steel impact)
  public playTargetHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Zombie Death Splat Sound
  public playZombieHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Wave Completed Fanfare
  public playWaveComplete() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [300, 450, 600, 900];

    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  }

  // Dark Ambient Horror Drone (Disabled buzzing sound)
  public startAmbientDrone() {
    this.stopAmbientDrone();
  }

  public stopAmbientDrone() {
    if (this.ambientOsc1) {
      try {
        this.ambientOsc1.stop();
        this.ambientOsc1.disconnect();
      } catch {
        // ignore if stopped
      }
      this.ambientOsc1 = null;
    }
    if (this.ambientOsc2) {
      try {
        this.ambientOsc2.stop();
        this.ambientOsc2.disconnect();
      } catch {
        // ignore if stopped
      }
      this.ambientOsc2 = null;
    }
  }

  // --- SPATIAL ZOMBIE SOUND EFFECTS ---
  public playSpatialZombieGroan(
    zombiePos: { x: number; y: number; z: number },
    playerPos: { x: number; y: number; z: number },
    yaw: number,
    type: 'WALKER' | 'RUNNER' | 'TANK' | 'STALKER' = 'WALKER'
  ) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;

    const now = ctx.currentTime;

    // 1. Calculate relative distance and angle
    const dx = zombiePos.x - playerPos.x;
    const dz = zombiePos.z - playerPos.z;
    const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));

    // Angle relative to player facing direction (yaw)
    const angleToZombie = Math.atan2(dx, -dz);
    let relAngle = angleToZombie - yaw;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    // Pan calculation: -1 (full left) to +1 (full right)
    const panVal = Math.sin(relAngle);

    // Volume distance decay (inverse distance law)
    const rawVol = 1.0 / (1.0 + (dist - 1) * 0.12);
    const volume = Math.min(0.85, Math.max(0.04, rawVol));

    // Front/Back filter cutoff: muffled if behind player
    const isBehind = Math.abs(relAngle) > Math.PI / 2;
    const baseCutoff = isBehind ? 450 : 1600;

    // 2. Build Web Audio Node Chain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);

    const biquadFilter = ctx.createBiquadFilter();
    biquadFilter.type = 'lowpass';
    biquadFilter.frequency.setValueAtTime(baseCutoff, now);

    // Stereo Panner or Fallback
    let pannerNode: AudioNode = masterGain;
    if (typeof (ctx as any).createStereoPanner === 'function') {
      const panner = (ctx as any).createStereoPanner();
      panner.pan.setValueAtTime(panVal, now);
      pannerNode = panner;
    }

    biquadFilter.connect(masterGain);
    if (pannerNode !== masterGain) {
      masterGain.connect(pannerNode);
      pannerNode.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    // 3. Sound Synthesis based on Zombie Type
    let duration = 0.9;

    if (type === 'RUNNER') {
      // High-pitched screech / aggressive hiss
      duration = 0.6;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(380, now + 0.2);
      osc.frequency.exponentialRampToValueAtTime(110, now + duration);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(22, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 35;
      lfo.connect(osc.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(biquadFilter);

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + duration);
      osc.stop(now + duration);

    } else if (type === 'TANK') {
      // Deep guttural sub-bass roar
      duration = 1.2;
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(45, now);
      osc1.frequency.linearRampToValueAtTime(75, now + 0.4);
      osc1.frequency.exponentialRampToValueAtTime(35, now + duration);

      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(50, now);
      osc2.frequency.linearRampToValueAtTime(80, now + 0.4);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.7, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(biquadFilter);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);

    } else if (type === 'STALKER') {
      // Sinister clicking / raspy whisper
      duration = 0.7;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (i % 80 < 15 ? 1.8 : 0.2);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(gain);
      gain.connect(biquadFilter);

      noise.start(now);

    } else {
      // WALKER: Classic pitch-modulated zombie groan
      duration = 0.85;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(55, now + duration);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(12, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 18;
      lfo.connect(osc.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(biquadFilter);

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + duration);
      osc.stop(now + duration);
    }
  }

  // Spatial Door Opening Hiss / Clank sound when zombie spawns
  public playDoorSpawnSound(
    doorPos: { x: number; y: number; z: number },
    playerPos: { x: number; y: number; z: number },
    yaw: number
  ) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;

    const now = ctx.currentTime;
    const dx = doorPos.x - playerPos.x;
    const dz = doorPos.z - playerPos.z;
    const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));

    const angleToDoor = Math.atan2(dx, -dz);
    let relAngle = angleToDoor - yaw;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    const panVal = Math.sin(relAngle);
    const volume = Math.min(0.6, Math.max(0.05, 1.0 / (1.0 + (dist - 1) * 0.15)));

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);

    if (typeof (ctx as any).createStereoPanner === 'function') {
      const panner = (ctx as any).createStereoPanner();
      panner.pan.setValueAtTime(panVal, now);
      masterGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    // Metallic door slam + hydraulic hiss
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Heartbeat sound for low HP
  public playHeartbeat() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const beats = [0, 0.18];

    beats.forEach(delay => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(70, now + delay);
      osc.frequency.exponentialRampToValueAtTime(30, now + delay + 0.12);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.12);
    });
  }
}

export const soundManager = new SoundManager();
