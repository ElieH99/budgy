"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { EmployeeDashboard } from "@/components/expenses/EmployeeDashboard";

export default function DashboardPage() {
  const user = useQuery(api.users.getCurrentUser);
  const router = useRouter();

  if (user === undefined) return null;
  if (user === null) {
    router.replace("/login");
    return null;
  }

  // Redirect managers to their dashboard
  if (user.role === "manager") {
    router.replace("/manager");
    return null;
  }

  return <EmployeeDashboard />;
}
