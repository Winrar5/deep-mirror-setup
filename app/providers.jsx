'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { AppContextProvider } from '@/context/AppContext';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }) {
  return (
    <ClerkProvider>
      <AppContextProvider>
        {children}
        {/* toast портал – лише на клієнті */}
        <Toaster
          toastOptions={{
            success: { style: { background: 'black', color: 'white' } },
            error:   { style: { background: 'black', color: 'white' } },
          }}
        />
      </AppContextProvider>
    </ClerkProvider>
  );
}
