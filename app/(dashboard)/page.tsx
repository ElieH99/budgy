"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { EmployeeDashboard } from "@/components/expenses/EmployeeDashboard";

export default function DashboardPage() {
  const user = useQuery(api.users.getCurrentUser);
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      router.replace("/login");
    } else if (user?.role === "manager") {
      router.replace("/manager");
    }
  }, [user, router]);

  if (user === undefined || user === null || user.role === "manager") return null;

  return <EmployeeDashboard />;
}
