/* =========================================================
   KONFIGURASI
========================================================= */

const DEFAULT_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWRM7E3rtMsJVWf9z1cntdblP4nSP9p0QCC6DeEbVt_3MHbjicUDgP2AsgLPV-NaNAYH3YZfDwFXhI/pub?output=csv";

const STORAGE_URL = "cctv_uid_sstb_csv_url";

/* Google Apps Script Web App (simpan hasil EDIT ke Spreadsheet) */
const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbz-zrsdF8UnVFVfn_k8pbLFR-uB4r6zmnI66H03MXRI8afCdLkbw1GxMOUAxIR7mimY/exec";

/*
 * Bulan yang dicetak rinciannya per hari di Console (F12)
 * untuk membantu memeriksa angka pada grafik.
 * Format "yyyy-mm". Isi "" untuk mematikan.
 */
const DEBUG_MONTH = "2026-08";

/* Warna grafik (tidak warna-warni) */
const CHART_BLUE = "#0F62B5";
const CHART_NAVY = "#0A2A54";


/* =========================================================
   VARIABEL GLOBAL
========================================================= */

let DATA = [];
let currentEditingRow = null;
let charts = {};
let isSavingEdit = false;
let currentPdfBlobUrl = null;

/* totalUnit tetap/manual (61); totalCctv dari tab "MONITORING CCTV" */
let CCTV_SUMMARY = {
    totalCctv: 0,
    totalUnit: 61,
    loaded: false
};


/* =========================================================
   HELPER
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function getValue(row, key) {

    if (!row) {
        return "";
    }

    if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
    }

    return "";
}

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* Normalisasi teks HANYA untuk perbandingan */
function normalizeKey(value) {

    return String(value ?? "")
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/* Kunci yyyy-mm dari sebuah Date */
function monthKeyOf(date) {

    return (
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0")
    );
}


/* =========================================================
   HAPUS BARIS DUPLIKAT (waktu sama sampai satuan MENIT)
========================================================= */

function dedupeExactDuplicateRows(rows) {

    const seenKeys = new Set();

    return rows.filter(function (row) {

        const d = row.dateObject;

        const timeKey = d
            ? d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate() +
              "-" + d.getHours() + "-" + d.getMinutes()
            : normalizeKey(row.timestamp);

        const key = [
            timeKey,
            normalizeKey(row.up3),
            normalizeKey(row.ulp),
            normalizeKey(row.device),
            normalizeKey(row.job),
            normalizeKey(row.location),
            normalizeKey(row.officer)
        ].join("|");

        if (seenKeys.has(key)) {
            return false;
        }

        seenKeys.add(key);

        return true;
    });
}


/* =========================================================
   TANGGAL
========================================================= */

function parseDate(value) {

    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }

    const text = String(value).trim();

    if (!text) {
        return null;
    }

    /* Format Indonesia dd/mm/yyyy [hh:mm[:ss]] dicek lebih dulu */
    const match = text.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (match) {

        const parsedDate = new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1]),
            Number(match[4] || 0),
            Number(match[5] || 0),
            Number(match[6] || 0)
        );

        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }

    const date = new Date(text);

    if (!isNaN(date.getTime())) {
        return date;
    }

    return null;
}

function formatDateTime(date) {

    if (!date) {
        return "-";
    }

    const d = date instanceof Date ? date : parseDate(date);

    if (!d || isNaN(d.getTime())) {
        return String(date);
    }

    const p = function (n) {
        return String(n).padStart(2, "0");
    };

    return (
        `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ` +
        `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    );
}

function formatDateOnly(date) {

    if (!date) {
        return "-";
    }

    const d = date instanceof Date ? date : parseDate(date);

    if (!d || isNaN(d.getTime())) {
        return "-";
    }

    const p = function (n) {
        return String(n).padStart(2, "0");
    };

    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDateForInput(value) {

    if (!value) {
        return "";
    }

    const date = parseDate(value);

    if (!date) {
        return "";
    }

    const p = function (n) {
        return String(n).padStart(2, "0");
    };

    return (
        `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
        `T${p(date.getHours())}:${p(date.getMinutes())}`
    );
}


/* =========================================================
   NORMALISASI DATA
========================================================= */

function normalizeRow(row) {

    const timestamp = getValue(row, "Timestamp");
    const dateObject = parseDate(timestamp);

    return {

        original: row,

        rowNumber: Number(row._row || row._rowNumber || 0),

        timestamp,

        dateObject,

        dateText: formatDateTime(dateObject),

        dateOnly: formatDateOnly(dateObject),

        up3: getValue(row, "Unit UP3"),

        ulp: getValue(row, "Unit ULP"),

        device: getValue(row, "NAMA PERANGKAT CCTV"),

        job: getValue(row, "Nama Pekerjaan"),

        location: getValue(row, "Lokasi Pekerjaan"),

        officer: getValue(row, "Petugas Pelaksana di Lapangan"),

        documentation: getValue(row, "Dokumentasi CCTV"),

        /* DATA POPUP */

        description: getValue(row, "Deskripsi Temuan (Jika Ada)"),

        findingTime: getValue(row, "Waktu Temuan"),

        findingDocumentation: getValue(row, "Dokumentasi Temuan"),

        followUp: getValue(row, "Tindak Lanjut (Tegur online, CMC, dsb)"),

        information: getValue(row, "Keterangan")
    };
}


/* =========================================================
   LOAD DATA DARI GOOGLE SHEETS CSV
========================================================= */

async function loadFromURL(url) {

    try {

        console.log("Memuat data dari:", url);

        if (typeof Papa === "undefined") {
            throw new Error("PapaParse tidak ditemukan.");
        }

        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const csvText = await response.text();

        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: function (header) {
                return String(header).trim();
            }
        });

        console.log("Jumlah baris CSV:", parsed.data.length);

        if (parsed.errors && parsed.errors.length) {
            console.warn("Peringatan CSV:", parsed.errors);
        }

        const rows = parsed.data || [];

        /* Header = baris 1, data pertama = baris 2 */
        DATA = rows
            .map(function (row, index) {
                row._row = index + 2;
                return normalizeRow(row);
            })
            .filter(function (row) {
                return (
                    row.timestamp ||
                    row.up3 ||
                    row.ulp ||
                    row.device ||
                    row.job ||
                    row.location ||
                    row.officer
                );
            });

        const rowsBefore = DATA.length;

        DATA = dedupeExactDuplicateRows(DATA);

        console.log(
            "Baris sebelum dedupe:", rowsBefore,
            "| sesudah:", DATA.length,
            "| duplikat dibuang:", rowsBefore - DATA.length
        );

        logMonthlyDiagnostics();

        localStorage.setItem(STORAGE_URL, url);

        renderDashboard();
        renderMonitoring();
        renderLaporan();
        renderCharts();

        updateConnectionStatus(true);

        return true;

    } catch (error) {

        console.error("Gagal memuat data:", error);

        updateConnectionStatus(false);

        const tbody = $("laporanTable");

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding:30px; color:#dc2626;">
                        Data gagal dimuat.
                        <br><br>
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }

        return false;
    }
}

/* Diagnosis angka per bulan / per hari di Console (F12) */
function logMonthlyDiagnostics() {

    const perMonth = {};
    const perDay = {};

    DATA.forEach(function (row) {

        if (!row.dateObject) {
            return;
        }

        const mk = monthKeyOf(row.dateObject);

        perMonth[mk] = (perMonth[mk] || 0) + 1;

        if (DEBUG_MONTH && mk === DEBUG_MONTH) {
            perDay[row.dateOnly] = (perDay[row.dateOnly] || 0) + 1;
        }
    });

    console.log("Jumlah laporan per bulan:");
    console.table(perMonth);

    if (DEBUG_MONTH) {
        console.log("Rincian per hari untuk bulan " + DEBUG_MONTH + ":");
        console.table(perDay);
    }
}


/* =========================================================
   RINGKASAN CCTV DARI TAB "MONITORING CCTV" (Apps Script)
========================================================= */

async function loadCctvSummary() {

    try {

        const response = await fetch(DEFAULT_API_URL, { cache: "no-store" });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const result = JSON.parse(await response.text());

        if (result && result.cctvSummary) {

            CCTV_SUMMARY.totalUnit =
                Number(result.cctvSummary.totalUnit) || 61;

            if (result.cctvSummary.success) {

                CCTV_SUMMARY.totalCctv =
                    Number(result.cctvSummary.totalCctv) || 0;

                CCTV_SUMMARY.loaded = true;

            } else {

                console.error(
                    "Gagal menghitung Total CCTV:",
                    result.cctvSummary.message,
                    "\nKolom yang tersedia di tab MONITORING CCTV:",
                    result.cctvSummary.availableHeaders
                );
            }

        } else {

            console.warn(
                "Ringkasan CCTV tidak tersedia. Cek URL Apps Script " +
                "(DEFAULT_API_URL) dan versi deployment-nya.",
                result
            );
        }

        renderDashboard();

        if (typeof Chart !== "undefined") {
            renderUlpDailyChart();
        }

    } catch (error) {

        console.warn("Gagal memuat ringkasan CCTV:", error);
    }
}


