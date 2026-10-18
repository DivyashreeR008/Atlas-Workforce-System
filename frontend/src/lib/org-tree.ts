// Pure helpers for the org chart. The reporting tree itself is assembled and
// permission-scoped server-side (employee-service /employees/hierarchy); these
// functions only decide what the client renders: which rows are visible for a
// set of expanded nodes, which rows match a search, and how span-of-control /
// open-requisition facets are derived.

export interface OrgNode {
  email: string;
  name: string;
  department?: string;
  position?: string;
  manager_id?: string | null;
  direct_reports: number;
  total_reports: number;
  children: OrgNode[];
}

export interface OrgTreeResponse {
  scope: string;
  viewer_email?: string | null;
  total_visible: number;
  roots: OrgNode[];
}

export interface OrgRow {
  node: OrgNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export function flattenVisible(
  roots: OrgNode[],
  expanded: ReadonlySet<string>
): OrgRow[] {
  const rows: OrgRow[] = [];
  const stack: { node: OrgNode; depth: number }[] = [];
  for (let i = roots.length - 1; i >= 0; i--) {
    stack.push({ node: roots[i], depth: 0 });
  }

  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: OrgNode; depth: number };
    const hasChildren = node.children.length > 0;
    const isExpanded = hasChildren && expanded.has(node.email);
    rows.push({ node, depth, hasChildren, expanded: isExpanded });

    if (isExpanded) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], depth: depth + 1 });
      }
    }
  }
  return rows;
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesOrgNode(node: OrgNode, query: string): boolean {
  const needle = normalizeQuery(query);
  if (!needle) return false;
  return [node.name, node.email, node.department ?? "", node.position ?? ""].some(
    (value) => value.toLowerCase().includes(needle)
  );
}

export function findMatches(roots: OrgNode[], query: string): Set<string> {
  const matches = new Set<string>();
  if (!normalizeQuery(query)) return matches;

  const stack = [...roots];
  while (stack.length > 0) {
    const node = stack.pop() as OrgNode;
    if (matchesOrgNode(node, query)) matches.add(node.email);
    stack.push(...node.children);
  }
  return matches;
}

export function buildParentMap(roots: OrgNode[]): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  const stack: { node: OrgNode; parent: string | null }[] = roots.map((node) => ({
    node,
    parent: null,
  }));

  while (stack.length > 0) {
    const { node, parent } = stack.pop() as { node: OrgNode; parent: string | null };
    if (parents.has(node.email)) continue;
    parents.set(node.email, parent);
    for (const child of node.children) {
      stack.push({ node: child, parent: node.email });
    }
  }
  return parents;
}

export function expandToMatches(
  roots: OrgNode[],
  expanded: ReadonlySet<string>,
  matches: ReadonlySet<string>
): Set<string> {
  const next = new Set(expanded);
  if (matches.size === 0) return next;

  const parents = buildParentMap(roots);
  for (const email of matches) {
    let parent = parents.get(email) ?? null;
    while (parent && !next.has(parent)) {
      next.add(parent);
      parent = parents.get(parent) ?? null;
    }
  }
  return next;
}

export function firstMatchRow(
  rows: OrgRow[],
  matches: ReadonlySet<string>
): number {
  return rows.findIndex((row) => matches.has(row.node.email));
}

export function allExpandable(roots: OrgNode[]): Set<string> {
  const emails = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const node = stack.pop() as OrgNode;
    if (node.children.length > 0) emails.add(node.email);
    stack.push(...node.children);
  }
  return emails;
}

export function collectDepartments(node: OrgNode): Set<string> {
  const departments = new Set<string>();
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop() as OrgNode;
    if (current.department) departments.add(current.department);
    stack.push(...current.children);
  }
  return departments;
}

export function openReqsForNode(
  node: OrgNode,
  byDepartment: ReadonlyMap<string, number>
): number {
  let total = 0;
  for (const department of collectDepartments(node)) {
    total += byDepartment.get(department) ?? 0;
  }
  return total;
}

export function aggregateOpenReqs(
  jobs: ReadonlyArray<{ department?: string | null; status?: string | null }>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    if (job.status && job.status !== "PUBLISHED") continue;
    const department = (job.department ?? "").trim();
    if (!department) continue;
    counts.set(department, (counts.get(department) ?? 0) + 1);
  }
  return counts;
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

export function highlightSegments(
  text: string,
  query: string
): HighlightSegment[] {
  const needle = normalizeQuery(query);
  if (!needle) return [{ text, match: false }];

  const haystack = text.toLowerCase();
  const segments: HighlightSegment[] = [];
  let index = 0;
  while (index < text.length) {
    const found = haystack.indexOf(needle, index);
    if (found === -1) {
      segments.push({ text: text.slice(index), match: false });
      break;
    }
    if (found > index) {
      segments.push({ text: text.slice(index, found), match: false });
    }
    segments.push({ text: text.slice(found, found + needle.length), match: true });
    index = found + needle.length;
  }
  return segments;
}

export interface ManagerFacetRow {
  email: string;
  name: string;
  department?: string;
  directReports: number;
  totalReports: number;
}

export function topManagers(roots: OrgNode[], limit = 5): ManagerFacetRow[] {
  const managers: ManagerFacetRow[] = [];
  const stack = [...roots];
  while (stack.length > 0) {
    const node = stack.pop() as OrgNode;
    if (node.direct_reports > 0 || node.total_reports > 0) {
      managers.push({
        email: node.email,
        name: node.name,
        department: node.department,
        directReports: node.direct_reports,
        totalReports: node.total_reports,
      });
    }
    stack.push(...node.children);
  }
  return managers
    .sort((a, b) =>
      b.totalReports - a.totalReports || b.directReports - a.directReports || a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}
