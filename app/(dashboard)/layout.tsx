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
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Expense Tracker</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs rounded-full px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize">
              {user.role}
            </span>
            <span className="text-sm text-muted-foreground">
              {user.firstName} {user.lastName}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </main>
    </div>
  );
}