/* =========================================================
   URUTKAN DATA TERBARU LEBIH DULU
========================================================= */

function getSortedByDateDesc(rows) {

    return [...rows].sort(function (a, b) {

        const dateA = a.dateObject ? a.dateObject.getTime() : 0;
        const dateB = b.dateObject ? b.dateObject.getTime() : 0;

        return dateB - dateA;
    });
}


/* =========================================================
   TABEL DATA LAPORAN
========================================================= */

function buildLaporanRowHTML(row, index) {

    const docLink = row.documentation
        ? `<a href="${escapeAttribute(row.documentation)}"
              target="_blank" rel="noopener noreferrer">Lihat</a>`
        : "-";

    return `
        <td>${index + 1}</td>
        <td>${escapeHTML(row.dateText || "-")}</td>
        <td>${escapeHTML(row.up3 || "-")}</td>
        <td>${escapeHTML(row.ulp || "-")}</td>
        <td>${escapeHTML(row.device || "-")}</td>
        <td>${escapeHTML(row.job || "-")}</td>
        <td>${escapeHTML(row.location || "-")}</td>
        <td>${escapeHTML(row.officer || "-")}</td>
        <td>${docLink}</td>
        <td>
            <div class="aksi-btn-group">
                <button type="button" class="action-btn"
                        onclick="openEditModal(${row.rowNumber})">
                    ✎ Edit
                </button>
                <button type="button" class="action-btn action-btn-pdf"
                        onclick="openUlpPdfModal(${row.rowNumber})">
                    📄 PDF ULP
                </button>
            </div>
        </td>
    `;
}

function renderLaporan(rows, emptyMessage) {

    const tbody = $("laporanTable");

    if (!tbody) {
        console.error("Element #laporanTable tidak ditemukan.");
        return;
    }

    const source = rows || DATA;

    tbody.innerHTML = "";

    if (!source.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:30px;">
                    ${escapeHTML(emptyMessage || "Tidak ada data laporan.")}
                </td>
            </tr>
        `;

        updateResultCount(0);

        return;
    }

    const sortedData = getSortedByDateDesc(source);

    sortedData.forEach(function (row, index) {

        const tr = document.createElement("tr");

        tr.innerHTML = buildLaporanRowHTML(row, index);

        tbody.appendChild(tr);
    });

    updateResultCount(sortedData.length);
}

function renderFilteredLaporan(filteredRows) {

    renderLaporan(filteredRows, "Data tidak ditemukan.");
}

function updateResultCount(count) {

    document
        .querySelectorAll(".result-count")
        .forEach(function (element) {
            element.textContent = count + " data";
        });
}


/* =========================================================
   MONITORING HARIAN
========================================================= */

function buildMonitoringRowHTML(row, index) {

    return `
        <td>${index + 1}</td>
        <td>${escapeHTML(row.dateText || "-")}</td>
        <td>${escapeHTML(row.up3 || "-")}</td>
        <td>${escapeHTML(row.ulp || "-")}</td>
        <td>${escapeHTML(row.device || "-")}</td>
        <td>${escapeHTML(row.job || "-")}</td>
        <td>${escapeHTML(row.location || "-")}</td>
        <td>${escapeHTML(row.officer || "-")}</td>
    `;
}

function renderMonitoring(rows) {

    const tbody = $("monitoringTable");

    if (!tbody) {
        return;
    }

    const source = rows || DATA;

    tbody.innerHTML = "";

    if (!source.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:30px;">
                    Tidak ada data.
                </td>
            </tr>
        `;

        return;
    }

    getSortedByDateDesc(source).forEach(function (row, index) {

        const tr = document.createElement("tr");

        tr.innerHTML = buildMonitoringRowHTML(row, index);

        tbody.appendChild(tr);
    });
}


/* =========================================================
   DASHBOARD
========================================================= */

function setText(id, value) {

    const el = $(id);

    if (el) {
        el.textContent = value;
    }
}

function renderDashboard() {

    setText("totalData", DATA.length);

    /* DATA HARI INI */

    const today = formatDateOnly(new Date());

    const todayRows = DATA.filter(function (row) {
        return row.dateOnly === today;
    });

    setText("todayData", todayRows.length);

    /* Tampil "-" kalau Total CCTV belum/gagal dimuat */
    setText(
        "totalCctv",
        CCTV_SUMMARY.loaded ? CCTV_SUMMARY.totalCctv : "-"
    );

    setText("totalUnit", CCTV_SUMMARY.totalUnit);

    /*
     * CCTV ON  = jumlah ULP UNIK yang melapor HARI INI
     * CCTV OFF = Total CCTV - ON
     */

    const uniqueReportedUlpToday = new Set(
        todayRows
            .map(function (row) {
                return normalizeKey(row.ulp);
            })
            .filter(Boolean)
    );

    const cctvOnCount = uniqueReportedUlpToday.size;

    const cctvOffCount = Math.max(
        0,
        CCTV_SUMMARY.totalCctv - cctvOnCount
    );

    setText("cctvOn", cctvOnCount);

    setText("cctvOff", CCTV_SUMMARY.loaded ? cctvOffCount : "-");

    setText("dataActive", DATA.length);

    /* AKTIVITAS TERBARU */

    const recentList = $("recentList");

    if (!recentList) {
        return;
    }

    const latest = getSortedByDateDesc(DATA).slice(0, 5);

    if (!latest.length) {

        recentList.innerHTML = `
            <div style="padding:20px 0; color:var(--muted); font-size:12px;">
                Belum ada aktivitas.
            </div>
        `;

        return;
    }

    recentList.innerHTML = latest
        .map(function (row) {

            return `
                <div class="activity-item">
                    <div class="activity-time">
                        ${escapeHTML(row.dateText || "-")}
                    </div>
                    <div class="activity-main">
                        <strong>${escapeHTML(row.job || "-")}</strong>
                        <span>${escapeHTML(row.device || "-")}</span>
                    </div>
                    <div class="activity-location">
                        ${escapeHTML(row.location || "-")}
                    </div>
                </div>
            `;
        })
        .join("");
}


/* =========================================================
   POPUP EDIT
========================================================= */

function openEditModal(rowNumber) {

    const row = DATA.find(function (item) {
        return Number(item.rowNumber) === Number(rowNumber);
    });

    if (!row) {
        alert("Data tidak ditemukan.");
        return;
    }

    currentEditingRow = row;

    const setValue = function (id, value) {

        const el = $(id);

        if (el) {
            el.value = value;
        }
    };

    setValue("editRowNumber", row.rowNumber || "");

    setText("editJob", row.job || "-");

    setText("editLocation", row.location || "-");

    setValue("editDescription", row.description || "");

    setValue("editFindingTime", formatDateForInput(row.findingTime));

    setValue("editFindingDocumentation", row.findingDocumentation || "");

    /* Kalau nilai lama tidak ada di daftar pilihan, tambahkan sementara */

    const editFollowUp = $("editFollowUp");

    if (editFollowUp) {

        const currentValue = row.followUp || "";

        const exists = Array.from(editFollowUp.options).some(
            function (option) {
                return option.value === currentValue;
            }
        );

        if (currentValue && !exists) {

            const option = document.createElement("option");

            option.value = currentValue;
            option.textContent = currentValue;

            editFollowUp.appendChild(option);
        }

        editFollowUp.value = currentValue;
    }

    setValue("editInformation", row.information || "");

    const modal = $("editModal");

    if (modal) {
        modal.classList.add("active");
    }
}

function closeEditModal() {

    const modal = $("editModal");

    if (modal) {
        modal.classList.remove("active");
    }

    currentEditingRow = null;
}

function applyEditSavedLocally(
    description,
    findingTime,
    findingDocumentation,
    followUp,
    information
) {

    currentEditingRow.description = description;
    currentEditingRow.findingTime = findingTime;
    currentEditingRow.findingDocumentation = findingDocumentation;
    currentEditingRow.followUp = followUp;
    currentEditingRow.information = information;

    if (currentEditingRow.original) {

        const o = currentEditingRow.original;

        o["Deskripsi Temuan (Jika Ada)"] = description;
        o["Waktu Temuan"] = findingTime;
        o["Dokumentasi Temuan"] = findingDocumentation;
        o["Tindak Lanjut (Tegur online, CMC, dsb)"] = followUp;
        o["Keterangan"] = information;
    }

    closeEditModal();

    renderLaporan();

    renderDashboard();
}


