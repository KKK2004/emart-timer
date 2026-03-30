"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

type CustomerType = "SAN" | "CHUAN" | "PIZZA" | "PIZZA_COMBO" | "NUOC";
type CounterType =
  | "Quầy thanh toán 1 - Khu bánh/pizza"
  | "Quầy thanh toán 2 - Khu nước"
  | "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến";

type EventName =
  | "CAM_DO_AN"
  | "NV_DUA_THE_ORDER"
  | "LAY_NUOC"
  | "VAO_HANG_THANH_TOAN"
  | "VAO_HANG_ORDER_PIZZA"
  | "NV_BAT_DAU_PHUC_VU"
  | "NHAN_HANG_ROI_QUAY";

type EventRow = {
  id: number;
  maKH: string;
  loaiKH: CustomerType;
  quyTrinh: string;
  suKien: EventName;
  thoiGian: string;
  nhanVien: string;
  quay: CounterType;
  ghiChu: string;
  nguoiBam: string;
};

type SummaryRow = {
  stt: number;
  maKH: string;
  loaiKH: string;
  quyTrinh: string;
  nhanVien: string;
  quay: string;
  ghiChu: string;
  nguoiBam: string;

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

  arenaEntityType: string;
  arenaArrivalTime: string;
  arenaInterarrivalS: number | "";
  arenaServiceS: number | "";
  arenaQueue: string;
  arenaResource: string;
  arenaProcessType: string;
};

type ActiveCustomerRow = {
  maKH: string;
  loaiKH: CustomerType;
  loaiLabel: string;
  quay: CounterType;
  nhanVien: string;
  ghiChu: string;
  nguoiBam: string;
  stepIndex: number;
  totalSteps: number;
  nextLabel: string;
  done: boolean;
  rows: EventRow[];
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

  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/
  );
  if (!m) return null;

  const [, y, mo, d, h, mi, s, ms = "0"] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
    Number(ms.padEnd(3, "0"))
  );
}

function formatDateTimeVNms(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
    date.getSeconds()
  )}.${pad3(date.getMilliseconds())}`;
}

function formatEventTime(value: string) {
  const d = parseDateTime(value);
  return d ? formatDateTimeVNms(d) : "";
}

function diffSecondsPrecise(start: string, end: string): number | "" {
  const s = parseDateTime(start);
  const e = parseDateTime(end);
  if (!s || !e) return "";
  return Number(Math.max(0, (e.getTime() - s.getTime()) / 1000).toFixed(3));
}

function generateDeviceId() {
  return `DV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateUniqueCustomerCode(deviceId: string) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mi = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  const ms = pad3(now.getMilliseconds());
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `KH-${yyyy}${mm}${dd}-${hh}${mi}${ss}${ms}-${deviceId}-${randomPart}`;
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
    default:
      return "";
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
      return [
        "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
        "Quầy thanh toán 2 - Khu nước",
      ];
    case "NUOC":
      return [
        "Quầy thanh toán 2 - Khu nước",
        "Quầy thanh toán 1 - Khu bánh/pizza",
        "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
      ];
    default:
      return [
        "Quầy thanh toán 1 - Khu bánh/pizza",
        "Quầy thanh toán 2 - Khu nước",
        "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
      ];
  }
}

function getRecommendedCounter(loai: CustomerType): CounterType {
  switch (loai) {
    case "PIZZA":
    case "PIZZA_COMBO":
      return "Quầy thanh toán 1 - Khu bánh/pizza";
    case "SAN":
    case "CHUAN":
      return "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến";
    case "NUOC":
      return "Quầy thanh toán 2 - Khu nước";
    default:
      return "Quầy thanh toán 2 - Khu nước";
  }
}

function getCounterLabel(quay: CounterType) {
  return quay;
}

