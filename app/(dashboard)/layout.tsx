"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { LogOut, Receipt } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const user = useQuery(api.users.getCurrentUser);
  const { signOut } = useAuthActions();
  const router = useRouter();

  // Redirect unauthenticated users
  useEffect(() => {
    if (user === null) {
      router.replace("/login");
    }
  }, [user, router]);

  // Loading state — also shown during sign-out to unmount children and stop their queries
  if (signingOut || user === undefined || user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  };

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
        {children}
      </main>
    </div>
  );
}