/* =========================================================
   VERIFIKASI ULANG KE SPREADSHEET
========================================================= */

async function verifyEditSaved(rowNumber, expectedData) {

    try {

        const response = await fetch(DEFAULT_API_URL, { cache: "no-store" });

        if (!response.ok) {
            return false;
        }

        let result;

        try {
            result = JSON.parse(await response.text());
        } catch (parseError) {
            return false;
        }

        if (!result || !result.success || !Array.isArray(result.rows)) {
            return false;
        }

        const row = result.rows.find(function (item) {
            return Number(item._row) === Number(rowNumber);
        });

        if (!row) {
            return false;
        }

        return Object.keys(expectedData).every(function (key) {

            const actual =
                row[key] !== undefined ? String(row[key]).trim() : "";

            const expected = String(expectedData[key] || "").trim();

            return actual === expected;
        });

    } catch (error) {

        return false;
    }
}


/* =========================================================
   SIMPAN EDIT KE GOOGLE SHEETS
========================================================= */

async function saveEdit(event) {

    event.preventDefault();

    if (isSavingEdit) {
        return;
    }

    if (!currentEditingRow) {
        alert("Data yang diedit tidak ditemukan.");
        return;
    }

    const readValue = function (id, trim) {

        const el = $(id);

        if (!el) {
            return "";
        }

        return trim ? el.value.trim() : el.value;
    };

    const description = readValue("editDescription", true);
    const findingTime = readValue("editFindingTime", false);
    const findingDocumentation = readValue("editFindingDocumentation", true);
    const followUp = readValue("editFollowUp", false);
    const information = readValue("editInformation", true);

    const rowNumber = Number(currentEditingRow.rowNumber);

    if (!rowNumber || rowNumber < 2) {
        alert("Nomor baris Spreadsheet tidak valid.");
        return;
    }

    if (!DEFAULT_API_URL) {
        alert("URL Google Apps Script belum diatur.");
        return;
    }

    const payload = {

        row: rowNumber,

        data: {
            "Deskripsi Temuan (Jika Ada)": description,
            "Waktu Temuan": findingTime,
            "Dokumentasi Temuan": findingDocumentation,
            "Tindak Lanjut (Tegur online, CMC, dsb)": followUp,
            "Keterangan": information
        }
    };

    console.log("Mengirim data ke Apps Script:", payload);

    const saveButton = $("saveEditBtn");

    const oldButtonText = saveButton ? saveButton.textContent : "";

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Menyimpan...";
    }

    isSavingEdit = true;

    try {

        /* text/plain agar tidak memicu CORS preflight */
        const response = await fetch(DEFAULT_API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        console.log("Response Apps Script:", responseText);

        let result;

        try {
            result = JSON.parse(responseText);
        } catch (jsonError) {
            console.error("Response bukan JSON:", responseText);
            throw new Error("Response dari Google Apps Script tidak valid.");
        }

        if (!result.success) {
            throw new Error(result.message || "Data gagal disimpan.");
        }

        applyEditSavedLocally(
            description,
            findingTime,
            findingDocumentation,
            followUp,
            information
        );

        alert("Data berhasil disimpan ke Google Spreadsheet.");

    } catch (error) {

        console.error("Gagal menyimpan data:", error);

        const reallySaved = await verifyEditSaved(rowNumber, payload.data);

        if (reallySaved) {

            applyEditSavedLocally(
                description,
                findingTime,
                findingDocumentation,
                followUp,
                information
            );

            alert("Data berhasil disimpan ke Google Spreadsheet.");

        } else {

            alert(
                "Data gagal disimpan ke Google Spreadsheet.\n\n" +
                error.message +
                "\n\n" +
                "Periksa deployment Google Apps Script dan URL /exec."
            );
        }

    } finally {

        isSavingEdit = false;

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = oldButtonText || "Simpan";
        }
    }
}


/* =========================================================
   STATUS KONEKSI
========================================================= */

function updateConnectionStatus(connected) {

    const status = $("dataStatus");

    if (!status) {
        return;
    }

    if (connected) {
        status.textContent = "Data Terhubung";
        status.style.color = "";
    } else {
        status.textContent = "Data Tidak Terhubung";
    }
}


/* =========================================================
   SEARCH DATA
========================================================= */

function searchData(keyword) {

    const text = String(keyword || "").toLowerCase().trim();

    if (!text) {
        renderLaporan();
        return;
    }

    const filtered = DATA.filter(function (row) {

        const searchable = [
            row.dateText,
            row.up3,
            row.ulp,
            row.device,
            row.job,
            row.location,
            row.officer,
            row.documentation,
            row.description,
            row.findingTime,
            row.findingDocumentation,
            row.followUp,
            row.information
        ]
            .join(" ")
            .toLowerCase();

        return searchable.includes(text);
    });

    renderFilteredLaporan(filtered);
}


/* =========================================================
   NAVIGATION
========================================================= */

function showView(viewName) {

    document.querySelectorAll(".view").forEach(function (view) {
        view.classList.remove("active");
    });

    const target = $("view-" + viewName);

    if (target) {
        target.classList.add("active");
    }

    document.querySelectorAll(".nav-link").forEach(function (link) {

        link.classList.remove("active");

        if (link.dataset.view === viewName) {
            link.classList.add("active");
        }
    });

    const topbarTitle = document.querySelector(".topbar-title");

    if (topbarTitle) {

        const titles = {
            dashboard: "Dashboard",
            monitoring: "Monitoring Harian",
            laporan: "Data Laporan",
            grafik: "Visualisasi Grafik",
            panduan: "Panduan"
        };

        topbarTitle.textContent = titles[viewName] || "Dashboard";
    }
}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {

    if (localStorage.getItem("cctv_theme") === "dark") {
        document.body.classList.add("dark");
    }
}

function toggleTheme() {

    document.body.classList.toggle("dark");

    localStorage.setItem(
        "cctv_theme",
        document.body.classList.contains("dark") ? "dark" : "light"
    );
}


/* =========================================================
   FILTER GRAFIK — BULAN TERSEDIA
========================================================= */

function getAvailableMonths() {

    const months = new Set();

    DATA.forEach(function (row) {

        if (row.dateObject) {
            months.add(monthKeyOf(row.dateObject));
        }
    });

    return Array.from(months).sort();
}

function getLatestAvailableMonth() {

    const months = getAvailableMonths();

    return months[months.length - 1] || "";
}

function setupChartFilters() {

    const availableMonths = getAvailableMonths();

    if (!availableMonths.length) {
        return;
    }

    const minMonth = availableMonths[0];
    const maxMonth = availableMonths[availableMonths.length - 1];

    const dailyMonthInput = $("dailyChartMonth");

    if (dailyMonthInput) {

        dailyMonthInput.min = minMonth;
        dailyMonthInput.max = maxMonth;

        if (
            !dailyMonthInput.value ||
            !availableMonths.includes(dailyMonthInput.value)
        ) {
            dailyMonthInput.value = maxMonth;
        }
    }
}


/* =========================================================
   PALET WARNA DONAT UP3
========================================================= */

const UP3_BASE_COLORS = [
    "#0F62B5", // biru PLN
    "#F97316", // oranye
    "#16A34A", // hijau
    "#DC2626", // merah
    "#7C3AED", // ungu
    "#0D9488", // teal
    "#EAB308", // kuning
    "#DB2777", // pink
    "#2563EB", // biru muda
    "#65A30D", // hijau lime
    "#9333EA", // ungu terang
    "#EA580C"  // oranye tua
];

function getUp3ColorPalette(count) {

    const palette = [];

    for (let i = 0; i < count; i++) {

        if (i < UP3_BASE_COLORS.length) {
            palette.push(UP3_BASE_COLORS[i]);
        } else {
            palette.push(`hsl(${(i * 47) % 360}, 68%, 52%)`);
        }
    }

    return palette;
}


/* =========================================================
   DAFTAR REKAP (2 KOLOM KIRI-KANAN)

   Dipakai untuk rekap UP3 dan rekap Pekerjaan per Hari.
   opts.sort       : false = pertahankan urutan asli (mis. tanggal)
   opts.totalLabel : teks pada baris total
========================================================= */

