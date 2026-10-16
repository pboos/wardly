function playBeep(ctx: AudioContext, startTime: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.6, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.5);
}

export function createMeetingAlarm() {
  let context: AudioContext | null = null;
  return {
    async prime() {
      if (typeof window === "undefined")
        throw new Error("Sound is unavailable.");
      const Constructor = window.AudioContext;
      if (!Constructor)
        throw new Error("This browser does not support alarm sound.");
      context ??= new Constructor();
      await context.resume();
      if (context.state !== "running")
        throw new Error("Sound is blocked. Use Test sound to enable it.");
    },
    play() {
      if (context?.state !== "running") return false;
      for (let index = 0; index < 3; index++)
        playBeep(context, context.currentTime + index * 0.6);
      return true;
    },
    dispose() {
      if (context && context.state !== "closed") void context.close();
      context = null;
    },
  };
}
