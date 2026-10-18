export function createAudio() {
  let context = null;
  let enabled = true;

  function ensure() {
    if (!enabled) return null;
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }

  function tone(frequency, duration, type, gainValue) {
    const audio = ensure();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  return {
    get enabled() {
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    unlock() {
      ensure();
    },
    hit(blocked) {
      tone(blocked ? 210 : 95, 0.12, "triangle", blocked ? 0.04 : 0.07);
    },
    ko() {
      tone(70, 0.4, "sawtooth", 0.06);
    },
  };
}
