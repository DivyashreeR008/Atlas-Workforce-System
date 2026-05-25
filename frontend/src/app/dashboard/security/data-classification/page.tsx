"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import { Database, Shield, Tag, User, Calendar, Lock, Eye } from "lucide-react";
import { securityApi } from "@/lib/api";
import type { DataClassification } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const levelColors: Record<string, string> = {
  public: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  internal: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  confidential: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  restricted: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  "top-secret": "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  critical: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
};

export default function DataClassificationPage() {
  const { data: classifications, isLoading } = useQuery({
    queryKey: ["security-data-classification"],
    queryFn: async () => {
      const { data } = await securityApi.dataClassification.list({ tenant_id: "default" });
      return (Array.isArray(data) ? data : []) as DataClassification[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Classification</h1>
        <p className="text-muted-foreground">Classify and label data assets by sensitivity and criticality</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15"><Database className="h-5 w-5 text-cyan-500" /></div>
              <div><p className="text-sm text-muted-foreground">Classifications</p><p className="text-xl font-bold">{classifications?.length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15"><Shield className="h-5 w-5 text-rose-500" /></div>
              <div><p className="text-sm text-muted-foreground">Restricted+Critical</p><p className="text-xl font-bold">{classifications?.filter(c => ["restricted", "top-secret", "critical"].includes(c.classification_level)).length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15"><Lock className="h-5 w-5 text-emerald-500" /></div>
              <div><p className="text-sm text-muted-foreground">Encryption Required</p><p className="text-xl font-bold">{classifications?.filter(c => c.encryption_required).length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15"><Eye className="h-5 w-5 text-indigo-500" /></div>
              <div><p className="text-sm text-muted-foreground">With Masking Rules</p><p className="text-xl font-bold">{classifications?.filter(c => c.masking_rules && Object.keys(c.masking_rules).length > 0).length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : !classifications || classifications.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Database className="h-12 w-12" />
            <p className="text-lg font-medium">No data classifications defined</p>
            <p className="text-sm">Create classification rules to label data assets by sensitivity</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classifications.map((dc) => (
            <Card key={dc.id} className="glass-panel">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">{dc.resource_type}</CardTitle>
                    <CardDescription className="text-xs">{dc.resource_pattern ?? "No pattern"}</CardDescription>
                  </div>
                  <Badge className={cn("border", levelColors[dc.classification_level] || "bg-muted")} variant="outline">{dc.classification_level}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  <span>{dc.category ?? "Uncategorized"}</span>
                </div>
                {dc.owner && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{dc.owner}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className={cn("h-3 w-3", dc.encryption_required ? "text-emerald-500" : "text-muted-foreground")} />
                  <span>{dc.encryption_required ? "Encryption required" : "No encryption required"}</span>
                </div>
                {dc.retention_days && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Retention: {dc.retention_days} days</span>
                  </div>
                )}
                {dc.masking_rules && Object.keys(dc.masking_rules).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(dc.masking_rules).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-[10px]">{k}: {String(v)}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
