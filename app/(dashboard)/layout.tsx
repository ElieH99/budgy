"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogOut, Receipt } from "lucide-react";
import { IDLE_TIMEOUT_MS } from "@/lib/constants";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const user = useQuery(api.users.getCurrentUser);
  const { signOut } = useAuthActions();
  const router = useRouter();

  // ── Idle logout (15 min) ────────────────────────────────────────────────
  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  }, [signOut, router]);

  useEffect(() => {
    if (!user) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "mousedown",
      "touchstart",
    ];
    for (const event of events) {
      window.addEventListener(event, resetActivity);
    }

    idleTimerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        handleSignOut();
      }
    }, 30_000); // check every 30 seconds

    return () => {
      for (const event of events) {
        window.removeEventListener(event, resetActivity);
      }
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
      }
    };
  }, [user, handleSignOut]);

  // Redirect unauthenticated users (skip if already signing out to avoid double redirect)
  useEffect(() => {
    if (user === null && !signingOut) {
      router.replace("/login");
    }
  }, [user, router, signingOut]);

  // Loading state — also shown during sign-out to unmount children and stop their queries
  if (signingOut || user === undefined || user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-indigo-700 focus:shadow">
        Skip to main content
      </a>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3" aria-label="Budgy — Internal Expense Tracker">
            <Receipt className="h-8 w-8 text-primary" aria-hidden="true" />
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-bold">Budgy</span>
              <span className="text-xs text-muted-foreground">Internal Expense Tracker</span>
            </div>
          </div>
          <nav aria-label="User menu">
            <div className="flex items-center gap-4">
              <span className="text-xs rounded-full px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize" aria-label={`Role: ${user.role}`}>
                {user.role}
              </span>
              <span className="text-sm text-muted-foreground" aria-label={`Signed in as ${user.firstName} ${user.lastName}`}>
                {user.firstName} {user.lastName}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" aria-hidden="true" />
                Sign out
              </Button>
            </div>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </main>
    </div>
  );
}
