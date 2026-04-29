"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

type CustomerType = "SAN" | "CHUAN" | "PIZZA" | "PIZZA_COMBO" | "NUOC";
type CounterType =
  | "Quầy thanh toán 1 - Khu bánh/pizza"
  | "Quầy thanh toán 2 - Khu nước"
  | "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến";
type EntranceType = "Entrance 1" | "Entrance 2" | "Entrance 3" | "Không ghi nhận";
type RecordableEntrance = Exclude<EntranceType, "Không ghi nhận">;

type EventName =
  | "CAM_DO_AN"
  | "NV_DUA_THE_ORDER"
  | "LAY_NUOC"
  | "VAO_HANG_THANH_TOAN"
  | "VAO_HANG_ORDER_PIZZA"
  | "NV_BAT_DAU_PHUC_VU"
  | "NHAN_HANG_ROI_QUAY";

type FlowStep = {
  code: EventName;
  label: string;
  shortLabel: string;
  role: "SYSTEM_START" | "QUEUE_ARRIVAL" | "SERVICE_START" | "SERVICE_END";
};

type EventRow = {
  id: number;
  maKH: string;
  loaiKH: CustomerType;
  loaiLabel: string;
  quyTrinh: string;
  suKien: EventName;
  suKienLabel: string;
  thoiGian: string;
  nhanVien: string;
  quay: CounterType;
  cuaVao: EntranceType;
  ghiChu: string;
  nguoiBam: string;
};

type DbRow = {
  id: number;
  ma_kh: string;
  loai_kh: CustomerType;
  quy_trinh: string | null;
  su_kien: EventName;
  thoi_gian: string;
  nhan_vien: string;
  quay: CounterType;
  ghi_chu: string | null;
  nguoi_bam: string | null;
};

type SummaryRow = {
  stt: number;
  maKH: string;
  loaiKH: CustomerType;
  loaiLabel: string;
  cuaVao: EntranceType;
  quyTrinh: string;
  nhanVien: string;
  quay: CounterType;
  ghiChu: string;
  nguoiBam: string;
  processKey: string;
  createByEntrance: string;
  createByType: string;
  queueName: string;
  resourceName: string;
  expectedSteps: number;
  actualSteps: number;
  dataStatus: "OK" | "THIEU_BUOC" | "LOI_THOI_GIAN";
  errorNote: string;
  buoc1Label: string;
  buoc2Label: string;
  buoc3Label: string;
  buoc4Label: string;
  T_B1: string;
  T_B2: string;
  T_B3: string;
  T_B4: string;
  systemArrivalTime: string;
  queueArrivalTime: string;
  serviceStartTime: string;
  serviceEndTime: string;
  waitingTimeS: number | "";
  serviceTimeS: number | "";
  systemTimeS: number | "";
  systemInterarrivalByEntranceS: number | "";
  systemInterarrivalByTypeS: number | "";
  queueInterarrivalByCounterS: number | "";
  queueInterarrivalByProcessS: number | "";
};

type ActiveCustomerRow = {
  maKH: string;
  loaiKH: CustomerType;
  loaiLabel: string;
  cuaVao: EntranceType;
  quay: CounterType;
  nhanVien: string;
  ghiChu: string;
  nguoiBam: string;
  stepIndex: number;
  totalSteps: number;
  nextStep?: FlowStep;
  done: boolean;
  rows: EventRow[];
};

const CUSTOMER_TYPES: { code: CustomerType; label: string; hint: string }[] = [
  { code: "SAN", label: "Đồ ăn làm sẵn", hint: "Cầm món → xếp hàng → tính tiền → rời quầy" },
  { code: "CHUAN", label: "Món cần đầu bếp làm", hint: "Nhận phiếu → xếp hàng → tính tiền → rời quầy" },
  { code: "PIZZA", label: "Pizza", hint: "Vào hàng pizza → order/tính tiền → rời quầy" },
  { code: "PIZZA_COMBO", label: "Pizza + món khác", hint: "Cầm món khác → hàng pizza → xử lý đơn → rời quầy" },
  { code: "NUOC", label: "Nước", hint: "Lấy nước → xếp hàng → tính tiền → rời quầy" },
];

const ALL_COUNTERS: CounterType[] = [
  "Quầy thanh toán 1 - Khu bánh/pizza",
  "Quầy thanh toán 2 - Khu nước",
  "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
];

const ENTRANCES: RecordableEntrance[] = ["Entrance 1", "Entrance 2", "Entrance 3"];

const palette = {
  bg: "#f6f8fb",
  card: "#ffffff",
  card2: "#f9fafb",
  line: "#e5e7eb",
  text: "#111827",
  sub: "#6b7280",
  blue: "#2563eb",
  blueSoft: "#dbeafe",
  green: "#059669",
  greenSoft: "#dcfce7",
  amber: "#d97706",
  amberSoft: "#fffbeb",
  red: "#dc2626",
  redSoft: "#fef2f2",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function parseDateTime(value: string): Date | null {
  if (!value) return null;
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso;

  const m = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms = "0"] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(ms.padEnd(3, "0")));
}

