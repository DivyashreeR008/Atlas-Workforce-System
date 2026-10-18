"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { atsApi, employeeApi } from "@/lib/api";
import {
  type OrgNode,
  type OrgRow,
  type OrgTreeResponse,
  aggregateOpenReqs,
  allExpandable,
  expandToMatches,
  findMatches,
  firstMatchRow,
  flattenVisible,
  highlightSegments,
  openReqsForNode,
  topManagers,
} from "@/lib/org-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronRight,
  Printer,
  Search,
  Users,
} from "lucide-react";

// Fixed-height rows keep the virtual window cheap: only the visible slice is
// mounted, so a 1000+ node tree renders like a short list.
const ROW_HEIGHT = 44;
const VIEWPORT_HEIGHT = 520;
const OVERSCAN = 8;

function OrgRowView({
  row,
  query,
  openReqs,
  onToggle,
}: {
  row: OrgRow;
  query: string;
  openReqs: number;
  onToggle: (email: string) => void;
}) {
  const { node, depth, hasChildren, expanded } = row;
  return (
    <div
      className="flex h-full items-center gap-2 border-b px-2 text-sm hover:bg-muted/40"
      style={{ paddingLeft: 8 + depth * 18 }}
      data-testid={`org-row-${node.email}`}
      data-depth={depth}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          aria-expanded={expanded}
          onClick={() => onToggle(node.email)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"
          data-testid={`toggle-${node.email}`}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ) : (
        <span className="inline-block h-6 w-6 shrink-0" />
      )}

      <Link
        href={`/dashboard/employees/${encodeURIComponent(node.email)}`}
        className="truncate font-medium text-primary hover:underline"
        data-testid={`org-link-${node.email}`}
      >
        {highlightSegments(node.name, query).map((segment, index) =>
          segment.match ? (
            <mark key={index} className="rounded bg-yellow-200/70 px-0.5 text-foreground">
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          )
        )}
      </Link>

      {node.department && (
        <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
          {node.department}
        </Badge>
      )}
      {node.position && (
        <span className="hidden truncate text-xs text-muted-foreground lg:inline">
          {node.position}
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {openReqs > 0 && (
          <Badge variant="outline" data-testid={`open-reqs-${node.email}`}>
            {openReqs} open reqs
          </Badge>
        )}
        {node.total_reports > 0 && (
          <Badge
            variant="outline"
            title={`${node.total_reports} people report up through ${node.name}`}
            data-testid={`span-${node.email}`}
          >
            {node.direct_reports} direct / {node.total_reports} total
          </Badge>
        )}
      </div>
    </div>
  );
}

function VirtualOrgList({
  rows,
  query,
  byDepartment,
  onToggle,
  viewportRef,
}: {
  rows: OrgRow[];
  query: string;
  byDepartment: ReadonlyMap<string, number>;
  onToggle: (email: string) => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN);

  return (
    <div
      ref={viewportRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className="relative overflow-y-auto rounded-md border"
      style={{ height: VIEWPORT_HEIGHT }}
      data-testid="org-tree-viewport"
    >
      <div className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
        {rows.slice(start, end).map((row, index) => (
          <div
            key={row.node.email}
            className="absolute inset-x-0"
            style={{ top: (start + index) * ROW_HEIGHT, height: ROW_HEIGHT }}
          >
            <OrgRowView
              row={row}
              query={query}
              openReqs={openReqsForNode(row.node, byDepartment)}
              onToggle={onToggle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintNode({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <li style={{ marginLeft: depth * 16 }} className="py-0.5">
      <span className="font-medium">{node.name}</span>
      <span className="text-muted-foreground">
        {" "}
        - {node.position}
        {node.department ? ` (${node.department})` : ""}
      </span>
      {node.total_reports > 0 && (
        <span className="text-muted-foreground">
          {" "}
          - {node.direct_reports} direct / {node.total_reports} total reports
        </span>
      )}
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <PrintNode key={child.email} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgChartPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set<string>());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const didInitExpansion = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const treeQuery = useQuery({
    queryKey: ["org-hierarchy"],
    queryFn: async () => {
      const { data } = await employeeApi.hierarchy();
      return data as OrgTreeResponse;
    },
  });

  const reqsQuery = useQuery({
    queryKey: ["org-open-reqs"],
    queryFn: async () => {
      const { data } = await atsApi.getOpenReqs(100);
      const payload = data as
        | { items?: { department?: string | null; status?: string | null }[] }
        | { department?: string | null; status?: string | null }[];
      const items = Array.isArray(payload) ? payload : payload.items ?? [];
      return items;
    },
    retry: false,
  });

  const roots = treeQuery.data?.roots ?? [];

  useEffect(() => {
    if (!treeQuery.data || didInitExpansion.current) return;
    didInitExpansion.current = true;
    setExpanded(
      new Set(treeQuery.data.roots.filter((root) => root.children.length > 0).map((root) => root.email))
    );
  }, [treeQuery.data]);

  const rows = useMemo(() => flattenVisible(roots, expanded), [roots, expanded]);
  const matches = useMemo(() => findMatches(roots, debouncedQuery), [roots, debouncedQuery]);
  const byDepartment = useMemo(() => aggregateOpenReqs(reqsQuery.data ?? []), [reqsQuery.data]);
  const managers = useMemo(() => topManagers(roots), [roots]);

  useEffect(() => {
    if (!debouncedQuery || matches.size === 0) return;
    setExpanded((current) => expandToMatches(roots, current, matches));
  }, [debouncedQuery, matches, roots]);

  useEffect(() => {
    if (!debouncedQuery || matches.size === 0) return;
    const index = firstMatchRow(rows, matches);
    if (index < 0 || !viewportRef.current) return;
    viewportRef.current.scrollTop = Math.max(0, index * ROW_HEIGHT - VIEWPORT_HEIGHT / 2);
  }, [debouncedQuery, matches, rows]);

  const toggleRow = (email: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const departments = useMemo(
    () => [...byDepartment.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [byDepartment]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Chart</h1>
          <p className="text-muted-foreground">
            Reporting lines assembled server-side from the directory; you only see the
            people you are allowed to see.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExpanded(allExpandable(roots))} data-testid="expand-all">
            Expand all
          </Button>
          <Button variant="outline" onClick={() => setExpanded(new Set<string>())} data-testid="collapse-all">
            Collapse all
          </Button>
          <Button onClick={() => window.print()} data-testid="print-org">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {treeQuery.isLoading ? (
        <Card className="print:hidden">
          <CardContent className="space-y-3 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : treeQuery.isError ? (
        <Card className="border-destructive/50 print:hidden" data-testid="org-error">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium text-destructive">Failed to load the organization chart</p>
            <p className="text-sm text-muted-foreground">
              {treeQuery.error instanceof Error
                ? treeQuery.error.message
                : "Something went wrong. Please try again."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => treeQuery.refetch()}
              disabled={treeQuery.isFetching}
            >
              {treeQuery.isFetching ? "Retrying..." : "Retry"}
            </Button>
          </CardContent>
        </Card>
      ) : roots.length === 0 ? (
        <Card className="print:hidden" data-testid="org-empty">
          <CardContent className="py-10 text-center text-muted-foreground">
            {treeQuery.data?.scope === "none"
              ? "No employee record is linked to your account, so there is no reporting line to show."
              : "No employees are available in this tenant yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="print:hidden">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Reporting tree</CardTitle>
                  <CardDescription>
                    Showing {rows.length} of {treeQuery.data?.total_visible ?? rows.length} people
                    {matches.size > 0 ? ` - ${matches.size} match the search` : ""}
                  </CardDescription>
                </div>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search the org chart"
                    placeholder="Search name, email, team, title..."
                    className="pl-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    data-testid="org-search"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <VirtualOrgList
                rows={rows}
                query={debouncedQuery}
                byDepartment={byDepartment}
                onToggle={toggleRow}
                viewportRef={viewportRef}
              />
            </CardContent>
          </Card>

          <div className="space-y-4 print:hidden">
            <Card data-testid="org-facet">
              <CardHeader>
                <CardTitle className="text-base">Scope</CardTitle>
                <CardDescription>
                  {treeQuery.data?.scope === "tenant"
                    ? "You can see the whole tenant, so the full reporting forest is shown."
                    : "You can see your own reporting line: yourself and everyone below you."}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {treeQuery.data?.total_visible ?? 0} people visible
                {treeQuery.data?.viewer_email ? ` for ${treeQuery.data.viewer_email}` : ""}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Largest teams
                </CardTitle>
                <CardDescription>Span of control, largest first</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm" data-testid="org-teams">
                {managers.length === 0 ? (
                  <p className="text-muted-foreground">Nobody has direct reports yet.</p>
                ) : (
                  managers.map((manager) => (
                    <div key={manager.email} className="flex items-center justify-between gap-2">
                      <Link
                        href={`/dashboard/employees/${encodeURIComponent(manager.email)}`}
                        className="truncate text-primary hover:underline"
                      >
                        {manager.name}
                      </Link>
                      <span className="shrink-0 text-muted-foreground">
                        {manager.directReports} direct / {manager.totalReports} total
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Open reqs by team</CardTitle>
                <CardDescription>Published job requisitions, from ATS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm" data-testid="org-open-reqs">
                {reqsQuery.isError ? (
                  <p className="text-muted-foreground">
                    Requisition data is unavailable right now; the chart is unaffected.
                  </p>
                ) : departments.length === 0 ? (
                  <p className="text-muted-foreground">No published requisitions.</p>
                ) : (
                  departments.map(([department, count]) => (
                    <div key={department} className="flex items-center justify-between gap-2">
                      <span className="truncate">{department}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="hidden print:block" data-testid="org-print-view">
        <h2 className="mb-2 text-lg font-semibold">Organization chart</h2>
        {roots.length === 0 ? (
          <p className="text-sm">No reporting data to print.</p>
        ) : (
          <ul className="text-sm">
            {roots.map((root) => (
              <PrintNode key={root.email} node={root} depth={0} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