function renderUp3RecapList(elementId, labels, values, colors, opts) {

    opts = opts || {};

    const container = $(elementId);

    if (!container) {
        return;
    }

    if (!labels.length) {

        container.innerHTML = `
            <div style="padding:10px 6px; color:var(--muted); font-size:12px;">
                Belum ada data.
            </div>
        `;

        return;
    }

    const combined = labels.map(function (label, index) {
        return {
            label: label,
            value: values[index] || 0,
            color: colors[index]
        };
    });

    /* Default: urut dari pekerjaan terbanyak */
    if (opts.sort !== false) {
        combined.sort(function (a, b) {
            return b.value - a.value;
        });
    }

    const total = combined.reduce(function (sum, item) {
        return sum + item.value;
    }, 0);

    const totalLabel =
        opts.totalLabel || ("Total Pekerjaan (" + combined.length + " Unit)");

    const totalRowHTML = `
        <div class="up3-recap-total">
            <span>${escapeHTML(totalLabel)}</span>
            <strong>${total}</strong>
        </div>
    `;

    const rowsHTML = combined
        .map(function (item) {

            return `
                <div class="up3-recap-row">
                    <span class="up3-recap-dot"
                          style="background:${item.color};"></span>
                    <span class="up3-recap-name">
                        ${escapeHTML(item.label)}
                    </span>
                    <span class="up3-recap-count">${item.value}</span>
                </div>
            `;
        })
        .join("");

    container.innerHTML = totalRowHTML + rowsHTML;
}


/* =========================================================
   GRAFIK
========================================================= */

function renderCharts() {

    if (typeof Chart === "undefined") {
        console.warn("Chart.js tidak ditemukan.");
        return;
    }

    setupChartFilters();
    setupChartFilterOptions();

    renderDailyChart();
    renderUlpDailyChart();
    renderUnitChart();
    renderUp3Chart();
    renderDeviceChart();
    renderJobChart();
    renderDashboardUnitChart();
    renderDashboardUp3Chart();
    renderDashboardJobChart();
}

/* Hitung jumlah baris per nilai field */
function countByField(field, fallback) {

    const counts = {};

    DATA.forEach(function (row) {

        const key = row[field] || fallback;

        counts[key] = (counts[key] || 0) + 1;
    });

    const labels = Object.keys(counts);

    return {
        labels: labels,
        values: labels.map(function (label) {
            return counts[label];
        })
    };
}

