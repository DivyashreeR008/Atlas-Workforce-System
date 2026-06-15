"use client";


import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { payrollApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToastStore } from "@/stores/toast-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Download, FileSpreadsheet, Plus, Globe, Calculator, TrendingUp,
  Shield, FileText, Landmark, Receipt, Heart, DollarSign,
  Award, Gem, BarChart3, AlertTriangle, BrainCircuit,
  Check, X, Search,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv";
import { downloadExcel } from "@/lib/excel";
import type {
  PayrollRecord, EnhancedPayrollRecord, CountryTaxConfig, TaxBracket,
  TaxSimulationResult, PayrollForecast, PayrollAudit, ExpenseReport,
  BenefitPlan, BenefitEnrollment, Bonus, EquityGrant, CompensationPlan,
  SalaryBenchmark, BenchmarkComparison, BankTransaction, PayrollComplianceReport,
  PayrollAnomaly, Payslip, PayrollDashboardSummary,
} from "@/types";

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary", PROCESSING: "warning", PROCESSED: "success",
  PENDING: "secondary", APPROVED: "success", REJECTED: "destructive",
  ACTIVE: "success", GRANTED: "success",
};

const severityVariant: Record<string, "secondary" | "warning" | "destructive"> = {
  low: "secondary", medium: "warning", high: "destructive", critical: "destructive",
};

