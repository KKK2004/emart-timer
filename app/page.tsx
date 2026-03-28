import { supabase } from "@/lib/supabase";

"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type CustomerType = "SAN" | "CHUAN" | "PIZZA" | "PIZZA_COMBO";

type EventName =
  | "CAM_DO_AN"
  | "VAO_HANG_THANH_TOAN"
  | "NV_BAT_DAU_CAM_MON_TINH_TIEN"
  | "NHAN_MON_ROI_QUAY"
  | "NV_DUA_THE_ORDER"
  | "VAO_HANG_THANH_TOAN_CHUAN"
  | "NV_BAT_DAU_CAM_PHIEU_TINH_TIEN"
  | "NHAN_MON_ROI_HANG"
  | "VAO_HANG_ORDER_PIZZA"
  | "NV_BAT_DAU_NHAN_ORDER_PIZZA_TINH_TIEN"
  | "NHAN_PIZZA_ROI_HANG"
  | "CAM_MON_KHAC_VAO_HANG_PIZZA"
  | "NV_BAT_DAU_ORDER_PIZZA_TINH_TIEN_TOAN_BO"
  | "NHAN_PIZZA_MON_DA_THANH_TOAN_ROI_HANG";

type EventRow = {
  id: number;
  maKH: string;
  loaiKH: CustomerType;
  suKien: EventName;
  thoiGian: string;
  nhanVien: string;
  quay: string;
  ghiChu: string;
};

type SummaryRow = {
  stt: number;
  maKH: string;
  loaiKH: string;
  nhanVien: string;
  quay: string;
  ghiChu: string;

  soBuoc: number;

  buoc1Label: string;
  buoc2Label: string;
  buoc3Label: string;
  buoc4Label: string;

  T_B1: string;
  T_B2: string;
  T_B3: string;
  T_B4: string;

  thoiGianDenHeThong: string;
  batDauXepHang: string;
  batDauPhucVu: string;
  ketThucPhucVuRoiHeThong: string;

  interarrivalTimeGiay: number | "";
  waitingTimeGiay: number | "";
  serviceTimeGiay: number | "";
  systemTimeGiay: number | "";
};

const STORAGE_KEY = "emart_timer_event_log";
const COUNTER_KEY = "emart_timer_customer_counter";
const CURRENT_KEY = "emart_timer_current_customer";
const CURRENT_TYPE_KEY = "emart_timer_current_type";

async function loadEventLog() {
  const { data, error } = await supabase
    .from("event_log")
    .select("*")
    .order("thoi_gian", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    const mapped = data.map((row: any) => ({
      id: row.id,
      maKH: row.ma_kh,
      loaiKH: row.loai_kh,
      suKien: row.su_kien,
      thoiGian: row.thoi_gian
        ? new Date(row.thoi_gian).toLocaleString("sv-SE").replace("T", " ")
        : "",
      nhanVien: row.nhan_vien,
      quay: row.quay,
      ghiChu: row.ghi_chu || "",
    }));

    setEventLog(mapped);
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function nowString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function parseDateTime(value: string): Date | null {
  if (!value) return null;

  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
  );
  if (!m) return null;

  const [, y, mo, d, h, mi, s] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  );
}

function diffSeconds(start: string, end: string): number | "" {
  const s = parseDateTime(start);
  const e = parseDateTime(end);
  if (!s || !e) return "";
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 1000));
}

function formatCustomerCode(n: number) {
  return `KH${String(n).padStart(3, "0")}`;
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
    default:
      return "";
  }
}

