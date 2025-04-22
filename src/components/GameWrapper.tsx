'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Game component with SSR disabled
// This is important because GameClient uses the window object which isn't available during SSR
const GameWithNoSSR = dynamic(() => import('@/components/Game'), {
  ssr: false,
});

export default function GameWrapper() {
  return <GameWithNoSSR />;
}