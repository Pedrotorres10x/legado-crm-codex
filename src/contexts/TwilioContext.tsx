import { createContext, useContext, ReactNode } from 'react';
import { useTwilioDevice, CallState } from '@/hooks/useTwilioDevice';

export interface DialContext {
  contactId?: string | null;
  contactName?: string | null;
}

interface TwilioContextValue {
  callState: CallState;
  dial: (number: string, context?: DialContext) => void;
  hangUp: () => void;
  toggleMute: () => void;
  answerCall: () => void;
  rejectCall: () => void;
  transferCall: (targetAgentUserId: string) => Promise<{ ok: boolean; error?: string }>;
}

const TwilioContext = createContext<TwilioContextValue | null>(null);

export const TwilioProvider = ({ children }: { children: ReactNode }) => {
  const twilio = useTwilioDevice();
  return (
    <TwilioContext.Provider value={twilio}>
      {children}
    </TwilioContext.Provider>
  );
};

export const useTwilio = () => {
  const ctx = useContext(TwilioContext);
  if (!ctx) throw new Error('useTwilio must be used within TwilioProvider');
  return ctx;
};
