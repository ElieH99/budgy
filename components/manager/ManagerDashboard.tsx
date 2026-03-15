"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingQueue } from "./PendingQueue";
import { ReviewedHistory } from "./ReviewedHistory";
import { ManagerSummaryStrip } from "./ManagerSummaryStrip";
import { ExpenseSummaryStrip } from "@/components/expenses/ExpenseSummaryStrip";
import { EmployeeDashboard } from "@/components/expenses/EmployeeDashboard";

export function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState("pending");
  const [historySelectedStatuses, setHistorySelectedStatuses] = useState<string[]>([]);

  const handleStripStatusClick = (status: string, tab: "pending" | "history") => {
    setActiveTab(tab);
    if (tab === "history") {
      if (status === "all") {
        setHistorySelectedStatuses([]);
      } else {
        setHistorySelectedStatuses((prev) =>
          prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Manager Dashboard</h1>

      {/* Summary strip — swaps based on active tab, always in same position */}
      <div className="min-h-[72px]">
        {activeTab === "my-expenses" ? (
          <ExpenseSummaryStrip />
        ) : (
          <ManagerSummaryStrip
            activeTab={activeTab}
            activeHistoryStatuses={historySelectedStatuses}
            onStatusClick={handleStripStatusClick}
          />
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="history">Reviewed History</TabsTrigger>
          <TabsTrigger value="my-expenses">My Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="min-h-[420px]">
          <PendingQueue />
        </TabsContent>
        <TabsContent value="history" className="min-h-[420px]">
          <ReviewedHistory
            selectedStatuses={historySelectedStatuses}
            onSelectedStatusesChange={setHistorySelectedStatuses}
          />
        </TabsContent>
        <TabsContent value="my-expenses" className="min-h-[420px]">
          <EmployeeDashboard hideSummaryStrip />
        </TabsContent>
      </Tabs>
    </div>
  );
}
