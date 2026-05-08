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
  T_KHACH_VAO: string;
  T_VAO_HANG: string;
  T_BAT_DAU_PHUC_VU: string;
  T_ROI_QUAY: string;
  systemArrivalTime: string;
  queueArrivalTime: string;
  serviceStartTime: string;
  serviceEndTime: string;
  selectProductTimeS: number | "";
  waitingTimeS: number | "";
  serviceTimeS: number | "";
  systemTimeS: number | "";
  systemInterarrivalByEntranceS: number | "";
  systemInterarrivalByTypeS: number | "";
  queueInterarrivalByCounterS: number | "";
  queueInterarrivalByProcessS: number | "";
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
  endTime: string;
  processDurationS: number | "";
  processInterarrivalS: number | "";
  status: "OK" | "DANG_CHAY" | "THIEU_START" | "LOI_THOI_GIAN";
  errorNote: string;
  ghiChu: string;
  nguoiBam: string;
};

const CUSTOMER_TYPES: { code: CustomerType; label: string; hint: string }[] = [
  { code: "SAN", label: "Đồ ăn làm sẵn", hint: "Vào khu → lựa hàng → hàng thanh toán → tính tiền → rời quầy" },
  { code: "CHUAN", label: "Món cần đầu bếp làm", hint: "Vào khu → nhận phiếu/order → hàng thanh toán → tính tiền → nhận món" },
  { code: "PIZZA", label: "Pizza", hint: "Vào khu → hàng pizza → order/tính tiền → nhận pizza" },
  { code: "PIZZA_COMBO", label: "Pizza + món khác", hint: "Vào khu → cầm món khác → hàng pizza → xử lý đơn → nhận đủ món" },
  { code: "NUOC", label: "Nước", hint: "Vào khu → lấy nước → hàng thanh toán → tính tiền → rời quầy" },
];

const ALL_COUNTERS: CounterType[] = [
  "Quầy thanh toán 1 - Khu bánh/pizza",
  "Quầy thanh toán 2 - Khu nước",
  "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
];
const ENTRANCES: RecordableEntrance[] = ["Entrance 1", "Entrance 2", "Entrance 3"];
const DECISION_NAMES: DecisionName[] = [
  "Turn or not 1", "Turn or not 2", "Turn or not 3", "Turn or not 4", "Turn or not 5", "Turn or not 6", "Turn or not 7",
  "continue or not 1", "continue or not 2", "continue or not 3",
  "Can I pay now 1", "Can I pay now 2", "Can I pay now 3", "Can I pay now 4", "Can I pay now 5", "Can I pay now 6",
  "Chọn loại khách",
];
const TURN_OPTIONS = ["Rẽ", "Không rẽ"];
const TURN_OR_NOT_1_OPTIONS = ["Rẽ", "Không rẽ", "Ra về Exit 1"];
const TURN_OR_NOT_2_OPTIONS = ["Rẽ", "Không rẽ", "Ra về Exit 3"];
const CONTINUE_OPTIONS = ["Continue", "Not continue"];
const CUSTOMER_DECISION_OPTIONS: CustomerType[] = ["NUOC", "SAN", "CHUAN", "PIZZA", "PIZZA_COMBO"];
const ARENA_PROCESS_NAMES: ProcessName[] = [
  "customer selects items", "customer selects items 1", "customer selects items 2", "customer selects items 3", "customer selects items 4",
  "customer selects items 5", "customer selects items 6", "customer selects items 7", "customer selects items 8", "customer selects items 9",
  "Payment_1", "Payment_2", "Payment_3",
];

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

function pad2(n: number) { return String(n).padStart(2, "0"); }
function pad3(n: number) { return String(n).padStart(3, "0"); }

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
  const devicePart = deviceId.replace("DV-", "").slice(-4) || "NODE";
  const randomPart = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `KH-${datePart}-${timePart}-${devicePart}-${randomPart}`;
}

function getLoaiKhachLabel(loai: CustomerType) {
  switch (loai) {
    case "SAN": return "ĐỒ ĂN LÀM SẴN";
    case "CHUAN": return "MÓN CẦN ĐẦU BẾP LÀM";
    case "PIZZA": return "PIZZA";
    case "PIZZA_COMBO": return "PIZZA KẾT HỢP MÓN KHÁC";
    case "NUOC": return "NƯỚC";
  }
}

