// Sintetizador WebAudio (sin archivos). Estilo interfaz moderna: cristal FM, colchones con reverb, aire y clics.
/* eslint-disable @typescript-eslint/no-explicit-any */
let ctx: AudioContext | null = null, dry: GainNode | null = null, wet: GainNode | null = null
let noiseBuf: AudioBuffer | null = null, muted = false, stale = false
export function setMuted(m: boolean) { muted = m }

function makeImpulse(c: AudioContext, seconds = 2.2, decay = 3.2) {
  const len = Math.floor(c.sampleRate * seconds), buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) }
  return buf
}
function audio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext; if (!AC) return null
    ctx = new AC()
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9000
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3
    const out = ctx.createGain(); out.gain.value = 0.9
    tone.connect(comp).connect(out).connect(ctx.destination)
    dry = ctx.createGain(); dry.gain.value = 0.8; dry.connect(tone)
    const verb = ctx.createConvolver(); verb.buffer = makeImpulse(ctx)
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.32
    wet = ctx.createGain(); wet.connect(verb).connect(verbOut).connect(tone)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return ctx
}
// iOS: tras segundo plano el contexto queda "muerto" (dice running pero no suena): recrearlo en el siguiente toque
function reset() { const o = ctx; ctx = dry = wet = null; stale = false; if (o) void o.close().catch(() => {}) }
function unlock() {
  if (ctx && (stale || ctx.state === 'closed' || (ctx.state as string) === 'interrupted')) reset()
  const c = audio(); if (!c) return
  const s = (navigator as any).audioSession; if (s && s.type !== 'playback') try { s.type = 'playback' } catch { /* */ }
  if (c.state !== 'running') void c.resume()
  const src = c.createBufferSource(); src.buffer = c.createBuffer(1, 1, c.sampleRate); src.connect(c.destination); src.start(0)
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stale = true })
  window.addEventListener('pagehide', () => { stale = true })
}
function ready() {
  if (muted) return null
  const c = audio(); if (!c || !dry || !wet) return null
  if (c.state !== 'running') { void c.resume(); return null }
  return c
}
function route(c: AudioContext, node: AudioNode, reverb: number) {
  const d = c.createGain(); const w = c.createGain(); w.gain.value = reverb
  node.connect(d).connect(dry!); node.connect(w).connect(wet!)
}
function env(g: GainNode, start: number, attack: number, dur: number, vol: number) {
  g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + attack); g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
}
function soft(c: AudioContext, o: { f: number; to?: number; t?: number; dur: number; vol?: number; attack?: number; reverb?: number; type?: OscillatorType }) {
  const start = c.currentTime + (o.t ?? 0), osc = c.createOscillator(), g = c.createGain()
  osc.type = o.type ?? 'sine'; osc.frequency.setValueAtTime(o.f, start)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + o.dur * 0.9)
  env(g, start, o.attack ?? 0.008, o.dur, o.vol ?? 0.12); osc.connect(g); route(c, g, o.reverb ?? 0.35)
  osc.start(start); osc.stop(start + o.dur + 0.05)
}
function glass(c: AudioContext, o: { f: number; t?: number; dur?: number; vol?: number; reverb?: number; ratio?: number; index?: number }) {
  const start = c.currentTime + (o.t ?? 0), dur = o.dur ?? 1.1
  const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain()
  car.frequency.value = o.f; mod.frequency.value = o.f * (o.ratio ?? 3.5)
  const idx = o.f * (o.index ?? 1.4); mg.gain.setValueAtTime(idx, start); mg.gain.exponentialRampToValueAtTime(idx * 0.02, start + dur * 0.5)
  mod.connect(mg).connect(car.frequency); env(g, start, 0.004, dur, o.vol ?? 0.07); car.connect(g); route(c, g, o.reverb ?? 0.6)
  car.start(start); mod.start(start); car.stop(start + dur + 0.05); mod.stop(start + dur + 0.05)
}
function pad(c: AudioContext, freqs: number[], o: { t?: number; dur: number; vol?: number; attack?: number; reverb?: number }) {
  for (const f of freqs) for (const det of [-6, 6]) {
    const start = c.currentTime + (o.t ?? 0), osc = c.createOscillator(), g = c.createGain()
    osc.frequency.value = f; osc.detune.value = det
    env(g, start, o.attack ?? 0.12, o.dur, (o.vol ?? 0.05) / freqs.length); osc.connect(g); route(c, g, o.reverb ?? 0.8)
    osc.start(start); osc.stop(start + o.dur + 0.05)
  }
}
function air(c: AudioContext, o: { t?: number; dur: number; vol?: number; f: number; to?: number; q?: number; attack?: number; type?: BiquadFilterType; reverb?: number }) {
  const start = c.currentTime + (o.t ?? 0), src = c.createBufferSource(); src.buffer = noiseBuf
  const bq = c.createBiquadFilter(); bq.type = o.type ?? 'bandpass'; bq.Q.value = o.q ?? 0.9
  bq.frequency.setValueAtTime(o.f, start); if (o.to) bq.frequency.exponentialRampToValueAtTime(o.to, start + o.dur)
  const g = c.createGain(); env(g, start, o.attack ?? o.dur * 0.4, o.dur, o.vol ?? 0.05)
  src.connect(bq).connect(g); route(c, g, o.reverb ?? 0.4); src.start(start, Math.random()); src.stop(start + o.dur + 0.05)
}
function tick(c: AudioContext, o: { t?: number; f?: number; vol?: number }) {
  const start = c.currentTime + (o.t ?? 0), osc = c.createOscillator(), g = c.createGain()
  osc.frequency.value = o.f ?? 1900; env(g, start, 0.001, 0.035, o.vol ?? 0.05); osc.connect(g); route(c, g, 0.1)
  osc.start(start); osc.stop(start + 0.05)
}
const PENTA = [62, 64, 66, 69, 71] // Re pentatónica
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const penta = (s: number, oct = 0) => hz(PENTA[((s % 5) + 5) % 5] + 12 * (oct + Math.floor(s / 5)))
let pickCount = 0

