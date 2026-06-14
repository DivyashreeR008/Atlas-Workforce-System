"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { UserPlus, ArrowUp, ArrowDown, GraduationCap, Award, LogOut } from "lucide-react";

interface Activity {
  id: string;
  type: "hire" | "promotion" | "departure" | "training" | "achievement" | "leave";
  actor: string;
  description: string;
  timestamp: string;
}

interface ActivityFeedProps {
  data?: Activity[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const iconMap = {
  hire: UserPlus,
  promotion: ArrowUp,
  departure: ArrowDown,
  training: GraduationCap,
  achievement: Award,
  leave: LogOut,
};

const colorMap = {
  hire: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  promotion: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  departure: "bg-red-500/10 text-red-600 dark:text-red-400",
  training: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  achievement: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  leave: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed({ data, loading, error, onRetry }: ActivityFeedProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          <CardDescription className="text-xs">Latest workforce events</CardDescription>
        </div>
        {data && data.length > 0 && (
          <Badge variant="secondary" className="text-xs">{data.length} events</Badge>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <ActivityFeedSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <p className="text-sm">Failed to load activity</p>
            {onRetry && (
              <button onClick={onRetry} className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                Retry
              </button>
            )}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item, i) => {
              const Icon = iconMap[item.type];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", colorMap[item.type])}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-tight">
                      <span className="font-medium">{item.actor}</span>{" "}
                      <span className="text-muted-foreground">{item.description}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.timestamp}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { cn } from "@/lib/utils";