// ============================================================
// Records Tab (original basic payroll)
// ============================================================
function RecordsTab() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.toast);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({ employeeId: "", period: "", baseSalary: "", allowances: "0", deductions: "0" });

  const { data: records, isLoading } = useQuery({
    queryKey: ["payroll"],
    queryFn: async () => { const { data } = await payrollApi.list(); return (Array.isArray(data) ? data : []) as PayrollRecord[]; },
  });

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault(); setRunning(true);
    try {
      await payrollApi.run({ employeeId: form.employeeId, period: form.period, baseSalary: parseFloat(form.baseSalary), allowances: parseFloat(form.allowances), deductions: parseFloat(form.deductions) });
      addToast({ title: "Payroll processed" }); setDialogOpen(false); setForm({ employeeId: "", period: "", baseSalary: "", allowances: "0", deductions: "0" });
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
    } catch { addToast({ title: "Failed to process payroll", variant: "destructive" }); } finally { setRunning(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h2 className="text-lg font-semibold">Payroll Runs</h2><p className="text-sm text-muted-foreground">Process and manage payroll</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> Run Payroll</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleRunPayroll}>
              <DialogHeader>
                <DialogTitle>Run Payroll</DialogTitle>
                <DialogDescription>Process payroll for an employee</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <div><Label>Employee ID</Label><Input required value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></div>
                <div><Label>Period</Label><Input placeholder="2026-05" required value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} /></div>
                <div><Label>Base Salary</Label><Input type="number" required value={form.baseSalary} onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2"><div><Label>Allowances</Label><Input type="number" value={form.allowances} onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))} /></div><div><Label>Deductions</Label><Input type="number" value={form.deductions} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} /></div></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={running}>{running ? "Processing..." : "Run Payroll"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardHeader><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-32 mt-1" /></CardHeader><CardContent><Skeleton className="h-8 w-28" /></CardContent></Card>
        )) : !records || records.length === 0 ? (
          <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">No payroll records found</CardContent></Card>
        ) : records.slice(-3).reverse().map((run) => (
          <Card key={run.id}>
            <CardHeader><div className="flex justify-between items-center"><CardTitle className="text-base">{run.period}</CardTitle><Badge variant={statusVariant[run.status] ?? "default"}>{run.status}</Badge></div><CardDescription>{run.employeeId}</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatCurrency(run.netSalary)}</p><span className="text-sm text-muted-foreground">Net salary</span></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><div className="flex justify-between items-center"><div><CardTitle className="text-base">Payroll History</CardTitle><CardDescription>{isLoading ? "Loading..." : `${records?.length ?? 0} records`}</CardDescription></div>
            {records && records.length > 0 && <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { downloadCSV("payroll_history", ["Employee", "Period", "Gross", "Tax", "Net", "Status"], records.map((r) => [r.employeeId, r.period, formatCurrency(r.baseSalary + r.allowances), formatCurrency(r.tax), formatCurrency(r.netSalary), r.status])); addToast({ title: "Payroll data exported" }); }}><Download className="h-4 w-4" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => { downloadExcel("payroll_history", ["Employee", "Period", "Gross", "Tax", "Net", "Status"], records.map((r) => [r.employeeId, r.period, formatCurrency(r.baseSalary + r.allowances), formatCurrency(r.tax), formatCurrency(r.netSalary), r.status])); addToast({ title: "Payroll data exported as Excel" }); }}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            </div>}
          </div></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead>Gross</TableHead><TableHead>Tax</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              )) : !records || records.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payroll history found</TableCell></TableRow>
              ) : [...records].reverse().map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{run.employeeId}</TableCell>
                  <TableCell>{run.period}</TableCell>
                  <TableCell>{formatCurrency(run.baseSalary + run.allowances)}</TableCell>
                  <TableCell>{formatCurrency(run.tax)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(run.netSalary)}</TableCell>
                  <TableCell><Badge variant={statusVariant[run.status] ?? "default"}>{run.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Multi-Country Payroll Tab
// ============================================================
function MultiCountryTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [showRun, setShowRun] = useState(false);
  const [form, setForm] = useState({ employeeId: "", period: "", baseSalary: "5000", allowances: "0", deductions: "0", country: "US", currency: "USD" });

  const { data: payrolls } = useQuery({
    queryKey: ["enterprise-payrolls"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.payrolls.list(); return (Array.isArray(data) ? data : []) as EnhancedPayrollRecord[]; },
  });

  const { data: countries } = useQuery({
    queryKey: ["tax-configs"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.tax.configs.list(); return (Array.isArray(data) ? data : []) as CountryTaxConfig[]; },
  });

  const handleRun = async () => {
    try {
      await payrollApi.enterprise.payrolls.run({ employeeId: form.employeeId, period: form.period, baseSalary: parseFloat(form.baseSalary), allowances: parseFloat(form.allowances), deductions: parseFloat(form.deductions), country: form.country, currency: form.currency });
      addToast({ title: "Multi-country payroll processed" }); setShowRun(false); void queryClient.invalidateQueries({ queryKey: ["enterprise-payrolls"] });
    } catch { addToast({ title: "Failed to process", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h2 className="text-lg font-semibold flex items-center gap-2"><Globe className="h-4 w-4" /> Multi-Country Payroll</h2><p className="text-sm text-muted-foreground">Process payroll with country-specific tax rules</p></div>
        <Button size="sm" onClick={() => setShowRun(!showRun)}><Plus className="h-4 w-4" /> Run Payroll</Button>
      </div>

      {showRun && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></div>
            <div><Label>Period</Label><Input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder="2026-05" /></div>
            <div><Label>Base Salary</Label><Input type="number" value={form.baseSalary} onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))} /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} /></div>
            <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} /></div>
            <div className="flex items-end"><Button onClick={handleRun} className="w-full"><Globe className="h-4 w-4" /> Process</Button></div>
          </div>
        </CardContent></Card>
      )}

      {/* Configs card */}
      {countries && countries.length > 0 && (
        <Card><CardHeader><CardTitle className="text-sm">Country Tax Configurations</CardTitle></CardHeader><CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {countries.map((c) => (
              <div key={c.id} className="p-2 bg-muted rounded text-sm">
                <span className="font-semibold">{c.country}</span> ({c.currency})<br />
                <span className="text-xs text-muted-foreground">SS: {(c.socialSecurityRate * 100).toFixed(1)}% | Medicare: {(c.medicareRate * 100).toFixed(1)}% | Year: {c.taxYear}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <Card><CardHeader><CardTitle className="text-sm">Payroll Records</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 font-medium">Country</th><th className="px-4 py-3 font-medium">Gross</th><th className="px-4 py-3 font-medium">Tax</th><th className="px-4 py-3 font-medium">SS/Med</th><th className="px-4 py-3 font-medium">Net</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
            <tbody>{(!payrolls || payrolls.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>No records</td></tr>) : payrolls.map((r) => (<tr key={r.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3">{r.employeeId}</td><td className="px-4 py-3">{r.period}</td><td className="px-4 py-3"><Badge variant="secondary">{r.country}</Badge></td><td className="px-4 py-3">{formatCurrency(r.grossSalary)}</td><td className="px-4 py-3">{formatCurrency(r.tax)}</td><td className="px-4 py-3">{formatCurrency(r.socialSecurity + r.medicare)}</td><td className="px-4 py-3 font-medium">{formatCurrency(r.netSalary)}</td><td className="px-4 py-3"><Badge variant={statusVariant[r.status] ?? "default"}>{r.status}</Badge></td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Tax Engine Tab
// ============================================================
function TaxEngineTab() {
  const addToast = useToastStore((s) => s.toast);
  const [country, setCountry] = useState("US");
  const [grossSalary, setGrossSalary] = useState("8000");
  const [simResult, setSimResult] = useState<TaxSimulationResult | null>(null);
  const [compareCountries, setCompareCountries] = useState("US,UK,DE");
  const [compareResults, setCompareResults] = useState<TaxSimulationResult[]>([]);

  const { data: brackets } = useQuery({
    queryKey: ["tax-brackets"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.tax.brackets.list(); return (Array.isArray(data) ? data : []) as TaxBracket[]; },
  });

  const handleSimulate = async () => {
    try { const { data } = await payrollApi.enterprise.tax.simulate(country, parseFloat(grossSalary)); setSimResult(data as TaxSimulationResult); }
    catch { addToast({ title: "Simulation failed", variant: "destructive" }); }
  };

  const handleCompare = async () => {
    try { const countries = compareCountries.split(",").map((c) => c.trim()); const { data } = await payrollApi.enterprise.tax.compare(countries, parseFloat(grossSalary)); setCompareResults(data as TaxSimulationResult[]); }
    catch { addToast({ title: "Comparison failed", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Calculator className="h-4 w-4" /> Tax Engine & Simulations</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Single Country Simulation</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2"><div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div><div><Label>Gross Salary</Label><Input type="number" value={grossSalary} onChange={(e) => setGrossSalary(e.target.value)} /></div></div>
          <Button onClick={handleSimulate} className="w-full"><Calculator className="h-4 w-4" /> Simulate Tax</Button>
          {simResult && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex justify-between"><span>Gross:</span><span className="font-medium">{formatCurrency(simResult.grossSalary)}</span></div>
              <div className="flex justify-between"><span>Tax:</span><span className="font-medium text-red-500">{formatCurrency(simResult.tax)}</span></div>
              <div className="flex justify-between"><span>Effective Rate:</span><span>{simResult.effectiveTaxRate.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span>SS + Medicare:</span><span>{formatCurrency(simResult.socialSecurity + simResult.medicare)}</span></div>
              <div className="flex justify-between border-t pt-1"><span>Net Salary:</span><span className="font-bold text-green-600">{formatCurrency(simResult.netSalary)}</span></div>
            </div>
          )}
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-sm">Multi-Country Comparison</CardTitle></CardHeader><CardContent className="space-y-3">
          <div><Label>Countries (comma-separated)</Label><Input value={compareCountries} onChange={(e) => setCompareCountries(e.target.value)} /></div>
          <Button onClick={handleCompare} variant="outline" className="w-full"><Globe className="h-4 w-4" /> Compare</Button>
          {compareResults.length > 0 && (
            <div className="space-y-2">
              {compareResults.map((r, i) => (
                <div key={i} className="p-2 bg-muted rounded text-sm flex justify-between"><span className="font-medium">{r.country}</span><span>Tax: {formatCurrency(r.tax)} | Net: <span className="font-bold">{formatCurrency(r.netSalary)}</span></span></div>
              ))}
            </div>
          )}
        </CardContent></Card>
      </div>

      {brackets && brackets.length > 0 && (
        <Card><CardHeader><CardTitle className="text-sm">Tax Brackets</CardTitle></CardHeader><CardContent>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50 text-left"><th className="px-3 py-2">Country</th><th className="px-3 py-2">Min</th><th className="px-3 py-2">Max</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2">Flat</th></tr></thead><tbody>{brackets.map((b) => (<tr key={b.id} className="border-b"><td className="px-3 py-2">{b.country}</td><td className="px-3 py-2">{formatCurrency(b.minIncome)}</td><td className="px-3 py-2">{b.maxIncome > 0 ? formatCurrency(b.maxIncome) : "∞"}</td><td className="px-3 py-2">{(b.rate * 100).toFixed(0)}%</td><td className="px-3 py-2">{b.flatAmount > 0 ? formatCurrency(b.flatAmount) : "-"}</td></tr>))}</tbody></table></div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ============================================================
// Forecasting Tab
// ============================================================
function ForecastingTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState("2026-Q3");

  const { data: forecasts } = useQuery({
    queryKey: ["forecasts"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.forecasts.list(); return (Array.isArray(data) ? data : []) as PayrollForecast[]; },
  });

  const handleGenerate = async () => {
    try { await payrollApi.enterprise.forecasts.generate(period); addToast({ title: "Forecast generated" }); void queryClient.invalidateQueries({ queryKey: ["forecasts"] }); }
    catch { addToast({ title: "Failed to generate forecast", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Payroll Forecasting</h2>
      <div className="flex gap-2 items-end"><div className="flex-1"><Label>Period</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} /></div><Button onClick={handleGenerate}><TrendingUp className="h-4 w-4" /> Generate Forecast</Button></div>

      <div className="grid gap-3 md:grid-cols-2">
        {(!forecasts || forecasts.length === 0) ? (
          <Card className="md:col-span-2"><CardContent className="p-6 text-center text-muted-foreground">No forecasts generated yet</CardContent></Card>
        ) : forecasts.map((f) => (
          <Card key={f.id}><CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><h3 className="font-semibold">{f.period}</h3><Badge>{f.status}</Badge></div>
            <div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-muted-foreground">Projected Gross:</span> {formatCurrency(f.projectedGrossPayroll)}</div><div><span className="text-muted-foreground">Projected Net:</span> {formatCurrency(f.projectedNetPayroll)}</div><div><span className="text-muted-foreground">Projected Tax:</span> {formatCurrency(f.projectedTax)}</div><div><span className="text-muted-foreground">Confidence:</span> {f.confidence.toFixed(0)}%</div></div>
            <p className="text-xs text-muted-foreground">{f.factors}</p>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Auditing Tab
// ============================================================
function AuditingTab() {
  const { data: audits } = useQuery({
    queryKey: ["payroll-audits"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.auditLogs(); return (Array.isArray(data) ? data : []) as PayrollAudit[]; },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Payroll Auditing</h2>
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Changed By</th><th className="px-4 py-3 font-medium">Payroll ID</th><th className="px-4 py-3 font-medium">Old Value</th><th className="px-4 py-3 font-medium">New Value</th><th className="px-4 py-3 font-medium">Timestamp</th></tr></thead>
            <tbody>{(!audits || audits.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No audit logs</td></tr>) : audits.map((a) => (<tr key={a.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3"><Badge variant="secondary">{a.action}</Badge></td><td className="px-4 py-3">{a.changedBy}</td><td className="px-4 py-3">{a.payrollId}</td><td className="px-4 py-3 text-xs max-w-[150px] truncate">{a.oldValue || "-"}</td><td className="px-4 py-3 text-xs max-w-[150px] truncate">{a.newValue || "-"}</td><td className="px-4 py-3 text-xs">{new Date(a.changedAt).toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Payslips Tab
// ============================================================
function PayslipsTab() {
  const addToast = useToastStore((s) => s.toast);
  const [empId, setEmpId] = useState("");

  const { data: payslips } = useQuery({
    queryKey: ["payslips"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.payslips.list(); return (Array.isArray(data) ? data : []) as Payslip[]; },
  });

  const filtered = empId ? payslips?.filter((p) => p.employeeId.toLowerCase().includes(empId.toLowerCase())) : payslips;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Payslips</h2>
      <Input placeholder="Filter by employee ID..." value={empId} onChange={(e) => setEmpId(e.target.value)} className="max-w-xs" />
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 font-medium">Payroll ID</th><th className="px-4 py-3 font-medium">Generated</th><th className="px-4 py-3 font-medium">Preview</th></tr></thead>
            <tbody>{(!filtered || filtered.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>No payslips found</td></tr>) : filtered.map((p) => (<tr key={p.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3">{p.employeeId}</td><td className="px-4 py-3">{p.period}</td><td className="px-4 py-3">#{p.payrollId}</td><td className="px-4 py-3 text-xs">{new Date(p.generatedAt).toLocaleString()}</td><td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => addToast({ title: "Payslip Preview", description: `Period: ${p.period}, Net: check details page` })}><FileText className="h-3 w-3" /> View</Button></td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Bank Integration Tab
// ============================================================
function BankTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ employeeId: "", payrollId: "", amount: "", accountNumber: "", routingNumber: "", bankName: "" });

  const { data: transactions } = useQuery({
    queryKey: ["bank-tx"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.bank.list(); return (Array.isArray(data) ? data : []) as BankTransaction[]; },
  });

  const handleCreate = async () => {
    try { await payrollApi.enterprise.bank.create({ employeeId: form.employeeId, payrollId: parseInt(form.payrollId), amount: parseFloat(form.amount), accountNumber: form.accountNumber, routingNumber: form.routingNumber, bankName: form.bankName }); addToast({ title: "Transaction created" }); setShowCreate(false); void queryClient.invalidateQueries({ queryKey: ["bank-tx"] }); }
    catch { addToast({ title: "Failed to create", variant: "destructive" }); }
  };

  const handleProcess = async (id: number) => {
    try { await payrollApi.enterprise.bank.process(id); addToast({ title: "Transaction processed" }); void queryClient.invalidateQueries({ queryKey: ["bank-tx"] }); }
    catch { addToast({ title: "Failed to process", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-lg font-semibold flex items-center gap-2"><Landmark className="h-4 w-4" /> Direct Bank Integration</h2><Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus className="h-4 w-4" /> New Transaction</Button></div>
      {showCreate && (
        <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></div><div><Label>Payroll ID</Label><Input value={form.payrollId} onChange={(e) => setForm((f) => ({ ...f, payrollId: e.target.value }))} /></div><div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
          <div><Label>Account #</Label><Input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} /></div><div><Label>Routing #</Label><Input value={form.routingNumber} onChange={(e) => setForm((f) => ({ ...f, routingNumber: e.target.value }))} /></div><div><Label>Bank Name</Label><Input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} /></div>
          <div className="col-span-full"><Button onClick={handleCreate} className="w-full"><Landmark className="h-4 w-4" /> Create Transaction</Button></div>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Account</th><th className="px-4 py-3 font-medium">Bank</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
            <tbody>{(!transactions || transactions.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No transactions</td></tr>) : transactions.map((t) => (<tr key={t.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3">{t.employeeId}</td><td className="px-4 py-3">{formatCurrency(t.amount)}</td><td className="px-4 py-3 text-xs font-mono">...{t.accountNumber.slice(-4)}</td><td className="px-4 py-3">{t.bankName || "-"}</td><td className="px-4 py-3"><Badge variant={statusVariant[t.status] ?? "default"}>{t.status}</Badge></td><td className="px-4 py-3">{t.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => handleProcess(t.id)}><Check className="h-3 w-3" /> Process</Button>}</td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Expenses Tab
// ============================================================
function ExpensesTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ employeeId: "", category: "travel", amount: "", description: "" });

  const { data: expenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.expenses.list(); return (Array.isArray(data) ? data : []) as ExpenseReport[]; },
  });

  const handleSubmit = async () => {
    try { await payrollApi.enterprise.expenses.submit({ employeeId: form.employeeId, category: form.category, amount: parseFloat(form.amount), description: form.description }); addToast({ title: "Expense submitted" }); setShow(false); void queryClient.invalidateQueries({ queryKey: ["expenses"] }); }
    catch { addToast({ title: "Failed to submit", variant: "destructive" }); }
  };

  const handleAction = async (id: number, action: "approve" | "reject") => {
    try { if (action === "approve") await payrollApi.enterprise.expenses.approve(id, "admin"); else await payrollApi.enterprise.expenses.reject(id, "Not reimbursable"); addToast({ title: `Expense ${action}d` }); void queryClient.invalidateQueries({ queryKey: ["expenses"] }); }
    catch { addToast({ title: `Failed to ${action}`, variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-lg font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Expense Reimbursements</h2><Button size="sm" onClick={() => setShow(!show)}><Plus className="h-4 w-4" /> Submit Expense</Button></div>
      {show && (
        <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></div>
          <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></div>
          <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
          <div className="flex items-end"><Button onClick={handleSubmit} className="w-full">Submit</Button></div>
          <div className="col-span-full"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
            <tbody>{(!expenses || expenses.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>No expenses</td></tr>) : expenses.map((e) => (<tr key={e.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3">{e.employeeId}</td><td className="px-4 py-3"><Badge variant="secondary">{e.category}</Badge></td><td className="px-4 py-3">{formatCurrency(e.amount)}</td><td className="px-4 py-3"><Badge variant={statusVariant[e.status] ?? "default"}>{e.status}</Badge></td><td className="px-4 py-3">{e.status === "PENDING" && <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => handleAction(e.id, "approve")}><Check className="h-3 w-3" /></Button><Button size="sm" variant="destructive" onClick={() => handleAction(e.id, "reject")}><X className="h-3 w-3" /></Button></div>}</td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Benefits Tab
// ============================================================
function BenefitsTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", type: "health", description: "", employerContribution: "", employeeContribution: "", maxBenefitAmount: "" });

  const { data: plans } = useQuery({
    queryKey: ["benefit-plans"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.benefits.plans.list(); return (Array.isArray(data) ? data : []) as BenefitPlan[]; },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["benefit-enrollments"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.benefits.enrollments.list(); return (Array.isArray(data) ? data : []) as BenefitEnrollment[]; },
  });

  const handleCreate = async () => {
    try { await payrollApi.enterprise.benefits.plans.create({ name: form.name, type: form.type, description: form.description, employerContribution: parseFloat(form.employerContribution), employeeContribution: parseFloat(form.employeeContribution), maxBenefitAmount: parseFloat(form.maxBenefitAmount) } as Partial<BenefitPlan>); addToast({ title: "Plan created" }); setShow(false); void queryClient.invalidateQueries({ queryKey: ["benefit-plans"] }); }
    catch { addToast({ title: "Failed to create plan", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-lg font-semibold flex items-center gap-2"><Heart className="h-4 w-4" /> Benefits Administration</h2><Button size="sm" onClick={() => setShow(!show)}><Plus className="h-4 w-4" /> New Plan</Button></div>
      {show && (
        <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Health Plan" /></div>
          <div><Label>Type</Label><Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} /></div>
          <div><Label>Employer Contribution</Label><Input type="number" value={form.employerContribution} onChange={(e) => setForm((f) => ({ ...f, employerContribution: e.target.value }))} /></div>
          <div><Label>Employee Contribution</Label><Input type="number" value={form.employeeContribution} onChange={(e) => setForm((f) => ({ ...f, employeeContribution: e.target.value }))} /></div>
          <div><Label>Max Amount</Label><Input type="number" value={form.maxBenefitAmount} onChange={(e) => setForm((f) => ({ ...f, maxBenefitAmount: e.target.value }))} /></div>
          <div className="flex items-end"><Button onClick={handleCreate} className="w-full">Create Plan</Button></div>
          <div className="col-span-full"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Benefit Plans ({plans?.length || 0})</CardTitle></CardHeader><CardContent><div className="space-y-2">{(!plans || plans.length === 0) ? <p className="text-sm text-muted-foreground">No plans</p> : plans.map((p) => (<div key={p.id} className="p-2 bg-muted rounded text-sm"><div className="flex justify-between"><span className="font-medium">{p.name}</span><Badge variant="secondary">{p.type}</Badge></div><p className="text-xs text-muted-foreground">Employer: {formatCurrency(p.employerContribution)} | Employee: {formatCurrency(p.employeeContribution)}</p></div>))}</div></CardContent></Card>

        <Card><CardHeader><CardTitle className="text-sm">Enrollments ({enrollments?.length || 0})</CardTitle></CardHeader><CardContent><div className="space-y-2">{(!enrollments || enrollments.length === 0) ? <p className="text-sm text-muted-foreground">No enrollments</p> : enrollments.map((e) => (<div key={e.id} className="p-2 bg-muted rounded text-sm"><span className="font-medium">{e.employeeId}</span> → Plan #{e.planId} <Badge variant={statusVariant[e.status] ?? "default"}>{e.status}</Badge></div>))}</div></CardContent></Card>
      </div>
    </div>
  );
}

// ============================================================
// Compensation Tab
// ============================================================
function CompensationTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ employeeId: "", currentSalary: "", proposedSalary: "", reason: "", reviewCycle: "annual" });

  const { data: plans } = useQuery({
    queryKey: ["compensation"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.compensation.list(); return (Array.isArray(data) ? data : []) as CompensationPlan[]; },
  });

  const handleCreate = async () => {
    try { await payrollApi.enterprise.compensation.create({ employeeId: form.employeeId, currentSalary: parseFloat(form.currentSalary), proposedSalary: parseFloat(form.proposedSalary), reason: form.reason, reviewCycle: form.reviewCycle }); addToast({ title: "Compensation plan created" }); setShow(false); void queryClient.invalidateQueries({ queryKey: ["compensation"] }); }
    catch { addToast({ title: "Failed to create", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Compensation Planning</h2><Button size="sm" onClick={() => setShow(!show)}><Plus className="h-4 w-4" /> New Plan</Button></div>
      {show && (
        <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></div>
          <div><Label>Current Salary</Label><Input type="number" value={form.currentSalary} onChange={(e) => setForm((f) => ({ ...f, currentSalary: e.target.value }))} /></div>
          <div><Label>Proposed Salary</Label><Input type="number" value={form.proposedSalary} onChange={(e) => setForm((f) => ({ ...f, proposedSalary: e.target.value }))} /></div>
          <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
          <div><Label>Review Cycle</Label><Input value={form.reviewCycle} onChange={(e) => setForm((f) => ({ ...f, reviewCycle: e.target.value }))} /></div>
          <div className="flex items-end"><Button onClick={handleCreate} className="w-full">Create</Button></div>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Current</th><th className="px-4 py-3 font-medium">Proposed</th><th className="px-4 py-3 font-medium">Change</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
            <tbody>{(!plans || plans.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No compensation plans</td></tr>) : plans.map((p) => {
              const change = p.currentBaseSalary > 0 ? ((p.proposedBaseSalary - p.currentBaseSalary) / p.currentBaseSalary * 100) : 0;
              return (<tr key={p.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3">{p.employeeId}</td><td className="px-4 py-3">{formatCurrency(p.currentBaseSalary)}</td><td className="px-4 py-3">{formatCurrency(p.proposedBaseSalary)}</td><td className="px-4 py-3"><span className={change >= 0 ? "text-green-600" : "text-red-600"}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</span></td><td className="px-4 py-3 text-xs max-w-[150px] truncate">{p.reason || "-"}</td><td className="px-4 py-3"><Badge variant={statusVariant[p.status] ?? "default"}>{p.status}</Badge></td></tr>);
            })}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Bonuses Tab
// ============================================================
function BonusesTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ employeeId: "", amount: "", type: "performance", reason: "" });

  const { data: bonuses } = useQuery({
    queryKey: ["bonuses"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.bonuses.list(); return (Array.isArray(data) ? data : []) as Bonus[]; },
  });

  const handleCreate = async () => {
    try { await payrollApi.enterprise.bonuses.create({ employeeId: form.employeeId, amount: parseFloat(form.amount), type: form.type, reason: form.reason }); addToast({ title: "Bonus created" }); setShow(false); void queryClient.invalidateQueries({ queryKey: ["bonuses"] }); }
    catch { addToast({ title: "Failed to create", variant: "destructive" }); }
  };

  const handleApprove = async (id: number) => {
    try { await payrollApi.enterprise.bonuses.approve(id, "admin"); addToast({ title: "Bonus approved" }); void queryClient.invalidateQueries({ queryKey: ["bonuses"] }); }
    catch { addToast({ title: "Failed to approve", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-lg font-semibold flex items-center gap-2"><Award className="h-4 w-4" /> Bonus Management</h2><Button size="sm" onClick={() => setShow(!show)}><Plus className="h-4 w-4" /> New Bonus</Button></div>
      {show && (
        <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></div>
          <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
          <div><Label>Type</Label><Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} /></div>
          <div className="flex items-end"><Button onClick={handleCreate} className="w-full">Create</Button></div>
          <div className="col-span-full"><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
            <tbody>{(!bonuses || bonuses.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No bonuses</td></tr>) : bonuses.map((b) => (<tr key={b.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3">{b.employeeId}</td><td className="px-4 py-3 font-medium">{formatCurrency(b.amount)}</td><td className="px-4 py-3"><Badge variant="secondary">{b.type}</Badge></td><td className="px-4 py-3 text-xs max-w-[150px] truncate">{b.reason || "-"}</td><td className="px-4 py-3"><Badge variant={statusVariant[b.status] ?? "default"}>{b.status}</Badge></td><td className="px-4 py-3">{b.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => handleApprove(b.id)}><Check className="h-3 w-3" /> Approve</Button>}</td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Equity Tab
// ============================================================
function EquityTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ employeeId: "", shares: "", strikePrice: "", fairMarketValue: "", equityType: "NSO", vestingSchedule: "4-year standard" });

  const { data: grants } = useQuery({
    queryKey: ["equity"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.equity.list(); return (Array.isArray(data) ? data : []) as EquityGrant[]; },
  });

  const handleCreate = async () => {
    try { await payrollApi.enterprise.equity.create({ employeeId: form.employeeId, shares: parseFloat(form.shares), strikePrice: parseFloat(form.strikePrice), fairMarketValue: parseFloat(form.fairMarketValue), equityType: form.equityType, vestingSchedule: form.vestingSchedule }); addToast({ title: "Equity grant created" }); setShow(false); void queryClient.invalidateQueries({ queryKey: ["equity"] }); }
    catch { addToast({ title: "Failed to create grant", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h2 className="text-lg font-semibold flex items-center gap-2"><Gem className="h-4 w-4" /> Equity Management</h2><Button size="sm" onClick={() => setShow(!show)}><Plus className="h-4 w-4" /> New Grant</Button></div>
      {show && (
        <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></div>
          <div><Label>Shares</Label><Input type="number" value={form.shares} onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))} /></div>
          <div><Label>Strike Price</Label><Input type="number" value={form.strikePrice} onChange={(e) => setForm((f) => ({ ...f, strikePrice: e.target.value }))} /></div>
          <div><Label>Fair Market Value</Label><Input type="number" value={form.fairMarketValue} onChange={(e) => setForm((f) => ({ ...f, fairMarketValue: e.target.value }))} /></div>
          <div><Label>Type</Label><Input value={form.equityType} onChange={(e) => setForm((f) => ({ ...f, equityType: e.target.value }))} /></div>
          <div className="flex items-end"><Button onClick={handleCreate} className="w-full">Create Grant</Button></div>
          <div className="col-span-full"><Label>Vesting Schedule</Label><Input value={form.vestingSchedule} onChange={(e) => setForm((f) => ({ ...f, vestingSchedule: e.target.value }))} /></div>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Shares</th><th className="px-4 py-3 font-medium">Strike</th><th className="px-4 py-3 font-medium">FMV</th><th className="px-4 py-3 font-medium">Value</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
            <tbody>{(!grants || grants.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>No equity grants</td></tr>) : grants.map((g) => (<tr key={g.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3">{g.employeeId}</td><td className="px-4 py-3"><Badge variant="secondary">{g.equityType}</Badge></td><td className="px-4 py-3">{g.shares.toLocaleString()}</td><td className="px-4 py-3">{formatCurrency(g.strikePrice)}</td><td className="px-4 py-3">{formatCurrency(g.fairMarketValue)}</td><td className="px-4 py-3 font-medium">{formatCurrency(g.shares * g.fairMarketValue)}</td><td className="px-4 py-3"><Badge variant={statusVariant[g.status] ?? "default"}>{g.status}</Badge></td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Benchmarks Tab
// ============================================================
function BenchmarksTab() {
  const addToast = useToastStore((s) => s.toast);
  const [role, setRole] = useState("Software Engineer"); const [experience, setExperience] = useState("mid");
  const [location, setLocation] = useState("San Francisco"); const [salary, setSalary] = useState("120000");
  const [comparison, setComparison] = useState<BenchmarkComparison | null>(null);

  const { data: benchmarks } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.benchmarks.list(); return (Array.isArray(data) ? data : []) as SalaryBenchmark[]; },
  });

  const handleCompare = async () => {
    try { const { data } = await payrollApi.enterprise.benchmarks.compare(role, parseFloat(salary), experience, location); setComparison(data as BenchmarkComparison); }
    catch { addToast({ title: "Comparison failed", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Salary Benchmarking</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Compare Salary</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2"><div><Label>Role</Label><Input value={role} onChange={(e) => setRole(e.target.value)} /></div><div><Label>Experience</Label><Input value={experience} onChange={(e) => setExperience(e.target.value)} /></div><div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div><div><Label>Your Salary</Label><Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} /></div></div>
          <Button onClick={handleCompare} className="w-full"><Search className="h-4 w-4" /> Compare</Button>
          {comparison && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex justify-between"><span>P25:</span><span className="font-medium">{formatCurrency(comparison.p25)}</span></div>
              <div className="flex justify-between"><span>P50 (Median):</span><span className="font-bold">{formatCurrency(comparison.p50)}</span></div>
              <div className="flex justify-between"><span>P75:</span><span>{formatCurrency(comparison.p75)}</span></div>
              <div className="flex justify-between border-t pt-1"><span>Your Salary:</span><span className="font-bold">{formatCurrency(comparison.currentSalary)}</span></div>
              <div className="flex justify-between"><span>Position:</span><Badge variant="secondary">{comparison.position}</Badge></div>
              <div className="flex justify-between"><span>vs Median:</span><span className={comparison.vsMedianPercent >= 0 ? "text-green-600" : "text-red-600"}>{comparison.vsMedianPercent >= 0 ? "+" : ""}{comparison.vsMedianPercent.toFixed(1)}%</span></div>
            </div>
          )}
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-sm">Benchmark Data ({benchmarks?.length || 0})</CardTitle></CardHeader><CardContent><div className="space-y-2 max-h-80 overflow-y-auto">{(!benchmarks || benchmarks.length === 0) ? <p className="text-sm text-muted-foreground">No benchmarks loaded</p> : benchmarks.map((b) => (<div key={b.id} className="p-2 bg-muted rounded text-sm"><div className="flex justify-between"><span className="font-medium">{b.role}</span><Badge variant="secondary">{b.experience}</Badge></div><p className="text-xs text-muted-foreground">P50: {formatCurrency(b.percentile50)} | {b.location} | {b.source}</p></div>))}</div></CardContent></Card>
      </div>
    </div>
  );
}

// ============================================================
// Compliance Tab
// ============================================================
function ComplianceTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState("TAX"); const [period, setPeriod] = useState("2026-05"); const [country, setCountry] = useState("US");

  const { data: reports } = useQuery({
    queryKey: ["payroll-compliance"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.compliance.list(); return (Array.isArray(data) ? data : []) as PayrollComplianceReport[]; },
  });

  const handleGenerate = async () => {
    try { await payrollApi.enterprise.compliance.generate(reportType, period, country); addToast({ title: "Report generated" }); void queryClient.invalidateQueries({ queryKey: ["payroll-compliance"] }); }
    catch { addToast({ title: "Failed to generate", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Payroll Compliance Reports</h2>
      <div className="flex gap-2 items-end flex-wrap"><div><Label>Report Type</Label><Input value={reportType} onChange={(e) => setReportType(e.target.value)} /></div><div><Label>Period</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} /></div><div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div><Button onClick={handleGenerate}><Plus className="h-4 w-4" /> Generate</Button></div>
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 font-medium">Country</th><th className="px-4 py-3 font-medium">Summary</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Generated</th></tr></thead>
            <tbody>{(!reports || reports.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No compliance reports</td></tr>) : reports.map((r) => (<tr key={r.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3"><Badge variant="secondary">{r.reportType}</Badge></td><td className="px-4 py-3">{r.period}</td><td className="px-4 py-3">{r.country}</td><td className="px-4 py-3 text-xs max-w-[200px] truncate">{r.summary}</td><td className="px-4 py-3"><Badge variant={statusVariant[r.status] ?? "default"}>{r.status}</Badge></td><td className="px-4 py-3 text-xs">{new Date(r.generatedAt).toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// Anomalies Tab
// ============================================================
function PayrollAnomaliesTab() {
  const addToast = useToastStore((s) => s.toast);
  const queryClient = useQueryClient();

  const { data: anomalies } = useQuery({
    queryKey: ["payroll-anomalies"],
    queryFn: async () => { const { data } = await payrollApi.enterprise.anomalies.list(); return (Array.isArray(data) ? data : []) as PayrollAnomaly[]; },
  });

  const handleResolve = async (id: number) => {
    try { await payrollApi.enterprise.anomalies.resolve(id); addToast({ title: "Anomaly resolved" }); void queryClient.invalidateQueries({ queryKey: ["payroll-anomalies"] }); }
    catch { addToast({ title: "Failed to resolve", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Payroll Anomaly Detection</h2>
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left"><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Severity</th><th className="px-4 py-3 font-medium">Description</th><th className="px-4 py-3 font-medium">Detected</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
            <tbody>{(!anomalies || anomalies.length === 0) ? (<tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>No anomalies detected</td></tr>) : anomalies.map((a) => (<tr key={a.id} className="border-b hover:bg-muted/30"><td className="px-4 py-3">{a.employeeId}</td><td className="px-4 py-3"><Badge variant="secondary">{a.anomalyType}</Badge></td><td className="px-4 py-3"><Badge variant={severityVariant[a.severity] ?? "default"}>{a.severity}</Badge></td><td className="px-4 py-3 text-xs max-w-[200px] truncate">{a.description}</td><td className="px-4 py-3 text-xs">{new Date(a.detectedAt).toLocaleString()}</td><td className="px-4 py-3">{a.isResolved ? <Badge variant="success">Resolved</Badge> : <Badge variant="warning">Open</Badge>}</td><td className="px-4 py-3">{!a.isResolved && <Button size="sm" variant="outline" onClick={() => handleResolve(a.id)}><Check className="h-3 w-3" /> Resolve</Button>}</td></tr>))}</tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="records" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="records">Payroll</TabsTrigger>
          <TabsTrigger value="multi-country"><Globe className="h-4 w-4" /> Multi-Country</TabsTrigger>
          <TabsTrigger value="tax"><Calculator className="h-4 w-4" /> Tax Engine</TabsTrigger>
          <TabsTrigger value="forecasting"><TrendingUp className="h-4 w-4" /> Forecasting</TabsTrigger>
          <TabsTrigger value="auditing"><Shield className="h-4 w-4" /> Auditing</TabsTrigger>
          <TabsTrigger value="payslips"><FileText className="h-4 w-4" /> Payslips</TabsTrigger>
          <TabsTrigger value="bank"><Landmark className="h-4 w-4" /> Bank</TabsTrigger>
          <TabsTrigger value="expenses"><Receipt className="h-4 w-4" /> Expenses</TabsTrigger>
          <TabsTrigger value="benefits"><Heart className="h-4 w-4" /> Benefits</TabsTrigger>
          <TabsTrigger value="compensation"><DollarSign className="h-4 w-4" /> Compensation</TabsTrigger>
          <TabsTrigger value="bonuses"><Award className="h-4 w-4" /> Bonuses</TabsTrigger>
          <TabsTrigger value="equity"><Gem className="h-4 w-4" /> Equity</TabsTrigger>
          <TabsTrigger value="benchmarks"><BarChart3 className="h-4 w-4" /> Benchmarks</TabsTrigger>
          <TabsTrigger value="compliance"><Shield className="h-4 w-4" /> Compliance</TabsTrigger>
          <TabsTrigger value="anomalies"><AlertTriangle className="h-4 w-4" /> Anomalies</TabsTrigger>
        </TabsList>

        <TabsContent value="records"><RecordsTab /></TabsContent>
        <TabsContent value="multi-country"><MultiCountryTab /></TabsContent>
        <TabsContent value="tax"><TaxEngineTab /></TabsContent>
        <TabsContent value="forecasting"><ForecastingTab /></TabsContent>
        <TabsContent value="auditing"><AuditingTab /></TabsContent>
        <TabsContent value="payslips"><PayslipsTab /></TabsContent>
        <TabsContent value="bank"><BankTab /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab /></TabsContent>
        <TabsContent value="benefits"><BenefitsTab /></TabsContent>
        <TabsContent value="compensation"><CompensationTab /></TabsContent>
        <TabsContent value="bonuses"><BonusesTab /></TabsContent>
        <TabsContent value="equity"><EquityTab /></TabsContent>
        <TabsContent value="benchmarks"><BenchmarksTab /></TabsContent>
        <TabsContent value="compliance"><ComplianceTab /></TabsContent>
        <TabsContent value="anomalies"><PayrollAnomaliesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
