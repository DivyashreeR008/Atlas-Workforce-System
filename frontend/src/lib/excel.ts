import * as XLSX from "xlsx";

export function downloadExcel(
  filename: string,
  headers: string[],
  rows: string[][]
): void {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[i] ?? "").length)
    );
    return { wch: Math.min(maxLen + 3, 50) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename.replace(/\s+/g, "_").toLowerCase()}.xlsx`);
}
