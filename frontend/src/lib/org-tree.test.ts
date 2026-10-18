import { describe, it, expect } from "vitest";
import {
  type OrgNode,
  flattenVisible,
  findMatches,
  expandToMatches,
  firstMatchRow,
  allExpandable,
  buildParentMap,
  openReqsForNode,
  aggregateOpenReqs,
  highlightSegments,
  topManagers,
} from "./org-tree";

function node(partial: Partial<OrgNode> & { email: string; name: string }): OrgNode {
  return { direct_reports: 0, total_reports: 0, children: [], ...partial };
}

function org(): OrgNode {
  return node({
    email: "alice@acme.io",
    name: "Alice Root",
    department: "Executive",
    position: "CEO",
    direct_reports: 2,
    total_reports: 4,
    children: [
      node({
        email: "bob@acme.io",
        name: "Bob Lead",
        department: "Engineering",
        position: "Engineering Manager",
        manager_id: "alice@acme.io",
        direct_reports: 1,
        total_reports: 1,
        children: [
          node({
            email: "carol@acme.io",
            name: "Carol Staff",
            department: "Engineering",
            position: "Developer",
            manager_id: "bob@acme.io",
          }),
        ],
      }),
      node({
        email: "dave@acme.io",
        name: "Dave Lead",
        department: "Sales",
        position: "Sales Manager",
        manager_id: "alice@acme.io",
        direct_reports: 1,
        total_reports: 1,
        children: [
          node({
            email: "eve@acme.io",
            name: "Eve Staff",
            department: "Sales",
            position: "Account Executive",
            manager_id: "dave@acme.io",
          }),
        ],
      }),
    ],
  });
}

describe("flattenVisible", () => {
  it("shows only collapsed roots when nothing is expanded", () => {
    const rows = flattenVisible([org()], new Set());
    expect(rows.map((row) => row.node.email)).toEqual(["alice@acme.io"]);
    expect(rows[0].hasChildren).toBe(true);
    expect(rows[0].expanded).toBe(false);
  });

  it("walks pre-order and tracks depth for expanded nodes", () => {
    const rows = flattenVisible([org()], new Set(["alice@acme.io", "bob@acme.io"]));
    expect(rows.map((row) => `${row.node.email}:${row.depth}`)).toEqual([
      "alice@acme.io:0",
      "bob@acme.io:1",
      "carol@acme.io:2",
      "dave@acme.io:1",
    ]);
  });
});

describe("search", () => {
  it("matches name, email, department and position case-insensitively", () => {
    expect([...findMatches([org()], "CAROL")]).toEqual(["carol@acme.io"]);
    expect([...findMatches([org()], "engineering")].sort()).toEqual([
      "bob@acme.io",
      "carol@acme.io",
    ]);
    expect([...findMatches([org()], "@acme.io")].length).toBe(5);
    expect([...findMatches([org()], "  sales  ")].sort()).toEqual([
      "dave@acme.io",
      "eve@acme.io",
    ]);
    expect([...findMatches([org()], "")]).toEqual([]);
  });

  it("auto-expands every ancestor of a match so it is visible", () => {
    const matches = findMatches([org()], "carol");
    const expanded = expandToMatches([org()], new Set(), matches);
    expect([...expanded].sort()).toEqual(["alice@acme.io", "bob@acme.io"]);

    const rows = flattenVisible([org()], expanded);
    expect(firstMatchRow(rows, matches)).toBe(2);
    expect(rows[2].node.email).toBe("carol@acme.io");
  });

  it("keeps previously expanded branches when new matches arrive", () => {
    const expanded = expandToMatches([org()], new Set(["dave@acme.io"]), findMatches([org()], "carol"));
    expect([...expanded].sort()).toEqual(["alice@acme.io", "bob@acme.io", "dave@acme.io"]);
  });
});

describe("span-of-control and open reqs facets", () => {
  it("aggregates open requisitions by department, ignoring closed jobs", () => {
    const byDept = aggregateOpenReqs([
      { department: "Engineering", status: "PUBLISHED" },
      { department: "Engineering", status: "PUBLISHED" },
      { department: "Sales", status: "CLOSED" },
      { department: "Sales", status: "PUBLISHED" },
      { department: null, status: "PUBLISHED" },
    ]);
    expect(byDept.get("Engineering")).toBe(2);
    expect(byDept.get("Sales")).toBe(1);
    expect(byDept.size).toBe(2);
  });

  it("sums open reqs across the unique departments in a subtree", () => {
    const byDept = new Map([
      ["Engineering", 2],
      ["Sales", 1],
    ]);
    expect(openReqsForNode(org(), byDept)).toBe(3);
    const bob = org().children[0];
    expect(openReqsForNode(bob, byDept)).toBe(2);
  });

  it("ranks managers by total reports for the manager facet", () => {
    const facet = topManagers([org()]);
    expect(facet.map((row) => row.email)).toEqual([
      "alice@acme.io",
      "bob@acme.io",
      "dave@acme.io",
    ]);
    expect(facet[0].directReports).toBe(2);
    expect(facet[0].totalReports).toBe(4);
  });
});

describe("highlightSegments", () => {
  it("splits text into matched and unmatched segments", () => {
    expect(highlightSegments("Carol Staff", "car")).toEqual([
      { text: "Car", match: true },
      { text: "ol Staff", match: false },
    ]);
  });

  it("returns the whole text once when there is no query", () => {
    expect(highlightSegments("Carol", "")).toEqual([{ text: "Carol", match: false }]);
  });
});

describe("large trees", () => {
  it("handles a 1000+ node chain without recursion or dropping rows", () => {
    const root = node({ email: "chain-0@acme.io", name: "Chain 0" });
    let current = root;
    for (let i = 1; i < 1500; i++) {
      const child = node({ email: `chain-${i}@acme.io`, name: `Chain ${i}`, manager_id: `chain-${i - 1}@acme.io` });
      current.children.push(child);
      current = child;
    }

    const expandable = allExpandable([root]);
    expect(expandable.size).toBe(1499);

    const rows = flattenVisible([root], expandable);
    expect(rows.length).toBe(1500);
    expect(rows[1499].node.email).toBe("chain-1499@acme.io");
    expect(rows[1499].depth).toBe(1499);

    const matches = findMatches([root], "chain-1200@");
    expect(firstMatchRow(rows, matches)).toBe(1200);
  });

  it("buildParentMap guards against pathological repeated nodes", () => {
    const shared = node({ email: "dup@acme.io", name: "Dup" });
    const root = node({ email: "root@acme.io", name: "Root", children: [shared] });
    const parents = buildParentMap([root, node({ email: "root@acme.io", name: "Root again", children: [shared] })]);
    expect(parents.get("dup@acme.io")).toBe("root@acme.io");
  });
});