function getFlow(loai: CustomerType) {
  switch (loai) {
    case "SAN":
      return [
        { code: "CAM_DO_AN" as EventName, label: "Khách cầm đồ ăn" },
        {
          code: "VAO_HANG_THANH_TOAN" as EventName,
          label: "Khách đứng vào hàng đợi thanh toán",
        },
        {
          code: "NV_BAT_DAU_CAM_MON_TINH_TIEN" as EventName,
          label: "Nhân viên bắt đầu cầm món / tính tiền",
        },
        {
          code: "NHAN_MON_ROI_QUAY" as EventName,
          label: "Khách nhận món và rời quầy",
        },
      ];

    case "CHUAN":
      return [
        {
          code: "NV_DUA_THE_ORDER" as EventName,
          label: "Nhân viên đưa thẻ / phiếu order",
        },
        {
          code: "VAO_HANG_THANH_TOAN_CHUAN" as EventName,
          label: "Khách đứng vào hàng đợi thanh toán",
        },
        {
          code: "NV_BAT_DAU_CAM_PHIEU_TINH_TIEN" as EventName,
          label: "Nhân viên bắt đầu cầm phiếu / tính tiền",
        },
        {
          code: "NHAN_MON_ROI_HANG" as EventName,
          label: "Khách nhận món và rời hàng",
        },
      ];

    case "PIZZA":
      return [
        {
          code: "VAO_HANG_ORDER_PIZZA" as EventName,
          label: "Khách đứng vào hàng đợi order",
        },
        {
          code: "NV_BAT_DAU_NHAN_ORDER_PIZZA_TINH_TIEN" as EventName,
          label: "Nhân viên bắt đầu nhận order / tính tiền",
        },
        {
          code: "NHAN_PIZZA_ROI_HANG" as EventName,
          label: "Khách nhận pizza và rời hàng",
        },
      ];

    case "PIZZA_COMBO":
      return [
        {
          code: "CAM_MON_KHAC_VAO_HANG_PIZZA" as EventName,
          label: "Khách cầm món khác và đứng vào hàng đợi quầy pizza",
        },
        {
          code: "NV_BAT_DAU_ORDER_PIZZA_TINH_TIEN_TOAN_BO" as EventName,
          label: "Nhân viên bắt đầu nhận order pizza và tính tiền toàn bộ đơn",
        },
        {
          code: "NHAN_PIZZA_MON_DA_THANH_TOAN_ROI_HANG" as EventName,
          label: "Khách nhận pizza cùng các món đã thanh toán và rời hàng",
        },
      ];

    default:
      return [];
  }
}

function getArrivalEvent(loai: CustomerType): EventName {
  switch (loai) {
    case "SAN":
      return "VAO_HANG_THANH_TOAN";
    case "CHUAN":
      return "VAO_HANG_THANH_TOAN_CHUAN";
    case "PIZZA":
      return "VAO_HANG_ORDER_PIZZA";
    case "PIZZA_COMBO":
      return "CAM_MON_KHAC_VAO_HANG_PIZZA";
  }
}

function getServiceStartEvent(loai: CustomerType): EventName {
  switch (loai) {
    case "SAN":
      return "NV_BAT_DAU_CAM_MON_TINH_TIEN";
    case "CHUAN":
      return "NV_BAT_DAU_CAM_PHIEU_TINH_TIEN";
    case "PIZZA":
      return "NV_BAT_DAU_NHAN_ORDER_PIZZA_TINH_TIEN";
    case "PIZZA_COMBO":
      return "NV_BAT_DAU_ORDER_PIZZA_TINH_TIEN_TOAN_BO";
  }
}

function getSystemStartEvent(loai: CustomerType): EventName {
  switch (loai) {
    case "SAN":
      return "CAM_DO_AN";
    case "CHUAN":
      return "NV_DUA_THE_ORDER";
    case "PIZZA":
      return "VAO_HANG_ORDER_PIZZA";
    case "PIZZA_COMBO":
      return "CAM_MON_KHAC_VAO_HANG_PIZZA";
  }
}

function getSystemEndEvent(loai: CustomerType): EventName {
  switch (loai) {
    case "SAN":
      return "NHAN_MON_ROI_QUAY";
    case "CHUAN":
      return "NHAN_MON_ROI_HANG";
    case "PIZZA":
      return "NHAN_PIZZA_ROI_HANG";
    case "PIZZA_COMBO":
      return "NHAN_PIZZA_MON_DA_THANH_TOAN_ROI_HANG";
  }
}

