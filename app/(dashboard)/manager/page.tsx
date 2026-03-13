"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";

export default function ManagerPage() {
  const user = useQuery(api.users.getCurrentUser);
  const router = useRouter();

  if (user === undefined) return null;
  if (user === null) {
    router.replace("/login");
    return null;
  }

  if (user.role !== "manager") {
    router.replace("/");
    return null;
  }

  return <ManagerDashboard />;
}
