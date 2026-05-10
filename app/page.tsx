"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

type CustomerType = "SAN" | "CHUAN" | "PIZZA" | "PIZZA_COMBO" | "NUOC";
type CounterType =
  | "Quầy thanh toán 1 - Khu bánh/pizza"
  | "Quầy thanh toán 2 - Khu nước"
  | "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến";
type EntranceType = "Entrance 1" | "Entrance 2" | "Entrance 3" | "Không ghi nhận";
type RecordableEntrance = Exclude<EntranceType, "Không ghi nhận">;

type DecisionName =
  | "Turn or not 1"
  | "Turn or not 2"
  | "Turn or not 3"
  | "Turn or not 4"
  | "Turn or not 5"
  | "Turn or not 6"
  | "Turn or not 7"
  | "continue or not 1"
  | "continue or not 2"
  | "continue or not 3"
  | "Can I pay now 1"
  | "Can I pay now 2"
  | "Can I pay now 3"
  | "Can I pay now 4"
  | "Can I pay now 5"
  | "Can I pay now 6"
  | "Chọn loại khách";

type ChosenCounter = "Q1" | "Q2" | "Q3" | "";
type ProcessEventType = "START" | "END";
type ProcessName =
  | "customer selects items"
  | "customer selects items 1"
  | "customer selects items 2"
  | "customer selects items 3"
  | "customer selects items 4"
  | "customer selects items 5"
  | "customer selects items 6"
  | "customer selects items 7"
  | "customer selects items 8"
  | "customer selects items 9"
  | "Payment_1"
  | "Payment_2"
  | "Payment_3";

type EventName =
  | "KHACH_VAO_KHU_AN_UONG"
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

type DecisionRow = {
  id: number;
  maKH: string;
  thoiGian: string;
  cuaVao: EntranceType;
  decisionName: DecisionName;
  optionSelected: string;
  loaiKH: CustomerType | "";
  q1Length: number | "";
  q2Length: number | "";
  q3Length: number | "";
  chosenCounter: ChosenCounter;
  ghiChu: string;
  nguoiBam: string;
};

