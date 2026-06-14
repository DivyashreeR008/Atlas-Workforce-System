"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Clock, RefreshCw } from "lucide-react";

interface CheckIn {
  id: string;
  employeeName?: string;
  time: string;
  status: string;
}

interface LiveCheckinsProps {
  data?: CheckIn[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

function LiveCheckinsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function LiveCheckins({ data, loading, error, onRetry }: LiveCheckinsProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">Live Check-ins</CardTitle>
          <CardDescription className="text-xs">Today&apos;s attendance</CardDescription>
        </div>
        {!loading && !error && data && (
          <Badge variant="outline" className="text-xs gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <LiveCheckinsSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p className="text-sm">Unable to load check-in data</p>
            {onRetry && (
              <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p className="text-sm">No check-ins recorded today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/50"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                    {(c.employeeName ?? c.id).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{c.employeeName ?? c.id}</p>
                  <p className="text-[11px] text-muted-foreground">{c.time}</p>
                </div>
                <Badge
                  variant={
                    c.status === "PRESENT" || c.status === "present"
                      ? "success"
                      : c.status === "LATE" || c.status === "late"
                        ? "warning"
                        : c.status === "remote"
                          ? "secondary"
                          : "outline"
                  }
                  className="shrink-0 text-[10px] px-1.5 py-0 h-5"
                >
                  {c.status === "PRESENT" || c.status === "present" ? "In" :
                   c.status === "LATE" || c.status === "late" ? "Late" :
                   c.status === "remote" ? "Remote" :
                   c.status === "absent" ? "Out" : c.status}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
