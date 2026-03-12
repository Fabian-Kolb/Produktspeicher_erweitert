import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
}

export function useAudioVisualizer(options: AudioVisualizerOptions = {}) {
  const { fftSize = 2048, smoothingTimeConstant = 0.8 } = options;
  
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const initWebAudio = (audioElement: HTMLMediaElement) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      if (!analyserRef.current) {
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = fftSize;
        analyserRef.current.smoothingTimeConstant = smoothingTimeConstant;
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      }

      if (!sourceRef.current) {
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioElement);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      }

      setIsReady(true);
      setError(null);
    } catch (err: any) {
      console.error('AudioContext initialization failed', err);
      setError(err.message || 'Error initializing audio context');
    }
  };

  const getFrequencyData = () => {
    if (!analyserRef.current || !dataArrayRef.current) return new Uint8Array(0);
    analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
    return dataArrayRef.current;
  };

  const getAudioFrequencies = () => {
    const data = getFrequencyData();
    if (data.length === 0) return { bass: 0, mids: 0, highs: 0 };

    // Approximation of frequency bands based on the array length
    // Ideally calculated accurately based on sampleRate
    const third = Math.floor(data.length / 3);
    
    let bass = 0, mids = 0, highs = 0;
    
    for (let i = 0; i < third; i++) bass += data[i];
    for (let i = third; i < third * 2; i++) mids += data[i];
    for (let i = third * 2; i < data.length; i++) highs += data[i];

    return {
      bass: bass / third,
      mids: mids / third,
      highs: highs / (data.length - third * 2)
    };
  };

  useEffect(() => {
    return () => {
      // Cleanup
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(console.error);
      }
    };
  }, []);

  return {
    initWebAudio,
    getFrequencyData,
    getAudioFrequencies,
    isReady,
    isPlaying,
    setIsPlaying, // to manually trigger/sync UI
    error,
  };
}