type ProcessLogRow = {
  id: number;
  runId: string;
  maKH: string;
  thoiGian: string;
  processName: ProcessName;
  eventType: ProcessEventType;
  cuaVao: EntranceType;
  loaiKH: CustomerType | "";
  quay: CounterType | "";
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

type DecisionDbRow = {
  id: number;
  ma_kh: string | null;
  thoi_gian: string;
  cua_vao: EntranceType | null;
  decision_name: DecisionName;
  option_selected: string;
  loai_kh: CustomerType | null;
  q1_length: number | null;
  q2_length: number | null;
  q3_length: number | null;
  chosen_counter: ChosenCounter | null;
  ghi_chu: string | null;
  nguoi_bam: string | null;
};

type ProcessDbRow = {
  id: number;
  run_id: string;
  ma_kh: string | null;
  thoi_gian: string;
  process_name: ProcessName;
  event_type: ProcessEventType;
  cua_vao: EntranceType | null;
  loai_kh: CustomerType | null;
  quay: CounterType | null;
  ghi_chu: string | null;
  nguoi_bam: string | null;
};

type ProcessSummaryRow = {
  runId: string;
  maKH: string;
  processName: ProcessName;
  arenaModule: string;
  cuaVao: EntranceType;
  loaiKH: CustomerType | "";
  quay: CounterType | "";
  startTime: string;
  rawStartTime: string;
  endTime: string;
  rawEndTime: string;
  processDurationS: number | "";
  processInterarrivalS: number | "";
  status: "OK" | "DANG_CHAY" | "THIEU_START" | "LOI_THOI_GIAN";
  errorNote: string;
  ghiChu: string;
  nguoiBam: string;
};

type SummaryRow = {
  stt: number;
  maKH: string;
  loaiKH: CustomerType;
  loaiLabel: string;
  cuaVao: EntranceType;
  quay: CounterType;
  ghiChu: string;
  nguoiBam: string;
  processKey: string;
  createByEntrance: string;
  createByType: string;
  queueName: string;
  resourceName: string;
  dataStatus: "OK" | "THIEU_BUOC" | "LOI_THOI_GIAN";
  errorNote: string;
  T_KHACH_VAO: string;
  T_VAO_HANG: string;
  T_BAT_DAU_PHUC_VU: string;
  T_ROI_QUAY: string;
  selectProductTimeS: number | "";
  waitingTimeS: number | "";
  serviceTimeS: number | "";
  systemTimeS: number | "";
  systemInterarrivalByEntranceS: number | "";
  systemInterarrivalByTypeS: number | "";
  queueInterarrivalByCounterS: number | "";
  queueInterarrivalByProcessS: number | "";
};

const CUSTOMER_TYPES: { code: CustomerType; label: string; hint: string }[] = [
  { code: "SAN", label: "Đồ ăn làm sẵn", hint: "END lựa hàng → vào hàng thanh toán" },
  { code: "CHUAN", label: "Món cần đầu bếp làm", hint: "END lựa món → vào hàng thanh toán" },
  { code: "PIZZA", label: "Pizza", hint: "END lựa món → vào hàng pizza" },
  { code: "PIZZA_COMBO", label: "Pizza + món khác", hint: "END lựa món → vào hàng pizza" },
  { code: "NUOC", label: "Nước", hint: "END lựa hàng → vào hàng thanh toán" },
];

const ALL_COUNTERS: CounterType[] = [
  "Quầy thanh toán 1 - Khu bánh/pizza",
  "Quầy thanh toán 2 - Khu nước",
  "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
];

const ENTRANCES: RecordableEntrance[] = ["Entrance 1", "Entrance 2", "Entrance 3"];

const DECISION_NAMES: DecisionName[] = [
  "Turn or not 1",
  "Turn or not 2",
  "Turn or not 3",
  "Turn or not 4",
  "Turn or not 5",
  "Turn or not 6",
  "Turn or not 7",
  "continue or not 1",
  "continue or not 2",
  "continue or not 3",
  "Can I pay now 1",
  "Can I pay now 2",
  "Can I pay now 3",
  "Can I pay now 4",
  "Can I pay now 5",
  "Can I pay now 6",
  "Chọn loại khách",
];

const TURN_OPTIONS = ["Rẽ", "Không rẽ"];
const TURN_OR_NOT_1_OPTIONS = ["Rẽ", "Không rẽ", "Ra về Exit 1"];
const TURN_OR_NOT_2_OPTIONS = ["Rẽ", "Không rẽ", "Ra về Exit 3"];
const CONTINUE_OPTIONS = ["Continue", "Not continue"];
const CUSTOMER_DECISION_OPTIONS: CustomerType[] = ["NUOC", "SAN", "CHUAN", "PIZZA", "PIZZA_COMBO"];

const ARENA_PROCESS_NAMES: ProcessName[] = [
  "customer selects items",
  "customer selects items 1",
  "customer selects items 2",
  "customer selects items 3",
  "customer selects items 4",
  "customer selects items 5",
  "customer selects items 6",
  "customer selects items 7",
  "customer selects items 8",
  "customer selects items 9",
  "Payment_1",
  "Payment_2",
  "Payment_3",
];

const SELECT_PROCESS_NAMES = ARENA_PROCESS_NAMES.filter((name) => name.startsWith("customer selects items"));

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
function toNumberOrBlank(value: number | "") {
  return value === "" ? "" : Number(value.toFixed(3));
}
function generateDeviceId() {
  return `DV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}
function normalizeOperatorName(name: string) {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function getOperatorCode(name: string) {
  const normalized = normalizeOperatorName(name);
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  const base = (compact || "NV").padEnd(2, "X").slice(0, 2);
  let hash = 0;
  for (const char of normalized || "NV") {
    hash = (hash * 31 + char.charCodeAt(0)) % 1296;
  }
  const hashPart = hash.toString(36).toUpperCase().padStart(2, "0").slice(-2);
  return `${base}${hashPart}`;
}
function getNextCustomerNo(operatorName: string) {
  const normalized = normalizeOperatorName(operatorName) || "NO_NAME";
  const key = `emart_customer_seq_${getTodayKey()}_${normalized.replace(/[^A-Z0-9]/g, "_")}`;
  const current = Number(localStorage.getItem(key) || "0") + 1;
  localStorage.setItem(key, String(current));
  return current;
}
function generateCustomerCode(operatorName: string) {
  return `${getOperatorCode(operatorName)}${String(getNextCustomerNo(operatorName)).padStart(3, "0")}`;
}
function generateProcessRunId(processName: ProcessName) {
  const now = new Date();
  const stamp = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}${pad3(now.getMilliseconds())}`;
  const processShort = processName.replaceAll("customer selects items", "CSI").replaceAll("Payment_", "P").replaceAll(" ", "_");
  const randomPart = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `RUN-${processShort}-${stamp}-${randomPart}`;
}
function getLoaiKhachLabel(loai: CustomerType | "") {
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
    default:
      return "CHƯA PHÂN LOẠI";
  }
}
function getQueueEventForType(loai: CustomerType): EventName {
  return loai === "PIZZA" || loai === "PIZZA_COMBO" ? "VAO_HANG_ORDER_PIZZA" : "VAO_HANG_THANH_TOAN";
}
function getFlow(loai: CustomerType): FlowStep[] {
  const queueCode = getQueueEventForType(loai);
  return [
    {
      code: "KHACH_VAO_KHU_AN_UONG",
      label: "1. START Process: Khách vào khu ăn uống / bắt đầu lựa",
      shortLabel: "Khách vào khu ăn uống",
      role: "SYSTEM_START",
    },
    {
      code: queueCode,
      label: queueCode === "VAO_HANG_ORDER_PIZZA" ? "2. END Process: Khách vào hàng order pizza" : "2. END Process: Khách vào hàng thanh toán",
      shortLabel: queueCode === "VAO_HANG_ORDER_PIZZA" ? "Vào hàng pizza" : "Vào hàng thanh toán",
      role: "QUEUE_ARRIVAL",
    },
    {
      code: "NV_BAT_DAU_PHUC_VU",
      label: "3. Nhân viên bắt đầu phục vụ/tính tiền",
      shortLabel: "Bắt đầu phục vụ",
      role: "SERVICE_START",
    },
    {
      code: "NHAN_HANG_ROI_QUAY",
      label: "4. Khách nhận hàng và rời quầy",
      shortLabel: "Rời quầy",
      role: "SERVICE_END",
    },
  ];
}
function getValidCounters(loai: CustomerType): CounterType[] {
  switch (loai) {
    case "PIZZA":
    case "PIZZA_COMBO":
      return ["Quầy thanh toán 1 - Khu bánh/pizza"];
    case "SAN":
      return ["Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến", "Quầy thanh toán 2 - Khu nước", "Quầy thanh toán 1 - Khu bánh/pizza"];
    case "CHUAN":
      return ["Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến", "Quầy thanh toán 2 - Khu nước"];
    case "NUOC":
      return ["Quầy thanh toán 2 - Khu nước", "Quầy thanh toán 1 - Khu bánh/pizza", "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến"];
  }
}
function getCounterCode(quay: CounterType | ""): ChosenCounter {
  if (quay === "Quầy thanh toán 1 - Khu bánh/pizza") return "Q1";
  if (quay === "Quầy thanh toán 2 - Khu nước") return "Q2";
  if (quay === "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến") return "Q3";
  return "";
}
function getCounterFromCode(code: ChosenCounter): CounterType | "" {
  if (code === "Q1") return "Quầy thanh toán 1 - Khu bánh/pizza";
  if (code === "Q2") return "Quầy thanh toán 2 - Khu nước";
  if (code === "Q3") return "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến";
  return "";
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
function getEventLabel(loai: CustomerType, eventName: EventName) {
  return getFlow(loai).find((x) => x.code === eventName)?.shortLabel || eventName;
}
function parseEntrance(text: string | null | undefined): EntranceType {
  const raw = text || "";
  if (raw.includes("Entrance 1")) return "Entrance 1";
  if (raw.includes("Entrance 2")) return "Entrance 2";
  if (raw.includes("Entrance 3")) return "Entrance 3";
  return "Không ghi nhận";
}
function cleanNote(text: string | null | undefined) {
  return (text || "").replace(/Cửa vào:\s*Entrance [123]\s*\|\s*/i, "").trim();
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
  return {
    id: row.id,
    maKH: row.ma_kh,
    loaiKH: row.loai_kh,
    loaiLabel: getLoaiKhachLabel(row.loai_kh),
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
function mapDbRowToDecisionRow(row: DecisionDbRow): DecisionRow {
  return {
    id: row.id,
    maKH: row.ma_kh || "",
    thoiGian: row.thoi_gian,
    cuaVao: row.cua_vao || "Không ghi nhận",
    decisionName: row.decision_name,
    optionSelected: row.option_selected,
    loaiKH: row.loai_kh || "",
    q1Length: row.q1_length ?? "",
    q2Length: row.q2_length ?? "",
    q3Length: row.q3_length ?? "",
    chosenCounter: row.chosen_counter || "",
    ghiChu: cleanNote(row.ghi_chu),
    nguoiBam: row.nguoi_bam || "",
  };
}
function mapDbRowToProcessLogRow(row: ProcessDbRow): ProcessLogRow {
  return {
    id: row.id,
    runId: row.run_id,
    maKH: row.ma_kh || "",
    thoiGian: row.thoi_gian,
    processName: row.process_name,
    eventType: row.event_type,
    cuaVao: row.cua_vao || "Không ghi nhận",
    loaiKH: row.loai_kh || "",
    quay: row.quay || "",
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
function sortProcessLogAsc(a: ProcessLogRow, b: ProcessLogRow) {
  const ta = parseDateTime(a.thoiGian)?.getTime() || 0;
  const tb = parseDateTime(b.thoiGian)?.getTime() || 0;
  if (ta !== tb) return ta - tb;
  return a.id - b.id;
}
function sortProcessLogDesc(a: ProcessLogRow, b: ProcessLogRow) {
  return sortProcessLogAsc(b, a);
}
function getDecisionOptions(decisionName: DecisionName) {
  if (decisionName === "Turn or not 1") return TURN_OR_NOT_1_OPTIONS;
  if (decisionName === "Turn or not 2") return TURN_OR_NOT_2_OPTIONS;
  if (decisionName.startsWith("Turn or not")) return TURN_OPTIONS;
  if (decisionName.startsWith("continue or not")) return CONTINUE_OPTIONS;
  if (decisionName.startsWith("Can I pay now")) return ["Khách vào Q1", "Khách vào Q2", "Khách vào Q3"];
  return CUSTOMER_DECISION_OPTIONS;
}
function getDefaultDecisionOption(decisionName: DecisionName) {
  return getDecisionOptions(decisionName)[0] || "";
}
function getDecisionMode(decisionName: DecisionName) {
  if (decisionName === "Turn or not 1" || decisionName === "Turn or not 2") return "N-way by Chance";
  if (decisionName.startsWith("Turn or not") || decisionName.startsWith("continue or not")) return "2-way by Chance";
  if (decisionName.startsWith("Can I pay now")) return "Chọn quầy thực tế / By Chance";
  return "N-way by Chance";
}
function getChosenCounterFromOption(option: string): ChosenCounter {
  if (option.includes("Q1")) return "Q1";
  if (option.includes("Q2")) return "Q2";
  if (option.includes("Q3")) return "Q3";
  return "";
}

function buildProcessSummaryRows(processLog: ProcessLogRow[]): ProcessSummaryRow[] {
  const grouped = new Map<string, ProcessLogRow[]>();
  for (const row of [...processLog].sort(sortProcessLogAsc)) {
    if (!grouped.has(row.runId)) grouped.set(row.runId, []);
    grouped.get(row.runId)!.push(row);
  }

  const result: ProcessSummaryRow[] = [];
  grouped.forEach((rows, runId) => {
    const ordered = rows.sort(sortProcessLogAsc);
    const first = ordered[0];
    const start = ordered.find((r) => r.eventType === "START");
    const end = ordered.find((r) => r.eventType === "END" && (!start || (parseDateTime(r.thoiGian)?.getTime() || 0) >= (parseDateTime(start.thoiGian)?.getTime() || 0)));

    const duration = diffSecondsPrecise(start?.thoiGian || "", end?.thoiGian || "");
    const status: ProcessSummaryRow["status"] = !start ? "THIEU_START" : !end ? "DANG_CHAY" : duration === "" || Number(duration) <= 0 ? "LOI_THOI_GIAN" : "OK";

    result.push({
      runId,
      maKH: first.maKH,
      processName: first.processName,
      arenaModule: first.processName,
      cuaVao: first.cuaVao,
      loaiKH: first.loaiKH,
      quay: first.quay,
      startTime: formatDateTimeVNms(start?.thoiGian || ""),
      rawStartTime: start?.thoiGian || "",
      endTime: formatDateTimeVNms(end?.thoiGian || ""),
      rawEndTime: end?.thoiGian || "",
      processDurationS: duration,
      processInterarrivalS: "",
      status,
      errorNote: status === "OK" ? "Đủ dữ liệu" : status === "DANG_CHAY" ? "Đã START, chưa END" : "Kiểm tra START/END",
      ghiChu: first.ghiChu,
      nguoiBam: first.nguoiBam,
    });
  });

  const byProcess = new Map<string, ProcessSummaryRow[]>();
  for (const row of result) {
    if (!row.startTime || row.status !== "OK") continue;
    if (!byProcess.has(row.processName)) byProcess.set(row.processName, []);
    byProcess.get(row.processName)!.push(row);
  }

  byProcess.forEach((items) => {
    items.sort((a, b) => (parseDateTime(a.rawStartTime)?.getTime() || 0) - (parseDateTime(b.rawStartTime)?.getTime() || 0));
    for (let i = 1; i < items.length; i++) {
      items[i].processInterarrivalS = diffSecondsPrecise(items[i - 1].rawStartTime, items[i].rawStartTime);
    }
  });

  return result.sort((a, b) => (parseDateTime(b.rawStartTime)?.getTime() || 0) - (parseDateTime(a.rawStartTime)?.getTime() || 0));
}
function addInterarrivalByGroup(
  rows: SummaryRow[],
  getGroup: (r: SummaryRow) => string,
  getTime: (r: SummaryRow) => string,
  field: keyof Pick<SummaryRow, "systemInterarrivalByEntranceS" | "systemInterarrivalByTypeS" | "queueInterarrivalByCounterS" | "queueInterarrivalByProcessS">,
) {
  const grouped = new Map<string, SummaryRow[]>();
  for (const row of rows) {
    const time = getTime(row);
    if (!time) continue;
    const group = getGroup(row);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(row);
  }
  grouped.forEach((items) => {
    items.sort((a, b) => (parseDateTime(getTime(a))?.getTime() || 0) - (parseDateTime(getTime(b))?.getTime() || 0));
    for (let i = 1; i < items.length; i++) {
      items[i][field] = diffSecondsPrecise(getTime(items[i - 1]), getTime(items[i]));
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
function makeWideIA(rows: SummaryRow[], getGroup: (r: SummaryRow) => string, getValue: (r: SummaryRow) => number | "") {
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
  const maxLength = Math.max(0, ...keys.map((k) => grouped.get(k)!.length));
  const result: Record<string, number | "">[] = [];
  for (let i = 0; i < maxLength; i++) {
    const obj: Record<string, number | ""> = {};
    for (const key of keys) obj[key] = grouped.get(key)?.[i] ?? "";
    result.push(obj);
  }
  return result.length ? result : [{ ghiChu: "Chưa có đủ dữ liệu hợp lệ" } as unknown as Record<string, number | "">];
}
function makeProcessLongIA(rows: ProcessSummaryRow[]) {
  return rows
    .filter((r) => r.status === "OK" && r.processDurationS !== "")
    .map((r) => ({
      phanTich: "Delay/Process time theo từng Process module trong Arena",
      processName: r.processName,
      arenaModule: r.arenaModule,
      maKH: r.maKH,
      loaiKH: r.loaiKH,
      cuaVao: r.cuaVao,
      quay: r.quay,
      processDurationS: toNumberOrBlank(r.processDurationS),
    }));
}
function makeProcessWideIA(rows: ProcessSummaryRow[]) {
  const grouped = new Map<string, number[]>();
  for (const r of rows) {
    if (r.status !== "OK" || r.processDurationS === "") continue;
    if (!grouped.has(r.processName)) grouped.set(r.processName, []);
    grouped.get(r.processName)!.push(Number(r.processDurationS));
  }
  const keys = ARENA_PROCESS_NAMES.filter((k) => grouped.has(k));
  const maxLength = Math.max(0, ...keys.map((k) => grouped.get(k)!.length));
  const result: Record<string, number | "">[] = [];
  for (let i = 0; i < maxLength; i++) {
    const obj: Record<string, number | ""> = {};
    for (const key of keys) obj[key] = grouped.get(key)?.[i] ?? "";
    result.push(obj);
  }
  return result.length ? result : [{ ghiChu: "Chưa có dữ liệu process hợp lệ" } as unknown as Record<string, number | "">];
}
function summarizeDecisionPercent(decisionLog: DecisionRow[]) {
  const grouped = new Map<string, DecisionRow[]>();
  for (const row of decisionLog) {
    if (!grouped.has(row.decisionName)) grouped.set(row.decisionName, []);
    grouped.get(row.decisionName)!.push(row);
  }
  const result: Record<string, unknown>[] = [];
  grouped.forEach((rows, decisionName) => {
    const typed = decisionName as DecisionName;
    const total = rows.length;
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.optionSelected, (counts.get(r.optionSelected) || 0) + 1));
    getDecisionOptions(typed).forEach((option, index) => {
      const count = counts.get(option) || 0;
      result.push({
        decisionName,
        arenaMode: getDecisionMode(typed),
        branchOrder: index + 1,
        optionSelected: option,
        count,
        total,
        percent: total ? Number(((count / total) * 100).toFixed(2)) : 0,
      });
    });
  });
  return result.length ? result : [{ ghiChu: "Chưa có dữ liệu Decision_Log" }];
}
function autoFitColumns(ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  ws["!cols"] = keys.map((key) => ({
    wch: Math.min(Math.max(key.length + 2, ...rows.map((r) => String(r[key] ?? "").length + 2), 12), 45),
  }));
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
  const [decisionLog, setDecisionLog] = useState<DecisionRow[]>([]);
  const [processLog, setProcessLog] = useState<ProcessLogRow[]>([]);
  const [decisionTableReady, setDecisionTableReady] = useState(true);
  const [processTableReady, setProcessTableReady] = useState(true);
  const [selectedDecisionName, setSelectedDecisionName] = useState<DecisionName>("Turn or not 1");
  const [selectedDecisionOption, setSelectedDecisionOption] = useState("Rẽ");
  const [selectedProcessName, setSelectedProcessName] = useState<ProcessName>("customer selects items");
  const [activeProcessRunId, setActiveProcessRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const processSummaryRows = useMemo(() => buildProcessSummaryRows(processLog), [processLog]);
  const currentFlow = useMemo(() => (loaiKH ? getFlow(loaiKH) : []), [loaiKH]);
  const validCounters = useMemo(() => (loaiKH ? getValidCounters(loaiKH) : ALL_COUNTERS), [loaiKH]);

  const currentCustomerEvents = useMemo(() => eventLog.filter((r) => r.maKH === currentMaKH).sort(sortEventsAsc), [eventLog, currentMaKH]);
  const currentCustomerDecisions = useMemo(
    () => decisionLog.filter((r) => r.maKH === currentMaKH).sort((a, b) => (parseDateTime(b.thoiGian)?.getTime() || 0) - (parseDateTime(a.thoiGian)?.getTime() || 0)),
    [decisionLog, currentMaKH],
  );
  const currentCustomerProcesses = useMemo(() => processLog.filter((r) => r.maKH === currentMaKH).sort(sortProcessLogDesc), [processLog, currentMaKH]);
  const currentCustomerProcessSummaries = useMemo(() => processSummaryRows.filter((r) => r.maKH === currentMaKH), [processSummaryRows, currentMaKH]);
  const completedSelectProcess = useMemo(
    () => currentCustomerProcessSummaries.find((r) => SELECT_PROCESS_NAMES.includes(r.processName) && r.status === "OK"),
    [currentCustomerProcessSummaries],
  );
  const selectedProcessActiveRun = useMemo(
    () => currentCustomerProcesses.find((r) => r.processName === selectedProcessName && r.eventType === "START" && !currentCustomerProcesses.some((x) => x.runId === r.runId && x.eventType === "END")),
    [currentCustomerProcesses, selectedProcessName],
  );
  const currentExpectedEvents = useMemo(() => {
    if (!loaiKH) return [];
    const expected = new Set(currentFlow.map((s) => s.code));
    return currentCustomerEvents.filter((r) => expected.has(r.suKien));
  }, [currentCustomerEvents, currentFlow, loaiKH]);
  const nextStep = loaiKH ? currentFlow.find((step) => !currentExpectedEvents.some((r) => r.suKien === step.code)) : undefined;

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
  function upsertDecisionRow(newRow: DecisionRow) {
    setDecisionLog((prev) => {
      const idx = prev.findIndex((x) => x.id === newRow.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRow;
        return copy.sort((a, b) => (parseDateTime(b.thoiGian)?.getTime() || 0) - (parseDateTime(a.thoiGian)?.getTime() || 0));
      }
      return [newRow, ...prev].sort((a, b) => (parseDateTime(b.thoiGian)?.getTime() || 0) - (parseDateTime(a.thoiGian)?.getTime() || 0));
    });
  }
  function upsertProcessRow(newRow: ProcessLogRow) {
    setProcessLog((prev) => {
      const idx = prev.findIndex((x) => x.id === newRow.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRow;
        return copy.sort(sortProcessLogDesc);
      }
      return [newRow, ...prev].sort(sortProcessLogDesc);
    });
  }

  async function loadEventLog() {
    setLoading(true);
    const { data, error } = await supabase.from("event_log").select("*").order("thoi_gian", { ascending: false }).order("id", { ascending: false });
    if (error) {
      alert(`Không tải được event_log: ${error.message}`);
      setLoading(false);
      return;
    }
    setEventLog(((data || []) as DbRow[]).map(mapDbRowToEventRow));
    setLoading(false);
  }
  async function loadDecisionLog() {
    const { data, error } = await supabase.from("decision_log").select("*").order("thoi_gian", { ascending: false }).order("id", { ascending: false });
    if (error) {
      setDecisionTableReady(false);
      setDecisionLog([]);
      return;
    }
    setDecisionTableReady(true);
    setDecisionLog(((data || []) as DecisionDbRow[]).map(mapDbRowToDecisionRow));
  }
  async function loadProcessLog() {
    const { data, error } = await supabase.from("process_log").select("*").order("thoi_gian", { ascending: false }).order("id", { ascending: false });
    if (error) {
      setProcessTableReady(false);
      setProcessLog([]);
      return;
    }
    setProcessTableReady(true);
    setProcessLog(((data || []) as ProcessDbRow[]).map(mapDbRowToProcessLogRow));
  }
  function refreshAllData() {
    loadEventLog();
    loadDecisionLog();
    loadProcessLog();
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
      refreshAllData();
    }

    const channel = supabase
      .channel("emart-live-short-code")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_log" }, (payload) => upsertEventRow(mapDbRowToEventRow(payload.new as DbRow)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_log" }, (payload) => {
        const id = (payload.old as { id?: number })?.id;
        if (id) setEventLog((prev) => prev.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "decision_log" }, (payload) => upsertDecisionRow(mapDbRowToDecisionRow(payload.new as DecisionDbRow)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "decision_log" }, (payload) => {
        const id = (payload.old as { id?: number })?.id;
        if (id) setDecisionLog((prev) => prev.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "process_log" }, (payload) => upsertProcessRow(mapDbRowToProcessLogRow(payload.new as ProcessDbRow)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "process_log" }, (payload) => {
        const id = (payload.old as { id?: number })?.id;
        if (id) setProcessLog((prev) => prev.filter((x) => x.id !== id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setSelectedDecisionOption(getDefaultDecisionOption(selectedDecisionName));
  }, [selectedDecisionName]);

  useEffect(() => {
    if (!loaiKH) return;
    const counters = getValidCounters(loaiKH);
    if (!counters.includes(quay)) setQuay(counters[0]);
  }, [loaiKH, quay]);

  function createNewCustomer() {
    if (!tenNguoiBam.trim()) {
      alert("Bạn cần nhập tên người bấm trước khi tạo mã khách. Mỗi tên người bấm sẽ có dãy mã khách riêng.");
      return;
    }
    const code = generateCustomerCode(tenNguoiBam.trim());
    setCurrentMaKH(code);
    setLoaiKH("");
    setGhiChu("");
    setActiveProcessRunId("");
    setSelectedProcessName("customer selects items");
  }
  function requireCurrentCustomerCode() {
    if (currentMaKH) return currentMaKH;
    alert("Bạn cần bấm '+ Tạo khách mới' ở mục 1. Khách hiện tại trước. Mã khách ở mục 1 sẽ được áp dụng cho tất cả các bước bên dưới.");
    return "";
  }
  function selectCustomerToContinue(maKH: string) {
    setCurrentMaKH(maKH);
    const events = eventLog.filter((x) => x.maKH === maKH).sort(sortEventsAsc);
    const processes = processLog.filter((x) => x.maKH === maKH).sort(sortProcessLogAsc);
    const lastEvent = events[events.length - 1];
    const lastProcess = processes[processes.length - 1];

    if (lastEvent) {
      setLoaiKH(lastEvent.loaiKH);
      setCuaVao(lastEvent.cuaVao === "Không ghi nhận" ? "Entrance 1" : lastEvent.cuaVao);
      setQuay(lastEvent.quay);
      setNhanVien(lastEvent.nhanVien || "NV1");
      setGhiChu(lastEvent.ghiChu || "");
    } else if (lastProcess) {
      setLoaiKH(lastProcess.loaiKH || "");
      setCuaVao(lastProcess.cuaVao === "Không ghi nhận" ? "Entrance 1" : lastProcess.cuaVao);
      if (lastProcess.quay) setQuay(lastProcess.quay);
      setGhiChu(lastProcess.ghiChu || "");
    }
  }

  async function addProcessEvent(eventType: ProcessEventType) {
    if (!processTableReady) {
      alert("Chưa có bảng process_log trong Supabase.");
      return;
    }
    if (!tenNguoiBam.trim()) {
      alert("Bạn chưa nhập tên người bấm.");
      return;
    }

    const maKH = requireCurrentCustomerCode();
    if (!maKH) return;
    let runId = activeProcessRunId;

    if (eventType === "START") {
      const running = currentCustomerProcessSummaries.some((r) => r.status === "DANG_CHAY" && r.processName === selectedProcessName);
      if (running) {
        alert("Process này đã START nhưng chưa END.");
        return;
      }
      runId = generateProcessRunId(selectedProcessName);
      setActiveProcessRunId(runId);
    } else {
      const latestStart = [...processLog]
        .filter((row) => row.maKH === maKH && row.processName === selectedProcessName && row.eventType === "START")
        .sort(sortProcessLogDesc)
        .find((start) => !processLog.some((row) => row.runId === start.runId && row.eventType === "END"));
      runId = runId || latestStart?.runId || "";
      if (!runId) {
        alert("Chưa có START đang chạy cho Process này.");
        return;
      }
    }

    const { data, error } = await supabase
      .from("process_log")
      .insert({
        run_id: runId,
        ma_kh: maKH,
        thoi_gian: new Date().toISOString(),
        process_name: selectedProcessName,
        event_type: eventType,
        cua_vao: cuaVao,
        loai_kh: loaiKH || null,
        quay: loaiKH ? quay : null,
        ghi_chu: buildGhiChu(ghiChu, cuaVao),
        nguoi_bam: tenNguoiBam.trim(),
      })
      .select("*");

    if (error) {
      alert(`Lưu Process_Log thất bại: ${error.message}`);
      return;
    }
    const inserted = data?.[0] as ProcessDbRow | undefined;
    if (inserted) upsertProcessRow(mapDbRowToProcessLogRow(inserted));
    if (eventType === "END") setActiveProcessRunId("");
  }

  async function updateCustomerMeta(selectedType: CustomerType, selectedCounter: CounterType) {
    const maKH = currentMaKH;
    if (!maKH) return;

    await supabase.from("process_log").update({ loai_kh: selectedType, quay: selectedCounter }).eq("ma_kh", maKH);
    await supabase.from("decision_log").update({ loai_kh: selectedType }).eq("ma_kh", maKH);

    setProcessLog((prev) => prev.map((row) => (row.maKH === maKH ? { ...row, loaiKH: selectedType, quay: selectedCounter } : row)));
    setDecisionLog((prev) => prev.map((row) => (row.maKH === maKH ? { ...row, loaiKH: selectedType } : row)));
  }

  async function insertEventAt(selectedType: CustomerType, selectedCounter: CounterType, eventName: EventName, timeISO: string) {
    if (!currentMaKH) return;
    if (eventLog.some((row) => row.maKH === currentMaKH && row.suKien === eventName)) return;

    const { data, error } = await supabase
      .from("event_log")
      .insert({
        ma_kh: currentMaKH,
        loai_kh: selectedType,
        quy_trinh: buildQuyTrinh(selectedType, selectedCounter, cuaVao),
        su_kien: eventName,
        thoi_gian: timeISO,
        nhan_vien: nhanVien.trim() || "NV1",
        quay: selectedCounter,
        ghi_chu: buildGhiChu(ghiChu, cuaVao),
        nguoi_bam: tenNguoiBam.trim(),
      })
      .select("*");

    if (error) {
      alert(`Lưu mốc ${eventName} thất bại: ${error.message}`);
      return;
    }
    const inserted = data?.[0] as DbRow | undefined;
    if (inserted) upsertEventRow(mapDbRowToEventRow(inserted));
  }

  async function classifyCustomer(selectedType: CustomerType) {
    if (!currentMaKH) {
      alert("Bạn cần bấm '+ Tạo khách mới' ở mục 1 trước, sau đó bấm START/END Process.");
      return;
    }
    if (!completedSelectProcess) {
      alert("Bạn cần bấm START và END Process lựa món trước, sau đó mới chọn loại khách/món chính.");
      return;
    }

    const selectedCounter = getValidCounters(selectedType)[0];
    setLoaiKH(selectedType);
    setQuay(selectedCounter);

    await updateCustomerMeta(selectedType, selectedCounter);
    await insertEventAt(selectedType, selectedCounter, "KHACH_VAO_KHU_AN_UONG", completedSelectProcess.rawStartTime);
    await insertEventAt(selectedType, selectedCounter, getQueueEventForType(selectedType), completedSelectProcess.rawEndTime);
    await addDecisionLogInline("Chọn loại khách", selectedType, selectedType, selectedCounter);
  }

  async function addDecisionLogInline(decisionName: DecisionName, option: string, forcedType?: CustomerType, forcedCounter?: CounterType) {
    if (!decisionTableReady) return;
    const maKH = requireCurrentCustomerCode();
    if (!maKH) return;
    const isCanPay = decisionName.startsWith("Can I pay now");
    const finalChosenCounter = getChosenCounterFromOption(option);
    const manuallyChosenCounter = isCanPay ? getCounterFromCode(finalChosenCounter) : "";
    const counterToApply = forcedCounter || manuallyChosenCounter || undefined;

    const { data, error } = await supabase
      .from("decision_log")
      .insert({
        ma_kh: maKH,
        thoi_gian: new Date().toISOString(),
        cua_vao: cuaVao,
        decision_name: decisionName,
        option_selected: option,
        loai_kh: forcedType || loaiKH || null,
        q1_length: null,
        q2_length: null,
        q3_length: null,
        chosen_counter: isCanPay ? finalChosenCounter : null,
        ghi_chu: buildGhiChu(ghiChu, cuaVao),
        nguoi_bam: tenNguoiBam.trim(),
      })
      .select("*");

    if (error) {
      alert(`Lưu Decision_Log thất bại: ${error.message}`);
      return;
    }

    const inserted = data?.[0] as DecisionDbRow | undefined;
    if (inserted) upsertDecisionRow(mapDbRowToDecisionRow(inserted));

    if (counterToApply) {
      setQuay(counterToApply);
      if (loaiKH) {
        await supabase.from("process_log").update({ quay: counterToApply }).eq("ma_kh", maKH);
        await supabase.from("event_log").update({ quay: counterToApply }).eq("ma_kh", maKH);
        setProcessLog((prev) => prev.map((row) => (row.maKH === maKH ? { ...row, quay: counterToApply } : row)));
        setEventLog((prev) => prev.map((row) => (row.maKH === maKH ? { ...row, quay: counterToApply } : row)));
      }
    }
  }

  async function addDecisionLog() {
    if (!decisionTableReady) {
      alert("Chưa có bảng decision_log trong Supabase.");
      return;
    }
    if (!tenNguoiBam.trim()) {
      alert("Bạn chưa nhập tên người bấm.");
      return;
    }
    if (!currentMaKH) {
      alert("Bạn cần bấm '+ Tạo khách mới' ở mục 1 trước để có mã khách áp dụng cho Decide.");
      return;
    }
    await addDecisionLogInline(selectedDecisionName, selectedDecisionOption);
  }

  async function addNextMainEvent() {
    if (!currentMaKH || !loaiKH) {
      alert("Bạn cần chọn loại khách sau khi END Process.");
      return;
    }
    if (!nextStep) {
      alert("Khách này đã đủ mốc chính.");
      return;
    }
    if (nextStep.role === "SYSTEM_START" || nextStep.role === "QUEUE_ARRIVAL") {
      alert("Hai mốc đầu được tạo tự động từ START/END Process lựa món.");
      return;
    }
    await insertEventAt(loaiKH, quay, nextStep.code, new Date().toISOString());
  }

  async function deleteRow(table: "event_log" | "decision_log" | "process_log", id: number) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      alert(`Xóa thất bại: ${error.message}`);
      return;
    }
    if (table === "event_log") setEventLog((prev) => prev.filter((x) => x.id !== id));
    if (table === "decision_log") setDecisionLog((prev) => prev.filter((x) => x.id !== id));
    if (table === "process_log") setProcessLog((prev) => prev.filter((x) => x.id !== id));
  }

  async function resetCurrentCustomer() {
    if (!currentMaKH) return;
    if (!confirm(`Xóa toàn bộ dữ liệu của ${currentMaKH}?`)) return;

    await supabase.from("event_log").delete().eq("ma_kh", currentMaKH);
    await supabase.from("decision_log").delete().eq("ma_kh", currentMaKH);
    await supabase.from("process_log").delete().eq("ma_kh", currentMaKH);

    setEventLog((prev) => prev.filter((x) => x.maKH !== currentMaKH));
    setDecisionLog((prev) => prev.filter((x) => x.maKH !== currentMaKH));
    setProcessLog((prev) => prev.filter((x) => x.maKH !== currentMaKH));
    setCurrentMaKH("");
    setLoaiKH("");
    setActiveProcessRunId("");
  }

  async function clearAllData() {
    if (!confirm("Xóa toàn bộ dữ liệu event_log, decision_log, process_log?")) return;
    await supabase.from("event_log").delete().neq("id", 0);
    await supabase.from("decision_log").delete().neq("id", 0);
    await supabase.from("process_log").delete().neq("id", 0);
    setEventLog([]);
    setDecisionLog([]);
    setProcessLog([]);
    setCurrentMaKH("");
    setLoaiKH("");
    setActiveProcessRunId("");
  }

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const grouped = new Map<string, EventRow[]>();
    for (const row of [...eventLog].sort(sortEventsAsc)) {
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

      const findByRole = (role: FlowStep["role"]) => {
        const step = flow.find((x) => x.role === role);
        return step ? ordered.find((r) => r.suKien === step.code) : undefined;
      };

      const systemStart = findByRole("SYSTEM_START");
      const queueArrival = findByRole("QUEUE_ARRIVAL");
      const serviceStart = findByRole("SERVICE_START");
      const serviceEnd = findByRole("SERVICE_END");

      const selectProductTimeS = diffSecondsPrecise(systemStart?.thoiGian || "", queueArrival?.thoiGian || "");
      const waitingTimeS = diffSecondsPrecise(queueArrival?.thoiGian || "", serviceStart?.thoiGian || "");
      const serviceTimeS = diffSecondsPrecise(serviceStart?.thoiGian || "", serviceEnd?.thoiGian || "");
      const systemTimeS = diffSecondsPrecise(systemStart?.thoiGian || "", serviceEnd?.thoiGian || "");

      const missingSteps = flow.filter((s) => !ordered.some((r) => r.suKien === s.code)).map((s) => s.shortLabel);
      const timeError = selectProductTimeS === "" || waitingTimeS === "" || serviceTimeS === "" || systemTimeS === "" || Number(serviceTimeS) <= 0;
      const dataStatus: SummaryRow["dataStatus"] = missingSteps.length ? "THIEU_BUOC" : timeError ? "LOI_THOI_GIAN" : "OK";

      result.push({
        stt: stt++,
        maKH,
        loaiKH: loai,
        loaiLabel: getLoaiKhachLabel(loai),
        cuaVao: firstRow.cuaVao,
        quay: lastRow.quay,
        ghiChu: lastRow.ghiChu,
        nguoiBam: lastRow.nguoiBam,
        processKey: getProcessKey(loai, lastRow.quay),
        createByEntrance: getCreateByEntrance(firstRow.cuaVao),
        createByType: getCreateByType(loai),
        queueName: getArenaQueue(lastRow.quay),
        resourceName: getArenaResource(lastRow.quay),
        dataStatus,
        errorNote: missingSteps.length ? `Thiếu bước: ${missingSteps.join(", ")}` : timeError ? "Kiểm tra thời gian select/wait/service/system" : "Đủ dữ liệu",
        T_KHACH_VAO: formatDateTimeVNms(systemStart?.thoiGian || ""),
        T_VAO_HANG: formatDateTimeVNms(queueArrival?.thoiGian || ""),
        T_BAT_DAU_PHUC_VU: formatDateTimeVNms(serviceStart?.thoiGian || ""),
        T_ROI_QUAY: formatDateTimeVNms(serviceEnd?.thoiGian || ""),
        selectProductTimeS,
        waitingTimeS,
        serviceTimeS,
        systemTimeS,
        systemInterarrivalByEntranceS: "",
        systemInterarrivalByTypeS: "",
        queueInterarrivalByCounterS: "",
        queueInterarrivalByProcessS: "",
      });
    });

    addInterarrivalByGroup(result, (r) => r.createByEntrance, (r) => r.T_KHACH_VAO, "systemInterarrivalByEntranceS");
    addInterarrivalByGroup(result, (r) => r.createByType, (r) => r.T_KHACH_VAO, "systemInterarrivalByTypeS");
    addInterarrivalByGroup(result, (r) => r.queueName, (r) => r.T_VAO_HANG, "queueInterarrivalByCounterS");
    addInterarrivalByGroup(result, (r) => r.processKey, (r) => r.T_VAO_HANG, "queueInterarrivalByProcessS");

    return result.sort((a, b) => (parseDateTime(b.T_KHACH_VAO)?.getTime() || 0) - (parseDateTime(a.T_KHACH_VAO)?.getTime() || 0));
  }, [eventLog]);

  const pendingCustomers = useMemo(() => {
    const ids = new Set<string>();
    processLog.forEach((r) => {
      if (r.maKH) ids.add(r.maKH);
    });
    eventLog.forEach((r) => {
      if (r.maKH) ids.add(r.maKH);
    });

    return Array.from(ids)
      .map((maKH) => {
        const relatedProcesses = processLog.filter((p) => p.maKH === maKH);
        const relatedEvents = eventLog.filter((e) => e.maKH === maKH);
        const relatedDecisions = decisionLog.filter((d) => d.maKH === maKH);
        const hasType = relatedEvents.find((e) => e.loaiKH)?.loaiKH || relatedProcesses.find((p) => p.loaiKH)?.loaiKH || relatedDecisions.find((d) => d.loaiKH)?.loaiKH || "";
        const latestTime =
          [...relatedProcesses.map((p) => p.thoiGian), ...relatedEvents.map((e) => e.thoiGian), ...relatedDecisions.map((d) => d.thoiGian)].sort().at(-1) || "";
        const latestNoteSource = [...relatedProcesses, ...relatedEvents, ...relatedDecisions]
          .filter((row) => row.ghiChu && row.ghiChu.trim())
          .sort((a, b) => (parseDateTime(b.thoiGian)?.getTime() || 0) - (parseDateTime(a.thoiGian)?.getTime() || 0))[0];
        const note = latestNoteSource?.ghiChu || "";
        return { maKH, loaiKH: hasType, latestTime, note };
      })
      .sort((a, b) => (parseDateTime(b.latestTime)?.getTime() || 0) - (parseDateTime(a.latestTime)?.getTime() || 0));
  }, [processLog, eventLog, decisionLog]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    appendSheet(
      wb,
      "Event_Log",
      [...eventLog].sort(sortEventsAsc).map((r, i) => ({
        stt: i + 1,
        maKH: r.maKH,
        loaiKH: r.loaiKH,
        loaiLabel: r.loaiLabel,
        cuaVao: r.cuaVao,
        quay: r.quay,
        suKien: r.suKien,
        suKienLabel: r.suKienLabel,
        thoiGian: formatDateTimeVNms(r.thoiGian),
        nhanVien: r.nhanVien,
        ghiChu: r.ghiChu,
        nguoiBam: r.nguoiBam,
      })),
    );

    appendSheet(
      wb,
      "Decision_Log",
      [...decisionLog]
        .sort((a, b) => (parseDateTime(a.thoiGian)?.getTime() || 0) - (parseDateTime(b.thoiGian)?.getTime() || 0))
        .map((r, i) => ({
          stt: i + 1,
          maKH: r.maKH,
          thoiGian: formatDateTimeVNms(r.thoiGian),
          cuaVao: r.cuaVao,
          decisionName: r.decisionName,
          optionSelected: r.optionSelected,
          loaiKH: r.loaiKH,
          chosenCounter: r.chosenCounter,
          ghiChu: r.ghiChu,
          nguoiBam: r.nguoiBam,
        })),
    );

    appendSheet(
      wb,
      "Process_Log",
      [...processLog].sort(sortProcessLogAsc).map((r, i) => ({
        stt: i + 1,
        maKH: r.maKH,
        runId: r.runId,
        processName: r.processName,
        eventType: r.eventType,
        thoiGian: formatDateTimeVNms(r.thoiGian),
        cuaVao: r.cuaVao,
        loaiKH: r.loaiKH,
        quay: r.quay,
        ghiChu: r.ghiChu,
        nguoiBam: r.nguoiBam,
      })),
    );

    appendSheet(
      wb,
      "Summary",
      summaryRows.map((r) => ({
        ...r,
        selectProductTimeS: toNumberOrBlank(r.selectProductTimeS),
        waitingTimeS: toNumberOrBlank(r.waitingTimeS),
        serviceTimeS: toNumberOrBlank(r.serviceTimeS),
        systemTimeS: toNumberOrBlank(r.systemTimeS),
      })) as Record<string, unknown>[],
    );

    appendSheet(
      wb,
      "Process_Summary",
      processSummaryRows.map((r) => ({
        ...r,
        processDurationS: toNumberOrBlank(r.processDurationS),
        processInterarrivalS: toNumberOrBlank(r.processInterarrivalS),
      })) as Record<string, unknown>[],
    );

    appendSheet(wb, "IA_Create_Entrance_Long", makeLongIA(summaryRows, "systemInterarrivalByEntranceS", "createByEntrance", "Interarrival theo cửa vào"));
    appendSheet(wb, "IA_Create_Type_Long", makeLongIA(summaryRows, "systemInterarrivalByTypeS", "createByType", "Interarrival theo loại khách"));
    appendSheet(wb, "IA_Select_Long", makeLongIA(summaryRows, "selectProductTimeS", "createByType", "Thời gian lựa món = END Process - START Process"));
    appendSheet(wb, "IA_Waiting_Long", makeLongIA(summaryRows, "waitingTimeS", "queueName", "Thời gian chờ quầy"));
    appendSheet(wb, "IA_Service_Long", makeLongIA(summaryRows, "serviceTimeS", "resourceName", "Thời gian phục vụ"));
    appendSheet(wb, "IA_Select_Type_Wide", makeWideIA(summaryRows, (r) => r.createByType, (r) => r.selectProductTimeS));
    appendSheet(wb, "IA_Service_Wide", makeWideIA(summaryRows, (r) => r.processKey, (r) => r.serviceTimeS));
    appendSheet(wb, "IA_Process_Long", makeProcessLongIA(processSummaryRows));
    appendSheet(wb, "IA_Process_Wide", makeProcessWideIA(processSummaryRows));
    appendSheet(wb, "Decision_Percent", summarizeDecisionPercent(decisionLog));

    XLSX.writeFile(wb, `Emart_Arena_Input_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const okCount = summaryRows.filter((r) => r.dataStatus === "OK").length;
  const errorCount = summaryRows.length - okCount;
  const canClassify = Boolean(currentMaKH && completedSelectProcess && !loaiKH);
  const canPressService = Boolean(currentMaKH && loaiKH && nextStep && nextStep.role !== "SYSTEM_START" && nextStep.role !== "QUEUE_ARRIVAL");

  return (
    <main style={{ minHeight: "100vh", background: palette.bg, padding: 18, color: palette.text, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <section style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26 }}>Emart Timer - mã khách ngắn</h1>
            <p style={{ margin: "6px 0 0", color: palette.sub }}>Tạo mã khách ở mục 1 trước. Mã khách sẽ tách theo tên người bấm, ví dụ mỗi người có một dãy mã riêng, và mã đó dùng chung cho START/END Process, Decide, phân loại và phục vụ.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={refreshAllData} style={secondaryButtonStyle}>{loading ? "Đang tải..." : "Tải lại"}</button>
            <button onClick={exportExcel} style={primaryButtonStyle}>Xuất Excel Arena</button>
            <button onClick={clearAllData} style={dangerButtonStyle}>Xóa tất cả</button>
          </div>
        </header>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>1. Khách hiện tại</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            <InfoBox label="Mã khách" value={currentMaKH || "Chưa tạo"} />
            <InfoBox label="Trạng thái" value={!currentMaKH ? "Chưa tạo mã KH" : !completedSelectProcess ? "Đang lựa/chưa END" : !loaiKH ? "Chờ phân loại" : "Đang phục vụ"} tone={loaiKH ? "green" : completedSelectProcess ? "amber" : undefined} />
            <InfoBox label="Summary OK" value={String(okCount)} tone="green" />
            <InfoBox label="Thiếu/Lỗi" value={String(errorCount)} tone={errorCount ? "red" : undefined} />
          </div>

          <div style={gridFormStyle}>
            <Field label="Người bấm">
              <input value={tenNguoiBam} onChange={(e) => { setTenNguoiBam(e.target.value); localStorage.setItem("emart_ten_nguoi_bam", e.target.value); }} style={inputStyle} />
            </Field>
            <Field label="Cửa vào">
              <select value={cuaVao} onChange={(e) => setCuaVao(e.target.value as RecordableEntrance)} style={inputStyle}>
                {ENTRANCES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Nhân viên">
              <input value={nhanVien} onChange={(e) => setNhanVien(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Ghi chú">
              <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} style={inputStyle} placeholder="Ví dụ: áo trắng, nhóm 2 người..." />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={createNewCustomer} style={primaryButtonStyle}>+ Tạo khách mới</button>
            <button onClick={resetCurrentCustomer} disabled={!currentMaKH} style={currentMaKH ? dangerButtonStyle : disabledButtonStyle}>Reset khách hiện tại</button>
          </div>
          <p style={{ margin: "10px 0 0", color: palette.sub, fontSize: 13 }}>
            Mã khách đang hiển thị ở mục này được tạo theo tên người bấm và sẽ áp dụng cho tất cả thao tác bên dưới: START/END Process, Decide, chọn loại khách và bấm phục vụ.
          </p>

          {pendingCustomers.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <b>Chọn lại khách đang bấm:</b>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {pendingCustomers.slice(0, 20).map((c) => (
                  <button key={c.maKH} onClick={() => selectCustomerToContinue(c.maKH)} style={c.maKH === currentMaKH ? smallPrimaryButtonStyle : smallButtonStyle} title={c.note || "Chưa có ghi chú"}>
                    {c.maKH} {c.loaiKH ? `- ${c.loaiKH}` : "- chưa loại"}{c.note ? ` - ${c.note}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>2. Bấm START/END Process và Decide theo mã khách hiện tại</h2>
          <Notice tone="amber">
            Bấm “+ Tạo khách mới” ở mục 1 trước. Sau đó START = khách vào khu ăn uống/bắt đầu lựa, END = khách kết thúc lựa và chuẩn bị vào hàng. Decide cũng sẽ lưu theo đúng mã khách đang hiển thị ở mục 1.
          </Notice>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
            <div style={innerPanelStyle}>
              <h3 style={subSectionTitleStyle}>2.1. START/END Process lựa món</h3>
              {!processTableReady && <Notice tone="red">Chưa có bảng process_log trong Supabase.</Notice>}

              <div style={gridFormStyle}>
                <Field label="Process module">
                  <select value={selectedProcessName} onChange={(e) => { setSelectedProcessName(e.target.value as ProcessName); setActiveProcessRunId(""); }} style={inputStyle}>
                    {ARENA_PROCESS_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </Field>
                <Field label="Mã khách hàng đang chạy">
                  <input value={currentMaKH || "Chưa tạo mã khách"} readOnly style={inputStyle} />
                </Field>
                <Field label="Ghi chú phân biệt khách">
                  <input
                    value={ghiChu}
                    onChange={(e) => setGhiChu(e.target.value)}
                    style={inputStyle}
                    placeholder="Ví dụ: áo trắng, đi 2 người, cầm pizza..."
                  />
                </Field>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => addProcessEvent("START")} disabled={!currentMaKH} style={currentMaKH ? primaryButtonStyle : disabledButtonStyle}>START Process cho mã hiện tại</button>
                <button onClick={() => addProcessEvent("END")} disabled={!currentMaKH} style={currentMaKH ? secondaryButtonStyle : disabledButtonStyle}>END Process cho mã hiện tại</button>
              </div>

              <p style={{ color: palette.sub, margin: "10px 0 0", fontSize: 13 }}>
                Process lựa món hoàn tất: <b>{completedSelectProcess ? `${completedSelectProcess.processName} (${completedSelectProcess.processDurationS}s)` : "Chưa có"}</b>
              </p>

              <div style={{ marginTop: 14 }}>
                <LogTable
                  title="Process_Log của khách hiện tại"
                  rows={currentCustomerProcesses}
                  columns={["Thời gian", "Process", "Type", "Mã KH", "Ghi chú", "Xóa"]}
                  renderRow={(r) => (
                    <tr key={r.id}>
                      <td style={tdStyle}>{formatDateTimeVNms(r.thoiGian)}</td>
                      <td style={tdStyle}>{r.processName}</td>
                      <td style={tdStyle}>{r.eventType}</td>
                      <td style={tdStyle}>{r.maKH || currentMaKH}</td>
                      <td style={tdStyle}>{r.ghiChu || ""}</td>
                      <td style={tdStyle}><button onClick={() => deleteRow("process_log", r.id)} style={miniDangerButtonStyle}>Xóa</button></td>
                    </tr>
                  )}
                />
              </div>
            </div>

            <div style={innerPanelStyle}>
              <h3 style={subSectionTitleStyle}>2.2. Decide nếu khách đi qua điểm rẽ / chọn quầy</h3>
              {!decisionTableReady && <Notice tone="red">Chưa có bảng decision_log trong Supabase.</Notice>}
              {!currentMaKH && <Notice tone="blue">Bấm “+ Tạo khách mới” ở mục 1 trước. Decide sẽ dùng đúng mã khách đang hiển thị ở mục 1.</Notice>}

              <div style={gridFormStyle}>
                <Field label="Mã khách hàng áp dụng">
                  <input value={currentMaKH || "Chưa tạo mã khách"} readOnly style={inputStyle} />
                </Field>
                <Field label="Tên cục Decide">
                  <select value={selectedDecisionName} onChange={(e) => setSelectedDecisionName(e.target.value as DecisionName)} style={inputStyle}>
                    {DECISION_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </Field>
                <Field label="Nhánh khách chọn">
                  <select value={selectedDecisionOption} onChange={(e) => setSelectedDecisionOption(e.target.value)} style={inputStyle}>
                    {getDecisionOptions(selectedDecisionName).map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </Field>
                <Field label="Loại dữ liệu Arena">
                  <input value={getDecisionMode(selectedDecisionName)} readOnly style={inputStyle} />
                </Field>
              </div>

              {selectedDecisionName.startsWith("Can I pay now") && <Notice tone="blue">Chọn trực tiếp quầy khách thực tế đi vào ở ô “Nhánh khách chọn”. Không cần nhập Q1/Q2/Q3 đang chờ.</Notice>}
              <button onClick={addDecisionLog} disabled={!currentMaKH} style={currentMaKH ? primaryButtonStyle : disabledButtonStyle}>Lưu Decide cho mã khách đang hiển thị</button>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>3. Chọn loại khách / món chính cho mã khách hiện tại sau END Process</h2>
          {!completedSelectProcess && <Notice tone="amber">Chưa chọn được loại khách. Hãy bấm START và END Process lựa món trước.</Notice>}
          {loaiKH && <Notice tone="green">Mã {currentMaKH} đã chọn loại: {getLoaiKhachLabel(loaiKH)}. Hai mốc đầu đã được lấy từ START/END Process.</Notice>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {CUSTOMER_TYPES.map((item) => {
              const selected = loaiKH === item.code;
              return (
                <button
                  key={item.code}
                  onClick={() => classifyCustomer(item.code)}
                  disabled={!canClassify}
                  style={{
                    ...typeButtonStyle,
                    background: selected ? palette.blueSoft : palette.card,
                    borderColor: selected ? palette.blue : palette.line,
                    cursor: canClassify ? "pointer" : "not-allowed",
                    opacity: canClassify || selected ? 1 : 0.55,
                  }}
                >
                  <b>{item.label}</b>
                  <span style={{ color: palette.sub, fontSize: 12 }}>{item.hint}</span>
                </button>
              );
            })}
          </div>

          <div style={gridFormStyle}>
            <Field label="Mã khách hàng phân loại">
              <input value={currentMaKH || "Chưa tạo mã khách"} readOnly style={inputStyle} />
            </Field>
            <Field label="Quầy áp dụng">
              <select value={quay} onChange={(e) => setQuay(e.target.value as CounterType)} style={inputStyle}>
                {validCounters.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
            <Field label="Loại đang chọn">
              <input value={getLoaiKhachLabel(loaiKH)} readOnly style={inputStyle} />
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>4. Bấm mốc phục vụ sau khi đã biết loại khách</h2>
          {!loaiKH && <Notice tone="amber">Sau khi chọn loại khách, hệ thống tự tạo mốc “khách vào khu ăn uống” và “vào hàng” từ START/END Process. Bạn chỉ cần bấm 2 mốc phục vụ còn lại.</Notice>}

          <div style={{ display: "grid", gap: 10 }}>
            {loaiKH &&
              currentFlow.map((step) => {
                const done = currentCustomerEvents.some((r) => r.suKien === step.code);
                const active = nextStep?.code === step.code;
                return (
                  <div key={step.code} style={{ ...flowStepStyle, borderColor: active ? palette.blue : palette.line, background: done ? palette.greenSoft : active ? palette.blueSoft : palette.card2 }}>
                    <div>
                      <b>{step.label}</b>
                      <div style={{ fontSize: 12, color: palette.sub }}>{step.code}</div>
                    </div>
                    <b>{done ? "Đã bấm" : active ? "Đang chờ bấm" : "Sau bước trước"}</b>
                  </div>
                );
              })}
          </div>

          <button onClick={addNextMainEvent} disabled={!canPressService} style={canPressService ? primaryButtonStyle : disabledButtonStyle}>
            Bấm mốc phục vụ tiếp theo
          </button>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>5. Summary khách</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: palette.card2 }}>
                  {["STT", "Mã KH", "Loại", "Cửa", "Quầy", "Select(s)", "Wait(s)", "Service(s)", "System(s)", "Status", "Ghi chú"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {summaryRows.slice(0, 50).map((r) => (
                  <tr key={r.maKH}>
                    <td style={tdStyle}>{r.stt}</td>
                    <td style={tdStyle}>{r.maKH}</td>
                    <td style={tdStyle}>{r.loaiLabel}</td>
                    <td style={tdStyle}>{r.cuaVao}</td>
                    <td style={tdStyle}>{getCounterCode(r.quay)}</td>
                    <td style={tdStyle}>{r.selectProductTimeS}</td>
                    <td style={tdStyle}>{r.waitingTimeS}</td>
                    <td style={tdStyle}>{r.serviceTimeS}</td>
                    <td style={tdStyle}>{r.systemTimeS}</td>
                    <td style={tdStyle}>{r.dataStatus}</td>
                    <td style={tdStyle}>{r.errorNote}</td>
                  </tr>
                ))}
                {!summaryRows.length && (
                  <tr>
                    <td colSpan={11} style={{ ...tdStyle, color: palette.sub }}>Chưa có dữ liệu Summary.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
          <LogTable title="Decision_Log của khách hiện tại" rows={currentCustomerDecisions} columns={["Thời gian", "Decide", "Nhánh", "Quầy", "Xóa"]} renderRow={(r) => (
            <tr key={r.id}>
              <td style={tdStyle}>{formatDateTimeVNms(r.thoiGian)}</td>
              <td style={tdStyle}>{r.decisionName}</td>
              <td style={tdStyle}>{r.optionSelected}</td>
              <td style={tdStyle}>{r.chosenCounter}</td>
              <td style={tdStyle}><button onClick={() => deleteRow("decision_log", r.id)} style={miniDangerButtonStyle}>Xóa</button></td>
            </tr>
          )} />
        </section>
      </section>
    </main>
  );
}

function Field({ label, children, block = false }: { label: string; children: ReactNode; block?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 6, gridColumn: block ? "1 / -1" : undefined }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

function InfoBox({ label, value, tone }: { label: string; value: string; tone?: "green" | "amber" | "red" | "blue" }) {
  const color =
    tone === "green" ? palette.green :
    tone === "amber" ? palette.amber :
    tone === "red" ? palette.red :
    tone === "blue" ? palette.blue :
    palette.text;
  const bg =
    tone === "green" ? palette.greenSoft :
    tone === "amber" ? palette.amberSoft :
    tone === "red" ? palette.redSoft :
    tone === "blue" ? palette.blueSoft :
    palette.card2;

  return (
    <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12, background: bg }}>
      <div style={{ color: palette.sub, fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ color, fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Notice({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "amber" | "red" | "green" }) {
  const color =
    tone === "green" ? palette.green :
    tone === "amber" ? palette.amber :
    tone === "red" ? palette.red :
    palette.blue;
  const bg =
    tone === "green" ? palette.greenSoft :
    tone === "amber" ? palette.amberSoft :
    tone === "red" ? palette.redSoft :
    palette.blueSoft;
  return <div style={{ border: `1px solid ${color}`, background: bg, color, borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 650, margin: "8px 0" }}>{children}</div>;
}

function LogTable<T>({ title, rows, columns, renderRow }: { title: string; rows: T[]; columns: string[]; renderRow: (row: T) => ReactNode }) {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: palette.card2 }}>
              {columns.map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map(renderRow)}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length} style={{ ...tdStyle, color: palette.sub }}>Chưa có dữ liệu cho khách hiện tại.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  background: palette.card,
  border: `1px solid ${palette.line}`,
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const innerPanelStyle: CSSProperties = {
  border: `1px solid ${palette.line}`,
  borderRadius: 14,
  padding: 12,
  background: palette.card2,
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 20,
};

const subSectionTitleStyle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 16,
};

const gridFormStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
  margin: "12px 0",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${palette.line}`,
  borderRadius: 12,
  padding: "11px 12px",
  fontWeight: 650,
  background: "#fff",
  color: palette.text,
};

const primaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 16px",
  background: palette.blue,
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: `1px solid ${palette.blue}`,
  borderRadius: 12,
  padding: "11px 16px",
  background: palette.blueSoft,
  color: palette.blue,
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
  border: `1px solid ${palette.red}`,
  borderRadius: 12,
  padding: "11px 16px",
  background: palette.redSoft,
  color: palette.red,
  fontWeight: 800,
  cursor: "pointer",
};

const disabledButtonStyle: CSSProperties = {
  border: `1px solid ${palette.line}`,
  borderRadius: 12,
  padding: "11px 16px",
  background: palette.card2,
  color: palette.sub,
  fontWeight: 800,
  cursor: "not-allowed",
};

const smallButtonStyle: CSSProperties = {
  border: `1px solid ${palette.line}`,
  borderRadius: 999,
  padding: "8px 12px",
  background: "#fff",
  color: palette.text,
  fontWeight: 700,
  cursor: "pointer",
};

const smallPrimaryButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  borderColor: palette.blue,
  background: palette.blueSoft,
  color: palette.blue,
};

const miniDangerButtonStyle: CSSProperties = {
  border: `1px solid ${palette.red}`,
  borderRadius: 8,
  padding: "5px 9px",
  background: palette.redSoft,
  color: palette.red,
  fontWeight: 700,
  cursor: "pointer",
};

const typeButtonStyle: CSSProperties = {
  border: `1px solid ${palette.line}`,
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 6,
  textAlign: "left",
};

const flowStepStyle: CSSProperties = {
  border: `1px solid ${palette.line}`,
  borderRadius: 14,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: CSSProperties = {
  borderBottom: `1px solid ${palette.line}`,
  padding: 10,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  borderBottom: `1px solid ${palette.line}`,
  padding: 10,
  verticalAlign: "top",
  whiteSpace: "nowrap",
};
