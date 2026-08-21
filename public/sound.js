/* Tiny Web Audio helper — beep + reveal chime, no external files. */
const Sound = (() => {
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur = 0.12, type = 'sine', gain = 0.2, when = 0) {
    if (!enabled) return;
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + when);
    o.stop(c.currentTime + when + dur);
  }

  return {
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },
    tick() { tone(660, 0.08, 'square', 0.15); },          // countdown tick
    go() { tone(880, 0.18, 'sawtooth', 0.2); },            // countdown -> reveal
    reveal() {                                             // ta-da on full reveal
      tone(523, 0.14, 'sine', 0.22, 0);
      tone(659, 0.14, 'sine', 0.22, 0.12);
      tone(784, 0.26, 'sine', 0.24, 0.24);
    },
    answer() { tone(988, 0.22, 'triangle', 0.22); },       // show answer
    score() { tone(1175, 0.16, 'sine', 0.2); },
  };
})();