function getFlow(loai: CustomerType) {
  switch (loai) {
    case "SAN":
      return [
        { code: "CAM_DO_AN" as EventName, label: "1. Khách cầm đồ ăn" },
        {
          code: "VAO_HANG_THANH_TOAN" as EventName,
          label: "2. Khách vào hàng đợi thanh toán",
        },
        {
          code: "NV_BAT_DAU_PHUC_VU" as EventName,
          label: "3. Nhân viên bắt đầu tính tiền",
        },
        {
          code: "NHAN_HANG_ROI_QUAY" as EventName,
          label: "4. Khách nhận hàng và rời quầy",
        },
      ];
    case "CHUAN":
      return [
        {
          code: "NV_DUA_THE_ORDER" as EventName,
          label: "1. Nhân viên đưa phiếu / thẻ order",
        },
        {
          code: "VAO_HANG_THANH_TOAN" as EventName,
          label: "2. Khách vào hàng đợi thanh toán",
        },
        {
          code: "NV_BAT_DAU_PHUC_VU" as EventName,
          label: "3. Nhân viên bắt đầu tính tiền",
        },
        {
          code: "NHAN_HANG_ROI_QUAY" as EventName,
          label: "4. Khách nhận món và rời quầy",
        },
      ];
    case "PIZZA":
      return [
        {
          code: "VAO_HANG_ORDER_PIZZA" as EventName,
          label: "1. Khách vào hàng đợi order pizza",
        },
        {
          code: "NV_BAT_DAU_PHUC_VU" as EventName,
          label: "2. Nhân viên bắt đầu nhận order / tính tiền",
        },
        {
          code: "NHAN_HANG_ROI_QUAY" as EventName,
          label: "3. Khách nhận pizza và rời quầy",
        },
      ];
    case "PIZZA_COMBO":
      return [
        {
          code: "CAM_DO_AN" as EventName,
          label: "1. Khách cầm món khác và qua quầy pizza",
        },
        {
          code: "VAO_HANG_ORDER_PIZZA" as EventName,
          label: "2. Khách vào hàng order pizza / thanh toán",
        },
        {
          code: "NV_BAT_DAU_PHUC_VU" as EventName,
          label: "3. Nhân viên bắt đầu xử lý toàn bộ đơn",
        },
        {
          code: "NHAN_HANG_ROI_QUAY" as EventName,
          label: "4. Khách nhận đủ món và rời quầy",
        },
      ];
    case "NUOC":
      return [
        { code: "LAY_NUOC" as EventName, label: "1. Khách lấy nước" },
        {
          code: "VAO_HANG_THANH_TOAN" as EventName,
          label: "2. Khách vào hàng đợi thanh toán",
        },
        {
          code: "NV_BAT_DAU_PHUC_VU" as EventName,
          label: "3. Nhân viên bắt đầu tính tiền",
        },
        {
          code: "NHAN_HANG_ROI_QUAY" as EventName,
          label: "4. Khách thanh toán xong và rời quầy",
        },
      ];
    default:
      return [];
  }
}

function isSanAtQ1(loai: CustomerType | "", quay: CounterType) {
  return loai === "SAN" && quay === "Quầy thanh toán 1 - Khu bánh/pizza";
}

function getEffectiveLoaiForSummary(rows: EventRow[]): CustomerType {
  if (rows.some((r) => r.loaiKH === "PIZZA_COMBO")) {
    return "PIZZA_COMBO";
  }
  return rows[rows.length - 1]?.loaiKH || "SAN";
}

function getSummaryFlow(loai: CustomerType, rows: EventRow[]) {
  const hasThanhToanStep = rows.some((r) => r.suKien === "VAO_HANG_THANH_TOAN");
  const hasOrderPizzaStep = rows.some(
    (r) => r.suKien === "VAO_HANG_ORDER_PIZZA"
  );

  if (loai === "PIZZA_COMBO" && hasThanhToanStep && !hasOrderPizzaStep) {
    return [
      { code: "CAM_DO_AN" as EventName, label: "1. Khách cầm đồ ăn" },
      {
        code: "VAO_HANG_THANH_TOAN" as EventName,
        label: "2. Khách vào hàng đợi thanh toán tại quầy 1",
      },
      {
        code: "NV_BAT_DAU_PHUC_VU" as EventName,
        label: "3. Nhân viên bắt đầu tính tiền và xử lý mua kèm pizza",
      },
      {
        code: "NHAN_HANG_ROI_QUAY" as EventName,
        label: "4. Khách nhận đủ món và rời quầy",
      },
    ];
  }

  return getFlow(loai);
}

function getSystemStartEvent(loai: CustomerType): EventName {
  switch (loai) {
    case "SAN":
    case "PIZZA_COMBO":
      return "CAM_DO_AN";
    case "CHUAN":
      return "NV_DUA_THE_ORDER";
    case "PIZZA":
      return "VAO_HANG_ORDER_PIZZA";
    case "NUOC":
      return "LAY_NUOC";
  }
}

function getArrivalEvent(loai: CustomerType): EventName {
  switch (loai) {
    case "PIZZA":
    case "PIZZA_COMBO":
      return "VAO_HANG_ORDER_PIZZA";
    default:
      return "VAO_HANG_THANH_TOAN";
  }
}

function getServiceStartEvent(): EventName {
  return "NV_BAT_DAU_PHUC_VU";
}

function getSystemEndEvent(): EventName {
  return "NHAN_HANG_ROI_QUAY";
}

function getArenaQueue(quay: CounterType) {
  switch (quay) {
    case "Quầy thanh toán 1 - Khu bánh/pizza":
      return "Q_ThanhToan_Q1";
    case "Quầy thanh toán 2 - Khu nước":
      return "Q_ThanhToan_Q2";
    case "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến":
      return "Q_ThanhToan_Q3";
  }
}

function getArenaResource(quay: CounterType) {
  switch (quay) {
    case "Quầy thanh toán 1 - Khu bánh/pizza":
      return "Cashier_Q1";
    case "Quầy thanh toán 2 - Khu nước":
      return "Cashier_Q2";
    case "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến":
      return "Cashier_Q3";
  }
}

function getArenaProcessType(loai: CustomerType, quay: CounterType) {
  if (quay === "Quầy thanh toán 1 - Khu bánh/pizza") return `${loai}_Q1`;
  if (quay === "Quầy thanh toán 2 - Khu nước") return `${loai}_Q2`;
  return `${loai}_Q3`;
}

