function playBeep(ctx: AudioContext, startTime: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.6, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + 0.5);
}

export function playAlarm(): void {
  if (typeof window === "undefined") return;
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return;
  const ctx = new AudioContextCtor();
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    playBeep(ctx, now + i * 0.6);
  }
  ctx.resume().catch(() => {});
}
