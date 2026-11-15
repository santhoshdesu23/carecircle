'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';

interface SeniorModeContextType {
  seniorMode: boolean;
  toggleSeniorMode: () => Promise<void>;
  speakText: (text: string) => void;
  isSpeaking: boolean;
}

const SeniorModeContext = createContext<SeniorModeContextType>({
  seniorMode: false,
  toggleSeniorMode: async () => {
    // Default context placeholder
  },
  speakText: () => {
    // Default context placeholder
  },
  isSpeaking: false,
});

export function SeniorModeProvider({
  children,
  initialSeniorMode = false,
}: Readonly<{
  children: ReactNode;
  initialSeniorMode?: boolean;
}>) {
  const [seniorMode, setSeniorMode] = useState(initialSeniorMode);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('carecircle_senior_mode');
    if (saved !== null) {
      setSeniorMode(saved === 'true');
    }
  }, []);

  const toggleSeniorMode = useCallback(async () => {
    const nextVal = !seniorMode;
    setSeniorMode(nextVal);
    localStorage.setItem('carecircle_senior_mode', String(nextVal));

    try {
      await fetch('/api/auth/senior-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal }),
      });
    } catch (_err) {
      // Offline or network error ignored
    }
  }, [seniorMode]);

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();
      if (isSpeaking) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower, clearer speech for seniors
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [isSpeaking]
  );

  const contextValue = useMemo(
    () => ({
      seniorMode,
      toggleSeniorMode,
      speakText,
      isSpeaking,
    }),
    [seniorMode, toggleSeniorMode, speakText, isSpeaking]
  );

  return (
    <SeniorModeContext.Provider value={contextValue}>
      <div className={seniorMode ? 'senior-mode text-lg' : ''}>{children}</div>
    </SeniorModeContext.Provider>
  );
}

export function useSeniorMode() {
  return useContext(SeniorModeContext);
}
