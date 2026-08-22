let actx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function initAudio(): void {
  if (actx) {
    if (actx.state === "suspended") void actx.resume();
    return;
  }
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  actx = new Ctor();
  master = actx.createGain();
  master.gain.value = 0.5;
  master.connect(actx.destination);
  const len = Math.floor(actx.sampleRate * 0.25);
  noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
}

export function audioState(): string {
  return actx ? actx.state : "none";
}

function now(): number {
  return actx ? actx.currentTime : 0;
}

function noiseSource(dur: number): AudioBufferSourceNode | null {
  if (!actx || !noiseBuf) return null;
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.start(now(), Math.random() * 0.1, dur);
  return src;
}

export function playShot(volume = 1): void {
  if (!actx || !master) return;
  const t = now();
  const dur = 0.14;

  const crack = noiseSource(dur);
  if (crack) {
    const bp = actx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(500, t + dur);
    bp.Q.value = 0.8;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.55 * volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    crack.connect(bp).connect(g).connect(master);
    crack.stop(t + dur);
  }

  const thump = actx.createOscillator();
  thump.type = "triangle";
  thump.frequency.setValueAtTime(160, t);
  thump.frequency.exponentialRampToValueAtTime(45, t + 0.09);
  const tg = actx.createGain();
  tg.gain.setValueAtTime(0.4 * volume, t);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  thump.connect(tg).connect(master);
  thump.start(t);
  thump.stop(t + 0.1);
}

export function playHitConfirm(): void {
  if (!actx || !master) return;
  const t = now();
  const osc = actx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(1750, t);
  osc.frequency.setValueAtTime(2300, t + 0.04);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.09);
}

export function playHurt(): void {
  if (!actx || !master) return;
  const t = now();

  const thud = actx.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(220, t);
  thud.frequency.exponentialRampToValueAtTime(70, t + 0.16);
  const tg = actx.createGain();
  tg.gain.setValueAtTime(0.35, t);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  thud.connect(tg).connect(master);
  thud.start(t);
  thud.stop(t + 0.19);

  const grit = noiseSource(0.12);
  if (grit) {
    const lp = actx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const gg = actx.createGain();
    gg.gain.setValueAtTime(0.3, t);
    gg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    grit.connect(lp).connect(gg).connect(master);
    grit.stop(t + 0.13);
  }
}

export function playShieldCharge(): void {
  if (!actx || !master) return;
  const t = now();
  const osc = actx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(780, t + 0.35);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.43);
}

export function playPickup(): void {
  if (!actx || !master) return;
  const t = now();
  for (const [i, frequency] of [660, 990].entries()) {
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    g.gain.setValueAtTime(0.1, t + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.12);
    osc.connect(g).connect(master);
    osc.start(t + i * 0.07);
    osc.stop(t + i * 0.07 + 0.13);
  }
}

export function playExplosion(): void {
  if (!actx || !master) return;
  const t = now();
  const blast = noiseSource(0.45);
  if (blast) {
    const lp = actx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 0.42);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    blast.connect(lp).connect(g).connect(master);
    blast.stop(t + 0.45);
  }
}
