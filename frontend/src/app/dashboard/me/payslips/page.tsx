"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { selfServiceApi } from "@/lib/api";
import type { MyPayslip } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToastStore } from "@/stores/toast-store";
import { Download, Eye, Printer } from "lucide-react";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

// The payroll service stores payslip documents as plain text today, so the
// print window renders that document and lets the browser "Save as PDF".
function printPayslip(title: string, content: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>${escapeHtml(title)}</title></head>` +
      `<body><pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;">${escapeHtml(content)}</pre></body></html>`
  );
  win.document.close();
  win.focus();
  win.print();
}

export default function MyPayslipsPage() {
  const addToast = useToastStore((s) => s.toast);
  const [selected, setSelected] = useState<MyPayslip | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const {
    data: payslips,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["my-payslips"],
    queryFn: async () => {
      const { data } = await selfServiceApi.payslips.list();
      return (data as MyPayslip[]) ?? [];
    },
  });

  const { data: detail, isLoading: detailLoading, isError: detailError } = useQuery({
    queryKey: ["my-payslip", selected?.id],
    queryFn: async () => {
      if (!selected) return null;
      const { data } = await selfServiceApi.payslips.get(selected.id);
      return data as MyPayslip;
    },
    enabled: selected !== null,
  });

  const handleDownload = async (payslip: MyPayslip) => {
    setDownloadingId(payslip.id);
    try {
      const { data } = await selfServiceApi.payslips.download(payslip.id);
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslip-${payslip.period ?? payslip.id}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      addToast({ title: "Failed to download payslip", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const detailContent = detail?.pdfContent ?? selected?.pdfContent ?? "";

  return (
    <div className="space-y-4" data-testid="my-payslips">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading payslips..." : `${payslips?.length ?? 0} payslips on file`}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="refresh-payslips">
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="border-destructive/50">
          <CardContent className="space-y-3 py-8 text-center">
            <p className="font-medium text-destructive">Failed to load your payslips</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Something went wrong. Please try again."}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Retrying..." : "Retry"}
            </Button>
          </CardContent>
        </Card>
      ) : !payslips || payslips.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground" data-testid="payslips-empty">
            No payslips have been generated for you yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((payslip) => (
                  <TableRow key={payslip.id} data-testid={`payslip-row-${payslip.id}`}>
                    <TableCell className="font-medium">{payslip.period ?? `#${payslip.id}`}</TableCell>
                    <TableCell>{formatDate(payslip.generatedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Payslip</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelected(payslip)} data-testid={`view-payslip-${payslip.id}`}>
                          <Eye className="h-4 w-4" /> View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(payslip)}
                          disabled={downloadingId === payslip.id}
                        >
                          <Download className="h-4 w-4" />
                          {downloadingId === payslip.id ? "Downloading..." : "Download"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payslip {selected?.period ?? ""}</DialogTitle>
            <DialogDescription>
              Generated {formatDate(selected?.generatedAt)}. This document belongs to your account.
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : detailError ? (
            <p className="py-4 text-sm text-destructive">
              Failed to load this payslip. Close the dialog and try again.
            </p>
          ) : detailContent ? (
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap" data-testid="payslip-document">
              {detailContent}
            </pre>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">This payslip has no document content.</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => selected && printPayslip(`Payslip ${selected.period ?? ""}`, detailContent)}
              disabled={!detailContent}
            >
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </Button>
            <Button onClick={() => selected && handleDownload(selected)} disabled={!selected || downloadingId === selected.id}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