export const sfx = {
  /** levantar una ficha (muy bajo) */
  pick() { const c = ready(); if (!c) return; pickCount++
    tick(c, { f: 1500 + (pickCount % 5) * 90, vol: 0.03 })
    soft(c, { f: penta(pickCount % 5, 1), dur: 0.09, vol: 0.016, reverb: 0.15 }) },
  /** soltar fichas en la mesa: toque sobre madera + cristal */
  place() { const c = ready(); if (!c) return; soft(c, { f: 260, to: 150, dur: .2, vol: .13, reverb: .25 }); glass(c, { t: .03, f: penta(0, 2), dur: .8, vol: .035 }) },
  /** la jugada queda válida */
  meldOk() { const c = ready(); if (!c) return; glass(c, { f: penta(2, 2), dur: .9, vol: .045 }); glass(c, { t: .08, f: penta(4, 2), dur: 1.1, vol: .04 }) },
  undo() { const c = ready(); if (!c) return; air(c, { dur: .25, vol: .03, f: 3000, to: 900, q: .8 }); soft(c, { f: penta(3, 1), to: penta(1, 1), dur: .18, vol: .05, reverb: .3 }) },
  /** robar ficha: aire que sube + cristal */
  draw() { const c = ready(); if (!c) return; air(c, { dur: .42, vol: .05, f: 400, to: 4200, q: .7 }); glass(c, { t: .18, f: penta(4, 2), dur: 1, vol: .03 }) },
  whoosh() { const c = ready(); if (!c) return; air(c, { dur: .42, vol: .05, f: 400, to: 4200, q: .7 }); glass(c, { t: .18, f: penta(4, 2), dur: 1, vol: .03 }) },
  /** otro jugador coloca fichas */
  otherPlay() { const c = ready(); if (!c) return; [0, 1, 2].forEach((i) => soft(c, { t: i * .07, f: 230 - i * 20, to: 140, dur: .14, vol: .09, reverb: .25 })); glass(c, { t: .22, f: penta(1, 2), dur: .9, vol: .03 }) },
  firstMeld() { const c = ready(); if (!c) return; glass(c, { f: penta(0, 2), dur: 1.3, vol: .06 }); glass(c, { t: .11, f: penta(4, 2), dur: 1.5, vol: .06 }); pad(c, [penta(0, 1), penta(3, 1), penta(4, 1)], { t: .05, dur: 1.4, vol: .06 }) },
  penalty() { const c = ready(); if (!c) return; soft(c, { f: 520, to: 180, dur: .6, vol: .1, attack: .03, reverb: .5 }); pad(c, [hz(57), hz(60), hz(64)], { t: .1, dur: 1.3, vol: .08, attack: .15 }); soft(c, { t: .55, f: 90, to: 50, dur: .35, vol: .22, reverb: .3 }) },
  pass() { const c = ready(); if (!c) return; soft(c, { f: penta(3, 1), dur: .3, vol: .07, reverb: .4 }); soft(c, { t: .14, f: penta(1, 1), to: penta(0, 1), dur: .45, vol: .07, reverb: .4 }) },
  yourTurn() { const c = ready(); if (!c) return; glass(c, { f: penta(2, 2), dur: .9, vol: .06 }); glass(c, { t: .12, f: penta(5, 2), dur: 1.1, vol: .06 }) },
  tickTock() { const c = ready(); if (!c) return; tick(c, { f: 2400, vol: .05 }) },
  fanfare() { const c = ready(); if (!c) return; pad(c, [penta(0, 0), penta(3, 0), penta(0, 1), penta(2, 1)], { dur: 2, vol: .1, attack: .15 }); [0, 1, 2, 3, 4, 5, 7].forEach((s, i) => glass(c, { t: i * .06, f: penta(s, 2), dur: 1.4, vol: .045 })); air(c, { t: .3, dur: 1, vol: .025, f: 6000, to: 12000, q: 1.5 }) },
  lose() { const c = ready(); if (!c) return; pad(c, [hz(50), hz(57), hz(60), hz(65)], { dur: 2.2, vol: .1, attack: .2 }); soft(c, { f: 440, to: 140, dur: 1.5, vol: .05, attack: .1, reverb: .7 }) },
  victory() { const c = ready(); if (!c) return; pad(c, [penta(0, 0), penta(3, 0), penta(2, 1)], { dur: 1.2, vol: .1, attack: .1 }); pad(c, [penta(4, -1), penta(1, 0), penta(4, 0)], { t: .9, dur: 1.2, vol: .1, attack: .1 }); pad(c, [penta(0, 0), penta(3, 0), penta(0, 1), penta(2, 1)], { t: 1.8, dur: 2.4, vol: .12, attack: .15 }); [0, 2, 3, 5, 7, 8, 10].forEach((s, i) => glass(c, { t: 1.8 + i * .07, f: penta(s, 2), dur: 1.6, vol: .045 })) },
  deny() { const c = ready(); if (!c) return; soft(c, { f: 170, to: 120, dur: .12, vol: .12, reverb: .05 }) },
  button() { const c = ready(); if (!c) return; tick(c, { f: 2000, vol: .035 }) },
}

export const SOUND_LIST: { key: keyof typeof sfx; label: string }[] = [
  { key: 'pick', label: 'Levantar ficha' },
  { key: 'place', label: 'Colocar' },
  { key: 'meldOk', label: 'Jugada válida' },
  { key: 'undo', label: 'Deshacer' },
  { key: 'draw', label: 'Robar' },
  { key: 'otherPlay', label: 'Juega otro' },
  { key: 'firstMeld', label: 'Primera bajada' },
  { key: 'penalty', label: 'Penalización' },
  { key: 'pass', label: 'Pasar' },
  { key: 'yourTurn', label: 'Tu turno' },
  { key: 'fanfare', label: 'Fanfarria' },
  { key: 'victory', label: 'Victoria' },
  { key: 'lose', label: 'Derrota' },
  { key: 'deny', label: 'No se puede' },
]
