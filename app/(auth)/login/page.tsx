"use client";

import { useState, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Receipt } from "lucide-react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(user.role === "manager" ? "/manager" : "/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="mx-4 w-full max-w-[380px] sm:mx-auto">
        <div className="overflow-hidden rounded-2xl border border-[#e5e2db] bg-white shadow-xl">
          {/* Top accent strip */}
          <div className="h-1 w-full bg-[#7C6BF0]" />

          <div className="px-5 py-6 sm:px-7 sm:py-8">
            {/* Logo mark */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold text-foreground">Budgy</span>
              </div>
            </div>

            <div className="border-t border-border mb-5" />

            {/* Heading */}
            <div className="mb-5">
              <h1 className="text-lg font-medium">Sign in</h1>
              <p className="text-sm text-muted-foreground">Internal Expense Tracker</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="focus:ring-2 focus:ring-[#7C6BF0]/20 focus:border-[#7C6BF0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="focus:ring-2 focus:ring-[#7C6BF0]/20 focus:border-[#7C6BF0]"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full border-none bg-[#7C6BF0] text-white hover:bg-[#6a59d8]"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-[#7C6BF0] hover:underline">
                  Register
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
