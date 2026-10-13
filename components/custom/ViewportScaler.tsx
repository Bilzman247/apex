'use client';

/**
 * Universal layout wrapper ensuring smooth rendering and responsive display
 * across all devices (mobile, tablet, and desktop).
 */
export default function ViewportScaler({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full flex flex-col bg-background overflow-y-auto">
      {children}
    </div>
  );
}