export default function Page() {
  const [customerCounter, setCustomerCounter] = useState<number>(1);
  const [currentMaKH, setCurrentMaKH] = useState<string>("");
  const [loaiKH, setLoaiKH] = useState<CustomerType | "">("");
  const [nhanVien, setNhanVien] = useState<string>("NV1");
  const [quay, setQuay] = useState<string>("Q1");
  const [ghiChu, setGhiChu] = useState<string>("");
  const [eventLog, setEventLog] = useState<EventRow[]>([]);

  useEffect(() => {
    const savedLog = localStorage.getItem(STORAGE_KEY);
    const savedCounter = localStorage.getItem(COUNTER_KEY);
    const savedCurrent = localStorage.getItem(CURRENT_KEY);
    const savedType = localStorage.getItem(CURRENT_TYPE_KEY);

    if (savedLog) {
      try {
        const parsed = JSON.parse(savedLog) as EventRow[];
        setEventLog(parsed);
      } catch {
        setEventLog([]);
      }
    }

    if (savedCounter) {
      const n = Number(savedCounter);
      if (!Number.isNaN(n) && n > 0) {
        setCustomerCounter(n);
      }
    }

    if (savedCurrent) {
      setCurrentMaKH(savedCurrent);
    }

    if (
      savedType === "SAN" ||
      savedType === "CHUAN" ||
      savedType === "PIZZA" ||
      savedType === "PIZZA_COMBO"
    ) {
      setLoaiKH(savedType);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventLog));
  }, [eventLog]);

  useEffect(() => {
    localStorage.setItem(COUNTER_KEY, String(customerCounter));
  }, [customerCounter]);

  useEffect(() => {
    localStorage.setItem(CURRENT_KEY, currentMaKH);
  }, [currentMaKH]);

  useEffect(() => {
    localStorage.setItem(CURRENT_TYPE_KEY, loaiKH);
  }, [loaiKH]);

  function startNewCustomer(selectedType: CustomerType) {
    if (currentMaKH) {
      const ok = window.confirm(
        `Bạn đang ở khách ${currentMaKH}. Tạo khách mới sẽ chuyển sang mã tiếp theo. Tiếp tục?`
      );
      if (!ok) return;
    }

    const newCode = formatCustomerCode(customerCounter);
    setLoaiKH(selectedType);
    setCurrentMaKH(newCode);
    setGhiChu("");
    setCustomerCounter((prev) => prev + 1);
  }

  const currentFlow = loaiKH ? getFlow(loaiKH) : [];

  const currentCustomerEvents = eventLog
    .filter((row) => row.maKH === currentMaKH)
    .sort((a, b) => a.thoiGian.localeCompare(b.thoiGian));

  const nextStepIndex = currentCustomerEvents.length;
  const nextExpectedEvent = currentFlow[nextStepIndex]?.code;

  function addEvent(suKien: EventName) {
    if (!currentMaKH || !loaiKH) {
      alert("Bạn phải chọn loại khách trước.");
      return;
    }

    if (suKien !== nextExpectedEvent) {
      alert("Bạn đang bấm sai thứ tự quy trình.");
      return;
    }

    const row: EventRow = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      maKH: currentMaKH,
      loaiKH,
      suKien,
      thoiGian: nowString(),
      nhanVien,
      quay,
      ghiChu,
    };

    setEventLog((prev) => [row, ...prev]);
  }

  function nextCustomer() {
    if (!currentMaKH) {
      alert("Chưa có khách hiện tại.");
      return;
    }

    setCurrentMaKH("");
    setLoaiKH("");
    setGhiChu("");
  }

  function resetCurrentCustomer() {
    if (!currentMaKH) {
      alert("Chưa có khách hiện tại để reset.");
      return;
    }

    const ok = window.confirm(`Xóa toàn bộ log của khách ${currentMaKH}?`);
    if (!ok) return;

    setEventLog((prev) => prev.filter((row) => row.maKH !== currentMaKH));
    setCurrentMaKH("");
    setLoaiKH("");
    setGhiChu("");
  }

  function clearAllData() {
    const ok = window.confirm("Bạn có chắc muốn xóa toàn bộ dữ liệu?");
    if (!ok) return;

    setEventLog([]);
    setCustomerCounter(1);
    setCurrentMaKH("");
    setLoaiKH("");
    setNhanVien("NV1");
    setQuay("Q1");
    setGhiChu("");

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COUNTER_KEY);
    localStorage.removeItem(CURRENT_KEY);
    localStorage.removeItem(CURRENT_TYPE_KEY);
  }

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const grouped = new Map<string, EventRow[]>();
    const sortedOldToNew = [...eventLog].reverse();

    for (const row of sortedOldToNew) {
      if (!grouped.has(row.maKH)) grouped.set(row.maKH, []);
      grouped.get(row.maKH)!.push(row);
    }

    const result: SummaryRow[] = [];
    let stt = 1;

    grouped.forEach((rows, maKH) => {
      const firstRow = rows[0];
      const loai = firstRow.loaiKH;
      const flow = getFlow(loai);

      const findTime = (eventName: EventName) =>
        rows.find((r) => r.suKien === eventName)?.thoiGian || "";

      const heThongStart = findTime(getSystemStartEvent(loai));
      const arrivalQueue = findTime(getArrivalEvent(loai));
      const serviceStart = findTime(getServiceStartEvent(loai));
      const systemEnd = findTime(getSystemEndEvent(loai));

      result.push({
        stt: stt++,
        maKH,
        loaiKH: getLoaiKhachLabel(loai),
        nhanVien: firstRow?.nhanVien || "",
        quay: firstRow?.quay || "",
        ghiChu: firstRow?.ghiChu || "",

        soBuoc: flow.length,

        buoc1Label: flow[0]?.label || "",
        buoc2Label: flow[1]?.label || "",
        buoc3Label: flow[2]?.label || "",
        buoc4Label: flow[3]?.label || "",

        T_B1: flow[0] ? findTime(flow[0].code) : "",
        T_B2: flow[1] ? findTime(flow[1].code) : "",
        T_B3: flow[2] ? findTime(flow[2].code) : "",
        T_B4: flow[3] ? findTime(flow[3].code) : "",

        thoiGianDenHeThong: heThongStart,
        batDauXepHang: arrivalQueue,
        batDauPhucVu: serviceStart,
        ketThucPhucVuRoiHeThong: systemEnd,

        interarrivalTimeGiay: "",
        waitingTimeGiay: diffSeconds(arrivalQueue, serviceStart),
        serviceTimeGiay: diffSeconds(serviceStart, systemEnd),
        systemTimeGiay: diffSeconds(heThongStart, systemEnd),
      });
    });

    const sorted = result.sort((a, b) => a.maKH.localeCompare(b.maKH));

    const arrivalSorted = [...sorted]
      .filter((r) => r.batDauXepHang)
      .sort((a, b) => a.batDauXepHang.localeCompare(b.batDauXepHang));

    for (let i = 0; i < arrivalSorted.length; i++) {
      if (i === 0) {
        arrivalSorted[i].interarrivalTimeGiay = "";
      } else {
        arrivalSorted[i].interarrivalTimeGiay = diffSeconds(
          arrivalSorted[i - 1].batDauXepHang,
          arrivalSorted[i].batDauXepHang
        );
      }
    }

    const interarrivalMap = new Map(
      arrivalSorted.map((r) => [r.maKH, r.interarrivalTimeGiay])
    );

    return sorted.map((row) => ({
      ...row,
      interarrivalTimeGiay: interarrivalMap.get(row.maKH) ?? "",
    }));
  }, [eventLog]);

  function exportEventLogExcel() {
    const rows = [...eventLog].reverse().map((row, idx) => ({
      STT: idx + 1,
      MaKH: row.maKH,
      LoaiKH: getLoaiKhachLabel(row.loaiKH),
      SuKien: row.suKien,
      ThoiGian: parseDateTime(row.thoiGian),
      NhanVien: row.nhanVien,
      Quay: row.quay,
      GhiChu: row.ghiChu,
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      cellDates: true,
      dateNF: "yyyy-mm-dd hh:mm:ss",
    });

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let r = 1; r <= range.e.r; r++) {
      const timeCell = XLSX.utils.encode_cell({ r, c: 4 });
      if (ws[timeCell] && ws[timeCell].v instanceof Date) {
        ws[timeCell].z = "yyyy-mm-dd hh:mm:ss";
      }

      const sttCell = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[sttCell]) ws[sttCell].z = "0";
    }

    ws["!cols"] = [
      { wch: 8 },
      { wch: 10 },
      { wch: 28 },
      { wch: 55 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 25 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EventLog");
    XLSX.writeFileXLSX(wb, "event_log.xlsx", { compression: true });
  }

  function exportSummaryExcel() {
    const rows = summaryRows.map((row) => ({
      STT: row.stt,
      MaKH: row.maKH,
      LoaiKH: row.loaiKH,
      NhanVien: row.nhanVien,
      Quay: row.quay,
      GhiChu: row.ghiChu,
      SoBuoc: row.soBuoc,

      ThoiGianDenHeThong: parseDateTime(row.thoiGianDenHeThong),
      BatDauXepHang: parseDateTime(row.batDauXepHang),
      BatDauPhucVu: parseDateTime(row.batDauPhucVu),
      KetThucPhucVu_RoiHeThong: parseDateTime(row.ketThucPhucVuRoiHeThong),

      InterarrivalTime_Giay:
        row.interarrivalTimeGiay === "" ? "" : row.interarrivalTimeGiay,
      WaitingTime_Giay:
        row.waitingTimeGiay === "" ? "" : row.waitingTimeGiay,
      ServiceTime_Giay:
        row.serviceTimeGiay === "" ? "" : row.serviceTimeGiay,
      SystemTime_Giay:
        row.systemTimeGiay === "" ? "" : row.systemTimeGiay,

      Buoc_1: row.buoc1Label,
      TG_Buoc_1: parseDateTime(row.T_B1),
      Buoc_2: row.buoc2Label,
      TG_Buoc_2: parseDateTime(row.T_B2),
      Buoc_3: row.buoc3Label,
      TG_Buoc_3: parseDateTime(row.T_B3),
      Buoc_4: row.buoc4Label,
      TG_Buoc_4: parseDateTime(row.T_B4),
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      cellDates: true,
      dateNF: "yyyy-mm-dd hh:mm:ss",
    });

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

    for (let r = 1; r <= range.e.r; r++) {
      const numberCols = [0, 6, 11, 12, 13, 14];
      const dateCols = [7, 8, 9, 10, 16, 18, 20, 22];

      for (const c of numberCols) {
        const cell = XLSX.utils.encode_cell({ r, c });
        if (ws[cell] && ws[cell].v !== "") {
          ws[cell].z = "0";
        }
      }

      for (const c of dateCols) {
        const cell = XLSX.utils.encode_cell({ r, c });
        if (ws[cell] && ws[cell].v instanceof Date) {
          ws[cell].z = "yyyy-mm-dd hh:mm:ss";
        }
      }
    }

    ws["!cols"] = [
      { wch: 8 },
      { wch: 10 },
      { wch: 28 },
      { wch: 12 },
      { wch: 10 },
      { wch: 20 },
      { wch: 8 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 40 },
      { wch: 22 },
      { wch: 40 },
      { wch: 22 },
      { wch: 40 },
      { wch: 22 },
      { wch: 40 },
      { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFileXLSX(wb, "summary.xlsx", { compression: true });
  }

  function buttonStyle(disabled = false): React.CSSProperties {
    return {
      padding: 14,
      borderRadius: 10,
      border: "1px solid #d0d7de",
      background: disabled ? "#f3f4f6" : "#ffffff",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 600,
    };
  }

  function typeButtonStyle(active: boolean): React.CSSProperties {
    return {
      padding: 14,
      borderRadius: 10,
      border: active ? "2px solid #2563eb" : "1px solid #d0d7de",
      background: active ? "#dbeafe" : "#ffffff",
      cursor: "pointer",
      fontWeight: 700,
    };
  }

  return (
    <main
      style={{
        maxWidth: 1450,
        margin: "0 auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Web bấm giờ mô phỏng eMart</h1>
      <p style={{ marginBottom: 24 }}>
        Summary đã sửa đúng công thức Interarrival, Waiting, Service, System.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Thông tin khách hiện tại</h2>

          <div style={{ marginBottom: 12 }}>
            <label>Mã khách</label>
            <input
              value={currentMaKH || "Chưa chọn loại khách"}
              readOnly
              style={{
                width: "100%",
                padding: 10,
                marginTop: 4,
                border: "1px solid #ccc",
                borderRadius: 8,
                background: "#f9fafb",
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Loại khách hiện tại</label>
            <input
              value={loaiKH ? getLoaiKhachLabel(loaiKH) : "Chưa chọn"}
              readOnly
              style={{
                width: "100%",
                padding: 10,
                marginTop: 4,
                border: "1px solid #ccc",
                borderRadius: 8,
                background: "#f9fafb",
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Nhân viên</label>
            <select
              value={nhanVien}
              onChange={(e) => setNhanVien(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                marginTop: 4,
                border: "1px solid #ccc",
                borderRadius: 8,
              }}
            >
              <option value="NV1">NV1</option>
              <option value="NV2">NV2</option>
              <option value="NV3">NV3</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Quầy</label>
            <select
              value={quay}
              onChange={(e) => setQuay(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                marginTop: 4,
                border: "1px solid #ccc",
                borderRadius: 8,
              }}
            >
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Pizza">Quầy Pizza</option>
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Ghi chú</label>
            <input
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Ví dụ: áo xanh"
              style={{
                width: "100%",
                padding: 10,
                marginTop: 4,
                border: "1px solid #ccc",
                borderRadius: 8,
              }}
            />
          </div>

          <h3 style={{ marginBottom: 10 }}>Bấm theo đúng thứ tự thực tế</h3>
          {loaiKH ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 10,
              }}
            >
              {currentFlow.map((step, index) => {
                const disabled = !currentMaKH || nextStepIndex !== index;
                return (
                  <button
                    key={step.code}
                    onClick={() => addEvent(step.code)}
                    disabled={disabled}
                    style={buttonStyle(disabled)}
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: 16,
                border: "1px dashed #cbd5e1",
                borderRadius: 10,
                background: "#f8fafc",
              }}
            >
              Hãy chọn loại khách ở phía dưới trước.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
              marginTop: 16,
            }}
          >
            <button onClick={nextCustomer} style={buttonStyle(false)}>
              KHÁCH TIẾP THEO
            </button>
            <button onClick={resetCurrentCustomer} style={buttonStyle(false)}>
              RESET KHÁCH NÀY
            </button>
            <button onClick={clearAllData} style={buttonStyle(false)}>
              XÓA TẤT CẢ
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 16,
            }}
          >
            <button onClick={exportEventLogExcel} style={buttonStyle(false)}>
              XUẤT EVENT LOG XLSX
            </button>
            <button onClick={exportSummaryExcel} style={buttonStyle(false)}>
              XUẤT SUMMARY XLSX
            </button>
          </div>

          <hr style={{ margin: "24px 0" }} />

          <h3 style={{ marginBottom: 10 }}>Chọn loại khách để tạo mã khách mới</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <button
              onClick={() => startNewCustomer("SAN")}
              style={typeButtonStyle(loaiKH === "SAN")}
            >
              ĐỒ ĂN LÀM SẴN
            </button>

            <button
              onClick={() => startNewCustomer("CHUAN")}
              style={typeButtonStyle(loaiKH === "CHUAN")}
            >
              MÓN CẦN ĐẦU BẾP LÀM
            </button>

            <button
              onClick={() => startNewCustomer("PIZZA")}
              style={typeButtonStyle(loaiKH === "PIZZA")}
            >
              PIZZA
            </button>

            <button
              onClick={() => startNewCustomer("PIZZA_COMBO")}
              style={typeButtonStyle(loaiKH === "PIZZA_COMBO")}
            >
              PIZZA KẾT HỢP MÓN KHÁC
            </button>
          </div>
        </section>

        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Summary</h2>
          <div
            style={{
              maxHeight: 420,
              overflow: "auto",
              border: "1px solid #eee",
              borderRadius: 8,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>STT</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>MaKH</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>LoaiKH</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>NhanVien</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>Quay</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>GhiChu</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>SoBuoc</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>DenHT</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>VaoHang</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>BatDauPV</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>RoiHT</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    Interarrival(s)
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    Waiting(s)
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    Service(s)
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    System(s)
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} style={{ padding: 12, textAlign: "center" }}>
                      Chưa có dữ liệu
                    </td>
                  </tr>
                ) : (
                  summaryRows.map((row) => (
                    <tr key={row.maKH}>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.stt}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.maKH}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.loaiKH}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.nhanVien}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.quay}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.ghiChu}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.soBuoc}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.thoiGianDenHeThong}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.batDauXepHang}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.batDauPhucVu}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.ketThucPhucVuRoiHeThong}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.interarrivalTimeGiay}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.waitingTimeGiay}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.serviceTimeGiay}
                      </td>
                      <td style={{ borderBottom: "1px solid #f0f0f0", padding: 6 }}>
                        {row.systemTimeGiay}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