function getCustomerTypeTheme(loaiLabel: string) {
  switch (loaiLabel) {
    case "ĐỒ ĂN LÀM SẴN":
      return {
        badgeBg: "#dbeafe",
        badgeText: "#1d4ed8",
        cardBorder: "#93c5fd",
        cardBg: "#eff6ff",
      };
    case "MÓN CẦN ĐẦU BẾP LÀM":
      return {
        badgeBg: "#fef3c7",
        badgeText: "#b45309",
        cardBorder: "#fcd34d",
        cardBg: "#fffbeb",
      };
    case "PIZZA":
      return {
        badgeBg: "#fee2e2",
        badgeText: "#b91c1c",
        cardBorder: "#fca5a5",
        cardBg: "#fef2f2",
      };
    case "PIZZA KẾT HỢP MÓN KHÁC":
      return {
        badgeBg: "#ede9fe",
        badgeText: "#6d28d9",
        cardBorder: "#c4b5fd",
        cardBg: "#f5f3ff",
      };
    case "NƯỚC":
      return {
        badgeBg: "#dcfce7",
        badgeText: "#15803d",
        cardBorder: "#86efac",
        cardBg: "#f0fdf4",
      };
    default:
      return {
        badgeBg: "#e5e7eb",
        badgeText: "#374151",
        cardBorder: "#d1d5db",
        cardBg: "#f9fafb",
      };
  }
}

function mapDbRowToEventRow(row: DbRow): EventRow {
  return {
    id: row.id,
    maKH: row.ma_kh,
    loaiKH: row.loai_kh,
    quyTrinh: row.quy_trinh || "",
    suKien: row.su_kien,
    thoiGian: row.thoi_gian,
    nhanVien: row.nhan_vien,
    quay: row.quay,
    ghiChu: row.ghi_chu || "",
    nguoiBam: row.nguoi_bam || "",
  };
}

const palette = {
  bg: "#f6f8fb",
  card: "#ffffff",
  line: "#e5e7eb",
  text: "#111827",
  sub: "#6b7280",
  blue: "#2563eb",
  blueSoft: "#dbeafe",
  greenSoft: "#ecfdf5",
  green: "#059669",
  amberSoft: "#fffbeb",
  amber: "#d97706",
  redSoft: "#fef2f2",
  red: "#dc2626",
};

const ALL_COUNTERS: CounterType[] = [
  "Quầy thanh toán 1 - Khu bánh/pizza",
  "Quầy thanh toán 2 - Khu nước",
  "Quầy thanh toán 3 - Khu đồ ăn sẵn/chế biến",
];

