"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingQueue } from "./PendingQueue";
import { ReviewedHistory } from "./ReviewedHistory";
import { EmployeeDashboard } from "@/components/expenses/EmployeeDashboard";

export function ManagerDashboard() {
  const stats = useQuery(api.expenses.getManagerStats);
  const [activeTab, setActiveTab] = useState("pending");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Manager Dashboard</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending" value={stats?.pending} color="text-amber-600" />
        <StatCard label="Approved This Month" value={stats?.approvedThisMonth} color="text-green-600" />
        <StatCard label="Rejected This Month" value={stats?.rejectedThisMonth} color="text-orange-600" />
        <StatCard label="Total" value={stats?.totalUnderManagement} color="text-gray-900" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="history">Reviewed History</TabsTrigger>
          <TabsTrigger value="my-expenses">My Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <PendingQueue />
        </TabsContent>
        <TabsContent value="history">
          <ReviewedHistory />
        </TabsContent>
        <TabsContent value="my-expenses">
          <EmployeeDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | undefined;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {value === undefined ? (
        <Skeleton className="h-8 w-16 mt-1" />
      ) : (
        <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      )}
    </div>
  );
}