function getFlow(loai: CustomerType): FlowStep[] {
  const vaoKhu: FlowStep = {
    code: "KHACH_VAO_KHU_AN_UONG",
    label: "1. Khách vào khu ăn uống / cửa vào",
    shortLabel: "Vào khu ăn uống",
    role: "SYSTEM_START",
  };
  switch (loai) {
    case "SAN":
      return [
        vaoKhu,
        { code: "VAO_HANG_THANH_TOAN", label: "2. Khách vào hàng đợi thanh toán", shortLabel: "Vào hàng thanh toán", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu tính tiền", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách nhận hàng và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
    case "CHUAN":
      return [
        vaoKhu,
        { code: "NV_DUA_THE_ORDER", label: "2. Nhân viên đưa phiếu/thẻ order", shortLabel: "Nhận phiếu order", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu thanh toán/xử lý đơn", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách nhận món và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
    case "PIZZA":
      return [
        vaoKhu,
        { code: "VAO_HANG_ORDER_PIZZA", label: "2. Khách vào hàng đợi order pizza", shortLabel: "Vào hàng pizza", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu nhận order/tính tiền", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách nhận pizza và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
    case "PIZZA_COMBO":
      return [
        vaoKhu,
        { code: "CAM_DO_AN", label: "2. Khách cầm món khác và qua quầy pizza", shortLabel: "Cầm món khác", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu xử lý toàn bộ đơn", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách nhận đủ món và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
    case "NUOC":
      return [
        vaoKhu,
        { code: "VAO_HANG_THANH_TOAN", label: "2. Khách vào hàng đợi thanh toán", shortLabel: "Vào hàng thanh toán", role: "QUEUE_ARRIVAL" },
        { code: "NV_BAT_DAU_PHUC_VU", label: "3. Nhân viên bắt đầu tính tiền", shortLabel: "Bắt đầu phục vụ", role: "SERVICE_START" },
        { code: "NHAN_HANG_ROI_QUAY", label: "4. Khách thanh toán xong và rời quầy", shortLabel: "Rời quầy", role: "SERVICE_END" },
      ];
  }
}

function getValidCounters(loai: CustomerType): CounterType[] {
  switch (loai) {
    case "PIZZA":
    case "PIZZA_COMBO": return ["Quầy thanh toán 1 - Khu bánh/pizza"];
    case "SAN": return ["Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến", "Quầy thanh toán 2 - Khu nước", "Quầy thanh toán 1 - Khu bánh/pizza"];
    case "CHUAN": return ["Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến", "Quầy thanh toán 2 - Khu nước"];
    case "NUOC": return ["Quầy thanh toán 2 - Khu nước", "Quầy thanh toán 1 - Khu bánh/pizza", "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến"];
  }
}

function getCounterCode(quay: CounterType) {
  switch (quay) {
    case "Quầy thanh toán 1 - Khu bánh/pizza": return "Q1";
    case "Quầy thanh toán 2 - Khu nước": return "Q2";
    case "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến": return "Q3";
  }
}
function getArenaQueue(quay: CounterType) { return `Q_ThanhToan_${getCounterCode(quay)}`; }
function getArenaResource(quay: CounterType) { return `Cashier_${getCounterCode(quay)}`; }
function getProcessKey(loai: CustomerType, quay: CounterType) { return `${loai}_${getCounterCode(quay)}`; }
function getCreateByEntrance(cuaVao: EntranceType) { return cuaVao === "Không ghi nhận" ? "Create_Khong_Ghi_Nhan" : `Create_${cuaVao.replaceAll(" ", "_")}`; }
function getCreateByType(loai: CustomerType) { return `Create_${loai}`; }
function findStepByEvent(loai: CustomerType, eventName: EventName) { return getFlow(loai).find((x) => x.code === eventName); }
function getEventLabel(loai: CustomerType, eventName: EventName) { return findStepByEvent(loai, eventName)?.shortLabel || eventName; }

function parseEntrance(text: string | null | undefined): EntranceType {
  const raw = text || "";
  if (raw.includes("Entrance 1")) return "Entrance 1";
  if (raw.includes("Entrance 2")) return "Entrance 2";
  if (raw.includes("Entrance 3")) return "Entrance 3";
  return "Không ghi nhận";
}
function cleanNote(text: string | null | undefined) { return (text || "").replace(/Cửa vào:\s*Entrance [123]\s*\|\s*/i, "").trim(); }
function buildQuyTrinh(loai: CustomerType, quay: CounterType, cuaVao: RecordableEntrance) { return `${cuaVao} | ${getLoaiKhachLabel(loai)} | ${quay}`; }
function buildGhiChu(note: string, cuaVao: RecordableEntrance) { const clean = note.trim(); return clean ? `Cửa vào: ${cuaVao} | ${clean}` : `Cửa vào: ${cuaVao}`; }

function mapDbRowToEventRow(row: DbRow): EventRow {
  const cuaVao = parseEntrance(row.quy_trinh || row.ghi_chu || "");
  return {
    id: Number(row.id),
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
    id: Number(row.id),
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
    ghiChu: row.ghi_chu || "",
    nguoiBam: row.nguoi_bam || "",
  };
}
function mapDbRowToProcessLogRow(row: ProcessDbRow): ProcessLogRow {
  return {
    id: Number(row.id),
    runId: row.run_id,
    maKH: row.ma_kh || "",
    thoiGian: row.thoi_gian,
    processName: row.process_name,
    eventType: row.event_type,
    cuaVao: row.cua_vao || "Không ghi nhận",
    loaiKH: row.loai_kh || "",
    quay: row.quay || "",
    ghiChu: row.ghi_chu || "",
    nguoiBam: row.nguoi_bam || "",
  };
}

function sortEventsAsc(a: EventRow, b: EventRow) {
  const ta = parseDateTime(a.thoiGian)?.getTime() || 0;
  const tb = parseDateTime(b.thoiGian)?.getTime() || 0;
  if (ta !== tb) return ta - tb;
  return a.id - b.id;
}
function sortEventsDesc(a: EventRow, b: EventRow) { return sortEventsAsc(b, a); }
function sortProcessLogAsc(a: ProcessLogRow, b: ProcessLogRow) {
  const ta = parseDateTime(a.thoiGian)?.getTime() || 0;
  const tb = parseDateTime(b.thoiGian)?.getTime() || 0;
  if (ta !== tb) return ta - tb;
  return a.id - b.id;
}
function sortProcessLogDesc(a: ProcessLogRow, b: ProcessLogRow) { return sortProcessLogAsc(b, a); }

function generateProcessRunId(processName: ProcessName, deviceId: string) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}${pad3(now.getMilliseconds())}`;
  const cleanProcess = processName.replaceAll(" ", "_").replaceAll("/", "_");
  const devicePart = deviceId.replace("DV-", "").slice(-4) || "NODE";
  const randomPart = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RUN-${cleanProcess}-${stamp}-${devicePart}-${randomPart}`;
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
      endTime: formatDateTimeVNms(end?.thoiGian || ""),
      processDurationS: duration,
      processInterarrivalS: "",
      status,
      errorNote: status === "OK" ? "Đủ dữ liệu" : status === "DANG_CHAY" ? "Đã bấm START nhưng chưa bấm END" : status === "THIEU_START" ? "Thiếu START" : "Kiểm tra thứ tự START/END",
      ghiChu: first.ghiChu,
      nguoiBam: first.nguoiBam,
    });
  });
  const byProcess = new Map<string, ProcessSummaryRow[]>();
  for (const row of result) {
    if (!row.startTime) continue;
    if (!byProcess.has(row.processName)) byProcess.set(row.processName, []);
    byProcess.get(row.processName)!.push(row);
  }
  byProcess.forEach((items) => {
    items.sort((a, b) => (parseDateTime(a.startTime)?.getTime() || 0) - (parseDateTime(b.startTime)?.getTime() || 0));
    for (let i = 1; i < items.length; i++) items[i].processInterarrivalS = diffSecondsPrecise(items[i - 1].startTime, items[i].startTime);
  });
  return result.sort((a, b) => (parseDateTime(b.startTime)?.getTime() || 0) - (parseDateTime(a.startTime)?.getTime() || 0));
}

function getDecisionMode(decisionName: DecisionName) {
  if (decisionName === "Turn or not 1" || decisionName === "Turn or not 2") return "N-way by Chance";
  if (decisionName.startsWith("Turn or not")) return "2-way by Chance";
  if (decisionName.startsWith("continue or not")) return "2-way by Chance";
  if (decisionName.startsWith("Can I pay now")) return "By Condition / kiểm tra NQ()";
  return "N-way by Chance";
}
function getDefaultDecisionOption(decisionName: DecisionName) {
  if (decisionName.startsWith("Turn or not")) return "Rẽ";
  if (decisionName.startsWith("continue or not")) return "Continue";
  if (decisionName.startsWith("Can I pay now")) return "Choose Q1";
  return "NUOC";
}
function getDecisionOptions(decisionName: DecisionName): string[] {
  if (decisionName === "Turn or not 1") return TURN_OR_NOT_1_OPTIONS;
  if (decisionName === "Turn or not 2") return TURN_OR_NOT_2_OPTIONS;
  if (decisionName.startsWith("Turn or not")) return TURN_OPTIONS;
  if (decisionName.startsWith("continue or not")) return CONTINUE_OPTIONS;
  if (decisionName.startsWith("Can I pay now")) return ["Choose Q1", "Choose Q2", "Choose Q3"];
  return CUSTOMER_DECISION_OPTIONS;
}
function getArenaBranchNote(decisionName: DecisionName, option: string) {
  if (decisionName === "Turn or not 1" && option === "Ra về Exit 1") return "Nối nhánh này về Exit 1";
  if (decisionName === "Turn or not 2" && option === "Ra về Exit 3") return "Nối nhánh này về Exit 3";
  if (option === "Rẽ") return "Khách rẽ theo hướng trong layout Arena";
  if (option === "Không rẽ") return "Khách không rẽ/đi tiếp hướng chính";
  return "";
}
function getChosenCounterFromOption(option: string): ChosenCounter {
  if (option.includes("Q1")) return "Q1";
  if (option.includes("Q2")) return "Q2";
  if (option.includes("Q3")) return "Q3";
  return "";
}
function getShortestQueueCounter(q1: number | "", q2: number | "", q3: number | ""): ChosenCounter {
  if (q1 === "" || q2 === "" || q3 === "") return "";
  const min = Math.min(q1, q2, q3);
  if (q1 === min) return "Q1";
  if (q2 === min) return "Q2";
  return "Q3";
}
function toNullableNumber(value: number | "") { return value === "" || Number.isNaN(Number(value)) ? null : Number(value); }
function toNumberOrBlank(value: number | "") { return value === "" ? "" : Number(value.toFixed(3)); }

function addInterarrivalByGroup(
  rows: SummaryRow[],
  getGroup: (r: SummaryRow) => string,
  getTime: (r: SummaryRow) => string,
  field: keyof Pick<SummaryRow, "systemInterarrivalByEntranceS" | "systemInterarrivalByTypeS" | "queueInterarrivalByCounterS" | "queueInterarrivalByProcessS">,
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
    items.sort((a, b) => (parseDateTime(getTime(a))?.getTime() || 0) - (parseDateTime(getTime(b))?.getTime() || 0));
    for (let i = 1; i < items.length; i++) items[i][field] = diffSecondsPrecise(getTime(items[i - 1]), getTime(items[i]));
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
  const maxLength = Math.max(0, ...keys.map((key) => grouped.get(key)!.length));
  const result: Record<string, number | "">[] = [];
  for (let i = 0; i < maxLength; i++) {
    const obj: Record<string, number | ""> = {};
    for (const key of keys) obj[key] = grouped.get(key)?.[i] ?? "";
    result.push(obj);
  }
  return result.length ? result : [{ ghiChu: "Chưa có đủ dữ liệu hợp lệ" } as unknown as Record<string, number | "">];
}
function makeProcessLongIA(rows: ProcessSummaryRow[]) {
  return rows.filter((row) => row.status === "OK" && row.processDurationS !== "").map((row) => ({
    phanTich: "Delay/Process time theo từng Process module trong Arena",
    processName: row.processName,
    arenaModule: row.arenaModule,
    maKH: row.maKH,
    loaiKH: row.loaiKH,
    cuaVao: row.cuaVao,
    quay: row.quay,
    processDurationS: toNumberOrBlank(row.processDurationS),
  }));
}
function makeProcessWideIA(rows: ProcessSummaryRow[], value: "duration" | "interarrival") {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    if (row.status !== "OK") continue;
    const raw = value === "duration" ? row.processDurationS : row.processInterarrivalS;
    if (raw === "") continue;
    if (!grouped.has(row.processName)) grouped.set(row.processName, []);
    grouped.get(row.processName)!.push(Number(raw));
  }
  const keys = ARENA_PROCESS_NAMES.filter((key) => grouped.has(key));
  const maxLength = Math.max(0, ...keys.map((key) => grouped.get(key)!.length));
  const result: Record<string, number | "">[] = [];
  for (let i = 0; i < maxLength; i++) {
    const obj: Record<string, number | ""> = {};
    for (const key of keys) obj[key] = grouped.get(key)?.[i] ?? "";
    result.push(obj);
  }
  return result.length ? result : [{ ghiChu: "Chưa có đủ dữ liệu process hợp lệ" } as unknown as Record<string, number | "">];
}
function summarizeDecisionPercent(decisionLog: DecisionRow[]) {
  const grouped = new Map<string, DecisionRow[]>();
  for (const row of decisionLog) {
    if (!grouped.has(row.decisionName)) grouped.set(row.decisionName, []);
    grouped.get(row.decisionName)!.push(row);
  }
  const result: Record<string, unknown>[] = [];
  grouped.forEach((rows, decisionName) => {
    const typedName = decisionName as DecisionName;
    const total = rows.length;
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.optionSelected, (counts.get(row.optionSelected) || 0) + 1);
    getDecisionOptions(typedName).forEach((option, index) => {
      const count = counts.get(option) || 0;
      result.push({ decisionName, arenaMode: getDecisionMode(typedName), branchOrder: index + 1, optionSelected: option, arenaBranchNote: getArenaBranchNote(typedName, option), count, total, percent: total ? Number(((count / total) * 100).toFixed(2)) : 0 });
    });
  });
  return result.length ? result : [{ ghiChu: "Chưa có dữ liệu Decision_Log" }];
}
function summarizeQueueChoice(decisionLog: DecisionRow[]) {
  const rows = decisionLog.filter((r) => r.decisionName.startsWith("Can I pay now"));
  if (!rows.length) return [{ ghiChu: "Chưa có dữ liệu chọn quầy thanh toán" }];
  return rows.map((r) => {
    const shortest = getShortestQueueCounter(r.q1Length, r.q2Length, r.q3Length);
    return { maKH: r.maKH, thoiGian: formatDateTimeVNms(r.thoiGian), decisionName: r.decisionName, q1Length: r.q1Length, q2Length: r.q2Length, q3Length: r.q3Length, chosenCounter: r.chosenCounter, shortestQueueCounter: shortest, choseShortestQueue: shortest && r.chosenCounter ? shortest === r.chosenCounter : "", ghiChu: r.ghiChu, nguoiBam: r.nguoiBam };
  });
}
function autoFitColumns(ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  ws["!cols"] = keys.map((key) => ({ wch: Math.min(Math.max(key.length + 2, ...rows.map((row) => String(row[key] ?? "").length + 2), 12), 45) }));
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
  const [q1Length, setQ1Length] = useState<number | "">("");
  const [q2Length, setQ2Length] = useState<number | "">("");
  const [q3Length, setQ3Length] = useState<number | "">("");
  const [selectedProcessName, setSelectedProcessName] = useState<ProcessName>("customer selects items");
  const [activeProcessRunId, setActiveProcessRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const currentFlow = useMemo(() => (loaiKH ? getFlow(loaiKH) : []), [loaiKH]);
  const validCounters = useMemo(() => (loaiKH ? getValidCounters(loaiKH) : ALL_COUNTERS), [loaiKH]);
  const currentCustomerEvents = useMemo(() => eventLog.filter((row) => row.maKH === currentMaKH).sort(sortEventsAsc), [eventLog, currentMaKH]);
  const currentExpectedEvents = useMemo(() => {
    if (!loaiKH) return [];
    const expected = new Set(currentFlow.map((step) => step.code));
    return currentCustomerEvents.filter((row) => expected.has(row.suKien));
  }, [currentCustomerEvents, currentFlow, loaiKH]);
  const nextStepIndex = currentExpectedEvents.length;
  const nextStep = currentFlow[nextStepIndex];
  const isCurrentDone = Boolean(loaiKH && currentFlow.length > 0 && nextStepIndex >= currentFlow.length);
  const selectedDecisionOptions = getDecisionOptions(selectedDecisionName);
  const isCanPayDecision = selectedDecisionName.startsWith("Can I pay now");

  function upsertEventRow(newRow: EventRow) { setEventLog((prev) => [newRow, ...prev.filter((x) => x.id !== newRow.id)].sort(sortEventsDesc)); }
  function upsertDecisionRow(newRow: DecisionRow) {
    setDecisionLog((prev) => [newRow, ...prev.filter((x) => x.id !== newRow.id)].sort((a, b) => (parseDateTime(b.thoiGian)?.getTime() || 0) - (parseDateTime(a.thoiGian)?.getTime() || 0)));
  }
  function upsertProcessRow(newRow: ProcessLogRow) { setProcessLog((prev) => [newRow, ...prev.filter((x) => x.id !== newRow.id)].sort(sortProcessLogDesc)); }

  async function loadEventLog() {
    setLoading(true);
    const { data, error } = await supabase.from("event_log").select("*").order("thoi_gian", { ascending: false }).order("id", { ascending: false });
    if (error) { alert(`Không tải được event_log: ${error.message}`); setLoading(false); return; }
    setEventLog(((data || []) as DbRow[]).map(mapDbRowToEventRow));
    setLoading(false);
  }
  async function loadDecisionLog() {
    const { data, error } = await supabase.from("decision_log").select("*").order("thoi_gian", { ascending: false }).order("id", { ascending: false });
    if (error) { console.warn(error.message); setDecisionTableReady(false); setDecisionLog([]); return; }
    setDecisionTableReady(true);
    setDecisionLog(((data || []) as DecisionDbRow[]).map(mapDbRowToDecisionRow));
  }
  async function loadProcessLog() {
    const { data, error } = await supabase.from("process_log").select("*").order("thoi_gian", { ascending: false }).order("id", { ascending: false });
    if (error) { console.warn(error.message); setProcessTableReady(false); setProcessLog([]); return; }
    setProcessTableReady(true);
    setProcessLog(((data || []) as ProcessDbRow[]).map(mapDbRowToProcessLogRow));
  }
  function refreshAllData() { loadEventLog(); loadDecisionLog(); loadProcessLog(); }

  useEffect(() => {
    const savedName = localStorage.getItem("emart_ten_nguoi_bam") || "";
    if (savedName) setTenNguoiBam(savedName);
    else {
      const input = window.prompt("Nhập tên người đang bấm giờ:", "") || "";
      if (input.trim()) { localStorage.setItem("emart_ten_nguoi_bam", input.trim()); setTenNguoiBam(input.trim()); }
    }
    const savedDevice = localStorage.getItem("emart_device_id");
    if (savedDevice) setDeviceId(savedDevice);
    else { const newDevice = generateDeviceId(); localStorage.setItem("emart_device_id", newDevice); setDeviceId(newDevice); }
    if (!loadedRef.current) { loadedRef.current = true; refreshAllData(); }

    const channel = supabase.channel("emart-unified-timer-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_log" }, (payload) => upsertEventRow(mapDbRowToEventRow(payload.new as DbRow)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_log" }, (payload) => { const id = (payload.old as { id?: number })?.id; if (id) setEventLog((prev) => prev.filter((x) => x.id !== id)); else loadEventLog(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "decision_log" }, (payload) => upsertDecisionRow(mapDbRowToDecisionRow(payload.new as DecisionDbRow)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "decision_log" }, (payload) => { const id = (payload.old as { id?: number })?.id; if (id) setDecisionLog((prev) => prev.filter((x) => x.id !== id)); else loadDecisionLog(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "process_log" }, (payload) => upsertProcessRow(mapDbRowToProcessLogRow(payload.new as ProcessDbRow)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "process_log" }, (payload) => { const id = (payload.old as { id?: number })?.id; if (id) setProcessLog((prev) => prev.filter((x) => x.id !== id)); else loadProcessLog(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { if (!loaiKH) return; const counters = getValidCounters(loaiKH); if (!counters.includes(quay)) setQuay(counters[0]); }, [loaiKH, quay]);
  useEffect(() => { setSelectedDecisionOption(getDefaultDecisionOption(selectedDecisionName)); }, [selectedDecisionName]);

  function createNewCustomer() {
    if (!deviceId) { alert("Thiết bị chưa sẵn sàng."); return; }
    const newCode = generateCustomerCode(deviceId);
    setCurrentMaKH(newCode);
    setLoaiKH("");
    setGhiChu("");
    setActiveProcessRunId("");
  }

  function chooseCustomerType(selectedType: CustomerType) {
    if (!currentMaKH) createNewCustomer();
    setLoaiKH(selectedType);
    const counters = getValidCounters(selectedType);
    if (!counters.includes(quay)) setQuay(counters[0]);
    setSelectedDecisionName("Chọn loại khách");
    setSelectedDecisionOption(selectedType);
  }

  function selectCustomerToContinue(maKH: string) {
    const rows = eventLog.filter((x) => x.maKH === maKH).sort(sortEventsAsc);
    const lastEvent = rows[rows.length - 1];
    const lastDecision = decisionLog.find((x) => x.maKH === maKH);
    const lastProcess = processLog.find((x) => x.maKH === maKH);
    setCurrentMaKH(maKH);
    if (lastEvent) {
      setLoaiKH(lastEvent.loaiKH);
      setCuaVao(lastEvent.cuaVao === "Không ghi nhận" ? "Entrance 1" : lastEvent.cuaVao);
      setQuay(lastEvent.quay);
      setNhanVien(lastEvent.nhanVien || "NV1");
      setGhiChu(lastEvent.ghiChu || "");
      return;
    }
    setLoaiKH((lastDecision?.loaiKH || lastProcess?.loaiKH || "") as CustomerType | "");
    setCuaVao((lastDecision?.cuaVao || lastProcess?.cuaVao || "Entrance 1") as RecordableEntrance);
    setGhiChu(lastDecision?.ghiChu || lastProcess?.ghiChu || "");
  }

  async function addNextEvent() {
    if (!currentMaKH) { alert("Hãy bấm Tạo khách mới trước."); return; }
    if (!loaiKH) { alert("Hãy chọn loại khách trước khi bấm mốc thời gian chính."); return; }
    if (!nextStep) { alert("Khách này đã đủ các mốc thời gian chính."); return; }
    if (!tenNguoiBam.trim()) { alert("Bạn chưa nhập tên người bấm."); return; }
    if (!validCounters.includes(quay)) { alert("Quầy đang chọn không phù hợp với loại khách này."); return; }
    const { data, error } = await supabase.from("event_log").insert({
      ma_kh: currentMaKH,
      loai_kh: loaiKH,
      quy_trinh: buildQuyTrinh(loaiKH, quay, cuaVao),
      su_kien: nextStep.code,
      thoi_gian: new Date().toISOString(),
      nhan_vien: nhanVien.trim() || "NV1",
      quay,
      ghi_chu: buildGhiChu(ghiChu, cuaVao),
      nguoi_bam: tenNguoiBam.trim(),
    }).select("*");
    if (error) { alert(`Lưu Event thất bại: ${error.message}`); return; }
    const inserted = data?.[0] as DbRow | undefined;
    if (inserted) upsertEventRow(mapDbRowToEventRow(inserted));
  }

  async function addDecisionLog() {
    if (!decisionTableReady) { alert("Chưa có bảng decision_log trong Supabase."); return; }
    if (!currentMaKH) { alert("Hãy tạo/chọn mã khách trước khi bấm Decide."); return; }
    if (!tenNguoiBam.trim()) { alert("Bạn chưa nhập tên người bấm."); return; }
    if (isCanPayDecision && (q1Length === "" || q2Length === "" || q3Length === "")) { alert("Với Can I pay now cần nhập đủ Q1, Q2, Q3."); return; }
    const finalOption = selectedDecisionName === "Chọn loại khách" && loaiKH ? loaiKH : selectedDecisionOption;
    const finalChosenCounter = getChosenCounterFromOption(finalOption);
    const { data, error } = await supabase.from("decision_log").insert({
      ma_kh: currentMaKH,
      thoi_gian: new Date().toISOString(),
      cua_vao: cuaVao,
      decision_name: selectedDecisionName,
      option_selected: finalOption,
      loai_kh: loaiKH || null,
      q1_length: isCanPayDecision ? toNullableNumber(q1Length) : null,
      q2_length: isCanPayDecision ? toNullableNumber(q2Length) : null,
      q3_length: isCanPayDecision ? toNullableNumber(q3Length) : null,
      chosen_counter: isCanPayDecision ? finalChosenCounter : null,
      ghi_chu: ghiChu.trim(),
      nguoi_bam: tenNguoiBam.trim(),
    }).select("*");
    if (error) { alert(`Lưu Decision_Log thất bại: ${error.message}`); return; }
    const inserted = data?.[0] as DecisionDbRow | undefined;
    if (inserted) upsertDecisionRow(mapDbRowToDecisionRow(inserted));
  }

  async function addProcessEvent(eventType: ProcessEventType) {
    if (!processTableReady) { alert("Chưa có bảng process_log trong Supabase."); return; }
    if (!currentMaKH) { alert("Hãy tạo/chọn mã khách trước khi bấm Process."); return; }
    if (!tenNguoiBam.trim()) { alert("Bạn chưa nhập tên người bấm."); return; }
    let runId = activeProcessRunId;
    if (eventType === "START") {
      runId = generateProcessRunId(selectedProcessName, deviceId);
      setActiveProcessRunId(runId);
    } else if (!runId) {
      const latestStart = [...processLog]
        .filter((row) => row.maKH === currentMaKH && row.processName === selectedProcessName && row.eventType === "START")
        .sort(sortProcessLogDesc)
        .find((start) => !processLog.some((row) => row.runId === start.runId && row.eventType === "END"));
      runId = latestStart?.runId || "";
    }
    if (!runId) { alert("Chưa có START nào đang chạy cho Process này và mã khách này."); return; }
    const { data, error } = await supabase.from("process_log").insert({
      run_id: runId,
      ma_kh: currentMaKH,
      thoi_gian: new Date().toISOString(),
      process_name: selectedProcessName,
      event_type: eventType,
      cua_vao: cuaVao,
      loai_kh: loaiKH || null,
      quay: loaiKH ? quay : null,
      ghi_chu: ghiChu.trim(),
      nguoi_bam: tenNguoiBam.trim(),
    }).select("*");
    if (error) { alert(`Lưu Process_Log thất bại: ${error.message}`); return; }
    const inserted = data?.[0] as ProcessDbRow | undefined;
    if (inserted) upsertProcessRow(mapDbRowToProcessLogRow(inserted));
    if (eventType === "END") setActiveProcessRunId("");
  }

  async function deleteEventRow(id: number) { if (!confirm("Xóa dòng Event này?")) return; const { error } = await supabase.from("event_log").delete().eq("id", id); if (error) alert(error.message); else setEventLog((prev) => prev.filter((x) => x.id !== id)); }
  async function deleteDecisionRow(id: number) { if (!confirm("Xóa dòng Decision này?")) return; const { error } = await supabase.from("decision_log").delete().eq("id", id); if (error) alert(error.message); else setDecisionLog((prev) => prev.filter((x) => x.id !== id)); }
  async function deleteProcessRow(id: number) { if (!confirm("Xóa dòng Process này?")) return; const { error } = await supabase.from("process_log").delete().eq("id", id); if (error) alert(error.message); else setProcessLog((prev) => prev.filter((x) => x.id !== id)); }

  async function resetCurrentCustomer() {
    if (!currentMaKH) { alert("Chưa có khách hiện tại."); return; }
    if (!confirm(`Xóa toàn bộ Event/Decision/Process của khách ${currentMaKH}?`)) return;
    await supabase.from("event_log").delete().eq("ma_kh", currentMaKH);
    await supabase.from("decision_log").delete().eq("ma_kh", currentMaKH);
    await supabase.from("process_log").delete().eq("ma_kh", currentMaKH);
    setEventLog((prev) => prev.filter((x) => x.maKH !== currentMaKH));
    setDecisionLog((prev) => prev.filter((x) => x.maKH !== currentMaKH));
    setProcessLog((prev) => prev.filter((x) => x.maKH !== currentMaKH));
    createNewCustomer();
  }

  async function clearAllData() {
    if (!confirm("Xóa toàn bộ dữ liệu event_log, decision_log, process_log?")) return;
    await supabase.from("event_log").delete().neq("id", 0);
    await supabase.from("decision_log").delete().neq("id", 0);
    await supabase.from("process_log").delete().neq("id", 0);
    setEventLog([]); setDecisionLog([]); setProcessLog([]); setCurrentMaKH(""); setLoaiKH(""); setGhiChu(""); setActiveProcessRunId("");
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
        if (!step) return undefined;
        return ordered.find((r) => r.suKien === step.code);
      };
      const systemStart = findByRole("SYSTEM_START");
      const queueArrival = findByRole("QUEUE_ARRIVAL");
      const serviceStart = findByRole("SERVICE_START");
      const serviceEnd = findByRole("SERVICE_END");
      const selectProductTimeS = diffSecondsPrecise(systemStart?.thoiGian || "", queueArrival?.thoiGian || "");
      const waitingTimeS = diffSecondsPrecise(queueArrival?.thoiGian || "", serviceStart?.thoiGian || "");
      const serviceTimeS = diffSecondsPrecise(serviceStart?.thoiGian || "", serviceEnd?.thoiGian || "");
      const systemTimeS = diffSecondsPrecise(systemStart?.thoiGian || "", serviceEnd?.thoiGian || "");
      const missingSteps = flow.filter((step) => !ordered.some((r) => r.suKien === step.code)).map((step) => step.shortLabel);
      const timeError = selectProductTimeS === "" || waitingTimeS === "" || serviceTimeS === "" || systemTimeS === "" || Number(serviceTimeS) <= 0;
      const dataStatus: SummaryRow["dataStatus"] = missingSteps.length ? "THIEU_BUOC" : timeError ? "LOI_THOI_GIAN" : "OK";
      result.push({
        stt: stt++, maKH, loaiKH: loai, loaiLabel: getLoaiKhachLabel(loai), cuaVao: firstRow.cuaVao, quyTrinh: lastRow.quyTrinh,
        nhanVien: lastRow.nhanVien, quay: lastRow.quay, ghiChu: lastRow.ghiChu, nguoiBam: lastRow.nguoiBam,
        processKey: getProcessKey(loai, lastRow.quay), createByEntrance: getCreateByEntrance(firstRow.cuaVao), createByType: getCreateByType(loai),
        queueName: getArenaQueue(lastRow.quay), resourceName: getArenaResource(lastRow.quay), expectedSteps: flow.length,
        actualSteps: flow.filter((step) => ordered.some((r) => r.suKien === step.code)).length, dataStatus,
        errorNote: missingSteps.length ? `Thiếu bước: ${missingSteps.join(", ")}` : timeError ? "Kiểm tra mốc thời gian: select/wait/service/system rỗng hoặc sai thứ tự" : "Đủ dữ liệu",
        T_KHACH_VAO: formatDateTimeVNms(systemStart?.thoiGian || ""), T_VAO_HANG: formatDateTimeVNms(queueArrival?.thoiGian || ""),
        T_BAT_DAU_PHUC_VU: formatDateTimeVNms(serviceStart?.thoiGian || ""), T_ROI_QUAY: formatDateTimeVNms(serviceEnd?.thoiGian || ""),
        systemArrivalTime: formatDateTimeVNms(systemStart?.thoiGian || ""), queueArrivalTime: formatDateTimeVNms(queueArrival?.thoiGian || ""),
        serviceStartTime: formatDateTimeVNms(serviceStart?.thoiGian || ""), serviceEndTime: formatDateTimeVNms(serviceEnd?.thoiGian || ""),
        selectProductTimeS, waitingTimeS, serviceTimeS, systemTimeS,
        systemInterarrivalByEntranceS: "", systemInterarrivalByTypeS: "", queueInterarrivalByCounterS: "", queueInterarrivalByProcessS: "",
      });
    });
    addInterarrivalByGroup(result, (r) => r.createByEntrance, (r) => r.systemArrivalTime, "systemInterarrivalByEntranceS");
    addInterarrivalByGroup(result, (r) => r.createByType, (r) => r.systemArrivalTime, "systemInterarrivalByTypeS");
    addInterarrivalByGroup(result, (r) => r.queueName, (r) => r.queueArrivalTime, "queueInterarrivalByCounterS");
    addInterarrivalByGroup(result, (r) => r.processKey, (r) => r.queueArrivalTime, "queueInterarrivalByProcessS");
    return result.sort((a, b) => (parseDateTime(b.systemArrivalTime)?.getTime() || 0) - (parseDateTime(a.systemArrivalTime)?.getTime() || 0));
  }, [eventLog]);

  const processSummaryRows = useMemo(() => buildProcessSummaryRows(processLog), [processLog]);
  const decisionPercentRows = useMemo(() => summarizeDecisionPercent(decisionLog), [decisionLog]);
  const queueChoiceRows = useMemo(() => summarizeQueueChoice(decisionLog), [decisionLog]);
  const processLongIARows = useMemo(() => makeProcessLongIA(processSummaryRows), [processSummaryRows]);
  const processWideDurationRows = useMemo(() => makeProcessWideIA(processSummaryRows, "duration"), [processSummaryRows]);
  const processWideInterarrivalRows = useMemo(() => makeProcessWideIA(processSummaryRows, "interarrival"), [processSummaryRows]);
  const okCount = summaryRows.filter((r) => r.dataStatus === "OK").length;
  const errorCount = summaryRows.length - okCount;
  const processOKCount = processSummaryRows.filter((r) => r.status === "OK").length;
  const activeProcessCount = processSummaryRows.filter((r) => r.status === "DANG_CHAY").length;
  const allCustomerCodes = useMemo(() => Array.from(new Set([...eventLog.map((x) => x.maKH), ...decisionLog.map((x) => x.maKH), ...processLog.map((x) => x.maKH)].filter(Boolean))).sort().reverse(), [eventLog, decisionLog, processLog]);
  const currentCustomerDecisions = useMemo(() => decisionLog.filter((x) => x.maKH === currentMaKH).slice(0, 10), [decisionLog, currentMaKH]);
  const currentCustomerProcesses = useMemo(() => processLog.filter((x) => x.maKH === currentMaKH).slice(0, 10), [processLog, currentMaKH]);
  const selectedProcessActiveRun = useMemo(() => [...processLog].filter((row) => row.maKH === currentMaKH && row.processName === selectedProcessName && row.eventType === "START").sort(sortProcessLogDesc).find((start) => !processLog.some((row) => row.runId === start.runId && row.eventType === "END")), [processLog, currentMaKH, selectedProcessName]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    appendSheet(wb, "Event_Log", [...eventLog].sort(sortEventsAsc).map((r, i) => ({ stt: i + 1, maKH: r.maKH, loaiKH: r.loaiKH, loaiLabel: r.loaiLabel, cuaVao: r.cuaVao, quay: r.quay, nhanVien: r.nhanVien, suKien: r.suKien, suKienLabel: r.suKienLabel, thoiGianISO: r.thoiGian, thoiGianVN_ms: formatDateTimeVNms(r.thoiGian), nguoiBam: r.nguoiBam, ghiChu: r.ghiChu, quyTrinh: r.quyTrinh })));
    appendSheet(wb, "Summary", summaryRows.map((r) => ({ stt: r.stt, maKH: r.maKH, loaiKH: r.loaiKH, loaiLabel: r.loaiLabel, cuaVao: r.cuaVao, quay: r.quay, nhanVien: r.nhanVien, processKey: r.processKey, dataStatus: r.dataStatus, errorNote: r.errorNote, expectedSteps: r.expectedSteps, actualSteps: r.actualSteps, systemArrivalTime: r.systemArrivalTime, queueArrivalTime: r.queueArrivalTime, serviceStartTime: r.serviceStartTime, serviceEndTime: r.serviceEndTime, selectProductTimeS: toNumberOrBlank(r.selectProductTimeS), waitingTimeS: toNumberOrBlank(r.waitingTimeS), serviceTimeS: toNumberOrBlank(r.serviceTimeS), systemTimeS: toNumberOrBlank(r.systemTimeS), systemInterarrivalByEntranceS: toNumberOrBlank(r.systemInterarrivalByEntranceS), systemInterarrivalByTypeS: toNumberOrBlank(r.systemInterarrivalByTypeS), queueInterarrivalByCounterS: toNumberOrBlank(r.queueInterarrivalByCounterS), queueInterarrivalByProcessS: toNumberOrBlank(r.queueInterarrivalByProcessS), ghiChu: r.ghiChu })));
    appendSheet(wb, "Arena_Input_Table", summaryRows.filter((r) => r.dataStatus === "OK").map((r, i) => ({ stt: i + 1, maKH: r.maKH, entityType: r.loaiKH, entityLabel: r.loaiLabel, entrance: r.cuaVao, counter: getCounterCode(r.quay), processKey: r.processKey, arenaCreateByEntrance: r.createByEntrance, arenaCreateByType: r.createByType, arenaQueue: r.queueName, arenaResource: r.resourceName, systemInterarrivalByEntranceS: toNumberOrBlank(r.systemInterarrivalByEntranceS), systemInterarrivalByTypeS: toNumberOrBlank(r.systemInterarrivalByTypeS), selectProductTimeS: toNumberOrBlank(r.selectProductTimeS), waitingTimeS: toNumberOrBlank(r.waitingTimeS), serviceTimeS: toNumberOrBlank(r.serviceTimeS), systemTimeS: toNumberOrBlank(r.systemTimeS) })));
    appendSheet(wb, "Decision_Log", [...decisionLog].sort((a, b) => (parseDateTime(a.thoiGian)?.getTime() || 0) - (parseDateTime(b.thoiGian)?.getTime() || 0)).map((r, i) => ({ stt: i + 1, maKH: r.maKH, thoiGian: formatDateTimeVNms(r.thoiGian), cuaVao: r.cuaVao, decisionName: r.decisionName, optionSelected: r.optionSelected, loaiKH: r.loaiKH, q1Length: r.q1Length, q2Length: r.q2Length, q3Length: r.q3Length, chosenCounter: r.chosenCounter, ghiChu: r.ghiChu, nguoiBam: r.nguoiBam })));
    appendSheet(wb, "Decision_Percent", decisionPercentRows);
    appendSheet(wb, "Arena_Decide_Setup", DECISION_NAMES.flatMap((decisionName) => getDecisionOptions(decisionName).map((option, index) => ({ decisionName, arenaMode: getDecisionMode(decisionName), branchOrder: index + 1, optionSelected: option, arenaBranchNote: getArenaBranchNote(decisionName, option) }))));
    appendSheet(wb, "Queue_Choice_Analysis", queueChoiceRows);
    appendSheet(wb, "Process_Log", [...processLog].sort(sortProcessLogAsc).map((r, i) => ({ stt: i + 1, id: r.id, runId: r.runId, maKH: r.maKH, processName: r.processName, eventType: r.eventType, thoiGian: formatDateTimeVNms(r.thoiGian), cuaVao: r.cuaVao, loaiKH: r.loaiKH, quay: r.quay, ghiChu: r.ghiChu, nguoiBam: r.nguoiBam })));
    appendSheet(wb, "Process_Summary", processSummaryRows.map((r, i) => ({ stt: i + 1, runId: r.runId, maKH: r.maKH, arenaModule: r.arenaModule, processName: r.processName, cuaVao: r.cuaVao, loaiKH: r.loaiKH, quay: r.quay, startTime: r.startTime, endTime: r.endTime, processDurationS: toNumberOrBlank(r.processDurationS), processInterarrivalS: toNumberOrBlank(r.processInterarrivalS), status: r.status, errorNote: r.errorNote, nguoiBam: r.nguoiBam, ghiChu: r.ghiChu })));
    appendSheet(wb, "IA_All_Process_Long", processLongIARows);
    appendSheet(wb, "IA_All_Process_Wide", processWideDurationRows);
    appendSheet(wb, "IA_Process_IArr_Wide", processWideInterarrivalRows);
    appendSheet(wb, "IA_Create_Entrance_Long", makeLongIA(summaryRows, "systemInterarrivalByEntranceS", "createByEntrance", "Interarrival theo Create/Entrance"));
    appendSheet(wb, "IA_Create_Type_Long", makeLongIA(summaryRows, "systemInterarrivalByTypeS", "createByType", "Interarrival theo loại khách"));
    appendSheet(wb, "IA_Select_Long", makeLongIA(summaryRows, "selectProductTimeS", "processKey", "Select product time"));
    appendSheet(wb, "IA_Waiting_Long", makeLongIA(summaryRows, "waitingTimeS", "queueName", "Waiting time"));
    appendSheet(wb, "IA_Service_Long", makeLongIA(summaryRows, "serviceTimeS", "processKey", "Service time theo process"));
    appendSheet(wb, "IA_Create_Entrance_Wide", makeWideIA(summaryRows, (r) => r.createByEntrance, (r) => r.systemInterarrivalByEntranceS));
    appendSheet(wb, "IA_Select_Process_Wide", makeWideIA(summaryRows, (r) => r.processKey, (r) => r.selectProductTimeS));
    appendSheet(wb, "IA_Service_Process_Wide", makeWideIA(summaryRows, (r) => r.processKey, (r) => r.serviceTimeS));
    const stamp = formatDateTimeVNms(new Date()).replaceAll("-", "").replaceAll(":", "").replaceAll(" ", "_").replaceAll(".", "");
    XLSX.writeFile(wb, `emart_arena_input_${stamp}.xlsx`);
  }

  return (
    <main style={{ minHeight: "100vh", background: palette.bg, color: palette.text, padding: 16 }}>
      <section style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>Bấm giờ Emart cho Arena</h1>
              <p style={{ margin: "6px 0 0", color: palette.sub }}>Gộp Process + Decide + Event theo cùng một mã khách.</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={refreshAllData} style={secondaryButtonStyle}>{loading ? "Đang tải..." : "Tải lại"}</button>
              <button onClick={exportExcel} style={primaryButtonStyle}>Xuất Excel Input Analyzer</button>
              <button onClick={clearAllData} style={dangerButtonStyle}>Xóa toàn bộ</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 14 }}>
            <InfoBox label="Tổng khách có Event" value={String(summaryRows.length)} />
            <InfoBox label="Đủ dữ liệu" value={String(okCount)} tone="green" />
            <InfoBox label="Cần kiểm tra" value={String(errorCount)} tone={errorCount ? "red" : "green"} />
            <InfoBox label="Decision" value={String(decisionLog.length)} />
            <InfoBox label="Process OK" value={`${processOKCount}/${processSummaryRows.length}`} />
            <InfoBox label="Process đang chạy" value={String(activeProcessCount)} tone={activeProcessCount ? "red" : "green"} />
            <InfoBox label="Thiết bị" value={deviceId || "Đang tạo..."} />
          </div>
        </header>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>1. Khách hiện tại</h2>
          <div style={gridFormStyle}>
            <Field label="Mã khách hiện tại">
              <input value={currentMaKH} readOnly placeholder="Chưa tạo khách" style={inputStyle} />
            </Field>
            <Field label="Chọn lại khách đã có">
              <select value={currentMaKH} onChange={(e) => selectCustomerToContinue(e.target.value)} style={inputStyle}>
                <option value="">-- Chọn mã khách --</option>
                {allCustomerCodes.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </Field>
            <Field label="Cửa vào">
              <select value={cuaVao} onChange={(e) => setCuaVao(e.target.value as RecordableEntrance)} style={inputStyle}>{ENTRANCES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            </Field>
            <Field label="Người bấm">
              <input value={tenNguoiBam} onChange={(e) => { setTenNguoiBam(e.target.value); localStorage.setItem("emart_ten_nguoi_bam", e.target.value); }} style={inputStyle} />
            </Field>
            <Field label="Nhân viên / người phục vụ">
              <input value={nhanVien} onChange={(e) => setNhanVien(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Ghi chú chung">
              <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ví dụ: khách đi nhanh, quầy đông..." style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button onClick={createNewCustomer} style={primaryButtonStyle}>+ Tạo khách mới</button>
            <button onClick={resetCurrentCustomer} style={dangerButtonStyle}>Xóa khách hiện tại</button>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>2. Chọn loại khách / món chính</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            {CUSTOMER_TYPES.map((item) => {
              const active = loaiKH === item.code;
              return <button key={item.code} onClick={() => chooseCustomerType(item.code)} style={{ ...typeButtonStyle, borderColor: active ? palette.blue : palette.line, background: active ? palette.blueSoft : palette.card }}>
                <b>{item.label}</b><span>{item.code}</span><small>{item.hint}</small>
              </button>;
            })}
          </div>
          <div style={gridFormStyle}>
            <Field label="Quầy áp dụng">
              <select value={quay} onChange={(e) => setQuay(e.target.value as CounterType)} style={inputStyle}>{validCounters.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            </Field>
            <Field label="Loại đang chọn">
              <input value={loaiKH ? getLoaiKhachLabel(loaiKH) : "Chưa chọn"} readOnly style={inputStyle} />
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>3. Bấm dữ liệu cho khách hiện tại</h2>
          <p style={{ margin: "-4px 0 12px", color: palette.sub, fontSize: 13 }}>
            Gộp mốc thời gian chính, Decide và START/END Process phụ trong cùng một mã khách. Dùng phần này khi quan sát một khách thực tế đi qua khu ăn uống.
          </p>

          {!currentMaKH && <Notice tone="amber">Hãy bấm “+ Tạo khách mới” ở mục 1 trước khi ghi dữ liệu.</Notice>}
          {!loaiKH && <Notice tone="amber">Hãy chọn loại khách ở mục 2 trước khi bấm các mốc chính. Decide và Process phụ vẫn có thể bấm sau khi đã có mã khách.</Notice>}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: 16, alignItems: "start" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12, background: palette.card2 }}>
                <h3 style={subSectionTitleStyle}>3.1. Mốc thời gian chính</h3>
                {loaiKH ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {currentFlow.map((step, idx) => {
                      const done = currentCustomerEvents.some((r) => r.suKien === step.code);
                      const isNext = nextStep?.code === step.code;
                      return (
                        <div
                          key={step.code}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            border: `1px solid ${done ? palette.green : isNext ? palette.blue : palette.line}`,
                            background: done ? palette.greenSoft : isNext ? palette.blueSoft : palette.card,
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <div>
                            <b>{step.label}</b>
                            <div style={{ color: palette.sub, fontSize: 13 }}>{step.code}</div>
                          </div>
                          <span style={{ fontWeight: 800 }}>{done ? "Đã bấm" : isNext ? "Đang chờ bấm" : `Sau bước ${idx}`}</span>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={addNextEvent}
                        disabled={!nextStep || isCurrentDone || !currentMaKH}
                        style={nextStep && currentMaKH ? primaryButtonStyle : disabledButtonStyle}
                      >
                        {nextStep ? `Bấm: ${nextStep.shortLabel}` : "Đã đủ mốc chính"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, color: palette.sub }}>Chưa chọn loại khách nên chưa hiển thị flow mốc chính.</p>
                )}
              </div>

              <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12, background: palette.card2 }}>
                <h3 style={subSectionTitleStyle}>3.2. Decide nếu khách đi qua điểm rẽ / chọn quầy</h3>
                {!decisionTableReady && <Notice tone="red">Chưa có bảng decision_log trong Supabase.</Notice>}
                <div style={gridFormStyle}>
                  <Field label="Tên cục Decide">
                    <select value={selectedDecisionName} onChange={(e) => setSelectedDecisionName(e.target.value as DecisionName)} style={inputStyle}>
                      {DECISION_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </Field>
                  <Field label="Nhánh khách chọn">
                    <select value={selectedDecisionOption} onChange={(e) => setSelectedDecisionOption(e.target.value)} style={inputStyle}>
                      {selectedDecisionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Loại dữ liệu Arena">
                    <input value={getDecisionMode(selectedDecisionName)} readOnly style={inputStyle} />
                  </Field>
                </div>

                {isCanPayDecision && (
                  <div style={gridFormStyle}>
                    <Field label="Q1 đang chờ">
                      <input type="number" min={0} value={q1Length} onChange={(e) => setQ1Length(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle} />
                    </Field>
                    <Field label="Q2 đang chờ">
                      <input type="number" min={0} value={q2Length} onChange={(e) => setQ2Length(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle} />
                    </Field>
                    <Field label="Q3 đang chờ">
                      <input type="number" min={0} value={q3Length} onChange={(e) => setQ3Length(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle} />
                    </Field>
                    <Field label="Quầy ngắn nhất">
                      <input value={getShortestQueueCounter(q1Length, q2Length, q3Length) || "Chưa đủ dữ liệu"} readOnly style={inputStyle} />
                    </Field>
                  </div>
                )}

                <button onClick={addDecisionLog} disabled={!currentMaKH} style={currentMaKH ? primaryButtonStyle : disabledButtonStyle}>
                  Lưu Decide cho mã khách này
                </button>
              </div>

              <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12, background: palette.card2 }}>
                <h3 style={subSectionTitleStyle}>3.3. START/END Process phụ</h3>
                {!processTableReady && <Notice tone="red">Chưa có bảng process_log trong Supabase.</Notice>}
                <div style={gridFormStyle}>
                  <Field label="Process module">
                    <select value={selectedProcessName} onChange={(e) => { setSelectedProcessName(e.target.value as ProcessName); setActiveProcessRunId(""); }} style={inputStyle}>
                      {ARENA_PROCESS_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </Field>
                  <Field label="Run đang chạy">
                    <input value={activeProcessRunId || selectedProcessActiveRun?.runId || "Chưa có START"} readOnly style={inputStyle} />
                  </Field>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => addProcessEvent("START")} disabled={!currentMaKH} style={currentMaKH ? primaryButtonStyle : disabledButtonStyle}>
                    START Process
                  </button>
                  <button onClick={() => addProcessEvent("END")} disabled={!currentMaKH} style={currentMaKH ? secondaryButtonStyle : disabledButtonStyle}>
                    END Process
                  </button>
                </div>
              </div>
            </div>

            <aside style={{ display: "grid", gap: 12 }}>
              <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12, background: palette.card2 }}>
                <h3 style={subSectionTitleStyle}>Dữ liệu của khách hiện tại</h3>
                <p style={{ margin: "0 0 8px", color: palette.sub, fontSize: 13 }}>
                  Mã khách: <b style={{ color: palette.text }}>{currentMaKH || "Chưa tạo"}</b>
                </p>
                <SimpleTable rows={currentCustomerEvents} columns={["thoiGian", "suKien", "loaiKH"]} formatTime />
              </div>

              <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12, background: palette.card2 }}>
                <h3 style={subSectionTitleStyle}>Decision đã bấm</h3>
                <SimpleTable rows={currentCustomerDecisions} columns={["thoiGian", "decisionName", "optionSelected", "chosenCounter"]} formatTime />
              </div>

              <div style={{ border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12, background: palette.card2 }}>
                <h3 style={subSectionTitleStyle}>Process phụ đã bấm</h3>
                <SimpleTable rows={currentCustomerProcesses} columns={["thoiGian", "processName", "eventType", "runId"]} formatTime />
              </div>
            </aside>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>4. Summary khách</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}><thead><tr style={{ background: palette.card2 }}>{["Mã KH", "Loại", "Cửa", "Quầy", "Select(s)", "Wait(s)", "Service(s)", "System(s)", "Status", "Xóa"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>{summaryRows.slice(0, 80).map((r) => <tr key={r.maKH}>
                <td style={tdStyle}><button onClick={() => selectCustomerToContinue(r.maKH)} style={linkButtonStyle}>{r.maKH}</button></td>
                <td style={tdStyle}>{r.loaiLabel}</td><td style={tdStyle}>{r.cuaVao}</td><td style={tdStyle}>{getCounterCode(r.quay)}</td>
                <td style={tdStyle}>{toNumberOrBlank(r.selectProductTimeS)}</td><td style={tdStyle}>{toNumberOrBlank(r.waitingTimeS)}</td><td style={tdStyle}>{toNumberOrBlank(r.serviceTimeS)}</td><td style={tdStyle}>{toNumberOrBlank(r.systemTimeS)}</td>
                <td style={{ ...tdStyle, color: r.dataStatus === "OK" ? palette.green : palette.red, fontWeight: 800 }} title={r.errorNote}>{r.dataStatus}</td>
                <td style={tdStyle}><button onClick={() => { setCurrentMaKH(r.maKH); setTimeout(resetCurrentCustomer, 0); }} style={dangerButtonStyle}>Xóa</button></td>
              </tr>)}</tbody></table>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>5. Log gần nhất</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 16 }}>
            <LogTable title="Event_Log" rows={eventLog.slice(0, 20)} columns={["thoiGian", "maKH", "suKien", "loaiKH"]} onDelete={(id) => deleteEventRow(id)} />
            <LogTable title="Decision_Log" rows={decisionLog.slice(0, 20)} columns={["thoiGian", "maKH", "decisionName", "optionSelected"]} onDelete={(id) => deleteDecisionRow(id)} />
            <LogTable title="Process_Log" rows={processLog.slice(0, 20)} columns={["thoiGian", "maKH", "processName", "eventType"]} onDelete={(id) => deleteProcessRow(id)} />
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}><span>{label}</span>{children}</label>;
}
function InfoBox({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? palette.green : tone === "red" ? palette.red : palette.blue;
  const bg = tone === "green" ? palette.greenSoft : tone === "red" ? palette.redSoft : palette.blueSoft;
  return <div style={{ background: bg, border: `1px solid ${color}`, borderRadius: 12, padding: 10 }}><div style={{ color: palette.sub, fontSize: 12, fontWeight: 700 }}>{label}</div><div style={{ color, fontSize: 20, fontWeight: 900 }}>{value}</div></div>;
}
function Notice({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  const color = tone === "red" ? palette.red : palette.amber;
  const bg = tone === "red" ? palette.redSoft : palette.amberSoft;
  return <div style={{ background: bg, color, border: `1px solid ${color}`, borderRadius: 12, padding: 10, marginBottom: 12, fontWeight: 800 }}>{children}</div>;
}
function SimpleTable({ rows, columns, formatTime }: { rows: Record<string, unknown>[]; columns: string[]; formatTime?: boolean }) {
  if (!rows.length) return <p style={{ color: palette.sub, fontSize: 13 }}>Chưa có dữ liệu cho khách hiện tại.</p>;
  return <div style={{ overflowX: "auto", marginTop: 12 }}><table style={tableStyle}><thead><tr style={{ background: palette.card2 }}>{columns.map((c) => <th key={c} style={thStyle}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id || i)}>{columns.map((c) => <td key={c} style={tdStyle}>{formatTime && c === "thoiGian" ? formatDateTimeVNms(String(row[c] || "")) : String(row[c] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}
function LogTable({ title, rows, columns, onDelete }: { title: string; rows: Record<string, unknown>[]; columns: string[]; onDelete: (id: number) => void }) {
  return <div><h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{title}</h3><div style={{ overflowX: "auto" }}><table style={tableStyle}><thead><tr style={{ background: palette.card2 }}>{[...columns, "Xóa"].map((c) => <th key={c} style={thStyle}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id || i)}>{columns.map((c) => <td key={c} style={tdStyle}>{c === "thoiGian" ? formatDateTimeVNms(String(row[c] || "")) : String(row[c] ?? "")}</td>)}<td style={tdStyle}><button onClick={() => onDelete(Number(row.id))} style={dangerButtonStyle}>Xóa</button></td></tr>)}</tbody></table></div></div>;
}

const cardStyle: React.CSSProperties = { background: palette.card, border: `1px solid ${palette.line}`, borderRadius: 16, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
const sectionTitleStyle: React.CSSProperties = { margin: "0 0 12px", fontSize: 18 };
const subSectionTitleStyle: React.CSSProperties = { margin: "0 0 10px", fontSize: 16 };
const gridFormStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 12, marginBottom: 12 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${palette.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "white" };
const primaryButtonStyle: React.CSSProperties = { border: "none", background: palette.blue, color: "white", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { border: `1px solid ${palette.blue}`, background: palette.blueSoft, color: palette.blue, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" };
const dangerButtonStyle: React.CSSProperties = { border: `1px solid ${palette.red}`, background: palette.redSoft, color: palette.red, borderRadius: 10, padding: "8px 12px", fontWeight: 800, cursor: "pointer" };
const disabledButtonStyle: React.CSSProperties = { border: `1px solid ${palette.line}`, background: palette.card2, color: palette.sub, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "not-allowed" };
const typeButtonStyle: React.CSSProperties = { display: "grid", gap: 6, textAlign: "left", border: `1px solid ${palette.line}`, borderRadius: 14, padding: 12, cursor: "pointer", color: palette.text };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: `1px solid ${palette.line}`, padding: 8, whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { borderBottom: `1px solid ${palette.line}`, padding: 8, verticalAlign: "top", whiteSpace: "nowrap" };
const linkButtonStyle: React.CSSProperties = { border: "none", background: "transparent", color: palette.blue, fontWeight: 800, cursor: "pointer", padding: 0 };
