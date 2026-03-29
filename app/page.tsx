"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

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
  thoiGian: string; // ISO từ DB
  nhanVien: string;
  quay: string;
  ghiChu: string;
  nguoiBam: string;
};

type SummaryRow = {
  stt: number;
  maKH: string;
  loaiKH: string;
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

type DbRow = {
  id: number;
  ma_kh: string;
  loai_kh: CustomerType;
  su_kien: EventName;
  thoi_gian: string;
  nhan_vien: string;
  quay: string;
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
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${pad3(date.getMilliseconds())}`;
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
    default:
      return "";
  }
}

function getFlow(loai: CustomerType) {
  switch (loai) {
    case "SAN":
      return [
        { code: "CAM_DO_AN" as EventName, label: "1. Khách cầm đồ ăn" },
        { code: "VAO_HANG_THANH_TOAN" as EventName, label: "2. Khách đứng vào hàng đợi thanh toán" },
        { code: "NV_BAT_DAU_CAM_MON_TINH_TIEN" as EventName, label: "3. Nhân viên bắt đầu cầm món / tính tiền" },
        { code: "NHAN_MON_ROI_QUAY" as EventName, label: "4. Khách nhận món và rời quầy" },
      ];
    case "CHUAN":
      return [
        { code: "NV_DUA_THE_ORDER" as EventName, label: "1. Nhân viên đưa thẻ / phiếu order" },
        { code: "VAO_HANG_THANH_TOAN_CHUAN" as EventName, label: "2. Khách đứng vào hàng đợi thanh toán" },
        { code: "NV_BAT_DAU_CAM_PHIEU_TINH_TIEN" as EventName, label: "3. Nhân viên bắt đầu cầm phiếu / tính tiền" },
        { code: "NHAN_MON_ROI_HANG" as EventName, label: "4. Khách nhận món và rời hàng" },
      ];
    case "PIZZA":
      return [
        { code: "VAO_HANG_ORDER_PIZZA" as EventName, label: "1. Khách đứng vào hàng đợi order" },
        { code: "NV_BAT_DAU_NHAN_ORDER_PIZZA_TINH_TIEN" as EventName, label: "2. Nhân viên bắt đầu nhận order / tính tiền" },
        { code: "NHAN_PIZZA_ROI_HANG" as EventName, label: "3. Khách nhận pizza và rời hàng" },
      ];
    case "PIZZA_COMBO":
      return [
        { code: "CAM_MON_KHAC_VAO_HANG_PIZZA" as EventName, label: "1. Khách cầm món khác và đứng vào hàng đợi Quầy Thanh Toán 1" },
        { code: "NV_BAT_DAU_ORDER_PIZZA_TINH_TIEN_TOAN_BO" as EventName, label: "2. Nhân viên bắt đầu nhận order pizza và tính tiền toàn bộ đơn" },
        { code: "NHAN_PIZZA_MON_DA_THANH_TOAN_ROI_HANG" as EventName, label: "3. Khách nhận pizza cùng các món đã thanh toán và rời hàng" },
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

function getArenaQueue(loai: CustomerType): string {
  switch (loai) {
    case "SAN":
      return "Q_ThanhToan_DoAnSan";
    case "CHUAN":
      return "Q_ThanhToan_MonBep";
    case "PIZZA":
      return "Q_Order_Pizza";
    case "PIZZA_COMBO":
      return "Q_Pizza_Combo";
  }
}

function getArenaResource(loai: CustomerType): string {
  switch (loai) {
    case "SAN":
      return "Cashier_DoAnSan";
    case "CHUAN":
      return "Cashier_MonBep";
    case "PIZZA":
      return "Cashier_Pizza";
    case "PIZZA_COMBO":
      return "Cashier_PizzaCombo";
  }
}

function getArenaProcessType(loai: CustomerType): string {
  switch (loai) {
    case "SAN":
      return "ThanhToan";
    case "CHUAN":
      return "ThanhToan_MonBep";
    case "PIZZA":
      return "Order_TinhTien_Pizza";
    case "PIZZA_COMBO":
      return "Order_TinhTien_PizzaCombo";
  }
}

function mapDbRowToEventRow(row: DbRow): EventRow {
  return {
    id: row.id,
    maKH: row.ma_kh,
    loaiKH: row.loai_kh,
    suKien: row.su_kien,
    thoiGian: row.thoi_gian,
    nhanVien: row.nhan_vien,
    quay: row.quay,
    ghiChu: row.ghi_chu || "",
    nguoiBam: row.nguoi_bam || "",
  };
}

function getCustomerTypeTheme(loaiLabel: string) {
  switch (loaiLabel) {
    case "ĐỒ ĂN LÀM SẴN":
      return { badgeBg: "#dbeafe", badgeText: "#1d4ed8", cardBorder: "#93c5fd", cardBg: "#eff6ff" };
    case "MÓN CẦN ĐẦU BẾP LÀM":
      return { badgeBg: "#fef3c7", badgeText: "#b45309", cardBorder: "#fcd34d", cardBg: "#fffbeb" };
    case "PIZZA":
      return { badgeBg: "#fee2e2", badgeText: "#b91c1c", cardBorder: "#fca5a5", cardBg: "#fef2f2" };
    case "PIZZA KẾT HỢP MÓN KHÁC":
      return { badgeBg: "#ede9fe", badgeText: "#6d28d9", cardBorder: "#c4b5fd", cardBg: "#f5f3ff" };
    default:
      return { badgeBg: "#e5e7eb", badgeText: "#374151", cardBorder: "#d1d5db", cardBg: "#f9fafb" };
  }
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

export default function Page() {
  const [currentMaKH, setCurrentMaKH] = useState<string>("");
  const [loaiKH, setLoaiKH] = useState<CustomerType | "">("");
  const [nhanVien, setNhanVien] = useState<string>("NV1");
  const [quay, setQuay] = useState<string>("Quầy Thanh Toán 3");
  const [ghiChu, setGhiChu] = useState<string>("");
  const [tenNguoiBam, setTenNguoiBam] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [eventLog, setEventLog] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  function upsertEventRow(newRow: EventRow) {
    setEventLog((prev) => {
      const idx = prev.findIndex((x) => x.id === newRow.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRow;
        return copy.sort((a, b) => {
          const t = new Date(b.thoiGian).getTime() - new Date(a.thoiGian).getTime();
          if (t !== 0) return t;
          return b.id - a.id;
        });
      }
      return [newRow, ...prev].sort((a, b) => {
        const t = new Date(b.thoiGian).getTime() - new Date(a.thoiGian).getTime();
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
      console.error("Supabase load error:", error);
      alert(`Không tải được dữ liệu: ${error.message}`);
      setLoading(false);
      return;
    }

    const mapped = ((data || []) as DbRow[]).map(mapDbRowToEventRow);
    setEventLog(mapped);
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
      .channel("event-log-live")
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

  function startNewCustomer(selectedType: CustomerType) {
    if (!deviceId) {
      alert("Thiết bị chưa sẵn sàng, vui lòng thử lại.");
      return;
    }

    if (currentMaKH) {
      const ok = window.confirm(
        `Bạn đang ở khách ${currentMaKH}. Tạo khách mới sẽ chuyển sang mã khác. Tiếp tục?`
      );
      if (!ok) return;
    }

    const newCode = generateUniqueCustomerCode(deviceId);
    setLoaiKH(selectedType);
    setCurrentMaKH(newCode);
    setGhiChu("");
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

  async function addEvent(suKien: EventName) {
    if (!currentMaKH || !loaiKH) {
      alert("Bạn phải chọn loại khách trước.");
      return;
    }

    if (!tenNguoiBam.trim()) {
      alert("Bạn chưa nhập tên người bấm.");
      return;
    }

    if (suKien !== nextExpectedEvent) {
      alert("Bạn đang bấm sai thứ tự quy trình.");
      return;
    }

    const now = new Date();

    const { data, error } = await supabase
      .from("event_log")
      .insert({
        ma_kh: currentMaKH,
        loai_kh: loaiKH,
        su_kien: suKien,
        thoi_gian: now.toISOString(),
        nhan_vien: nhanVien,
        quay: quay,
        ghi_chu: ghiChu,
        nguoi_bam: tenNguoiBam,
      })
      .select("*");

    if (error) {
      console.error("Supabase insert error:", error);
      alert(`Lưu dữ liệu thất bại: ${error.message}`);
      return;
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

    const idsToDelete = eventLog.filter((x) => x.maKH === currentMaKH).map((x) => x.id);

    const { error } = await supabase
      .from("event_log")
      .delete()
      .eq("ma_kh", currentMaKH);

    if (error) {
      console.error("Supabase delete error:", error);
      alert(`Xóa dữ liệu thất bại: ${error.message}`);
      return;
    }

    setEventLog((prev) => prev.filter((x) => !idsToDelete.includes(x.id)));
    setCurrentMaKH("");
    setLoaiKH("");
    setGhiChu("");
  }

  async function clearAllData() {
    const ok = window.confirm("Bạn có chắc muốn xóa toàn bộ dữ liệu?");
    if (!ok) return;

    const { error } = await supabase.from("event_log").delete().neq("id", 0);

    if (error) {
      console.error("Supabase clear all error:", error);
      alert(`Xóa toàn bộ dữ liệu thất bại: ${error.message}`);
      return;
    }

    setEventLog([]);
    setCurrentMaKH("");
    setLoaiKH("");
    setNhanVien("NV1");
    setQuay("Quầy Thanh Toán 3");
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
        nguoiBam: firstRow?.nguoiBam || "",

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
        arenaQueue: getArenaQueue(loai),
        arenaResource: getArenaResource(loai),
        arenaProcessType: getArenaProcessType(loai),
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
  }, [eventLog]);

  function exportSummaryExcel() {
    const rows = summaryRows.map((row) => ({
      STT: row.stt,
      MaKH: row.maKH,
      LoaiKH: row.loaiKH,
      NhanVien: row.nhanVien,
      Quay: row.quay,
      GhiChu: row.ghiChu,
      NguoiBam: row.nguoiBam,
      SoBuoc: row.soBuoc,

      ThoiGianDenHeThong: parseDateTime(row.thoiGianDenHeThong),
      BatDauXepHang: parseDateTime(row.batDauXepHang),
      BatDauPhucVu: parseDateTime(row.batDauPhucVu),
      KetThucPhucVu_RoiHeThong: parseDateTime(row.ketThucPhucVuRoiHeThong),

      InterarrivalTime_Giay: row.interarrivalTimeGiay === "" ? "" : row.interarrivalTimeGiay,
      WaitingTime_Giay: row.waitingTimeGiay === "" ? "" : row.waitingTimeGiay,
      ServiceTime_Giay: row.serviceTimeGiay === "" ? "" : row.serviceTimeGiay,
      SystemTime_Giay: row.systemTimeGiay === "" ? "" : row.systemTimeGiay,

      Arena_EntityType: row.arenaEntityType,
      Arena_ArrivalTime: parseDateTime(row.arenaArrivalTime),
      Arena_Interarrival_s: row.arenaInterarrivalS === "" ? "" : row.arenaInterarrivalS,
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
      { wch: 8 }, { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 },
      { wch: 8 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 22 },
      { wch: 22 }, { wch: 22 }, { wch: 36 }, { wch: 24 }, { wch: 36 }, { wch: 24 }, { wch: 36 },
      { wch: 24 }, { wch: 36 }, { wch: 24 },
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
      normal: { background: "#fff", border: `1px solid ${palette.line}`, color: palette.text },
      danger: { background: palette.redSoft, border: `1px solid #fecaca`, color: palette.red },
      primary: { background: palette.blue, border: `1px solid ${palette.blue}`, color: "#fff" },
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
              Web bấm giờ dùng mô phỏng ở Quầy Đồ Ăn Emart
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
              <div style={{ fontWeight: 800, fontSize: 18 }}>{currentMaKH || "Chưa chọn"}</div>
            </div>

            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Loại khách</div>
              <div style={{ fontWeight: 700 }}>{loaiKH ? getLoaiKhachLabel(loaiKH) : "Chưa chọn"}</div>
            </div>

            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Người đang bấm</div>
              <div style={{ fontWeight: 700 }}>{tenNguoiBam || "Chưa nhập tên"}</div>
            </div>

            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Mã thiết bị</div>
              <div style={{ fontWeight: 700 }}>{deviceId || "Đang tạo..."}</div>
            </div>

            <div style={infoItemStyle}>
              <div style={{ color: palette.sub, fontSize: 13 }}>Trạng thái tải</div>
              <div style={{ fontWeight: 700, color: loading ? palette.amber : palette.green }}>
                {loading ? "Đang tải..." : "Sẵn sàng"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                const newName = window.prompt("Nhập lại tên người đang bấm:", tenNguoiBam) || "";
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
          <div style={{ marginBottom: 12 }}>
            <h2 style={sectionTitleStyle}>Thông tin thao tác</h2>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Nhân viên</label>
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
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Quầy</label>
              <select
                value={quay}
                onChange={(e) => setQuay(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${palette.line}`,
                  fontSize: 16,
                  background: "#fff",
                }}
              >
                <option value="Quầy Thanh Toán 3">Quầy Thanh Toán 3</option>
                <option value="Quầy Thanh Toán 2">Quầy Thanh Toán 2</option>
                <option value="Pizza">Quầy Thanh Toán 1</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Ghi chú</label>
              <input
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder="Ví dụ: áo xanh"
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
          <div style={{ marginBottom: 12 }}>
            <h2 style={sectionTitleStyle}>Chọn loại khách để tạo mã mới</h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <button onClick={() => startNewCustomer("SAN")} style={typeButtonStyle(loaiKH === "SAN")}>
              ĐỒ ĂN LÀM SẴN
            </button>
            <button onClick={() => startNewCustomer("CHUAN")} style={typeButtonStyle(loaiKH === "CHUAN")}>
              MÓN CẦN ĐẦU BẾP LÀM
            </button>
            <button onClick={() => startNewCustomer("PIZZA")} style={typeButtonStyle(loaiKH === "PIZZA")}>
              PIZZA
            </button>
            <button onClick={() => startNewCustomer("PIZZA_COMBO")} style={typeButtonStyle(loaiKH === "PIZZA_COMBO")}>
              PIZZA KẾT HỢP MÓN KHÁC
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
          <div style={{ marginBottom: 12 }}>
            <h2 style={sectionTitleStyle}>Bấm theo đúng thứ tự thực tế</h2>
            <p style={{ margin: "6px 0 0", color: palette.sub }}>
              Chỉ nút hợp lệ tiếp theo mới bấm được.
            </p>
          </div>

          {loaiKH ? (
            <div style={{ display: "grid", gap: 10 }}>
              {currentFlow.map((step, index) => {
                const disabled = !currentMaKH || nextStepIndex !== index;
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
              Hãy chọn loại khách ở phía trên trước.
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
            <button onClick={resetCurrentCustomer} style={buttonStyle(false, "danger")}>
              RESET KHÁCH NÀY
            </button>
            <button onClick={clearAllData} style={buttonStyle(false, "danger")}>
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
          <h2 style={sectionTitleStyle}>
            Summary {loading ? "(đang tải...)" : ""}
          </h2>
          <p style={{ margin: "6px 0 14px", color: palette.sub }}>
            Dữ liệu đã bấm
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
  <div>
    <div style={{ fontSize: 13, color: palette.sub, marginBottom: 4 }}>
      STT khách: {row.stt}
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, wordBreak: "break-word" }}>
      {row.maKH}
    </div>
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
                      <div style={infoItemStyle}>Nhân viên: <strong>{row.nhanVien || "Chưa có"}</strong></div>
                      <div style={infoItemStyle}>Quầy: <strong>{row.quay || "Chưa có"}</strong></div>
                      <div style={infoItemStyle}>Ghi chú: <strong>{row.ghiChu || "Chưa có"}</strong></div>
                      <div style={infoItemStyle}>Người bấm: <strong>{row.nguoiBam || "Chưa có"}</strong></div>
                      <div style={infoItemStyle}>Số bước: <strong>{row.soBuoc || "Chưa có"}</strong></div>
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
                        <div style={{ fontWeight: 800, marginBottom: 8 }}>Thời gian từng bước</div>
                        <div>{row.buoc1Label || "Bước 1"}: {row.T_B1 ? formatEventTime(row.T_B1) : "Chưa có"}</div>
                        <div>{row.buoc2Label || "Bước 2"}: {row.T_B2 ? formatEventTime(row.T_B2) : "Chưa có"}</div>
                        <div>{row.buoc3Label || "Bước 3"}: {row.T_B3 ? formatEventTime(row.T_B3) : "Chưa có"}</div>
                        <div>{row.buoc4Label || "Bước 4"}: {row.T_B4 ? formatEventTime(row.T_B4) : "Chưa có"}</div>
                      </div>

                      <div
                        style={{
                          border: `1px solid ${palette.line}`,
                          borderRadius: 12,
                          padding: 12,
                          background: "#ffffffcc",
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: 8 }}>Mốc mô phỏng</div>
                        <div>Đến hệ thống: {row.thoiGianDenHeThong ? formatEventTime(row.thoiGianDenHeThong) : "Chưa có"}</div>
                        <div>Bắt đầu xếp hàng: {row.batDauXepHang ? formatEventTime(row.batDauXepHang) : "Chưa có"}</div>
                        <div>Bắt đầu phục vụ: {row.batDauPhucVu ? formatEventTime(row.batDauPhucVu) : "Chưa có"}</div>
                        <div>Rời hệ thống: {row.ketThucPhucVuRoiHeThong ? formatEventTime(row.ketThucPhucVuRoiHeThong) : "Chưa có"}</div>
                      </div>

                      <div
                        style={{
                          border: `1px solid ${palette.line}`,
                          borderRadius: 12,
                          padding: 12,
                          background: palette.greenSoft,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            marginBottom: 8,
                            color: palette.green,
                          }}
                        >
                          Chỉ tiêu thời gian
                        </div>
                        <div>Interarrival(s): <strong>{row.interarrivalTimeGiay === "" ? "Chưa đủ dữ liệu" : row.interarrivalTimeGiay}</strong></div>
                        <div>Waiting(s): <strong>{row.waitingTimeGiay === "" ? "Chưa đủ dữ liệu" : row.waitingTimeGiay}</strong></div>
                        <div>Service(s): <strong>{row.serviceTimeGiay === "" ? "Chưa đủ dữ liệu" : row.serviceTimeGiay}</strong></div>
                        <div>System(s): <strong>{row.systemTimeGiay === "" ? "Chưa đủ dữ liệu" : row.systemTimeGiay}</strong></div>
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
