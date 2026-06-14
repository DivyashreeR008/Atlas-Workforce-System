import ExcelJS from "exceljs";

export async function downloadExcel(
  filename: string,
  headers: string[],
  rows: string[][]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  worksheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.min(Math.max(h.length, ...rows.map((r) => String(r[headers.indexOf(h)] ?? "").length)) + 3, 50) }));

  worksheet.addRows(rows);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\s+/g, "_").toLowerCase()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
