"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { selfServiceApi } from "@/lib/api";
import type { MyLeaveBalances, MyLeaveRecord } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays } from "lucide-react";

const statusVariant: Record<string, "secondary" | "success" | "warning" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function MyLeavePage() {
  const [page, setPage] = useState(0);

  const balancesQuery = useQuery({
    queryKey: ["my-leave-balances"],
    queryFn: async () => {
      const { data } = await selfServiceApi.leave.balances();
      return data as MyLeaveBalances;
    },
  });

  const requestsQuery = useQuery({
    queryKey: ["my-leave-requests", page],
    queryFn: async () => {
      const { data } = await selfServiceApi.leave.list({ page, size: PAGE_SIZE });
      return {
        items: (data.content ?? []) as MyLeaveRecord[],
        totalElements: typeof data.totalElements === "number" ? data.totalElements : 0,
        totalPages: typeof data.totalPages === "number" ? data.totalPages : 1,
      };
    },
    placeholderData: (previous) => previous,
  });

  const balances = balancesQuery.data?.balances ?? [];
  const requests = requestsQuery.data?.items ?? [];
  const totalPages = Math.max(1, requestsQuery.data?.totalPages ?? 1);

  return (
    <div className="space-y-6" data-testid="my-leave">
      <section aria-labelledby="leave-balances-heading">
        <h2 id="leave-balances-heading" className="mb-3 text-lg font-semibold">
          Balances
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {balancesQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          ) : balancesQuery.isError ? (
            <Card className="col-span-full border-destructive/50">
              <CardContent className="space-y-3 py-8 text-center">
                <p className="font-medium text-destructive">Failed to load your leave balances</p>
                <p className="text-sm text-muted-foreground">
                  {balancesQuery.error instanceof Error
                    ? balancesQuery.error.message
                    : "Something went wrong. Please try again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => balancesQuery.refetch()}
                  disabled={balancesQuery.isFetching}
                >
                  {balancesQuery.isFetching ? "Retrying..." : "Retry"}
                </Button>
              </CardContent>
            </Card>
          ) : balances.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-8 text-center text-muted-foreground">
                No leave balances are configured for your account yet.
              </CardContent>
            </Card>
          ) : (
            balances.map((balance) => {
              const usedRatio =
                balance.entitlementDays > 0
                  ? Math.min(100, Math.round((balance.usedDays / balance.entitlementDays) * 100))
                  : 0;
              return (
                <Card key={balance.leaveType} data-testid={`balance-${balance.leaveType}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {balance.leaveType}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-2xl font-bold">
                      {balance.remainingDays}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        days remaining
                      </span>
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${usedRatio}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {balance.usedDays} used of {balance.entitlementDays} entitled
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      <section aria-labelledby="leave-requests-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="leave-requests-heading" className="text-lg font-semibold">
            My requests
          </h2>
          {!requestsQuery.isLoading && !requestsQuery.isError && (
            <span className="text-sm text-muted-foreground">
              {requestsQuery.data?.totalElements ?? 0} total
            </span>
          )}
        </div>
        {requestsQuery.isLoading ? (
          <Card>
            <CardContent className="space-y-3 py-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : requestsQuery.isError ? (
          <Card className="border-destructive/50">
            <CardContent className="space-y-3 py-8 text-center">
              <p className="font-medium text-destructive">Failed to load your leave requests</p>
              <p className="text-sm text-muted-foreground">
                {requestsQuery.error instanceof Error
                  ? requestsQuery.error.message
                  : "Something went wrong. Please try again."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => requestsQuery.refetch()}
                disabled={requestsQuery.isFetching}
              >
                {requestsQuery.isFetching ? "Retrying..." : "Retry"}
              </Button>
            </CardContent>
          </Card>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground" data-testid="leave-requests-empty">
              You have not requested any leave yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((record) => (
                    <TableRow key={record.id} data-testid={`leave-row-${record.id}`}>
                      <TableCell className="font-medium">{record.leaveType}</TableCell>
                      <TableCell>{formatDate(record.startDate)}</TableCell>
                      <TableCell>{formatDate(record.endDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[record.status] ?? "secondary"}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">
                        {record.reason || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || requestsQuery.isFetching}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= totalPages || requestsQuery.isFetching}
            >
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