/* Grafik batang sederhana */
function drawBarChart(chartKey, canvasId, labels, values, color, seriesLabel) {

    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    if (charts[chartKey]) {
        charts[chartKey].destroy();
    }

    charts[chartKey] = new Chart(canvas, {

        type: "bar",

        data: {
            labels: labels,
            datasets: [{
                label: seriesLabel || "Jumlah Pekerjaan",
                data: values,
                backgroundColor: color,
                borderRadius: 6
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

/*
 * (OPSIONAL) Daftar lengkap nama ULP, supaya ULP yang BELUM pernah
 * melapor tetap tampil dengan nilai 0. Biarkan kosong [] bila hanya
 * ingin menampilkan ULP yang ada di kolom "Unit ULP" spreadsheet.
 */
const ULP_MASTER_LIST = [];

/*
 * Grafik batang VERTIKAL (memanjang ke atas) "Pekerjaan per ULP",
 * satu warna biru. Semua ULP ditampilkan; lebar grafik menyesuaikan
 * jumlah ULP dan bisa digeser ke samping bila banyak.
 */
function drawUlpBarChart(chartKey, canvasId, recapId, filterPrefix) {

    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    if (charts[chartKey]) {
        charts[chartKey].destroy();
    }

    const counts = {};
    const names = {};

    const filteredRows = getFilteredRows(filterPrefix);

    updateFilterSummary(filterPrefix, filteredRows.length);

    filteredRows.forEach(function (row) {

        const name = row.ulp || "Tidak diketahui";

        const key = normalizeKey(name);

        if (!(key in names)) {
            names[key] = name;
        }

        counts[key] = (counts[key] || 0) + 1;
    });

    (getFilterState(filterPrefix).ulps.size ? [] : ULP_MASTER_LIST).forEach(function (name) {

        const key = normalizeKey(name);

        if (key && !(key in names)) {
            names[key] = name;
            counts[key] = 0;
        }
    });

    const entries = Object.keys(names)
        .map(function (key) {
            return { label: names[key], value: counts[key] };
        })
        .sort(function (a, b) {
            return (b.value - a.value) || a.label.localeCompare(b.label);
        });

    const labels = entries.map(function (e) {
        return e.label;
    });

    const values = entries.map(function (e) {
        return e.value;
    });

    const colors = labels.map(function () {
        return CHART_BLUE;
    });

    /* Lebar minimum menyesuaikan jumlah ULP */
    const wrap = canvas.parentElement;

    if (wrap) {
        wrap.style.minWidth = labels.length * 34 + "px";
    }

    charts[chartKey] = new Chart(canvas, {

        type: "bar",

        data: {
            labels: labels,
            datasets: [{
                label: "Jumlah Pekerjaan",
                data: values,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 45,
                        font: { size: 11 }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });

    if (recapId) {
        renderUp3RecapList(recapId, labels, values, colors);
    }
}

/*
 * Hitung pekerjaan per UP3, dengan UP2D selalu disertakan sebagai
 * satu unit tersendiri. Baris yang kolom "Unit UP3" atau "Unit ULP"-nya
 * memuat "UP2D" dihitung ke UP2D.
 */
function countUp3WithUp2d() {

    const counts = {};
    const names = {};

    DATA.forEach(function (row) {

        let name = row.up3 || "Tidak diketahui";

        if (
            normalizeKey(row.up3).includes("up2d") ||
            normalizeKey(row.ulp).includes("up2d")
        ) {
            name = "UP2D";
        }

        const key = normalizeKey(name);

        if (!(key in names)) {
            names[key] = name;
        }

        counts[key] = (counts[key] || 0) + 1;
    });

    if (!("up2d" in names)) {
        names["up2d"] = "UP2D";
        counts["up2d"] = 0;
    }

    const keys = Object.keys(names);

    return {
        labels: keys.map(function (k) {
            return names[k];
        }),
        values: keys.map(function (k) {
            return counts[k];
        })
    };
}

/* Grafik donat UP3 + daftar rekap */
function drawUp3Doughnut(chartKey, canvasId, recapId) {

    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    if (charts[chartKey]) {
        charts[chartKey].destroy();
    }

    const data = countUp3WithUp2d();

    const colors = getUp3ColorPalette(data.labels.length);

    charts[chartKey] = new Chart(canvas, {

        type: "doughnut",

        data: {
            labels: data.labels,
            datasets: [{
                label: "Jumlah Pekerjaan",
                data: data.values,
                backgroundColor: colors
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    renderUp3RecapList(recapId, data.labels, data.values, colors);
}

/* =========================================================
   FILTER GRAFIK: BULAN + ULP (BISA PILIH LEBIH DARI SATU)

   Dipakai oleh 4 grafik:
   "job"  / "dashboardJob"  -> Item Pekerjaan
   "unit" / "dashboardUnit" -> Pekerjaan per ULP

   Kosong = tidak difilter (semua bulan / semua ULP).
========================================================= */

const CHART_FILTER_PREFIXES = ["job", "dashboardJob", "unit", "dashboardUnit"];

const CHART_FILTERS = {};

let ULP_KEYS = [];
let ULP_NAME_MAP = {};

function getFilterState(prefix) {

    if (!prefix) {
        return { month: "", ulps: new Set() };
    }

    if (!CHART_FILTERS[prefix]) {
        CHART_FILTERS[prefix] = { month: "", ulps: new Set() };
    }

    return CHART_FILTERS[prefix];
}

/* Baris data yang lolos filter bulan & ULP milik sebuah grafik */
function getFilteredRows(prefix) {

    const state = getFilterState(prefix);

    return DATA.filter(function (row) {

        if (
            state.month &&
            (!row.dateObject || monthKeyOf(row.dateObject) !== state.month)
        ) {
            return false;
        }

        if (state.ulps.size && !state.ulps.has(normalizeKey(row.ulp))) {
            return false;
        }

        return true;
    });
}

function redrawChartByPrefix(prefix) {

    if (typeof Chart === "undefined") {
        return;
    }

    if (prefix === "job") {
        drawJobBarChart("job", "jobChart", "job");
    } else if (prefix === "dashboardJob") {
        drawJobBarChart("dashboardJob", "dashboardJobChart", "dashboardJob");
    } else if (prefix === "unit") {
        drawUlpBarChart("unit", "unitChart", "unitRecapList", "unit");
    } else if (prefix === "dashboardUnit") {
        drawUlpBarChart("dashboardUnit", "dashboardUnitChart", "", "dashboardUnit");
    }
}

function getFilterBox(prefix) {

    return document.querySelector('[data-filter="' + prefix + '"]');
}

function updateUlpButtonLabel(prefix) {

    const box = getFilterBox(prefix);

    if (!box) {
        return;
    }

    const btn = box.querySelector('[data-role="msBtn"]');
    const state = getFilterState(prefix);

    let text = "Semua ULP";

    if (state.ulps.size === 1) {
        const key = Array.from(state.ulps)[0];
        text = ULP_NAME_MAP[key] || key;
    } else if (state.ulps.size > 1) {
        text = state.ulps.size + " ULP dipilih";
    }

    if (btn) {
        btn.textContent = text;
        btn.title = text;
    }
}

function renderUlpOptions(prefix) {

    const box = getFilterBox(prefix);

    if (!box) {
        return;
    }

    const list = box.querySelector('[data-role="msList"]');
    const search = box.querySelector('[data-role="msSearch"]');

    if (!list) {
        return;
    }

    const query = normalizeKey(search ? search.value : "");
    const state = getFilterState(prefix);

    const keys = ULP_KEYS.filter(function (key) {
        return !query || key.includes(query);
    });

    if (!keys.length) {
        list.innerHTML = '<div class="ms-empty">ULP tidak ditemukan.</div>';
        return;
    }

    list.innerHTML = keys.map(function (key) {

        return `
            <label class="ms-item">
                <input type="checkbox" value="${escapeAttribute(key)}"
                       ${state.ulps.has(key) ? "checked" : ""}>
                <span>${escapeHTML(ULP_NAME_MAP[key] || key)}</span>
            </label>
        `;
    }).join("");
}

/* Bangun tampilan filter (Bulan + ULP + Reset) di dalam wadah data-filter */
function buildChartFilter(prefix) {

    const box = getFilterBox(prefix);

    if (!box) {
        return;
    }

    box.innerHTML = `
        <label>Bulan</label>
        <input type="month" data-role="month">

        <label>ULP</label>
        <div class="ms">
            <button type="button" class="ms-btn" data-role="msBtn">Semua ULP</button>
            <div class="ms-menu" data-role="msMenu" hidden>
                <input type="text" class="ms-search" data-role="msSearch"
                       placeholder="Cari ULP...">
                <div class="ms-actions">
                    <span>Kosong = semua ULP</span>
                    <button type="button" class="text-btn" data-role="msClear">
                        Hapus pilihan
                    </button>
                </div>
                <div class="ms-list" data-role="msList"></div>
            </div>
        </div>

        <button type="button" class="text-btn" data-role="reset">Reset</button>
    `;

    const state = getFilterState(prefix);

    const monthEl = box.querySelector('[data-role="month"]');
    const btn = box.querySelector('[data-role="msBtn"]');
    const menu = box.querySelector('[data-role="msMenu"]');
    const search = box.querySelector('[data-role="msSearch"]');
    const list = box.querySelector('[data-role="msList"]');
    const clearBtn = box.querySelector('[data-role="msClear"]');
    const resetBtn = box.querySelector('[data-role="reset"]');

    monthEl.value = state.month;

    monthEl.addEventListener("change", function () {
        state.month = monthEl.value;
        redrawChartByPrefix(prefix);
    });

    btn.addEventListener("click", function () {

        const willOpen = menu.hidden;

        document.querySelectorAll(".ms-menu").forEach(function (m) {
            m.hidden = true;
        });

        menu.hidden = !willOpen;

        if (willOpen) {
            search.value = "";
            renderUlpOptions(prefix);
            search.focus();
        }
    });

    search.addEventListener("input", function () {
        renderUlpOptions(prefix);
    });

    list.addEventListener("change", function (event) {

        const input = event.target;

        if (!input || input.type !== "checkbox") {
            return;
        }

        if (input.checked) {
            state.ulps.add(input.value);
        } else {
            state.ulps.delete(input.value);
        }

        updateUlpButtonLabel(prefix);
        redrawChartByPrefix(prefix);
    });

    clearBtn.addEventListener("click", function () {
        state.ulps.clear();
        renderUlpOptions(prefix);
        updateUlpButtonLabel(prefix);
        redrawChartByPrefix(prefix);
    });

    resetBtn.addEventListener("click", function () {
        state.month = "";
        state.ulps.clear();
        monthEl.value = "";
        search.value = "";
        renderUlpOptions(prefix);
        updateUlpButtonLabel(prefix);
        menu.hidden = true;
        redrawChartByPrefix(prefix);
    });

    updateUlpButtonLabel(prefix);

    /* Baris ringkasan "sedang menampilkan apa" di bawah judul grafik */
    const header = box.closest(".panel-header");

    if (header) {

        const summary = document.createElement("div");

        summary.className = "filter-summary";
        summary.setAttribute("data-summary", prefix);
        summary.textContent = "ULP: Semua ULP • Bulan: Semua bulan";

        header.insertAdjacentElement("afterend", summary);
    }
}

/* Dipanggil sekali saat halaman dimuat */
function initChartFilters() {

    CHART_FILTER_PREFIXES.forEach(buildChartFilter);

    /* Klik di luar dropdown menutupnya */
    document.addEventListener("click", function (event) {

        document.querySelectorAll(".ms-menu").forEach(function (menu) {

            if (!menu.parentElement.contains(event.target)) {
                menu.hidden = true;
            }
        });
    });
}

/* Dipanggil tiap data dimuat: isi daftar ULP & batas bulan */
function setupChartFilterOptions() {

    const months = getAvailableMonths();

    const map = {};

    DATA.forEach(function (row) {

        const key = normalizeKey(row.ulp);

        if (key && !(key in map)) {
            map[key] = row.ulp;
        }
    });

    ULP_NAME_MAP = map;

    ULP_KEYS = Object.keys(map).sort(function (a, b) {
        return map[a].localeCompare(map[b]);
    });

    CHART_FILTER_PREFIXES.forEach(function (prefix) {

        const box = getFilterBox(prefix);

        if (!box) {
            return;
        }

        const monthEl = box.querySelector('[data-role="month"]');

        if (monthEl && months.length) {
            monthEl.min = months[0];
            monthEl.max = months[months.length - 1];
        }

        renderUlpOptions(prefix);
        updateUlpButtonLabel(prefix);
    });
}

const MONTH_NAMES_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function formatMonthLabel(monthKey) {

    const parts = String(monthKey || "").split("-");

    const name = MONTH_NAMES_ID[Number(parts[1]) - 1];

    return name ? name + " " + parts[0] : monthKey;
}

/*
 * Baris ringkasan di bawah judul grafik: ULP & bulan yang sedang
 * ditampilkan serta jumlah laporan yang dihitung.
 */
function updateFilterSummary(prefix, count) {

    const el = document.querySelector('[data-summary="' + prefix + '"]');

    if (!el) {
        return;
    }

    const state = getFilterState(prefix);

    let ulpText = "Semua ULP";

    if (state.ulps.size) {

        const names = Array.from(state.ulps)
            .map(function (key) {
                return ULP_NAME_MAP[key] || key;
            })
            .sort(function (a, b) {
                return a.localeCompare(b);
            });

        ulpText = names.length > 4
            ? names.slice(0, 4).join(", ") + " +" + (names.length - 4) + " lainnya"
            : names.join(", ");
    }

    const monthText = state.month
        ? formatMonthLabel(state.month)
        : "Semua bulan";

    el.innerHTML =
        "ULP: <b>" + escapeHTML(ulpText) + "</b>" +
        " &nbsp;•&nbsp; Bulan: <b>" + escapeHTML(monthText) + "</b>" +
        " &nbsp;•&nbsp; <b>" + count + "</b> laporan";
}

/*
 * Grafik batang VERTIKAL (memanjang ke atas) "Item Pekerjaan",
 * mengikuti filter Bulan & ULP milik grafik ini (filterPrefix).
 *
 * Penanda ULP pelaksana:
 * - Bila 2 ULP atau lebih dipilih: batang ditumpuk per ULP, tiap ULP
 *   punya warna sendiri + legenda, jadi terlihat siapa mengerjakan apa.
 * - Bila 0/1 ULP dipilih: satu warna, tetapi tooltip menampilkan
 *   rincian "Dilakukan oleh" per ULP untuk pekerjaan tersebut.
 */
function drawJobBarChart(chartKey, canvasId, filterPrefix) {

    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    if (charts[chartKey]) {
        charts[chartKey].destroy();
    }

    const state = getFilterState(filterPrefix);

    const rows = getFilteredRows(filterPrefix);

    updateFilterSummary(filterPrefix, rows.length);

    const jobNames = {};
    const jobTotals = {};
    const byJobUlp = {};
    const ulpLabels = {};

    rows.forEach(function (row) {

        const jobName = row.job || "Tidak diketahui";
        const jobKey = normalizeKey(jobName);

        const ulpName = row.ulp || "Tidak diketahui";
        const ulpKey = normalizeKey(ulpName);

        if (!(jobKey in jobNames)) {
            jobNames[jobKey] = jobName;
        }

        if (!(ulpKey in ulpLabels)) {
            ulpLabels[ulpKey] = ulpName;
        }

        jobTotals[jobKey] = (jobTotals[jobKey] || 0) + 1;

        if (!byJobUlp[jobKey]) {
            byJobUlp[jobKey] = {};
        }

        byJobUlp[jobKey][ulpKey] = (byJobUlp[jobKey][ulpKey] || 0) + 1;
    });

    const jobKeys = Object.keys(jobNames).sort(function (a, b) {
        return (jobTotals[b] - jobTotals[a]) ||
               jobNames[a].localeCompare(jobNames[b]);
    });

    const stacked = state.ulps.size >= 2;

    let datasets;

    if (stacked) {

        const ulpKeys = Array.from(state.ulps).sort(function (a, b) {
            return (ULP_NAME_MAP[a] || a).localeCompare(ULP_NAME_MAP[b] || b);
        });

        const colors = getUp3ColorPalette(ulpKeys.length);

        datasets = ulpKeys.map(function (ulpKey, i) {
            return {
                label: ULP_NAME_MAP[ulpKey] || ulpKey,
                data: jobKeys.map(function (jobKey) {
                    return (byJobUlp[jobKey] && byJobUlp[jobKey][ulpKey]) || 0;
                }),
                backgroundColor: colors[i],
                borderRadius: 2,
                stack: "ulp"
            };
        });

    } else {

        datasets = [{
            label: "Jumlah Laporan",
            data: jobKeys.map(function (jobKey) {
                return jobTotals[jobKey];
            }),
            backgroundColor: CHART_NAVY,
            borderRadius: 4
        }];
    }

    const wrap = canvas.parentElement;

    if (wrap) {
        wrap.style.minWidth = Math.max(jobKeys.length, 1) * 44 + "px";
    }

    charts[chartKey] = new Chart(canvas, {

        type: "bar",

        data: {
            labels: jobKeys.map(function (jobKey) {
                return jobNames[jobKey];
            }),
            datasets: datasets
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: stacked
                ? { mode: "index", intersect: false }
                : { mode: "nearest", intersect: true },
            plugins: {
                legend: {
                    display: stacked,
                    position: "top"
                },
                tooltip: {
                    filter: function (item) {
                        return !stacked || item.parsed.y > 0;
                    },
                    callbacks: {
                        afterBody: function (items) {

                            if (stacked || !items.length) {
                                return [];
                            }

                            const jobKey = jobKeys[items[0].dataIndex];
                            const parts = byJobUlp[jobKey] || {};

                            const lines = Object.keys(parts)
                                .sort(function (a, b) {
                                    return parts[b] - parts[a];
                                })
                                .slice(0, 10)
                                .map(function (ulpKey) {
                                    return "• " + (ulpLabels[ulpKey] || ulpKey) +
                                           ": " + parts[ulpKey];
                                });

                            return ["", "Dilakukan oleh:"].concat(lines);
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: stacked,
                    ticks: {
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 45,
                        font: { size: 11 },
                        callback: function (value) {
                            const label = this.getLabelForValue(value);
                            return label.length > 26
                                ? label.slice(0, 25) + "…"
                                : label;
                        }
                    }
                },
                y: {
                    stacked: stacked,
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}


/* =========================================================
   GRAFIK HARIAN
========================================================= */

/* Daftar angka (tanggal + jumlah) di bawah grafik Pekerjaan per Hari */
function renderDailyRecap(labels, values) {

    const colors = labels.map(function () {
        return CHART_BLUE;
    });

    renderUp3RecapList("dailyRecapList", labels, values, colors, {
        sort: false,
        totalLabel: "Total Pekerjaan Bulan Ini"
    });
}

function renderDailyChart() {

    const canvas = $("dailyChart");

    if (!canvas) {
        return;
    }

    if (charts.daily) {
        charts.daily.destroy();
    }

    const monthInput = $("dailyChartMonth");

    const selectedMonth =
        monthInput && monthInput.value
            ? monthInput.value
            : getLatestAvailableMonth();

    const counts = {};

    DATA.forEach(function (row) {

        if (!row.dateObject || !row.dateOnly || row.dateOnly === "-") {
            return;
        }

        if (selectedMonth && monthKeyOf(row.dateObject) !== selectedMonth) {
            return;
        }

        counts[row.dateOnly] = (counts[row.dateOnly] || 0) + 1;
    });

    /* Label untuk SEMUA tanggal pada bulan terpilih */
    let labels = [];

    if (selectedMonth) {

        const parts = selectedMonth.split("-");
        const year = Number(parts[0]);
        const month = Number(parts[1]);

        if (!isNaN(year) && !isNaN(month)) {

            const daysInMonth = new Date(year, month, 0).getDate();

            for (let day = 1; day <= daysInMonth; day++) {

                labels.push(
                    `${String(day).padStart(2, "0")}/` +
                    `${String(month).padStart(2, "0")}/${year}`
                );
            }
        }
    }

    /* Fallback: pakai tanggal yang ada di data */
    if (!labels.length) {

        const toSortable = function (s) {
            const p = s.split("/");
            return `${p[2]}-${p[1]}-${p[0]}`;
        };

        labels = Object.keys(counts).sort(function (a, b) {
            return toSortable(a).localeCompare(toSortable(b));
        });
    }

    const values = labels.map(function (label) {
        return counts[label] || 0;
    });

    charts.daily = new Chart(canvas, {

        type: "bar",

        data: {
            labels: labels,
            datasets: [{
                label: "Jumlah Pekerjaan",
                data: values,
                backgroundColor: "#0F62B5",
                borderRadius: 6
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });

    /* Angka per tanggal, ikut berubah saat bulan diganti */
    renderDailyRecap(labels, values);
}


/* =========================================================
   GRAFIK ULP YANG MELAPOR PER HARI (30 HARI TERAKHIR)
   (hanya tampil bila canvas #ulpDailyChart ada di HTML)
========================================================= */

function renderUlpDailyChart() {

    const canvas = $("ulpDailyChart");

    if (!canvas) {
        return;
    }

    if (charts.ulpDaily) {
        charts.ulpDaily.destroy();
    }

    const DAYS = 30;

    const ulpPerDay = {};

    DATA.forEach(function (row) {

        const key = normalizeKey(row.ulp);

        if (!row.dateObject || !key) {
            return;
        }

        if (!ulpPerDay[row.dateOnly]) {
            ulpPerDay[row.dateOnly] = new Set();
        }

        ulpPerDay[row.dateOnly].add(key);
    });

    const labels = [];
    const values = [];

    const today = new Date();

    for (let i = DAYS - 1; i >= 0; i--) {

        const d = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - i
        );

        const full = formatDateOnly(d);

        labels.push(full.slice(0, 5));

        values.push(ulpPerDay[full] ? ulpPerDay[full].size : 0);
    }

    const totalUnit = CCTV_SUMMARY.totalUnit;

    charts.ulpDaily = new Chart(canvas, {

        data: {
            labels: labels,
            datasets: [
                {
                    type: "bar",
                    label: "ULP yang melapor",
                    data: values,
                    backgroundColor: "#0F62B5",
                    borderRadius: 6,
                    order: 2
                },
                {
                    type: "line",
                    label: "Total unit (" + totalUnit + ")",
                    data: labels.map(function () {
                        return totalUnit;
                    }),
                    borderColor: "#DC2626",
                    borderDash: [6, 6],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    order: 1
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: totalUnit,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}


/* =========================================================
   GRAFIK ULP, UP3, PERANGKAT, ITEM PEKERJAAN
========================================================= */

function renderUnitChart() {

    drawUlpBarChart("unit", "unitChart", "unitRecapList", "unit");
}

function renderUp3Chart() {

    drawUp3Doughnut("up3", "up3Chart", "up3RecapList");
}

function renderDashboardUnitChart() {

    drawUlpBarChart("dashboardUnit", "dashboardUnitChart", "", "dashboardUnit");
}

function renderDashboardUp3Chart() {

    drawUp3Doughnut("dashboardUp3", "dashboardUp3Chart", "dashboardUp3RecapList");
}

function renderDeviceChart() {

    const d = countByField("device", "Tidak diketahui");

    drawBarChart(
        "device",
        "deviceChart",
        d.labels,
        d.values,
        CHART_NAVY,
        "Jumlah Laporan"
    );
}

function renderJobChart() {

    drawJobBarChart("job", "jobChart", "job");
}

function renderDashboardJobChart() {

    drawJobBarChart("dashboardJob", "dashboardJobChart", "dashboardJob");
}


/* =========================================================
   PDF — UTILITAS BERSAMA
========================================================= */

function createPdfBase(subtitle) {

    if (
        typeof window.jspdf === "undefined" ||
        typeof window.jspdf.jsPDF === "undefined"
    ) {
        throw new Error("Pustaka jsPDF tidak ditemukan.");
    }

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4"
    });

    const ctx = {
        doc: doc,
        pageWidth: doc.internal.pageSize.getWidth(),
        pageHeight: doc.internal.pageSize.getHeight(),
        marginLeft: 24,
        marginRight: 24,
        marginBottom: 40,
        cursorY: 74
    };

    doc.setFontSize(14);
    doc.setFont(undefined, "bold");

    doc.text(
        "Logsheet Monitoring CCTV Online UID SSTB",
        ctx.pageWidth / 2,
        40,
        { align: "center" }
    );

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");

    doc.text(subtitle, ctx.pageWidth / 2, 58, { align: "center" });

    return ctx;
}

function pdfEnsureSpace(ctx, neededHeight) {

    if (ctx.cursorY + neededHeight > ctx.pageHeight - ctx.marginBottom) {

        ctx.doc.addPage();

        ctx.cursorY = 40;
    }
}

/* Nomor halaman ditulis di akhir, supaya "n / total" benar */
function pdfAddPageNumbers(ctx) {

    const doc = ctx.doc;

    const total = doc.internal.getNumberOfPages();

    for (let i = 1; i <= total; i++) {

        doc.setPage(i);

        doc.setFontSize(8);

        doc.text(
            "Halaman " + i + " / " + total,
            ctx.pageWidth - ctx.marginRight,
            ctx.pageHeight - 16,
            { align: "right" }
        );
    }
}

function pdfAddTable(ctx, head, body) {

    ctx.doc.autoTable({

        startY: ctx.cursorY,

        head: [head],

        body: body,

        styles: {
            fontSize: 7.5,
            cellPadding: 4,
            overflow: "linebreak"
        },

        headStyles: {
            fillColor: [15, 98, 181],
            textColor: [255, 255, 255],
            fontStyle: "bold"
        },

        alternateRowStyles: {
            fillColor: [234, 243, 252]
        },

        columnStyles: {
            0: { cellWidth: 26 }
        },

        margin: {
            left: ctx.marginLeft,
            right: ctx.marginRight,
            bottom: ctx.marginBottom
        }
    });

    ctx.cursorY = ctx.doc.lastAutoTable.finalY + 22;
}


/* =========================================================
   PDF — DATA LAPORAN (HANYA LAPORAN HARI INI)
========================================================= */

function buildLaporanPdfDoc() {

    const todayKey = formatDateOnly(new Date());

    const ctx = createPdfBase(
        "Rekap Laporan Harian — Tanggal " + todayKey +
        " — dicetak pada " + formatDateTime(new Date())
    );

    const doc = ctx.doc;

    const rowsToday = getSortedByDateDesc(
        DATA.filter(function (row) {
            return row.dateOnly === todayKey;
        })
    );

    if (!rowsToday.length) {

        doc.setFontSize(11);

        doc.text(
            "Belum ada laporan yang masuk pada tanggal " + todayKey + ".",
            ctx.marginLeft,
            ctx.cursorY
        );

        pdfAddPageNumbers(ctx);

        return doc;
    }

    /* ULP unik yang sudah melapor hari ini */
    const seenUlpKeys = new Set();
    const uniqueUlp = [];

    rowsToday.forEach(function (row) {

        const key = normalizeKey(row.ulp);

        if (key && !seenUlpKeys.has(key)) {
            seenUlpKeys.add(key);
            uniqueUlp.push(row.ulp);
        }
    });

    pdfEnsureSpace(ctx, 50);

    doc.setFontSize(11.5);
    doc.setFont(undefined, "bold");
    doc.setTextColor(15, 98, 181);

    doc.text("Tanggal: " + todayKey, ctx.marginLeft, ctx.cursorY);

    doc.setTextColor(0, 0, 0);

    ctx.cursorY += 16;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");

    const ringkasanText =
        "ULP yang sudah melapor hari ini (" + uniqueUlp.length + "): " +
        (uniqueUlp.length ? uniqueUlp.join(", ") : "-");

    const wrapped = doc.splitTextToSize(
        ringkasanText,
        ctx.pageWidth - ctx.marginLeft - ctx.marginRight
    );

    pdfEnsureSpace(ctx, wrapped.length * 11 + 10);

    doc.text(wrapped, ctx.marginLeft, ctx.cursorY);

    ctx.cursorY += wrapped.length * 11 + 6;

    pdfAddTable(
        ctx,
        ["No", "Waktu", "UP3", "ULP", "Perangkat", "Pekerjaan", "Lokasi", "Petugas", "Dokumentasi"],
        rowsToday.map(function (row, index) {
            return [
                index + 1,
                row.dateText || "-",
                row.up3 || "-",
                row.ulp || "-",
                row.device || "-",
                row.job || "-",
                row.location || "-",
                row.officer || "-",
                row.documentation ? "Ada" : "-"
            ];
        })
    );

    pdfAddPageNumbers(ctx);

    return doc;
}


/* =========================================================
   PDF — REKAP LAPORAN SATU ULP PADA SATU HARI
========================================================= */

function buildUlpPdfDoc(ulp, dateKey) {

    const ctx = createPdfBase(
        "Rekap Laporan Harian — ULP " + ulp +
        " — Tanggal " + dateKey +
        " — dicetak pada " + formatDateTime(new Date())
    );

    const doc = ctx.doc;

    const targetUlpKey = normalizeKey(ulp);

    const rowsUlp = getSortedByDateDesc(
        DATA.filter(function (row) {
            return (
                normalizeKey(row.ulp) === targetUlpKey &&
                row.dateOnly === dateKey
            );
        })
    );

    if (!rowsUlp.length) {

        doc.setFontSize(11);

        doc.text(
            "Belum ada laporan ULP " + ulp + " pada tanggal " + dateKey + ".",
            ctx.marginLeft,
            ctx.cursorY
        );

        pdfAddPageNumbers(ctx);

        return doc;
    }

    pdfEnsureSpace(ctx, 40);

    doc.setFontSize(11.5);
    doc.setFont(undefined, "bold");
    doc.setTextColor(15, 98, 181);

    doc.text(
        "Tanggal: " + dateKey + "  —  Jumlah Laporan: " + rowsUlp.length,
        ctx.marginLeft,
        ctx.cursorY
    );

    doc.setTextColor(0, 0, 0);

    ctx.cursorY += 18;

    pdfAddTable(
        ctx,
        ["No", "Waktu", "UP3", "Perangkat", "Pekerjaan", "Lokasi", "Petugas", "Dokumentasi"],
        rowsUlp.map(function (row, index) {
            return [
                index + 1,
                row.dateText || "-",
                row.up3 || "-",
                row.device || "-",
                row.job || "-",
                row.location || "-",
                row.officer || "-",
                row.documentation ? "Ada" : "-"
            ];
        })
    );

    pdfAddPageNumbers(ctx);

    return doc;
}


/* =========================================================
   MODAL PDF
========================================================= */

function showPdfModal(mode, ulp, dateKey, title, desc, builder) {

    const modal = $("pdfModal");
    const statusEl = $("pdfStatus");
    const frame = $("pdfPreviewFrame");
    const titleEl = $("pdfModalTitle");
    const descEl = $("pdfModalDesc");

    if (!modal) {
        return;
    }

    modal.dataset.pdfMode = mode;
    modal.dataset.pdfUlp = ulp || "";
    modal.dataset.pdfDate = dateKey || "";

    if (titleEl) {
        titleEl.textContent = title;
    }

    if (descEl) {
        descEl.textContent = desc;
    }

    modal.classList.add("active");

    if (statusEl) {
        statusEl.textContent = "Menyiapkan PDF...";
        statusEl.style.display = "block";
    }

    if (frame) {
        frame.style.display = "none";
    }

    /* Jeda agar status "Menyiapkan PDF..." sempat tampil */
    setTimeout(function () {

        try {

            const blob = builder().output("blob");

            if (currentPdfBlobUrl) {
                URL.revokeObjectURL(currentPdfBlobUrl);
            }

            currentPdfBlobUrl = URL.createObjectURL(blob);

            if (frame) {
                frame.src = currentPdfBlobUrl;
                frame.style.display = "block";
            }

            if (statusEl) {
                statusEl.style.display = "none";
            }

        } catch (error) {

            console.error("Gagal membuat PDF:", error);

            if (statusEl) {
                statusEl.textContent = "Gagal membuat PDF: " + error.message;
            }
        }
    }, 50);
}

function openPdfModal() {

    const todayKey = formatDateOnly(new Date());

    showPdfModal(
        "all",
        "",
        todayKey,
        "Rekap Laporan Harian (PDF)",
        "Laporan yang masuk hari ini (" + todayKey + ") saja.",
        buildLaporanPdfDoc
    );
}

function openUlpPdfModal(rowNumber) {

    const row = DATA.find(function (item) {
        return Number(item.rowNumber) === Number(rowNumber);
    });

    if (!row) {
        alert("Data tidak ditemukan.");
        return;
    }

    const ulp = row.ulp || "Tidak Diketahui";

    const dateKey = row.dateOnly;

    showPdfModal(
        "ulp",
        ulp,
        dateKey,
        "Rekap Laporan ULP " + ulp + " (PDF)",
        "Laporan ULP ini pada tanggal " + dateKey + " saja.",
        function () {
            return buildUlpPdfDoc(ulp, dateKey);
        }
    );
}

function closePdfModal() {

    const modal = $("pdfModal");

    if (modal) {
        modal.classList.remove("active");
    }
}

function downloadLaporanPdf() {

    try {

        const modal = $("pdfModal");

        const mode = modal ? modal.dataset.pdfMode : "all";
        const ulp = modal ? modal.dataset.pdfUlp : "";
        const dateKey = modal ? modal.dataset.pdfDate : "";

        const isUlpMode = mode === "ulp" && ulp;

        const doc = isUlpMode
            ? buildUlpPdfDoc(ulp, dateKey)
            : buildLaporanPdfDoc();

        const datePart = (
            isUlpMode && dateKey ? dateKey : formatDateOnly(new Date())
        )
            .split("/")
            .join("-");

        const filename = isUlpMode
            ? "rekap-ulp-" +
              ulp
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "") +
              "-" + datePart + ".pdf"
            : "data-laporan-cctv-" + datePart + ".pdf";

        doc.save(filename);

    } catch (error) {

        console.error("Gagal mengunduh PDF:", error);

        alert("Gagal membuat PDF: " + error.message);
    }
}


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener("DOMContentLoaded", async function () {

    console.log("Website CCTV UID SSTB dimulai.");

    loadTheme();

    /* NAVIGATION */

    document.querySelectorAll(".nav-link").forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            const view = this.dataset.view;

            if (view) {
                showView(view);
            }
        });
    });

    document.querySelectorAll("[data-view-target]").forEach(function (button) {

        button.addEventListener("click", function () {

            const view = this.dataset.viewTarget;

            if (view) {
                showView(view);
            }
        });
    });

    /* SEARCH */

    const globalSearch = $("globalSearch");

    if (globalSearch) {
        globalSearch.addEventListener("input", function () {
            searchData(this.value);
        });
    }

    const laporanSearch = $("laporanSearch");

    if (laporanSearch) {
        laporanSearch.addEventListener("input", function () {
            searchData(this.value);
        });
    }

    const monitoringSearch = $("monitoringSearch");

    if (monitoringSearch) {

        monitoringSearch.addEventListener("input", function () {

            const keyword = this.value.toLowerCase().trim();

            if (!keyword) {
                renderMonitoring();
                return;
            }

            const filtered = DATA.filter(function (row) {

                const text = [
                    row.dateText,
                    row.up3,
                    row.ulp,
                    row.device,
                    row.job,
                    row.location,
                    row.officer
                ]
                    .join(" ")
                    .toLowerCase();

                return text.includes(keyword);
            });

            renderMonitoring(filtered);
        });
    }

    /* THEME & MOBILE MENU */

    const themeButton = $("themeToggle");

    if (themeButton) {
        themeButton.addEventListener("click", toggleTheme);
    }

    const mobileMenu = $("mobileMenu");
    const sidebar = $("sidebar");

    if (mobileMenu && sidebar) {
        mobileMenu.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });
    }

    /* MODAL EDIT */

    const closeModalBtn = $("closeEditModal");

    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeEditModal);
    }

    const cancelButton = $("cancelEditBtn");

    if (cancelButton) {
        cancelButton.addEventListener("click", closeEditModal);
    }

    const editForm = $("editForm");

    if (editForm) {
        editForm.addEventListener("submit", saveEdit);
    }

    const editModal = $("editModal");

    if (editModal) {
        editModal.addEventListener("click", function (event) {
            if (event.target === editModal) {
                closeEditModal();
            }
        });
    }

    /* MODAL PDF */

    const viewPdfBtn = $("viewPdfBtn");

    if (viewPdfBtn) {
        viewPdfBtn.addEventListener("click", openPdfModal);
    }

    const closePdfModalX = $("closePdfModal");

    if (closePdfModalX) {
        closePdfModalX.addEventListener("click", closePdfModal);
    }

    const closePdfModalBtn = $("closePdfModalBtn");

    if (closePdfModalBtn) {
        closePdfModalBtn.addEventListener("click", closePdfModal);
    }

    const downloadPdfBtn = $("downloadPdfBtn");

    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener("click", downloadLaporanPdf);
    }

    const pdfModal = $("pdfModal");

    if (pdfModal) {
        pdfModal.addEventListener("click", function (event) {
            if (event.target === pdfModal) {
                closePdfModal();
            }
        });
    }

    /* SETTINGS DRAWER */

    const drawerOverlay = $("drawerOverlay");

    ["settingsBtn", "settingsBtnLaporan"].forEach(function (id) {

        const btn = $(id);

        if (btn && drawerOverlay) {
            btn.addEventListener("click", function () {
                drawerOverlay.classList.add("active");
            });
        }
    });

    const closeDrawer = $("closeDrawer");

    if (closeDrawer && drawerOverlay) {
        closeDrawer.addEventListener("click", function () {
            drawerOverlay.classList.remove("active");
        });
    }

    if (drawerOverlay) {
        drawerOverlay.addEventListener("click", function (event) {
            if (event.target === drawerOverlay) {
                drawerOverlay.classList.remove("active");
            }
        });
    }

    /* HUBUNGKAN URL CSV */

    const loadUrlBtn = $("loadUrlBtn");
    const csvUrlInput = $("csvUrlInput");
    const statusMsg = $("statusMsg");

    if (csvUrlInput) {
        csvUrlInput.value =
            localStorage.getItem(STORAGE_URL) || DEFAULT_CSV_URL;
    }

    if (loadUrlBtn) {

        loadUrlBtn.addEventListener("click", async function () {

            const url = csvUrlInput ? csvUrlInput.value.trim() : "";

            if (!url) {
                alert("URL Google Sheets belum diisi.");
                return;
            }

            if (statusMsg) {
                statusMsg.textContent = "Menghubungkan...";
            }

            const success = await loadFromURL(url);

            if (statusMsg) {
                statusMsg.textContent = success
                    ? "Data berhasil terhubung."
                    : "Gagal menghubungkan data.";
            }
        });
    }

    /* FILTER GRAFIK */

    const dailyChartMonth = $("dailyChartMonth");

    if (dailyChartMonth) {
        dailyChartMonth.addEventListener("change", renderDailyChart);
    }

    /* Filter Bulan + ULP (multi-pilih) untuk grafik Item Pekerjaan & Pekerjaan per ULP */

    initChartFilters();

    /* REFRESH */

    const refreshBtn = $("refreshBtnMain");

    if (refreshBtn) {

        refreshBtn.addEventListener("click", async function () {

            refreshBtn.disabled = true;
            refreshBtn.textContent = "↻ Memuat...";

            const url = localStorage.getItem(STORAGE_URL) || DEFAULT_CSV_URL;

            await loadFromURL(url);

            await loadCctvSummary();

            refreshBtn.disabled = false;
            refreshBtn.textContent = "↻ Refresh";
        });
    }

    /* LOAD DATA AWAL */

    const csvURL = localStorage.getItem(STORAGE_URL) || DEFAULT_CSV_URL;

    console.log("CSV URL:", csvURL);
    console.log("API URL:", DEFAULT_API_URL);

    await loadFromURL(csvURL);

    await loadCctvSummary();

    console.log("Website selesai dimuat.");
});


/* =========================================================
   AGAR onclick HTML BISA MEMANGGIL EDIT & PDF ULP
========================================================= */

window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEdit = saveEdit;
window.openUlpPdfModal = openUlpPdfModal;