function formatDateTimeVNms(value: string | Date) {
  const d = value instanceof Date ? value : parseDateTime(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
}

function diffSecondsPrecise(start: string, end: string): number | "" {
  const s = parseDateTime(start);
  const e = parseDateTime(end);
  if (!s || !e) return "";
  const diff = e.getTime() - s.getTime();
  if (diff < 0) return "";
  return Number((diff / 1000).toFixed(3));
}

function generateDeviceId() {
  return `DV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateCustomerCode(deviceId: string) {
  const now = new Date();
  const datePart = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const timePart = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}${pad3(now.getMilliseconds())}`;
  const devicePart = deviceId.replace("DV-", "").slice(-4);
  const randomPart = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `KH-${datePart}-${timePart}-${devicePart}-${randomPart}`;
}

function getLoaiKhachLabel(loai: CustomerType) {
  switch (loai) {
    case "SAN":
      return "ĐỒ ĂN LÀM SẴN";
    case "CHUAN":
      return "MÓN CẦN ĐẦU BẾP LÀM";
    case "PIZZA":
      return "PIZZA";
    case "PIZZA_COMBO":
      return "PIZZA KẾT HỢP MÓN KHÁC";
    case "NUOC":
      return "NƯỚC";
  }
}

function getFlow(loai: CustomerType): FlowStep[] {
  switch (loai) {
    case "SAN":
      return [
        { code: "CAM_DO_AN", label: "1. Khách cầm đồ ăn làm sẵn", shortLabel: "Cầm đồ ăn", role: "SYSTEM_START" },
        { code: "VAO_HANG_THANH_TOAN", label: "2. Khách vào hàng đợi thanh toán", shortLabel: "Vào hàng thanh toán", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu tính tiền", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách nhận hàng và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
    case "CHUAN":
      return [
        { code: "NV_DUA_THE_ORDER", label: "1. Nhân viên đưa phiếu/thẻ order", shortLabel: "Nhận phiếu order", role: "SYSTEM_START" },
        { code: "VAO_HANG_THANH_TOAN", label: "2. Khách vào hàng đợi thanh toán", shortLabel: "Vào hàng thanh toán", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu tính tiền", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách nhận món và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
    case "PIZZA":
      return [
        { code: "VAO_HANG_ORDER_PIZZA", label: "1. Khách vào hàng đợi order pizza", shortLabel: "Vào hàng pizza", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "2. Nhân viên bắt đầu nhận order/tính tiền", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "3. Khách nhận pizza và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
    case "PIZZA_COMBO":
      return [
        { code: "CAM_DO_AN", label: "1. Khách cầm món khác và qua quầy pizza", shortLabel: "Cầm món khác", role: "SYSTEM_START" },
        { code: "VAO_HANG_ORDER_PIZZA", label: "2. Khách vào hàng order pizza/thanh toán", shortLabel: "Vào hàng pizza", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu xử lý toàn bộ đơn", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách nhận đủ món và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
    case "NUOC":
      return [
        { code: "LAY_NUOC", label: "1. Khách lấy nước", shortLabel: "Lấy nước", role: "SYSTEM_START" },
        { code: "VAO_HANG_THANH_TOAN", label: "2. Khách vào hàng đợi thanh toán", shortLabel: "Vào hàng thanh toán", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu tính tiền", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách thanh toán xong và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
  }
}

function getValidCounters(loai: CustomerType): CounterType[] {
  switch (loai) {
    case "PIZZA":
    case "PIZZA_COMBO":
      return ["Quầy thanh toán 1 - Khu bánh/pizza"];
    case "SAN":
      return [
        "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
        "Quầy thanh toán 2 - Khu nước",
        "Quầy thanh toán 1 - Khu bánh/pizza",
      ];
    case "CHUAN":
      return ["Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến", "Quầy thanh toán 2 - Khu nước"];
    case "NUOC":
      return [
        "Quầy thanh toán 2 - Khu nước",
        "Quầy thanh toán 1 - Khu bánh/pizza",
        "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
      ];
  }
}

function getCounterCode(quay: CounterType) {
  switch (quay) {
    case "Quầy thanh toán 1 - Khu bánh/pizza":
      return "Q1";
    case "Quầy thanh toán 2 - Khu nước":
      return "Q2";
    case "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến":
      return "Q3";
  }
}

function getArenaQueue(quay: CounterType) {
  return `Q_ThanhToan_${getCounterCode(quay)}`;
}

function getArenaResource(quay: CounterType) {
  return `Cashier_${getCounterCode(quay)}`;
}

function getProcessKey(loai: CustomerType, quay: CounterType) {
  return `${loai}_${getCounterCode(quay)}`;
}

function getCreateByEntrance(cuaVao: EntranceType) {
  return cuaVao === "Không ghi nhận" ? "Create_Khong_Ghi_Nhan" : `Create_${cuaVao.replaceAll(" ", "_")}`;
}

function getCreateByType(loai: CustomerType) {
  return `Create_${loai}`;
}

function findStepByEvent(loai: CustomerType, eventName: EventName) {
  return getFlow(loai).find((x) => x.code === eventName);
}

function getEventLabel(loai: CustomerType, eventName: EventName) {
  return findStepByEvent(loai, eventName)?.shortLabel || eventName;
}

function parseEntrance(text: string | null | undefined): EntranceType {
  const raw = text || "";
  if (raw.includes("Entrance 1")) return "Entrance 1";
  if (raw.includes("Entrance 2")) return "Entrance 2";
  if (raw.includes("Entrance 3")) return "Entrance 3";
  return "Không ghi nhận";
}

function cleanNote(text: string | null | undefined) {
  const raw = text || "";
  return raw.replace(/Cửa vào:\s*Entrance [123]\s*\|\s*/i, "").trim();
}

function buildQuyTrinh(loai: CustomerType, quay: CounterType, cuaVao: RecordableEntrance) {
  return `${cuaVao} | ${getLoaiKhachLabel(loai)} | ${quay}`;
}

function buildGhiChu(note: string, cuaVao: RecordableEntrance) {
  const clean = note.trim();
  return clean ? `Cửa vào: ${cuaVao} | ${clean}` : `Cửa vào: ${cuaVao}`;
}

function mapDbRowToEventRow(row: DbRow): EventRow {
  const cuaVao = parseEntrance(row.quy_trinh || row.ghi_chu || "");
  const loaiLabel = getLoaiKhachLabel(row.loai_kh);
  return {
    id: row.id,
    maKH: row.ma_kh,
    loaiKH: row.loai_kh,
    loaiLabel,
    quyTrinh: row.quy_trinh || "",
    suKien: row.su_kien,
    suKienLabel: getEventLabel(row.loai_kh, row.su_kien),
    thoiGian: row.thoi_gian,
    nhanVien: row.nhan_vien,
    quay: row.quay,
    cuaVao,
    ghiChu: cleanNote(row.ghi_chu),
    nguoiBam: row.nguoi_bam || "",
  };
}

function sortEventsAsc(a: EventRow, b: EventRow) {
  const ta = parseDateTime(a.thoiGian)?.getTime() || 0;
  const tb = parseDateTime(b.thoiGian)?.getTime() || 0;
  if (ta !== tb) return ta - tb;
  return a.id - b.id;
}

function sortEventsDesc(a: EventRow, b: EventRow) {
  return sortEventsAsc(b, a);
}

function getCustomerTypeTheme(loai: CustomerType) {
  switch (loai) {
    case "SAN":
      return { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" };
    case "CHUAN":
      return { bg: "#fffbeb", border: "#fcd34d", text: "#b45309" };
    case "PIZZA":
      return { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c" };
    case "PIZZA_COMBO":
      return { bg: "#f5f3ff", border: "#c4b5fd", text: "#6d28d9" };
    case "NUOC":
      return { bg: "#f0fdf4", border: "#86efac", text: "#15803d" };
  }
}

function toNumberOrBlank(value: number | "") {
  return value === "" ? "" : Number(value.toFixed(3));
}

function addInterarrivalByGroup(
  rows: SummaryRow[],
  getGroup: (r: SummaryRow) => string,
  getTime: (r: SummaryRow) => string,
  field: keyof Pick<
    SummaryRow,
    "systemInterarrivalByEntranceS" | "systemInterarrivalByTypeS" | "queueInterarrivalByCounterS" | "queueInterarrivalByProcessS"
  >
) {
  const grouped = new Map<string, SummaryRow[]>();
  for (const row of rows) {
    const t = getTime(row);
    if (!t) continue;
    const group = getGroup(row);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(row);
  }

  grouped.forEach((items) => {
    items.sort((a, b) => {
      const ta = parseDateTime(getTime(a))?.getTime() || 0;
      const tb = parseDateTime(getTime(b))?.getTime() || 0;
      if (ta !== tb) return ta - tb;
      return a.maKH.localeCompare(b.maKH);
    });

    for (let i = 0; i < items.length; i++) {
      if (i === 0) {
        items[i][field] = "";
        continue;
      }
      const ia = diffSecondsPrecise(getTime(items[i - 1]), getTime(items[i]));
      items[i][field] = ia;
    }
  });
}

function makeLongIA(rows: SummaryRow[], valueField: keyof SummaryRow, groupField: keyof SummaryRow, label: string) {
  return rows
    .filter((row) => row.dataStatus === "OK")
    .map((row) => ({
      phanTich: label,
      nhomDuLieu: String(row[groupField]),
      maKH: row.maKH,
      loaiKH: row.loaiLabel,
      cuaVao: row.cuaVao,
      quay: row.quay,
      processKey: row.processKey,
      giaTriGiay: row[valueField] as number | "",
    }))
    .filter((row) => row.giaTriGiay !== "");
}

function makeWideIA(
  rows: SummaryRow[],
  getGroup: (r: SummaryRow) => string,
  getValue: (r: SummaryRow) => number | ""
) {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    if (row.dataStatus !== "OK") continue;
    const value = getValue(row);
    if (value === "") continue;
    const group = getGroup(row);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(value);
  }

  const keys = Array.from(grouped.keys()).sort();
  const maxLength = Math.max(0, ...keys.map((key) => grouped.get(key)!.length));
  const result: Record<string, number | "">[] = [];

  for (let i = 0; i < maxLength; i++) {
    const obj: Record<string, number | ""> = {};
    for (const key of keys) obj[key] = grouped.get(key)?.[i] ?? "";
    result.push(obj);
  }

  return result.length ? result : [{ ghiChu: "Chưa có đủ dữ liệu hợp lệ" } as unknown as Record<string, number | "">];
}

function autoFitColumns(ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  ws["!cols"] = keys.map((key) => {
    const max = Math.max(
      key.length,
      ...rows.map((row) => String(row[key] ?? "").length)
    );
    return { wch: Math.min(Math.max(max + 2, 12), 45) };
  });
}

function appendSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const safeRows = rows.length ? rows : [{ ghiChu: "Không có dữ liệu" }];
  const ws = XLSX.utils.json_to_sheet(safeRows);
  autoFitColumns(ws, safeRows);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

export default function Page() {
  const [currentMaKH, setCurrentMaKH] = useState("");
  const [loaiKH, setLoaiKH] = useState<CustomerType | "">("");
  const [cuaVao, setCuaVao] = useState<RecordableEntrance>("Entrance 1");
  const [quay, setQuay] = useState<CounterType>("Quầy thanh toán 2 - Khu nước");
  const [nhanVien, setNhanVien] = useState("NV1");
  const [tenNguoiBam, setTenNguoiBam] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [eventLog, setEventLog] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const currentFlow = loaiKH ? getFlow(loaiKH) : [];
  const validCounters = loaiKH ? getValidCounters(loaiKH) : ALL_COUNTERS;

  const currentCustomerEvents = useMemo(() => {
    return eventLog.filter((row) => row.maKH === currentMaKH).sort(sortEventsAsc);
  }, [eventLog, currentMaKH]);

  const nextStepIndex = currentCustomerEvents.length;
  const nextStep = currentFlow[nextStepIndex];
  const isCurrentDone = Boolean(loaiKH && currentFlow.length > 0 && nextStepIndex >= currentFlow.length);

  function upsertEventRow(newRow: EventRow) {
    setEventLog((prev) => {
      const idx = prev.findIndex((x) => x.id === newRow.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRow;
        return copy.sort(sortEventsDesc);
      }
      return [newRow, ...prev].sort(sortEventsDesc);
    });
  }

  async function loadEventLog() {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_log")
      .select("*")
      .order("thoi_gian", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      alert(`Không tải được dữ liệu: ${error.message}`);
      setLoading(false);
      return;
    }

    setEventLog(((data || []) as DbRow[]).map(mapDbRowToEventRow));
    setLoading(false);
  }

  useEffect(() => {
    const savedName = localStorage.getItem("emart_ten_nguoi_bam") || "";
    if (savedName) {
      setTenNguoiBam(savedName);
    } else {
      const input = window.prompt("Nhập tên người đang bấm giờ:", "") || "";
      if (input.trim()) {
        localStorage.setItem("emart_ten_nguoi_bam", input.trim());
        setTenNguoiBam(input.trim());
      }
    }

    const savedDevice = localStorage.getItem("emart_device_id");
    if (savedDevice) {
      setDeviceId(savedDevice);
    } else {
      const newDevice = generateDeviceId();
      localStorage.setItem("emart_device_id", newDevice);
      setDeviceId(newDevice);
    }

    if (!loadedRef.current) {
      loadedRef.current = true;
      loadEventLog();
    }

    const channel = supabase
      .channel("event-log-live-arena-input")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_log" }, (payload) => {
        upsertEventRow(mapDbRowToEventRow(payload.new as DbRow));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_log" }, (payload) => {
        const oldRow = payload.old as { id?: number };
        if (oldRow?.id) setEventLog((prev) => prev.filter((x) => x.id !== oldRow.id));
        else loadEventLog();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!loaiKH) return;
    const counters = getValidCounters(loaiKH);
    if (!counters.includes(quay)) setQuay(counters[0]);
  }, [loaiKH, quay]);

  function startNewCustomer(selectedType: CustomerType) {
    if (!deviceId) {
      alert("Thiết bị chưa sẵn sàng, vui lòng thử lại.");
      return;
    }

    const counters = getValidCounters(selectedType);
    const newCode = generateCustomerCode(deviceId);
    setCurrentMaKH(newCode);
    setLoaiKH(selectedType);
    setQuay(counters.includes(quay) ? quay : counters[0]);
    setGhiChu("");
  }

  function selectCustomerToContinue(maKH: string) {
    const rows = eventLog.filter((x) => x.maKH === maKH).sort(sortEventsAsc);
    if (!rows.length) return;
    const lastRow = rows[rows.length - 1];
    setCurrentMaKH(maKH);
    setLoaiKH(lastRow.loaiKH);
    setCuaVao(lastRow.cuaVao === "Không ghi nhận" ? "Entrance 1" : lastRow.cuaVao);
    setQuay(lastRow.quay);
    setNhanVien(lastRow.nhanVien || "NV1");
    setGhiChu(lastRow.ghiChu || "");
  }

  async function addNextEvent() {
    if (!currentMaKH || !loaiKH) {
      alert("Bạn phải chọn loại khách trước.");
      return;
    }
    if (!nextStep) {
      alert("Khách này đã đủ bước, không cần bấm thêm.");
      return;
    }
    if (!tenNguoiBam.trim()) {
      alert("Bạn chưa nhập tên người bấm.");
      return;
    }
    if (!validCounters.includes(quay)) {
      alert("Quầy đang chọn không phù hợp với loại khách này.");
      return;
    }

    const now = new Date();
    const quyTrinh = buildQuyTrinh(loaiKH, quay, cuaVao);
    const savedNote = buildGhiChu(ghiChu, cuaVao);

    const { data, error } = await supabase
      .from("event_log")
      .insert({
        ma_kh: currentMaKH,
        loai_kh: loaiKH,
        quy_trinh: quyTrinh,
        su_kien: nextStep.code,
        thoi_gian: now.toISOString(),
        nhan_vien: nhanVien.trim() || "NV1",
        quay,
        ghi_chu: savedNote,
        nguoi_bam: tenNguoiBam.trim(),
      })
      .select("*");

    if (error) {
      alert(`Lưu dữ liệu thất bại: ${error.message}`);
      return;
    }

    const inserted = data?.[0] as DbRow | undefined;
    if (inserted) upsertEventRow(mapDbRowToEventRow(inserted));
  }

  async function resetCurrentCustomer() {
    if (!currentMaKH) {
      alert("Chưa có khách hiện tại để reset.");
      return;
    }
    const ok = window.confirm(`Xóa toàn bộ log của khách ${currentMaKH}?`);
    if (!ok) return;

    const deletingMaKH = currentMaKH;
    const { error } = await supabase.from("event_log").delete().eq("ma_kh", deletingMaKH);
    if (error) {
      alert(`Xóa dữ liệu thất bại: ${error.message}`);
      return;
    }

    setEventLog((prev) => prev.filter((x) => x.maKH !== deletingMaKH));
    setCurrentMaKH("");
    setLoaiKH("");
    setGhiChu("");
  }

  async function clearAllData() {
    const ok = window.confirm("Bạn có chắc muốn xóa toàn bộ dữ liệu trong bảng event_log không?");
    if (!ok) return;
    const { error } = await supabase.from("event_log").delete().neq("id", 0);
    if (error) {
      alert(`Xóa toàn bộ dữ liệu thất bại: ${error.message}`);
      return;
    }
    setEventLog([]);
    setCurrentMaKH("");
    setLoaiKH("");
    setGhiChu("");
  }

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const grouped = new Map<string, EventRow[]>();
    const sortedEvents = [...eventLog].sort(sortEventsAsc);

    for (const row of sortedEvents) {
      if (!grouped.has(row.maKH)) grouped.set(row.maKH, []);
      grouped.get(row.maKH)!.push(row);
    }

    const result: SummaryRow[] = [];
    let stt = 1;

    grouped.forEach((rows, maKH) => {
      const ordered = rows.sort(sortEventsAsc);
      const firstRow = ordered[0];
      const lastRow = ordered[ordered.length - 1];
      const loai = lastRow.loaiKH;
      const flow = getFlow(loai);

      const findRow = (role: FlowStep["role"]) => {
        const step = flow.find((x) => x.role === role);
        if (!step) return undefined;
        return ordered.find((r) => r.suKien === step.code);
      };

      const findByIndex = (index: number) => {
        const step = flow[index];
        if (!step) return undefined;
        return ordered.find((r) => r.suKien === step.code);
      };

      const systemStart = findRow("SYSTEM_START") || findRow("QUEUE_ARRIVAL");
      const queueArrival = findRow("QUEUE_ARRIVAL") || systemStart;
      const serviceStart = findRow("SERVICE_START");
      const serviceEnd = findRow("SERVICE_END");

      const waitingTimeS = diffSecondsPrecise(queueArrival?.thoiGian || "", serviceStart?.thoiGian || "");
      const serviceTimeS = diffSecondsPrecise(serviceStart?.thoiGian || "", serviceEnd?.thoiGian || "");
      const systemTimeS = diffSecondsPrecise(systemStart?.thoiGian || "", serviceEnd?.thoiGian || "");

      const missingSteps = flow
        .filter((step) => !ordered.some((r) => r.suKien === step.code))
        .map((step) => step.shortLabel);

      const timeError =
        waitingTimeS === "" || serviceTimeS === "" || systemTimeS === "" || Number(serviceTimeS) <= 0;

      const dataStatus: SummaryRow["dataStatus"] = missingSteps.length
        ? "THIEU_BUOC"
        : timeError
          ? "LOI_THOI_GIAN"
          : "OK";

      const errorNote = missingSteps.length
        ? `Thiếu bước: ${missingSteps.join(", ")}`
        : timeError
          ? "Kiểm tra lại mốc thời gian: service/system time rỗng hoặc service time <= 0"
          : "Đủ dữ liệu";

      result.push({
        stt: stt++,
        maKH,
        loaiKH: loai,
        loaiLabel: getLoaiKhachLabel(loai),
        cuaVao: firstRow.cuaVao,
        quyTrinh: lastRow.quyTrinh,
        nhanVien: lastRow.nhanVien,
        quay: lastRow.quay,
        ghiChu: lastRow.ghiChu,
        nguoiBam: lastRow.nguoiBam,
        processKey: getProcessKey(loai, lastRow.quay),
        createByEntrance: getCreateByEntrance(firstRow.cuaVao),
        createByType: getCreateByType(loai),
        queueName: getArenaQueue(lastRow.quay),
        resourceName: getArenaResource(lastRow.quay),
        expectedSteps: flow.length,
        actualSteps: ordered.length,
        dataStatus,
        errorNote,
        buoc1Label: flow[0]?.label || "",
        buoc2Label: flow[1]?.label || "",
        buoc3Label: flow[2]?.label || "",
        buoc4Label: flow[3]?.label || "",
        T_B1: formatDateTimeVNms(findByIndex(0)?.thoiGian || ""),
        T_B2: formatDateTimeVNms(findByIndex(1)?.thoiGian || ""),
        T_B3: formatDateTimeVNms(findByIndex(2)?.thoiGian || ""),
        T_B4: formatDateTimeVNms(findByIndex(3)?.thoiGian || ""),
        systemArrivalTime: formatDateTimeVNms(systemStart?.thoiGian || ""),
        queueArrivalTime: formatDateTimeVNms(queueArrival?.thoiGian || ""),
        serviceStartTime: formatDateTimeVNms(serviceStart?.thoiGian || ""),
        serviceEndTime: formatDateTimeVNms(serviceEnd?.thoiGian || ""),
        waitingTimeS,
        serviceTimeS,
        systemTimeS,
        systemInterarrivalByEntranceS: "",
        systemInterarrivalByTypeS: "",
        queueInterarrivalByCounterS: "",
        queueInterarrivalByProcessS: "",
      });
    });

    addInterarrivalByGroup(result, (r) => r.createByEntrance, (r) => r.systemArrivalTime, "systemInterarrivalByEntranceS");
    addInterarrivalByGroup(result, (r) => r.createByType, (r) => r.systemArrivalTime, "systemInterarrivalByTypeS");
    addInterarrivalByGroup(result, (r) => r.queueName, (r) => r.queueArrivalTime, "queueInterarrivalByCounterS");
    addInterarrivalByGroup(result, (r) => r.processKey, (r) => r.queueArrivalTime, "queueInterarrivalByProcessS");

    return result.sort((a, b) => {
      const ta = parseDateTime(a.systemArrivalTime)?.getTime() || 0;
      const tb = parseDateTime(b.systemArrivalTime)?.getTime() || 0;
      if (tb !== ta) return tb - ta;
      return a.maKH.localeCompare(b.maKH);
    });
  }, [eventLog]);

  const activeCustomers = useMemo<ActiveCustomerRow[]>(() => {
    const grouped = new Map<string, EventRow[]>();
    for (const row of eventLog) {
      if (!grouped.has(row.maKH)) grouped.set(row.maKH, []);
      grouped.get(row.maKH)!.push(row);
    }

    const result: ActiveCustomerRow[] = [];
    grouped.forEach((rows, maKH) => {
      const ordered = rows.sort(sortEventsAsc);
      const last = ordered[ordered.length - 1];
      const flow = getFlow(last.loaiKH);
      const stepIndex = ordered.length;
      result.push({
        maKH,
        loaiKH: last.loaiKH,
        loaiLabel: getLoaiKhachLabel(last.loaiKH),
        cuaVao: last.cuaVao,
        quay: last.quay,
        nhanVien: last.nhanVien,
        ghiChu: last.ghiChu,
        nguoiBam: last.nguoiBam,
        stepIndex,
        totalSteps: flow.length,
        nextStep: flow[stepIndex],
        done: stepIndex >= flow.length,
        rows: ordered,
      });
    });

    return result.sort((a, b) => Number(a.done) - Number(b.done) || b.maKH.localeCompare(a.maKH));
  }, [eventLog]);

  const okCount = summaryRows.filter((r) => r.dataStatus === "OK").length;
  const errorCount = summaryRows.length - okCount;

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const chronologicalEvents = [...eventLog].sort(sortEventsAsc);

    appendSheet(
      wb,
      "Event_Log",
      chronologicalEvents.map((r, i) => ({
        stt: i + 1,
        maKH: r.maKH,
        loaiKH: r.loaiKH,
        loaiLabel: r.loaiLabel,
        cuaVao: r.cuaVao,
        quay: r.quay,
        nhanVien: r.nhanVien,
        suKien: r.suKien,
        suKienLabel: r.suKienLabel,
        thoiGianISO: r.thoiGian,
        thoiGianVN_ms: formatDateTimeVNms(r.thoiGian),
        nguoiBam: r.nguoiBam,
        ghiChu: r.ghiChu,
        quyTrinh: r.quyTrinh,
      }))
    );

    appendSheet(
      wb,
      "Summary",
      summaryRows.map((r) => ({
        stt: r.stt,
        maKH: r.maKH,
        loaiKH: r.loaiKH,
        loaiLabel: r.loaiLabel,
        cuaVao: r.cuaVao,
        quay: r.quay,
        nhanVien: r.nhanVien,
        processKey: r.processKey,
        dataStatus: r.dataStatus,
        errorNote: r.errorNote,
        expectedSteps: r.expectedSteps,
        actualSteps: r.actualSteps,
        systemArrivalTime: r.systemArrivalTime,
        queueArrivalTime: r.queueArrivalTime,
        serviceStartTime: r.serviceStartTime,
        serviceEndTime: r.serviceEndTime,
        waitingTimeS: toNumberOrBlank(r.waitingTimeS),
        serviceTimeS: toNumberOrBlank(r.serviceTimeS),
        systemTimeS: toNumberOrBlank(r.systemTimeS),
        systemInterarrivalByEntranceS: toNumberOrBlank(r.systemInterarrivalByEntranceS),
        systemInterarrivalByTypeS: toNumberOrBlank(r.systemInterarrivalByTypeS),
        queueInterarrivalByCounterS: toNumberOrBlank(r.queueInterarrivalByCounterS),
        queueInterarrivalByProcessS: toNumberOrBlank(r.queueInterarrivalByProcessS),
        ghiChu: r.ghiChu,
      }))
    );

    appendSheet(
      wb,
      "Arena_Input_Table",
      summaryRows
        .filter((r) => r.dataStatus === "OK")
        .map((r, i) => ({
          stt: i + 1,
          maKH: r.maKH,
          entityType: r.loaiKH,
          entityLabel: r.loaiLabel,
          entrance: r.cuaVao,
          counter: getCounterCode(r.quay),
          processKey: r.processKey,
          arenaCreateByEntrance: r.createByEntrance,
          arenaCreateByType: r.createByType,
          arenaQueue: r.queueName,
          arenaResource: r.resourceName,
          systemInterarrivalByEntranceS: toNumberOrBlank(r.systemInterarrivalByEntranceS),
          systemInterarrivalByTypeS: toNumberOrBlank(r.systemInterarrivalByTypeS),
          queueInterarrivalByCounterS: toNumberOrBlank(r.queueInterarrivalByCounterS),
          queueInterarrivalByProcessS: toNumberOrBlank(r.queueInterarrivalByProcessS),
          waitingTimeS: toNumberOrBlank(r.waitingTimeS),
          serviceTimeS: toNumberOrBlank(r.serviceTimeS),
          systemTimeS: toNumberOrBlank(r.systemTimeS),
        }))
    );

    appendSheet(
      wb,
      "Data_Check",
      summaryRows.map((r) => ({
        maKH: r.maKH,
        dataStatus: r.dataStatus,
        errorNote: r.errorNote,
        expectedSteps: r.expectedSteps,
        actualSteps: r.actualSteps,
        loaiKH: r.loaiKH,
        cuaVao: r.cuaVao,
        quay: r.quay,
      }))
    );

    appendSheet(wb, "IA_Create_Entrance_Long", makeLongIA(summaryRows, "systemInterarrivalByEntranceS", "createByEntrance", "Interarrival theo Create/Entrance"));
    appendSheet(wb, "IA_Create_Type_Long", makeLongIA(summaryRows, "systemInterarrivalByTypeS", "createByType", "Interarrival theo loại khách"));
    appendSheet(wb, "IA_Queue_Counter_Long", makeLongIA(summaryRows, "queueInterarrivalByCounterS", "queueName", "Interarrival vào hàng theo quầy"));
    appendSheet(wb, "IA_Service_Long", makeLongIA(summaryRows, "serviceTimeS", "processKey", "Service time theo process"));

    appendSheet(
      wb,
      "IA_Create_Entrance_Wide",
      makeWideIA(summaryRows, (r) => r.createByEntrance, (r) => r.systemInterarrivalByEntranceS)
    );
    appendSheet(
      wb,
      "IA_Service_Process_Wide",
      makeWideIA(summaryRows, (r) => r.processKey, (r) => r.serviceTimeS)
    );

    const stamp = formatDateTimeVNms(new Date()).replaceAll("-", "").replaceAll(":", "").replaceAll(" ", "_").replaceAll(".", "");
    XLSX.writeFile(wb, `emart_arena_input_${stamp}.xlsx`);
  }

  return (
    <main style={{ minHeight: "100vh", background: palette.bg, color: palette.text, padding: 16 }}>
      <section style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>Bấm giờ Emart cho Arena Input Analyzer</h1>
              <p style={{ margin: "6px 0 0", color: palette.sub }}>
                Ghi nhận đúng mốc: đến hệ thống, vào hàng đợi, bắt đầu phục vụ, kết thúc phục vụ. Xuất Excel có sẵn sheet cho Input Analyzer.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={loadEventLog} style={secondaryButtonStyle}>{loading ? "Đang tải..." : "Tải lại"}</button>
              <button onClick={exportExcel} style={primaryButtonStyle}>Xuất Excel Input Analyzer</button>
              <button onClick={clearAllData} style={dangerButtonStyle}>Xóa toàn bộ</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 14 }}>
            <InfoBox label="Tổng khách" value={String(summaryRows.length)} />
            <InfoBox label="Đủ dữ liệu" value={String(okCount)} tone="green" />
            <InfoBox label="Cần kiểm tra" value={String(errorCount)} tone={errorCount ? "red" : "green"} />
            <InfoBox label="Thiết bị" value={deviceId || "Đang tạo..."} />
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(320px, 0.75fr)", gap: 16 }}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>1. Tạo khách mới</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {CUSTOMER_TYPES.map((item) => {
                const theme = getCustomerTypeTheme(item.code);
                return (
                  <button
                    key={item.code}
                    onClick={() => startNewCustomer(item.code)}
                    style={{
                      textAlign: "left",
                      border: `1px solid ${theme.border}`,
                      background: loaiKH === item.code ? theme.bg : palette.card,
                      borderRadius: 14,
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: theme.text }}>{item.label}</div>
                    <div style={{ color: palette.sub, fontSize: 12, marginTop: 4 }}>{item.hint}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ ...gridFormStyle, marginTop: 16 }}>
              <Field label="Người bấm">
                <input
                  value={tenNguoiBam}
                  onChange={(e) => {
                    setTenNguoiBam(e.target.value);
                    localStorage.setItem("emart_ten_nguoi_bam", e.target.value);
                  }}
                  style={inputStyle}
                  placeholder="VD: Cường"
                />
              </Field>

              <Field label="Cửa vào">
                <select value={cuaVao} onChange={(e) => setCuaVao(e.target.value as RecordableEntrance)} style={inputStyle}>
                  {ENTRANCES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>

              <Field label="Quầy/Resource">
                <select value={quay} onChange={(e) => setQuay(e.target.value as CounterType)} style={inputStyle}>
                  {validCounters.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>

              <Field label="Nhân viên/Resource name">
                <input value={nhanVien} onChange={(e) => setNhanVien(e.target.value)} style={inputStyle} placeholder="NV1" />
              </Field>
            </div>

            <Field label="Ghi chú quan sát" block>
              <textarea
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                placeholder="VD: khách mua combo, đổi quầy, thanh toán nhiều món..."
              />
            </Field>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>2. Bấm mốc thời gian</h2>
            {currentMaKH ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ background: palette.card2, border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12 }}>
                  <div style={{ color: palette.sub, fontSize: 12 }}>Khách hiện tại</div>
                  <div style={{ fontWeight: 900, wordBreak: "break-all" }}>{currentMaKH}</div>
                  <div style={{ marginTop: 4, color: palette.sub }}>{loaiKH ? getLoaiKhachLabel(loaiKH) : ""} • {cuaVao} • {getCounterCode(quay)}</div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  {currentFlow.map((step, idx) => {
                    const event = currentCustomerEvents.find((r) => r.suKien === step.code);
                    const active = idx === nextStepIndex;
                    return (
                      <div
                        key={step.code}
                        style={{
                          border: `1px solid ${event ? "#86efac" : active ? "#93c5fd" : palette.line}`,
                          background: event ? palette.greenSoft : active ? palette.blueSoft : palette.card2,
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{step.label}</div>
                        <div style={{ color: palette.sub, fontSize: 12 }}>{event ? formatDateTimeVNms(event.thoiGian) : active ? "Đang chờ bấm" : "Chưa đến bước"}</div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={addNextEvent}
                  disabled={isCurrentDone}
                  style={{ ...primaryButtonStyle, width: "100%", opacity: isCurrentDone ? 0.5 : 1 }}
                >
                  {isCurrentDone ? "Khách đã đủ bước" : `Bấm: ${nextStep?.shortLabel || "Bước tiếp theo"}`}
                </button>
                <button onClick={resetCurrentCustomer} style={{ ...dangerButtonStyle, width: "100%" }}>Reset khách hiện tại</button>
              </div>
            ) : (
              <p style={{ color: palette.sub, margin: 0 }}>Chọn loại khách ở bên trái để bắt đầu bấm giờ.</p>
            )}
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>3. Khách đang theo dõi</h2>
          {activeCustomers.length === 0 ? (
            <p style={{ color: palette.sub }}>Chưa có dữ liệu.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 }}>
              {activeCustomers.slice(0, 12).map((c) => {
                const theme = getCustomerTypeTheme(c.loaiKH);
                return (
                  <button
                    key={c.maKH}
                    onClick={() => selectCustomerToContinue(c.maKH)}
                    style={{
                      textAlign: "left",
                      border: `1px solid ${currentMaKH === c.maKH ? palette.blue : theme.border}`,
                      background: c.done ? palette.card2 : theme.bg,
                      borderRadius: 14,
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900, wordBreak: "break-all" }}>{c.maKH}</div>
                    <div style={{ color: theme.text, fontWeight: 700, fontSize: 13 }}>{c.loaiLabel}</div>
                    <div style={{ color: palette.sub, fontSize: 12 }}>{c.cuaVao} • {getCounterCode(c.quay)} • {c.stepIndex}/{c.totalSteps}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: c.done ? palette.green : palette.amber }}>
                      {c.done ? "Đã đủ bước" : `Cần bấm: ${c.nextStep?.shortLabel}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>4. Bảng kiểm tra nhanh trước khi đưa vào Input Analyzer</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: palette.card2 }}>
                  {[
                    "Mã KH",
                    "Loại",
                    "Cửa",
                    "Quầy",
                    "Trạng thái",
                    "IA Entrance (s)",
                    "IA Type (s)",
                    "Wait (s)",
                    "Service (s)",
                    "System (s)",
                  ].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.slice(0, 30).map((r) => (
                  <tr key={r.maKH}>
                    <td style={tdStyle}>{r.maKH}</td>
                    <td style={tdStyle}>{r.loaiKH}</td>
                    <td style={tdStyle}>{r.cuaVao}</td>
                    <td style={tdStyle}>{getCounterCode(r.quay)}</td>
                    <td style={{ ...tdStyle, color: r.dataStatus === "OK" ? palette.green : palette.red, fontWeight: 800 }} title={r.errorNote}>{r.dataStatus}</td>
                    <td style={tdStyle}>{toNumberOrBlank(r.systemInterarrivalByEntranceS)}</td>
                    <td style={tdStyle}>{toNumberOrBlank(r.systemInterarrivalByTypeS)}</td>
                    <td style={tdStyle}>{toNumberOrBlank(r.waitingTimeS)}</td>
                    <td style={tdStyle}>{toNumberOrBlank(r.serviceTimeS)}</td>
                    <td style={tdStyle}>{toNumberOrBlank(r.systemTimeS)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "10px 0 0", color: palette.sub, fontSize: 13 }}>
            Khi mở Excel, dùng các sheet bắt đầu bằng IA_. Với Input Analyzer, ưu tiên lấy cột số giây trong sheet Wide hoặc Long theo đúng Create/Process của mô hình Arena.
          </p>
        </section>
      </section>
    </main>
  );
}

function InfoBox({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? palette.green : tone === "red" ? palette.red : palette.blue;
  const bg = tone === "green" ? palette.greenSoft : tone === "red" ? palette.redSoft : palette.blueSoft;
  return (
    <div style={{ background: bg, border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12 }}>
      <div style={{ color: palette.sub, fontSize: 12 }}>{label}</div>
      <div style={{ color, fontSize: 20, fontWeight: 900, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function Field({ label, children, block }: { label: string; children: React.ReactNode; block?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 6, marginTop: block ? 12 : 0 }}>
      <span style={{ color: palette.sub, fontSize: 13, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

const cardStyle: React.CSSProperties = {
  background: palette.card,
  border: `1px solid ${palette.line}`,
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 18,
};

const gridFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${palette.line}`,
  borderRadius: 12,
  padding: "10px 12px",
  outline: "none",
  fontSize: 14,
  background: palette.card,
  color: palette.text,
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  background: palette.blue,
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: `1px solid ${palette.line}`,
  borderRadius: 12,
  padding: "10px 14px",
  background: palette.card,
  color: palette.text,
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  background: palette.red,
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  borderBottom: `1px solid ${palette.line}`,
  padding: 8,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  borderBottom: `1px solid ${palette.line}`,
  padding: 8,
  whiteSpace: "nowrap",
};