export default function Page() {
  const [currentMaKH, setCurrentMaKH] = useState<string>("");
  const [loaiKH, setLoaiKH] = useState<CustomerType | "">("");
  const [quay, setQuay] = useState<CounterType>("Quầy thanh toán 2 - Khu nước");
  const [nhanVien, setNhanVien] = useState<string>("NV1");
  const [ghiChu, setGhiChu] = useState<string>("");
  const [tenNguoiBam, setTenNguoiBam] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [eventLog, setEventLog] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  function getLiveGhiChu(lastSaved: string) {
    if (currentMaKH && lastSaved !== ghiChu && currentMaKH) {
      return lastSaved;
    }
    return lastSaved;
  }

  function getDisplayGhiChu(maKH: string, savedGhiChu: string) {
    if (maKH === currentMaKH) {
      return ghiChu || savedGhiChu || "";
    }
    return savedGhiChu || "";
  }

  function upsertEventRow(newRow: EventRow) {
    setEventLog((prev) => {
      const idx = prev.findIndex((x) => x.id === newRow.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRow;
        return copy.sort((a, b) => {
          const t =
            new Date(b.thoiGian).getTime() - new Date(a.thoiGian).getTime();
          if (t !== 0) return t;
          return b.id - a.id;
        });
      }

      return [newRow, ...prev].sort((a, b) => {
        const t =
          new Date(b.thoiGian).getTime() - new Date(a.thoiGian).getTime();
        if (t !== 0) return t;
        return b.id - a.id;
      });
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
    const savedName = localStorage.getItem("emart_ten_nguoi_bam");
    if (savedName) {
      setTenNguoiBam(savedName);
    } else {
      const inputName = window.prompt("Nhập tên người đang bấm:", "") || "";
      const finalName = inputName.trim();
      if (finalName) {
        localStorage.setItem("emart_ten_nguoi_bam", finalName);
        setTenNguoiBam(finalName);
      }
    }

    const savedDeviceId = localStorage.getItem("emart_device_id");
    if (savedDeviceId) {
      setDeviceId(savedDeviceId);
    } else {
      const newDeviceId = generateDeviceId();
      localStorage.setItem("emart_device_id", newDeviceId);
      setDeviceId(newDeviceId);
    }

    if (!loadedRef.current) {
      loadedRef.current = true;
      loadEventLog();
    }

    const channel = supabase
      .channel("event-log-live-3counter")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_log" },
        (payload) => {
          const row = mapDbRowToEventRow(payload.new as DbRow);
          upsertEventRow(row);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "event_log" },
        (payload) => {
          const oldRow = payload.old as { id?: number };
          if (oldRow?.id) {
            setEventLog((prev) => prev.filter((x) => x.id !== oldRow.id));
          } else {
            loadEventLog();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (loaiKH) {
      const allowed = getValidCounters(loaiKH);
      if (!allowed.includes(quay)) {
        setQuay(getRecommendedCounter(loaiKH));
      }
    }
  }, [loaiKH, quay]);

  function startNewCustomer(selectedType: CustomerType) {
    if (!deviceId) {
      alert("Thiết bị chưa sẵn sàng, vui lòng thử lại.");
      return;
    }

    const newCode = generateUniqueCustomerCode(deviceId);
    setLoaiKH(selectedType);
    setQuay(getRecommendedCounter(selectedType));
    setCurrentMaKH(newCode);
    setGhiChu("");
  }

  function selectCustomerToContinue(maKH: string) {
    const rows = eventLog
      .filter((x) => x.maKH === maKH)
      .sort((a, b) => {
        const t =
          new Date(a.thoiGian).getTime() - new Date(b.thoiGian).getTime();
        if (t !== 0) return t;
        return a.id - b.id;
      });

    if (rows.length === 0) return;

    const lastRow = rows[rows.length - 1];
    const effectiveLoai = getEffectiveLoaiForSummary(rows);

    setCurrentMaKH(maKH);
    setLoaiKH(effectiveLoai);
    setQuay(lastRow.quay);
    setNhanVien(lastRow.nhanVien || "NV1");
    setGhiChu(lastRow.ghiChu || "");
  }

  const currentFlow = loaiKH ? getFlow(loaiKH) : [];

  const currentCustomerEvents = eventLog
    .filter((row) => row.maKH === currentMaKH)
    .sort((a, b) => {
      const t = new Date(a.thoiGian).getTime() - new Date(b.thoiGian).getTime();
      if (t !== 0) return t;
      return a.id - b.id;
    });

  const nextStepIndex = currentCustomerEvents.length;
  const nextExpectedEvent = currentFlow[nextStepIndex]?.code;
  const validCounters: CounterType[] = loaiKH ? getValidCounters(loaiKH) : ALL_COUNTERS;

  async function addEvent(suKien: EventName, forcedLoaiKH?: CustomerType) {
    if (!currentMaKH || !loaiKH) {
      alert("Bạn phải chọn loại khách trước.");
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

    if (suKien !== nextExpectedEvent) {
      alert("Bạn đang bấm sai thứ tự quy trình.");
      return;
    }

    const finalLoaiKH = forcedLoaiKH || loaiKH;
    const now = new Date();

    const quyTrinhText =
      finalLoaiKH === "PIZZA_COMBO" &&
      loaiKH === "SAN" &&
      quay === "Quầy thanh toán 1 - Khu bánh/pizza"
        ? `ĐỒ ĂN LÀM SẴN MUA KÈM PIZZA - ${quay}`
        : `${getLoaiKhachLabel(finalLoaiKH)} - ${quay}`;

    const { data, error } = await supabase
      .from("event_log")
      .insert({
        ma_kh: currentMaKH,
        loai_kh: finalLoaiKH,
        quy_trinh: quyTrinhText,
        su_kien: suKien,
        thoi_gian: now.toISOString(),
        nhan_vien: nhanVien,
        quay: quay,
        ghi_chu: ghiChu,
        nguoi_bam: tenNguoiBam,
      })
      .select("*");

    if (error) {
      alert(`Lưu dữ liệu thất bại: ${error.message}`);
      return;
    }

    if (forcedLoaiKH) {
      setLoaiKH(forcedLoaiKH);
    }

    const inserted = data?.[0] as DbRow | undefined;
    if (inserted) {
      upsertEventRow(mapDbRowToEventRow(inserted));
    }
  }

  async function resetCurrentCustomer() {
    if (!currentMaKH) {
      alert("Chưa có khách hiện tại để reset.");
      return;
    }

    const ok = window.confirm(`Xóa toàn bộ log của khách ${currentMaKH}?`);
    if (!ok) return;

    const { error } = await supabase
      .from("event_log")
      .delete()
      .eq("ma_kh", currentMaKH);

    if (error) {
      alert(`Xóa dữ liệu thất bại: ${error.message}`);
      return;
    }

    setEventLog((prev) => prev.filter((x) => x.maKH !== currentMaKH));
    setCurrentMaKH("");
    setLoaiKH("");
    setGhiChu("");
  }

  async function clearAllData() {
    const ok = window.confirm("Bạn có chắc muốn xóa toàn bộ dữ liệu?");
    if (!ok) return;

    const { error } = await supabase.from("event_log").delete().neq("id", 0);

    if (error) {
      alert(`Xóa toàn bộ dữ liệu thất bại: ${error.message}`);
      return;
    }

    setEventLog([]);
    setCurrentMaKH("");
    setLoaiKH("");
    setNhanVien("NV1");
    setQuay("Quầy thanh toán 2 - Khu nước");
    setGhiChu("");
  }

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const grouped = new Map<string, EventRow[]>();

    const sortedEvents = [...eventLog].sort((a, b) => {
      const t = new Date(a.thoiGian).getTime() - new Date(b.thoiGian).getTime();
      if (t !== 0) return t;
      return a.id - b.id;
    });

    for (const row of sortedEvents) {
      if (!grouped.has(row.maKH)) grouped.set(row.maKH, []);
      grouped.get(row.maKH)!.push(row);
    }

    const result: SummaryRow[] = [];
    let stt = 1;

    grouped.forEach((rows, maKH) => {
      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];
      const loai = getEffectiveLoaiForSummary(rows);
      const flow = getSummaryFlow(loai, rows);

      const findTime = (eventName: EventName) =>
        rows.find((r) => r.suKien === eventName)?.thoiGian || "";

      const heThongStart = findTime(getSystemStartEvent(loai));
      const arrivalQueue = findTime(getArrivalEvent(loai));
      const serviceStart = findTime(getServiceStartEvent());
      const systemEnd = findTime(getSystemEndEvent());

      result.push({
        stt: stt++,
        maKH,
        loaiKH: getLoaiKhachLabel(loai),
        quyTrinh:
          loai === "PIZZA_COMBO" &&
          firstRow.loaiKH === "SAN" &&
          firstRow.quay === "Quầy thanh toán 1 - Khu bánh/pizza"
            ? `ĐỒ ĂN LÀM SẴN MUA KÈM PIZZA - ${lastRow.quay}`
            : lastRow.quyTrinh || `${getLoaiKhachLabel(loai)} - ${lastRow.quay}`,
        nhanVien: lastRow.nhanVien || "",
        quay: lastRow.quay || "",
        ghiChu: getDisplayGhiChu(maKH, lastRow.ghiChu || ""),
        nguoiBam: lastRow.nguoiBam || "",

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
        waitingTimeGiay: diffSecondsPrecise(arrivalQueue, serviceStart),
        serviceTimeGiay: diffSecondsPrecise(serviceStart, systemEnd),
        systemTimeGiay: diffSecondsPrecise(heThongStart, systemEnd),

        arenaEntityType: loai,
        arenaArrivalTime: arrivalQueue,
        arenaInterarrivalS: "",
        arenaServiceS: diffSecondsPrecise(serviceStart, systemEnd),
        arenaQueue: getArenaQueue(lastRow.quay),
        arenaResource: getArenaResource(lastRow.quay),
        arenaProcessType: getArenaProcessType(loai, lastRow.quay),
      });
    });

    const sorted = result.sort((a, b) => {
      const ta = parseDateTime(a.thoiGianDenHeThong)?.getTime() || 0;
      const tb = parseDateTime(b.thoiGianDenHeThong)?.getTime() || 0;
      if (tb !== ta) return tb - ta;
      return a.maKH.localeCompare(b.maKH);
    });

    const arrivalSorted = [...sorted]
      .filter((r) => r.batDauXepHang)
      .sort((a, b) => {
        const ta = parseDateTime(a.batDauXepHang)?.getTime() || 0;
        const tb = parseDateTime(b.batDauXepHang)?.getTime() || 0;
        if (ta !== tb) return ta - tb;
        return a.maKH.localeCompare(b.maKH);
      });

    for (let i = 0; i < arrivalSorted.length; i++) {
      if (i === 0) {
        arrivalSorted[i].interarrivalTimeGiay = "";
        arrivalSorted[i].arenaInterarrivalS = "";
      } else {
        const ia = diffSecondsPrecise(
          arrivalSorted[i - 1].batDauXepHang,
          arrivalSorted[i].batDauXepHang
        );
        arrivalSorted[i].interarrivalTimeGiay = ia;
        arrivalSorted[i].arenaInterarrivalS = ia;
      }
    }

    const mapBack = new Map(
      arrivalSorted.map((r) => [
        r.maKH,
        {
          interarrival: r.interarrivalTimeGiay,
          arenaInterarrival: r.arenaInterarrivalS,
        },
      ])
    );

    return sorted.map((row) => ({
      ...row,
      interarrivalTimeGiay: mapBack.get(row.maKH)?.interarrival ?? "",
      arenaInterarrivalS: mapBack.get(row.maKH)?.arenaInterarrival ?? "",
    }));
  }, [eventLog, currentMaKH, ghiChu]);

  const activeCustomers = useMemo<ActiveCustomerRow[]>(() => {
    const grouped = new Map<string, EventRow[]>();

    const sortedEvents = [...eventLog].sort((a, b) => {
      const t = new Date(a.thoiGian).getTime() - new Date(b.thoiGian).getTime();
      if (t !== 0) return t;
      return a.id - b.id;
    });

    for (const row of sortedEvents) {
      if (!grouped.has(row.maKH)) grouped.set(row.maKH, []);
      grouped.get(row.maKH)!.push(row);
    }

    const result = Array.from(grouped.entries()).map(([maKH, rows]) => {
      const loai = getEffectiveLoaiForSummary(rows);
      const flow = getSummaryFlow(loai, rows);
      const stepIndex = rows.length;
      const done = stepIndex >= flow.length;
      const lastRow = rows[rows.length - 1];

      return {
        maKH,
        loaiKH: loai,
        loaiLabel: getLoaiKhachLabel(loai),
        quay: lastRow.quay,
        nhanVien: lastRow.nhanVien,
        ghiChu: getDisplayGhiChu(maKH, lastRow.ghiChu || ""),
        nguoiBam: lastRow.nguoiBam,
        stepIndex,
        totalSteps: flow.length,
        nextLabel: done ? "Đã hoàn tất" : flow[stepIndex]?.label || "Đã hoàn tất",
        done,
        rows,
      };
    });

    return result
      .filter((x) => !x.done)
      .sort((a, b) => {
        const ta = parseDateTime(a.rows[a.rows.length - 1].thoiGian)?.getTime() || 0;
        const tb = parseDateTime(b.rows[b.rows.length - 1].thoiGian)?.getTime() || 0;
        return tb - ta;
      });
  }, [eventLog, currentMaKH, ghiChu]);

  function exportSummaryExcel() {
    const rows = summaryRows.map((row) => ({
      STT: row.stt,
      MaKH: row.maKH,
      LoaiKH: row.loaiKH,
      QuyTrinh: row.quyTrinh,
      NhanVien: row.nhanVien,
      Quay: row.quay,
      GhiChu: row.ghiChu,
      NguoiBam: row.nguoiBam,
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

      Arena_EntityType: row.arenaEntityType,
      Arena_ArrivalTime: parseDateTime(row.arenaArrivalTime),
      Arena_Interarrival_s:
        row.arenaInterarrivalS === "" ? "" : row.arenaInterarrivalS,
      Arena_Service_s: row.arenaServiceS === "" ? "" : row.arenaServiceS,
      Arena_Queue: row.arenaQueue,
      Arena_Resource: row.arenaResource,
      Arena_ProcessType: row.arenaProcessType,

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
      dateNF: "yyyy-mm-dd hh:mm:ss.000",
    });

    ws["!cols"] = [
      { wch: 8 },
      { wch: 32 },
      { wch: 24 },
      { wch: 30 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 8 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 36 },
      { wch: 24 },
      { wch: 36 },
      { wch: 24 },
      { wch: 36 },
      { wch: 24 },
      { wch: 36 },
      { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFileXLSX(wb, "summary.xlsx", { compression: true });
  }

  const infoItemStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${palette.line}`,
    background: "#fff",
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: palette.text,
  };

  const buttonStyle = (
    disabled = false,
    tone: "normal" | "danger" | "primary" = "normal"
  ): React.CSSProperties => {
    const styles = {
      normal: {
        background: "#fff",
        border: `1px solid ${palette.line}`,
        color: palette.text,
      },
      danger: {
        background: palette.redSoft,
        border: `1px solid #fecaca`,
        color: palette.red,
      },
      primary: {
        background: palette.blue,
        border: `1px solid ${palette.blue}`,
        color: "#fff",
      },
    };

    return {
      width: "100%",
      padding: "14px 16px",
      borderRadius: 12,
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 700,
      fontSize: 16,
      opacity: disabled ? 0.55 : 1,
      ...styles[tone],
    };
  };

  const typeButtonStyle = (active: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
    border: active ? `2px solid ${palette.blue}` : `1px solid ${palette.line}`,
    background: active ? palette.blueSoft : "#fff",
    color: palette.text,
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: palette.bg,
        padding: 16,
        color: palette.text,
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <section
          style={{
            background: palette.card,
            border: `1px solid ${palette.line}`,
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
              Web bấm giờ mô phỏng ở emart - 3 quầy thanh toán
            </h1>
            <p style={{ margin: "8px 0 0", color: palette.sub }}>
              Tác giả: Bùi Văn Cường
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Khách hiện tại</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {currentMaKH || "Chưa chọn"}
              </div>
            </div>

            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Loại khách</div>
              <div style={{ fontWeight: 700 }}>
                {loaiKH ? getLoaiKhachLabel(loaiKH) : "Chưa chọn"}
              </div>
            </div>

            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Người đang bấm</div>
              <div style={{ fontWeight: 700 }}>
                {tenNguoiBam || "Chưa nhập tên"}
              </div>
            </div>

            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Mã thiết bị</div>
              <div style={{ fontWeight: 700 }}>
                {deviceId || "Đang tạo..."}
              </div>
            </div>

            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Trạng thái tải</div>
              <div
                style={{
                  fontWeight: 700,
                  color: loading ? palette.amber : palette.green,
                }}
              >
                {loading ? "Đang tải..." : "Sẵn sàng"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                const newName =
                  window.prompt("Nhập lại tên người đang bấm:", tenNguoiBam) || "";
                const finalName = newName.trim();
                if (finalName) {
                  localStorage.setItem("emart_ten_nguoi_bam", finalName);
                  setTenNguoiBam(finalName);
                }
              }}
              style={buttonStyle(false)}
            >
              ĐỔI TÊN NGƯỜI BẤM
            </button>
          </div>
        </section>

        <section
          style={{
            background: palette.card,
            border: `1px solid ${palette.line}`,
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={sectionTitleStyle}>Thông tin thao tác</h2>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Nhân viên
              </label>
              <select
                value={nhanVien}
                onChange={(e) => setNhanVien(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${palette.line}`,
                  fontSize: 16,
                  background: "#fff",
                }}
              >
                <option value="NV1">NV1</option>
                <option value="NV2">NV2</option>
                <option value="NV3">NV3</option>
                <option value="NV4">NV4</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Quầy thanh toán
              </label>
              <select
                value={quay}
                onChange={(e) => setQuay(e.target.value as CounterType)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${palette.line}`,
                  fontSize: 16,
                  background: "#fff",
                }}
              >
                {validCounters.map((q) => (
                  <option key={q} value={q}>
                    {getCounterLabel(q)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Ghi chú
              </label>
              <input
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder="Ví dụ: Áo đen (gõ là Summary cập nhật ngay)"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${palette.line}`,
                  fontSize: 16,
                  background: "#fff",
                }}
              />
            </div>
          </div>
        </section>

        <section
          style={{
            background: palette.card,
            border: `1px solid ${palette.line}`,
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={sectionTitleStyle}>Chọn loại khách</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginTop: 12,
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

            <button
              onClick={() => startNewCustomer("NUOC")}
              style={typeButtonStyle(loaiKH === "NUOC")}
            >
              NƯỚC
            </button>
          </div>
        </section>

        <section
          style={{
            background: palette.card,
            border: `1px solid ${palette.line}`,
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={sectionTitleStyle}>Bấm theo đúng thứ tự thực tế</h2>
          <p style={{ margin: "6px 0 12px", color: palette.sub }}>
            Lưu ý: Chọn đúng khách rồi mới bấm bước tiếp theo. Ghi chú gõ tới đâu Summary hiện tới đó.
          </p>

          {loaiKH ? (
            <div style={{ display: "grid", gap: 10 }}>
              {currentFlow.map((step, index) => {
                const disabled = !currentMaKH || nextStepIndex !== index;
                const isSpecialComboChoice =
                  isSanAtQ1(loaiKH, quay) &&
                  step.code === "NV_BAT_DAU_PHUC_VU";

                if (isSpecialComboChoice) {
                  return (
                    <div key={step.code} style={{ display: "grid", gap: 10 }}>
                      <button
                        onClick={() => addEvent(step.code)}
                        disabled={disabled}
                        style={buttonStyle(disabled, disabled ? "normal" : "primary")}
                      >
                        3. Nhân viên bắt đầu tính tiền - KHÔNG mua kèm pizza
                      </button>

                      <button
                        onClick={() => addEvent(step.code, "PIZZA_COMBO")}
                        disabled={disabled}
                        style={buttonStyle(disabled, disabled ? "normal" : "primary")}
                      >
                        3. Nhân viên bắt đầu tính tiền - CÓ mua kèm pizza
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={step.code}
                    onClick={() => addEvent(step.code)}
                    disabled={disabled}
                    style={buttonStyle(disabled, disabled ? "normal" : "primary")}
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: palette.amberSoft,
                border: "1px solid #fde68a",
                color: palette.amber,
                fontWeight: 600,
              }}
            >
              Hãy chọn hoặc chọn lại khách ở phía trên trước.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              marginTop: 14,
            }}
          >
            <button
              onClick={resetCurrentCustomer}
              style={buttonStyle(false, "danger")}
            >
              RESET KHÁCH NÀY
            </button>

            <button
              onClick={clearAllData}
              style={buttonStyle(false, "danger")}
            >
              XÓA TẤT CẢ
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={exportSummaryExcel} style={buttonStyle(false)}>
              XUẤT SUMMARY XLSX
            </button>
          </div>
        </section>

        <section
          style={{
            background: palette.card,
            border: `1px solid ${palette.line}`,
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={sectionTitleStyle}>Danh sách khách đang xử lý</h2>
          <p style={{ margin: "6px 0 14px", color: palette.sub }}>
            Muốn bấm lại giờ cho khách nào thì chọn khách đó ở đây.
          </p>

          <div style={{ display: "grid", gap: 10 }}>
            {activeCustomers.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: `1px dashed ${palette.line}`,
                  color: palette.sub,
                  background: "#fff",
                }}
              >
                Chưa có khách nào đang chờ xử lý tiếp.
              </div>
            ) : (
              activeCustomers.map((customer) => (
                <button
                  key={customer.maKH}
                  onClick={() => selectCustomerToContinue(customer.maKH)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 12,
                    border:
                      currentMaKH === customer.maKH
                        ? `2px solid ${palette.blue}`
                        : `1px solid ${palette.line}`,
                    background:
                      currentMaKH === customer.maKH ? palette.blueSoft : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>
                    {customer.maKH}
                  </div>
                  <div style={{ color: palette.text }}>
                    {customer.loaiLabel} - {customer.quay}
                  </div>
                  <div style={{ color: palette.sub, marginTop: 4 }}>
                    Bước tiếp theo: {customer.nextLabel}
                  </div>
                  <div style={{ color: palette.sub, marginTop: 4 }}>
                    Ghi chú: {customer.ghiChu || "Chưa có"}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section
          style={{
            background: palette.card,
            border: `1px solid ${palette.line}`,
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={sectionTitleStyle}>
            Summary {loading ? "(đang tải...)" : ""}
          </h2>
          <p style={{ margin: "6px 0 14px", color: palette.sub }}>
            Mới bấm sẽ hiện trên đầu nhe
          </p>

          <div style={{ display: "grid", gap: 14 }}>
            {summaryRows.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: `1px dashed ${palette.line}`,
                  color: palette.sub,
                  background: "#fff",
                }}
              >
                Chưa có dữ liệu.
              </div>
            ) : (
              summaryRows.map((row) => {
                const theme = getCustomerTypeTheme(row.loaiKH);

                return (
                  <div
                    key={row.maKH}
                    style={{
                      border: `2px solid ${theme.cardBorder}`,
                      borderRadius: 16,
                      padding: 14,
                      background: theme.cardBg,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 12,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          wordBreak: "break-word",
                        }}
                      >
                        {row.maKH}
                      </div>

                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: theme.badgeBg,
                          color: theme.badgeText,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {row.loaiKH}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <div style={infoItemStyle}>
                        STT khách: <strong>{row.stt}</strong>
                      </div>
                      <div style={infoItemStyle}>
                        Quy trình: <strong>{row.quyTrinh || "Chưa có"}</strong>
                      </div>
                      <div style={infoItemStyle}>
                        Nhân viên: <strong>{row.nhanVien || "Chưa có"}</strong>
                      </div>
                      <div style={infoItemStyle}>
                        Quầy: <strong>{row.quay || "Chưa có"}</strong>
                      </div>
                      <div style={infoItemStyle}>
                        Người bấm: <strong>{row.nguoiBam || "Chưa có"}</strong>
                      </div>
                      <div style={infoItemStyle}>
                        Ghi chú: <strong>{row.ghiChu || "Chưa có"}</strong>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <div
                        style={{
                          border: `1px solid ${palette.line}`,
                          borderRadius: 12,
                          padding: 12,
                          background: "#ffffffcc",
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: 8 }}>
                          Thời gian từng bước
                        </div>

                        <div>
                          {row.buoc1Label || "Bước 1"}:{" "}
                          <strong>
                            {row.T_B1 ? formatEventTime(row.T_B1) : "Chưa có"}
                          </strong>
                        </div>
                        <div>
                          {row.buoc2Label || "Bước 2"}:{" "}
                          <strong>
                            {row.T_B2 ? formatEventTime(row.T_B2) : "Chưa có"}
                          </strong>
                        </div>
                        <div>
                          {row.buoc3Label || "Bước 3"}:{" "}
                          <strong>
                            {row.T_B3 ? formatEventTime(row.T_B3) : "Chưa có"}
                          </strong>
                        </div>
                        <div>
                          {row.buoc4Label || "Bước 4"}:{" "}
                          <strong>
                            {row.T_B4 ? formatEventTime(row.T_B4) : "Chưa có"}
                          </strong>
                        </div>
                      </div>

                      <div
                        style={{
                          border: `1px solid ${palette.line}`,
                          borderRadius: 12,
                          padding: 12,
                          background: "#ffffffcc",
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: 8 }}>
                          Mốc mô phỏng
                        </div>
                        <div>
                          Đến hệ thống:{" "}
                          <strong>
                            {row.thoiGianDenHeThong
                              ? formatEventTime(row.thoiGianDenHeThong)
                              : "Chưa có"}
                          </strong>
                        </div>
                        <div>
                          Bắt đầu xếp hàng:{" "}
                          <strong>
                            {row.batDauXepHang
                              ? formatEventTime(row.batDauXepHang)
                              : "Chưa có"}
                          </strong>
                        </div>
                        <div>
                          Bắt đầu phục vụ:{" "}
                          <strong>
                            {row.batDauPhucVu
                              ? formatEventTime(row.batDauPhucVu)
                              : "Chưa có"}
                          </strong>
                        </div>
                        <div>
                          Rời hệ thống:{" "}
                          <strong>
                            {row.ketThucPhucVuRoiHeThong
                              ? formatEventTime(row.ketThucPhucVuRoiHeThong)
                              : "Chưa có"}
                          </strong>
                        </div>
                      </div>

                      <div
                        style={{
                          border: `1px solid ${palette.line}`,
                          borderRadius: 12,
                          padding: 12,
                          background: "#ffffffcc",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            marginBottom: 8,
                            color: palette.text,
                          }}
                        >
                          Chỉ tiêu thời gian
                        </div>
                        <div>
                          Interarrival(s):{" "}
                          <strong>
                            {row.interarrivalTimeGiay === ""
                              ? "Chưa đủ dữ liệu"
                              : row.interarrivalTimeGiay}
                          </strong>
                        </div>
                        <div>
                          Waiting(s):{" "}
                          <strong>
                            {row.waitingTimeGiay === ""
                              ? "Chưa đủ dữ liệu"
                              : row.waitingTimeGiay}
                          </strong>
                        </div>
                        <div>
                          Service(s):{" "}
                          <strong>
                            {row.serviceTimeGiay === ""
                              ? "Chưa đủ dữ liệu"
                              : row.serviceTimeGiay}
                          </strong>
                        </div>
                        <div>
                          System(s):{" "}
                          <strong>
                            {row.systemTimeGiay === ""
                              ? "Chưa đủ dữ liệu"
                              : row.systemTimeGiay}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
