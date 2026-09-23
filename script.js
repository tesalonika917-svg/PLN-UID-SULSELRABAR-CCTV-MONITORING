/* =========================================================
   KONFIGURASI
========================================================= */

const DEFAULT_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWRM7E3rtMsJVWf9z1cntdblP4nSP9p0QCC6DeEbVt_3MHbjicUDgP2AsgLPV-NaNAYH3YZfDwFXhI/pub?output=csv";

const STORAGE_URL =
    "cctv_uid_sstb_csv_url";

/*
 * GOOGLE APPS SCRIPT WEB APP
 *
 * Digunakan untuk menyimpan hasil EDIT
 * kembali ke Google Spreadsheet.
 */
const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbyYQ6Y472HiCSD0TJl-ejeU-Lb0vPSs__fAK_eUxJWhHePr_S63tM58GfMD_JXONOGL/exec";


/* =========================================================
   VARIABEL GLOBAL
========================================================= */

let DATA = [];

let currentEditingRow = null;

let charts = {};

/*
 * Penanda proses simpan sedang berjalan,
 * untuk mencegah klik ganda (double submit)
 * mengirim dua request bersamaan ke Apps Script.
 */
let isSavingEdit = false;

/*
 * Ringkasan Jumlah CCTV & Unit.
 *
 * - totalUnit bersifat TETAP/MANUAL (61), jadi
 *   langsung diisi 61 dari awal, tidak menunggu
 *   respons Apps Script. Kalaupun API gagal total,
 *   angka Unit tetap tampil benar.
 *
 * - totalCctv diambil dari tab "MONITORING CCTV"
 *   (kolom "Implementasi") lewat Apps Script (doGet),
 *   bukan dari tab laporan (Form Responses 1).
 */
let CCTV_SUMMARY = {
    totalCctv: 0,
    totalUnit: 61
};


/* =========================================================
   HELPER DOM
========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   GET VALUE
========================================================= */

function getValue(row, key) {

    if (!row) {
        return "";
    }

    if (
        row[key] !== undefined &&
        row[key] !== null
    ) {
        return String(row[key]).trim();
    }

    return "";
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   ESCAPE ATTRIBUTE
========================================================= */

function escapeAttribute(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


/* =========================================================
   PARSE TANGGAL
========================================================= */

function parseDate(value) {

    if (!value) {
        return null;
    }

    if (value instanceof Date) {

        return isNaN(value.getTime())
            ? null
            : value;
    }

    const text = String(value).trim();

    if (!text) {
        return null;
    }


    /* -----------------------------------------
       Format Indonesia (dicek LEBIH DULU)

       dd/mm/yyyy
       dd/mm/yyyy hh:mm
       dd/mm/yyyy hh:mm:ss

       PENTING:
       Timestamp dari Google Sheets dengan locale
       Indonesia memakai format dd/mm/yyyy. Kalau
       kita coba new Date(text) duluan, JavaScript
       akan salah membacanya sebagai mm/dd/yyyy
       (gaya Amerika), sehingga tanggal & bulan
       tertukar (misalnya 12/09/2026 yang seharusnya
       12 September malah terbaca 9 Desember).

       Karena itu, pola dd/mm/yyyy dicek & diprioritaskan
       lebih dulu di sini sebelum fallback ke new Date().
    ----------------------------------------- */

    const match = text.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (match) {

        const day =
            Number(match[1]);

        const month =
            Number(match[2]) - 1;

        const year =
            Number(match[3]);

        const hour =
            Number(match[4] || 0);

        const minute =
            Number(match[5] || 0);

        const second =
            Number(match[6] || 0);

        const parsedDate =
            new Date(
                year,
                month,
                day,
                hour,
                minute,
                second
            );

        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }


    /* -----------------------------------------
       Format ISO / lainnya (fallback)

       Dipakai untuk format yang tidak ambigu,
       misalnya "2026-09-16T10:00:00.000Z".
    ----------------------------------------- */

    const date = new Date(text);

    if (!isNaN(date.getTime())) {
        return date;
    }


    return null;
}


/* =========================================================
   FORMAT TANGGAL + JAM
========================================================= */

function formatDateTime(date) {

    if (!date) {
        return "-";
    }

    const d =
        date instanceof Date
            ? date
            : parseDate(date);

    if (!d || isNaN(d.getTime())) {
        return String(date);
    }

    const day =
        String(d.getDate()).padStart(2, "0");

    const month =
        String(d.getMonth() + 1).padStart(2, "0");

    const year =
        d.getFullYear();

    const hour =
        String(d.getHours()).padStart(2, "0");

    const minute =
        String(d.getMinutes()).padStart(2, "0");

    const second =
        String(d.getSeconds()).padStart(2, "0");

    return (
        `${day}/${month}/${year} ` +
        `${hour}:${minute}:${second}`
    );
}


/* =========================================================
   FORMAT TANGGAL SAJA
========================================================= */

function formatDateOnly(date) {

    if (!date) {
        return "-";
    }

    const d =
        date instanceof Date
            ? date
            : parseDate(date);

    if (!d || isNaN(d.getTime())) {
        return "-";
    }

    const day =
        String(d.getDate()).padStart(2, "0");

    const month =
        String(d.getMonth() + 1).padStart(2, "0");

    const year =
        d.getFullYear();

    return `${day}/${month}/${year}`;
}


/* =========================================================
   FORMAT DATETIME UNTUK INPUT
========================================================= */

function formatDateForInput(value) {

    if (!value) {
        return "";
    }

    const date =
        parseDate(value);

    if (!date) {
        return "";
    }

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    const hour =
        String(date.getHours())
            .padStart(2, "0");

    const minute =
        String(date.getMinutes())
            .padStart(2, "0");

    return (
        `${year}-${month}-${day}` +
        `T${hour}:${minute}`
    );
}


/* =========================================================
   NORMALISASI DATA
========================================================= */

function normalizeRow(row) {

    /* -----------------------------------------
       DATA UTAMA
    ----------------------------------------- */

    const timestamp =
        getValue(
            row,
            "Timestamp"
        );

    const dateObject =
        parseDate(timestamp);


    const up3 =
        getValue(
            row,
            "Unit UP3"
        );


    const ulp =
        getValue(
            row,
            "Unit ULP"
        );


    const device =
        getValue(
            row,
            "NAMA PERANGKAT CCTV"
        );


    const job =
        getValue(
            row,
            "Nama Pekerjaan"
        );


    const location =
        getValue(
            row,
            "Lokasi Pekerjaan"
        );


    const officer =
        getValue(
            row,
            "Petugas Pelaksana di Lapangan"
        );


    const documentation =
        getValue(
            row,
            "Dokumentasi CCTV"
        );


    /* -----------------------------------------
       DATA TEMUAN
    ----------------------------------------- */

    const description =
        getValue(
            row,
            "Deskripsi Temuan (Jika Ada)"
        );


    const findingTime =
        getValue(
            row,
            "Waktu Temuan"
        );


    const findingDocumentation =
        getValue(
            row,
            "Dokumentasi Temuan"
        );


    const followUp =
        getValue(
            row,
            "Tindak Lanjut (Tegur online, CMC, dsb)"
        );


    const information =
        getValue(
            row,
            "Keterangan"
        );


    return {

        original: row,

        rowNumber:
            Number(
                row._row ||
                row._rowNumber ||
                0
            ),

        timestamp,

        dateObject,

        dateText:
            formatDateTime(
                dateObject
            ),

        dateOnly:
            formatDateOnly(
                dateObject
            ),

        up3,

        ulp,

        device,

        job,

        location,

        officer,

        documentation,


        /* DATA POPUP */

        description,

        findingTime,

        findingDocumentation,

        followUp,

        information
    };
}


/* =========================================================
   LOAD DATA DARI GOOGLE SHEETS CSV
========================================================= */

async function loadFromURL(url) {

    try {

        console.log(
            "Memuat data dari:",
            url
        );


        if (
            typeof Papa ===
            "undefined"
        ) {

            throw new Error(
                "PapaParse tidak ditemukan."
            );
        }


        const response =
            await fetch(
                url,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );
        }


        const csvText =
            await response.text();


        console.log(
            "CSV berhasil diterima."
        );


        console.log(
            "Ukuran CSV:",
            csvText.length,
            "karakter"
        );


        const parsed =
            Papa.parse(
                csvText,
                {
                    header: true,

                    skipEmptyLines: true,

                    transformHeader:
                        function(header) {

                            return String(
                                header
                            ).trim();
                        }
                }
            );


        console.log(
            "Jumlah baris CSV:",
            parsed.data.length
        );


        if (
            parsed.errors &&
            parsed.errors.length
        ) {

            console.warn(
                "Peringatan CSV:",
                parsed.errors
            );
        }


        const rows =
            parsed.data || [];


        /* -----------------------------------------
           NORMALISASI DATA
        ----------------------------------------- */

        DATA =
            rows
                .map(
                    function(row, index) {

                        /*
                         * Header Spreadsheet = baris 1
                         * Data pertama = baris 2
                         */

                        row._row =
                            index + 2;

                        return normalizeRow(
                            row
                        );
                    }
                )
                .filter(
                    function(row) {

                        return (
                            row.timestamp ||
                            row.up3 ||
                            row.ulp ||
                            row.device ||
                            row.job ||
                            row.location ||
                            row.officer
                        );
                    }
                );


        console.log(
            "DATA berhasil dimuat:",
            DATA.length
        );


        console.log(
            DATA
        );


        /* -----------------------------------------
           SIMPAN URL
        ----------------------------------------- */

        localStorage.setItem(
            STORAGE_URL,
            url
        );


        /* -----------------------------------------
           RENDER
        ----------------------------------------- */

        renderDashboard();

        renderMonitoring();

        renderLaporan();

        renderCharts();


        updateConnectionStatus(
            true
        );


        return true;


    } catch (error) {

        console.error(
            "Gagal memuat data:",
            error
        );


        updateConnectionStatus(
            false
        );


        const tbody =
            $("laporanTable");


        if (tbody) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="10"
                        style="
                            text-align:center;
                            padding:30px;
                            color:#dc2626;
                        "
                    >
                        Data gagal dimuat.
                        <br><br>
                        ${escapeHTML(
                            error.message
                        )}
                    </td>
                </tr>
            `;
        }


        return false;
    }
}


/* =========================================================
   AMBIL RINGKASAN CCTV DARI TAB "MONITORING CCTV"

   Berbeda dari loadFromURL() yang membaca CSV publish
   tab "Form Responses 1", ringkasan ini diambil langsung
   dari Apps Script (doGet) karena datanya ada di tab lain
   dan supaya tidak perlu publish-to-web terpisah.
========================================================= */

async function loadCctvSummary() {

    try {

        const response =
            await fetch(
                DEFAULT_API_URL,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );
        }


        const text =
            await response.text();


        const result =
            JSON.parse(
                text
            );


        if (
            result &&
            result.cctvSummary
        ) {

            /*
             * Unit selalu diambil dari server kalau ada
             * (server juga mengirim angka manual 61),
             * dengan fallback 61 kalau field-nya kosong.
             * Ini tetap dilakukan walau success:false,
             * supaya KPI Unit tidak ikut kosong hanya
             * karena Total CCTV gagal dihitung.
             */

            CCTV_SUMMARY.totalUnit =
                Number(
                    result.cctvSummary.totalUnit
                ) || 61;


            if (result.cctvSummary.success) {

                CCTV_SUMMARY.totalCctv =
                    Number(
                        result.cctvSummary.totalCctv
                    ) || 0;

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
                "Ringkasan CCTV tidak tersedia. " +
                "Cek apakah URL Apps Script (DEFAULT_API_URL) " +
                "sudah benar dan deployment-nya sudah versi terbaru.",
                result
            );
        }


        renderDashboard();


    } catch (error) {

        console.warn(
            "Gagal memuat ringkasan CCTV:",
            error
        );
    }
}


/* =========================================================
   URUTKAN DATA TERBARU LEBIH DULU
========================================================= */

function getSortedByDateDesc(rows) {

    return [...rows].sort(
        function(a, b) {

            const dateA =
                a.dateObject
                    ? a.dateObject.getTime()
                    : 0;

            const dateB =
                b.dateObject
                    ? b.dateObject.getTime()
                    : 0;

            return (
                dateB -
                dateA
            );
        }
    );
}


/* =========================================================
   RENDER DATA LAPORAN
========================================================= */

function renderLaporan() {

    const tbody =
        $("laporanTable");


    if (!tbody) {

        console.error(
            "Element #laporanTable tidak ditemukan."
        );

        return;
    }


    tbody.innerHTML = "";


    if (
        !DATA ||
        DATA.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="10"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    Tidak ada data laporan.
                </td>
            </tr>
        `;

        updateResultCount(0);

        return;
    }


    const sortedData =
        getSortedByDateDesc(
            DATA
        );


    sortedData.forEach(
        function(row, index) {

            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <!-- NO -->

                <td>
                    ${index + 1}
                </td>


                <!-- TANGGAL & WAKTU -->

                <td>
                    ${escapeHTML(
                        row.dateText || "-"
                    )}
                </td>


                <!-- UP3 -->

                <td>
                    ${escapeHTML(
                        row.up3 || "-"
                    )}
                </td>


                <!-- ULP -->

                <td>
                    ${escapeHTML(
                        row.ulp || "-"
                    )}
                </td>


                <!-- PERANGKAT -->

                <td>
                    ${escapeHTML(
                        row.device || "-"
                    )}
                </td>


                <!-- PEKERJAAN -->

                <td>
                    ${escapeHTML(
                        row.job || "-"
                    )}
                </td>


                <!-- LOKASI -->

                <td>
                    ${escapeHTML(
                        row.location || "-"
                    )}
                </td>


                <!-- PETUGAS -->

                <td>
                    ${escapeHTML(
                        row.officer || "-"
                    )}
                </td>


                <!-- DOKUMENTASI CCTV -->

                <td>

                    ${
                        row.documentation
                            ? `
                                <a
                                    href="${escapeAttribute(
                                        row.documentation
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Lihat
                                </a>
                            `
                            : "-"
                    }

                </td>


                <!-- AKSI -->

                <td>

                    <button
                        type="button"
                        class="action-btn"
                        onclick="openEditModal(${row.rowNumber})"
                    >
                        ✎ Edit
                    </button>

                </td>
            `;


            tbody.appendChild(
                tr
            );
        }
    );


    updateResultCount(
        sortedData.length
    );
}


/* =========================================================
   RESULT COUNT
========================================================= */

function updateResultCount(count) {

    const elements =
        document.querySelectorAll(
            ".result-count"
        );


    elements.forEach(
        function(element) {

            element.textContent =
                count + " data";
        }
    );
}


/* =========================================================
   MONITORING HARIAN
========================================================= */

function renderMonitoring() {

    const tbody =
        $("monitoringTable");


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    if (!DATA.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    Tidak ada data.
                </td>
            </tr>
        `;

        return;
    }


    const sortedMonitoring =
        getSortedByDateDesc(
            DATA
        );


    sortedMonitoring.forEach(
        function(row, index) {

            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        row.dateText || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.up3 || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.ulp || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.device || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.job || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.location || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.officer || "-"
                    )}
                </td>

            `;


            tbody.appendChild(
                tr
            );
        }
    );
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

    /* -----------------------------------------
       TOTAL DATA
    ----------------------------------------- */

    const totalData =
        $("totalData");


    if (totalData) {

        totalData.textContent =
            DATA.length;
    }


    /* -----------------------------------------
       DATA HARI INI
    ----------------------------------------- */

    const today =
        formatDateOnly(
            new Date()
        );


    const todayRows =
        DATA.filter(
            function(row) {

                return (
                    row.dateOnly ===
                    today
                );
            }
        );


    const todayCount =
        todayRows.length;


    const todayData =
        $("todayData");


    if (todayData) {

        todayData.textContent =
            todayCount;
    }


    /* -----------------------------------------
       JUMLAH CCTV (dari tab "MONITORING CCTV")
    ----------------------------------------- */

    const totalCctv =
        $("totalCctv");


    if (totalCctv) {

        totalCctv.textContent =
            CCTV_SUMMARY.totalCctv;
    }


    /* -----------------------------------------
       JUMLAH UNIT (dari tab "MONITORING CCTV")
    ----------------------------------------- */

    const totalUnit =
        $("totalUnit");


    if (totalUnit) {

        totalUnit.textContent =
            CCTV_SUMMARY.totalUnit;
    }


    /* -----------------------------------------
       CCTV ON / OFF

       PENTING (diperbarui):

       ON dihitung dari ULP UNIK yang melapor
       PADA HARI INI SAJA (tab "Form Responses 1",
       kolom "Unit ULP"), bukan sepanjang waktu.
       Berapa kali pun 1 ULP mengajukan laporan
       dalam hari yang sama (misalnya 3 laporan
       hari ini), ULP tersebut tetap dihitung 1
       kali saja untuk status ON hari itu.

       Laporan itu sendiri tetap terekap seluruhnya
       (tidak dikurangi/di-dedupe) di "Total Laporan"
       sesuai jumlah pelaporan yang sebenarnya masuk.

       OFF = Total CCTV (dari tab "MONITORING CCTV",
       kolom "Implementasi") dikurangi jumlah yang ON
       hari ini.
    ----------------------------------------- */

    const uniqueReportedUlpToday =
        new Set(
            todayRows
                .map(
                    function(row) {

                        return row.ulp;
                    }
                )
                .filter(Boolean)
        );


    const cctvOnCount =
        uniqueReportedUlpToday.size;


    const cctvOffCount =
        Math.max(
            0,
            CCTV_SUMMARY.totalCctv -
                cctvOnCount
        );


    const cctvOn =
        $("cctvOn");


    if (cctvOn) {

        cctvOn.textContent =
            cctvOnCount;
    }


    const cctvOff =
        $("cctvOff");


    if (cctvOff) {

        cctvOff.textContent =
            cctvOffCount;
    }


    /* -----------------------------------------
       DATA AKTIF SIDEBAR
    ----------------------------------------- */

    const dataActive =
        $("dataActive");


    if (dataActive) {

        dataActive.textContent =
            DATA.length;
    }


    /* -----------------------------------------
       AKTIVITAS TERBARU
    ----------------------------------------- */

    const recentList =
        $("recentList");


    if (!recentList) {
        return;
    }


    const latest =
        [...DATA]
            .sort(
                function(a, b) {

                    const dateA =
                        a.dateObject
                            ? a.dateObject.getTime()
                            : 0;

                    const dateB =
                        b.dateObject
                            ? b.dateObject.getTime()
                            : 0;

                    return (
                        dateB -
                        dateA
                    );
                }
            )
            .slice(0, 5);


    if (!latest.length) {

        recentList.innerHTML = `
            <div
                style="
                    padding:20px 0;
                    color:var(--muted);
                    font-size:12px;
                "
            >
                Belum ada aktivitas.
            </div>
        `;

        return;
    }


    recentList.innerHTML =
        latest
            .map(
                function(row) {

                    return `

                        <div class="activity-item">

                            <div class="activity-time">

                                ${escapeHTML(
                                    row.dateText || "-"
                                )}

                            </div>


                            <div class="activity-main">

                                <strong>

                                    ${escapeHTML(
                                        row.job || "-"
                                    )}

                                </strong>


                                <span>

                                    ${escapeHTML(
                                        row.device || "-"
                                    )}

                                </span>

                            </div>


                            <div class="activity-location">

                                ${escapeHTML(
                                    row.location || "-"
                                )}

                            </div>

                        </div>

                    `;
                }
            )
            .join("");
}


/* =========================================================
   POPUP EDIT
========================================================= */

function openEditModal(rowNumber) {

    console.log(
        "Membuka data baris:",
        rowNumber
    );


    const row =
        DATA.find(
            function(item) {

                return (
                    Number(
                        item.rowNumber
                    ) ===
                    Number(
                        rowNumber
                    )
                );
            }
        );


    if (!row) {

        alert(
            "Data tidak ditemukan."
        );

        return;
    }


    currentEditingRow =
        row;


    /* -----------------------------------------
       NOMOR BARIS
    ----------------------------------------- */

    const rowNumberInput =
        $("editRowNumber");


    if (rowNumberInput) {

        rowNumberInput.value =
            row.rowNumber || "";
    }


    /* -----------------------------------------
       PEKERJAAN
    ----------------------------------------- */

    const editJob =
        $("editJob");


    if (editJob) {

        editJob.textContent =
            row.job || "-";
    }


    /* -----------------------------------------
       LOKASI
    ----------------------------------------- */

    const editLocation =
        $("editLocation");


    if (editLocation) {

        editLocation.textContent =
            row.location || "-";
    }


    /* -----------------------------------------
       DESKRIPSI TEMUAN
    ----------------------------------------- */

    const editDescription =
        $("editDescription");


    if (editDescription) {

        editDescription.value =
            row.description || "";
    }


    /* -----------------------------------------
       WAKTU TEMUAN
    ----------------------------------------- */

    const editFindingTime =
        $("editFindingTime");


    if (editFindingTime) {

        editFindingTime.value =
            formatDateForInput(
                row.findingTime
            );
    }


    /* -----------------------------------------
       DOKUMENTASI TEMUAN
    ----------------------------------------- */

    const editFindingDocumentation =
        $("editFindingDocumentation");


    if (editFindingDocumentation) {

        editFindingDocumentation.value =
            row.findingDocumentation || "";
    }


    /* -----------------------------------------
       TINDAK LANJUT
    ----------------------------------------- */

    const editFollowUp =
        $("editFollowUp");


    if (editFollowUp) {

        const currentValue =
            row.followUp || "";


        /*
         * Jika data lama tidak ada
         * di option, tambahkan sementara.
         */

        if (
            currentValue &&
            !Array.from(
                editFollowUp.options
            ).some(
                function(option) {

                    return (
                        option.value ===
                        currentValue
                    );
                }
            )
        ) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                currentValue;


            option.textContent =
                currentValue;


            editFollowUp.appendChild(
                option
            );
        }


        editFollowUp.value =
            currentValue;
    }


    /* -----------------------------------------
       KETERANGAN
    ----------------------------------------- */

    const editInformation =
        $("editInformation");


    if (editInformation) {

        editInformation.value =
            row.information || "";
    }


    /* -----------------------------------------
       BUKA MODAL
    ----------------------------------------- */

    const modal =
        $("editModal");


    if (modal) {

        modal.classList.add(
            "active"
        );
    }
}


/* =========================================================
   TUTUP POPUP
========================================================= */

function closeEditModal() {

    const modal =
        $("editModal");


    if (modal) {

        modal.classList.remove(
            "active"
        );
    }


    currentEditingRow =
        null;
}


/* =========================================================
   TERAPKAN HASIL SIMPAN KE MEMORY & UI
========================================================= */

function applyEditSavedLocally(
    description,
    findingTime,
    findingDocumentation,
    followUp,
    information
) {

    currentEditingRow.description =
        description;


    currentEditingRow.findingTime =
        findingTime;


    currentEditingRow.findingDocumentation =
        findingDocumentation;


    currentEditingRow.followUp =
        followUp;


    currentEditingRow.information =
        information;


    if (
        currentEditingRow.original
    ) {

        currentEditingRow.original[
            "Deskripsi Temuan (Jika Ada)"
        ] =
            description;


        currentEditingRow.original[
            "Waktu Temuan"
        ] =
            findingTime;


        currentEditingRow.original[
            "Dokumentasi Temuan"
        ] =
            findingDocumentation;


        currentEditingRow.original[
            "Tindak Lanjut (Tegur online, CMC, dsb)"
        ] =
            followUp;


        currentEditingRow.original[
            "Keterangan"
        ] =
            information;
    }


    closeEditModal();


    renderLaporan();

    renderDashboard();
}


/* =========================================================
   VERIFIKASI ULANG KE SPREADSHEET

   Dipakai saat balasan dari Apps Script gagal
   dibaca (bukan JSON valid / koneksi terputus
   di tengah jalan), padahal SANGAT MUNGKIN
   doPost() di server sudah berhasil jalan dan
   datanya sudah tersimpan. Google Apps Script
   Web App memang kadang begitu: server sudah
   selesai memproses, tapi balasannya ke browser
   gagal terbaca dengan baik.

   Fungsi ini mengambil ulang data langsung dari
   spreadsheet (lewat doGet, bukan CSV publish
   yang bisa delay), lalu membandingkan baris
   terkait dengan data yang barusan dikirim.
========================================================= */

async function verifyEditSaved(
    rowNumber,
    expectedData
) {

    try {

        const response =
            await fetch(
                DEFAULT_API_URL,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            return false;
        }


        const text =
            await response.text();


        let result;


        try {

            result =
                JSON.parse(
                    text
                );

        } catch (parseError) {

            return false;
        }


        if (
            !result ||
            !result.success ||
            !Array.isArray(
                result.rows
            )
        ) {

            return false;
        }


        const row =
            result.rows.find(
                function(item) {

                    return (
                        Number(
                            item._row
                        ) ===
                        Number(
                            rowNumber
                        )
                    );
                }
            );


        if (!row) {

            return false;
        }


        const keys =
            Object.keys(
                expectedData
            );


        return keys.every(
            function(key) {

                const actual =
                    row[key] !==
                    undefined
                        ? String(
                              row[key]
                          ).trim()
                        : "";

                const expected =
                    String(
                        expectedData[
                            key
                        ] || ""
                    ).trim();

                return (
                    actual ===
                    expected
                );
            }
        );


    } catch (error) {

        return false;
    }
}


/* =========================================================
   SIMPAN EDIT KE GOOGLE SHEETS
========================================================= */

async function saveEdit(event) {

    event.preventDefault();


    /*
     * Cegah klik ganda: kalau proses simpan
     * sebelumnya masih berjalan, abaikan
     * pemanggilan berikutnya sampai selesai.
     */

    if (isSavingEdit) {

        return;
    }


    if (!currentEditingRow) {

        alert(
            "Data yang diedit tidak ditemukan."
        );

        return;
    }


    /* -----------------------------------------
       AMBIL DATA DARI FORM
    ----------------------------------------- */

    const editDescription =
        $("editDescription");


    const editFindingTime =
        $("editFindingTime");


    const editFindingDocumentation =
        $("editFindingDocumentation");


    const editFollowUp =
        $("editFollowUp");


    const editInformation =
        $("editInformation");


    const description =
        editDescription
            ? editDescription.value.trim()
            : "";


    const findingTime =
        editFindingTime
            ? editFindingTime.value
            : "";


    const findingDocumentation =
        editFindingDocumentation
            ? editFindingDocumentation.value.trim()
            : "";


    const followUp =
        editFollowUp
            ? editFollowUp.value
            : "";


    const information =
        editInformation
            ? editInformation.value.trim()
            : "";


    /* -----------------------------------------
       NOMOR BARIS GOOGLE SHEETS
    ----------------------------------------- */

    const rowNumber =
        Number(
            currentEditingRow.rowNumber
        );


    if (!rowNumber || rowNumber < 2) {

        alert(
            "Nomor baris Spreadsheet tidak valid."
        );

        return;
    }


    /* -----------------------------------------
       CEK API
    ----------------------------------------- */

    const API_URL =
        DEFAULT_API_URL;


    if (!API_URL) {

        alert(
            "URL Google Apps Script belum diatur."
        );

        return;
    }


    /* -----------------------------------------
       DATA YANG DIKIRIM
    ----------------------------------------- */

    const payload = {

        row: rowNumber,

        data: {

            "Deskripsi Temuan (Jika Ada)":
                description,

            "Waktu Temuan":
                findingTime,

            "Dokumentasi Temuan":
                findingDocumentation,

            "Tindak Lanjut (Tegur online, CMC, dsb)":
                followUp,

            "Keterangan":
                information
        }
    };


    console.log(
        "Mengirim data ke Apps Script:",
        payload
    );


    /* -----------------------------------------
       TOMBOL SIMPAN
    ----------------------------------------- */

    const saveButton =
        $("saveEditBtn");


    const oldButtonText =
        saveButton
            ? saveButton.textContent
            : "";


    if (saveButton) {

        saveButton.disabled =
            true;

        saveButton.textContent =
            "Menyimpan...";
    }


    isSavingEdit =
        true;


    try {

        /*
         * PENTING:
         *
         * Content-Type dibuat text/plain
         * agar tidak memicu CORS preflight
         * yang sering bermasalah pada Apps Script.
         */

        const response =
            await fetch(
                API_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "text/plain;charset=utf-8"
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const responseText =
            await response.text();


        console.log(
            "Response Apps Script:",
            responseText
        );


        let result;


        try {

            result =
                JSON.parse(
                    responseText
                );

        } catch (jsonError) {

            console.error(
                "Response bukan JSON:",
                responseText
            );

            throw new Error(
                "Response dari Google Apps Script tidak valid."
            );
        }


        /* -----------------------------------------
           CEK HASIL API
        ----------------------------------------- */

        if (!result.success) {

            throw new Error(
                result.message ||
                "Data gagal disimpan."
            );
        }


        /* -----------------------------------------
           UPDATE MEMORY, DATA ASLI, MODAL, RENDER
        ----------------------------------------- */

        applyEditSavedLocally(
            description,
            findingTime,
            findingDocumentation,
            followUp,
            information
        );


        alert(
            "Data berhasil disimpan ke Google Spreadsheet."
        );


        console.log(
            "Data berhasil disimpan:",
            result
        );


    } catch (error) {

        console.error(
            "Gagal menyimpan data:",
            error
        );


        /* -----------------------------------------
           VERIFIKASI ULANG SEBELUM MENYERAH

           Balasan dari Apps Script kadang gagal
           terbaca padahal server sudah berhasil
           menyimpan datanya. Sebelum menampilkan
           pesan gagal, cek dulu langsung ke
           spreadsheet apakah datanya sudah cocok.
        ----------------------------------------- */

        const reallySaved =
            await verifyEditSaved(
                rowNumber,
                payload.data
            );


        if (reallySaved) {

            applyEditSavedLocally(
                description,
                findingTime,
                findingDocumentation,
                followUp,
                information
            );


            alert(
                "Data berhasil disimpan ke Google Spreadsheet."
            );


            console.log(
                "Data terverifikasi tersimpan meski response awal gagal dibaca."
            );

        } else {

            alert(
                "Data gagal disimpan ke Google Spreadsheet.\n\n" +
                error.message +
                "\n\n" +
                "Periksa deployment Google Apps Script dan URL /exec."
            );
        }


    } finally {

        isSavingEdit =
            false;


        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                oldButtonText ||
                "Simpan";
        }
    }
}


/* =========================================================
   STATUS KONEKSI
========================================================= */

function updateConnectionStatus(
    connected
) {

    const status =
        $("dataStatus");


    if (!status) {
        return;
    }


    if (connected) {

        status.textContent =
            "Data Terhubung";

        status.style.color =
            "";

    } else {

        status.textContent =
            "Data Tidak Terhubung";
    }
}


/* =========================================================
   SEARCH DATA
========================================================= */

function searchData(keyword) {

    const text =
        String(
            keyword || ""
        )
            .toLowerCase()
            .trim();


    if (!text) {

        renderLaporan();

        return;
    }


    const filtered =
        DATA.filter(
            function(row) {

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


                return searchable.includes(
                    text
                );
            }
        );


    renderFilteredLaporan(
        filtered
    );
}


/* =========================================================
   RENDER HASIL SEARCH
========================================================= */

function renderFilteredLaporan(
    filteredRows
) {

    const tbody =
        $("laporanTable");


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    if (!filteredRows.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="10"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    Data tidak ditemukan.
                </td>
            </tr>
        `;


        updateResultCount(0);

        return;
    }


    const sortedRows =
        getSortedByDateDesc(
            filteredRows
        );


    sortedRows.forEach(
        function(row, index) {

            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        row.dateText || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.up3 || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.ulp || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.device || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.job || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.location || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        row.officer || "-"
                    )}
                </td>

                <td>

                    ${
                        row.documentation
                            ? `
                                <a
                                    href="${escapeAttribute(
                                        row.documentation
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Lihat
                                </a>
                            `
                            : "-"
                    }

                </td>

                <td>

                    <button
                        type="button"
                        class="action-btn"
                        onclick="openEditModal(${row.rowNumber})"
                    >
                        ✎ Edit
                    </button>

                </td>

            `;


            tbody.appendChild(
                tr
            );
        }
    );


    updateResultCount(
        sortedRows.length
    );
}


/* =========================================================
   NAVIGATION
========================================================= */

function showView(viewName) {

    const views =
        document.querySelectorAll(
            ".view"
        );


    views.forEach(
        function(view) {

            view.classList.remove(
                "active"
            );
        }
    );


    const target =
        $("view-" + viewName);


    if (target) {

        target.classList.add(
            "active"
        );
    }


    const links =
        document.querySelectorAll(
            ".nav-link"
        );


    links.forEach(
        function(link) {

            link.classList.remove(
                "active"
            );


            if (
                link.dataset.view ===
                viewName
            ) {

                link.classList.add(
                    "active"
                );
            }
        }
    );


    /* -----------------------------------------
       UPDATE TITLE
    ----------------------------------------- */

    const topbarTitle =
        document.querySelector(
            ".topbar-title"
        );


    if (topbarTitle) {

        const titles = {

            dashboard:
                "Dashboard",

            monitoring:
                "Monitoring Harian",

            laporan:
                "Data Laporan",

            grafik:
                "Visualisasi Grafik",

            panduan:
                "Panduan"
        };


        topbarTitle.textContent =
            titles[viewName] ||
            "Dashboard";
    }
}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {

    const theme =
        localStorage.getItem(
            "cctv_theme"
        );


    if (
        theme === "dark"
    ) {

        document.body.classList.add(
            "dark"
        );
    }
}


function toggleTheme() {

    document.body.classList.toggle(
        "dark"
    );


    localStorage.setItem(
        "cctv_theme",

        document.body.classList.contains(
            "dark"
        )
            ? "dark"
            : "light"
    );
}


/* =========================================================
   FILTER GRAFIK — BULAN TERSEDIA DARI SPREADSHEET
========================================================= */

function getAvailableMonths() {

    const months =
        new Set();


    DATA.forEach(
        function(row) {

            if (!row.dateObject) {
                return;
            }


            const key =
                `${row.dateObject.getFullYear()}-${String(
                    row.dateObject.getMonth() + 1
                ).padStart(2, "0")}`;


            months.add(key);
        }
    );


    return Array.from(months).sort();
}


function getLatestAvailableMonth() {

    const months =
        getAvailableMonths();


    return (
        months[months.length - 1] || ""
    );
}


/* =========================================================
   SIAPKAN INPUT FILTER GRAFIK (HARI & BULAN)
========================================================= */

function setupChartFilters() {

    const availableMonths =
        getAvailableMonths();

    if (!availableMonths.length) {
        return;
    }


    const minMonth =
        availableMonths[0];

    const maxMonth =
        availableMonths[
            availableMonths.length - 1
        ];


    /* -----------------------------------------
       FILTER BULAN — GRAFIK PEKERJAAN PER HARI
    ----------------------------------------- */

    const dailyMonthInput =
        $("dailyChartMonth");


    if (dailyMonthInput) {

        dailyMonthInput.min =
            minMonth;

        dailyMonthInput.max =
            maxMonth;


        /*
         * Hanya isi nilai default jika input
         * masih kosong atau di luar rentang data,
         * agar pilihan user tidak tertimpa
         * setiap kali data di-refresh.
         */

        if (
            !dailyMonthInput.value ||
            !availableMonths.includes(
                dailyMonthInput.value
            )
        ) {

            dailyMonthInput.value =
                maxMonth;
        }
    }


    /* -----------------------------------------
       FILTER RENTANG — GRAFIK PEKERJAAN PER BULAN
    ----------------------------------------- */

    const monthlyFromInput =
        $("monthlyChartFrom");

    const monthlyToInput =
        $("monthlyChartTo");


    if (monthlyFromInput) {

        monthlyFromInput.min =
            minMonth;

        monthlyFromInput.max =
            maxMonth;


        if (
            !monthlyFromInput.value ||
            monthlyFromInput.value < minMonth ||
            monthlyFromInput.value > maxMonth
        ) {

            monthlyFromInput.value =
                minMonth;
        }
    }


    if (monthlyToInput) {

        monthlyToInput.min =
            minMonth;

        monthlyToInput.max =
            maxMonth;


        if (
            !monthlyToInput.value ||
            monthlyToInput.value < minMonth ||
            monthlyToInput.value > maxMonth
        ) {

            monthlyToInput.value =
                maxMonth;
        }
    }
}


/* =========================================================
   GRAFIK
========================================================= */

function renderCharts() {

    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js tidak ditemukan."
        );

        return;
    }


    setupChartFilters();


    renderDailyChart();

    renderMonthlyChart();

    renderUnitChart();

    renderUp3Chart();

    renderJobChart();

    renderDashboardUnitChart();

    renderDashboardUp3Chart();
}


/* =========================================================
   GRAFIK RINGKAS DI DASHBOARD
========================================================= */

function renderDashboardChart() {

    const canvas =
        $("dashboardChart");


    if (!canvas) {
        return;
    }


    if (charts.dashboard) {

        charts.dashboard.destroy();
    }


    const counts = {};


    DATA.forEach(
        function(row) {

            /*
             * Hanya hitung baris yang benar-benar
             * memiliki tanggal valid dari spreadsheet.
             */

            if (
                !row.dateObject ||
                !row.dateOnly ||
                row.dateOnly === "-"
            ) {
                return;
            }


            const date =
                row.dateOnly;


            counts[date] =
                (counts[date] || 0) + 1;
        }
    );


    /*
     * Urutkan berdasarkan tanggal (dd/mm/yyyy)
     * dan ambil 14 hari terakhir agar grafik
     * tetap ringkas dan mudah dibaca.
     */

    const entries =
        Object.keys(counts)
            .map(
                function(label) {

                    const parts =
                        label.split("/");

                    const sortKey =
                        parts.length === 3
                            ? `${parts[2]}-${parts[1]}-${parts[0]}`
                            : label;

                    return {
                        label,
                        sortKey,
                        value: counts[label]
                    };
                }
            )
            .sort(
                function(a, b) {

                    return a.sortKey.localeCompare(
                        b.sortKey
                    );
                }
            )
            .slice(-14);


    const labels =
        entries.map(
            function(entry) {

                return entry.label;
            }
        );


    const values =
        entries.map(
            function(entry) {

                return entry.value;
            }
        );


    charts.dashboard =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Jumlah Pekerjaan",

                            data: values,

                            tension: 0.35,

                            fill: true,

                            backgroundColor:
                                "rgba(15, 98, 181, 0.12)",

                            borderColor:
                                "#0F62B5",

                            pointBackgroundColor:
                                "#0F62B5",

                            pointRadius: 3
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: false
                        }
                    },

                    scales: {

                        y: {

                            beginAtZero: true,

                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            }
        );
}


/* =========================================================
   GRAFIK HARIAN
========================================================= */

function renderDailyChart() {

    const canvas =
        $("dailyChart");


    if (!canvas) {
        return;
    }


    if (charts.daily) {

        charts.daily.destroy();
    }


    /* -----------------------------------------
       BULAN YANG DIPILIH USER
    ----------------------------------------- */

    const monthInput =
        $("dailyChartMonth");


    const selectedMonth =
        monthInput && monthInput.value
            ? monthInput.value
            : getLatestAvailableMonth();


    /* -----------------------------------------
       HITUNG DATA ASLI SESUAI BULAN TERPILIH
    ----------------------------------------- */

    const counts = {};


    DATA.forEach(
        function(row) {

            /*
             * Hanya hitung baris yang benar-benar
             * memiliki tanggal valid dari spreadsheet,
             * dan berada pada bulan yang dipilih.
             */

            if (
                !row.dateObject ||
                !row.dateOnly ||
                row.dateOnly === "-"
            ) {
                return;
            }


            const monthKey =
                `${row.dateObject.getFullYear()}-${String(
                    row.dateObject.getMonth() + 1
                ).padStart(2, "0")}`;


            if (
                selectedMonth &&
                monthKey !== selectedMonth
            ) {
                return;
            }


            const date =
                row.dateOnly;


            counts[date] =
                (counts[date] || 0) + 1;
        }
    );


    /*
     * PENTING:
     *
     * Bangun label untuk SEMUA tanggal pada
     * bulan yang dipilih (dari tanggal 1 sampai
     * tanggal terakhir bulan tersebut), bukan
     * hanya tanggal yang kebetulan punya data.
     *
     * Jika tidak, tanggal yang tidak memiliki
     * pekerjaan pada spreadsheet tidak akan
     * muncul sama sekali di grafik, sehingga
     * grafik terlihat seolah datanya sedikit
     * padahal bulan tersebut punya banyak hari.
     */

    let labels = [];


    if (selectedMonth) {

        const parts =
            selectedMonth.split("-");

        const year =
            Number(parts[0]);

        const month =
            Number(parts[1]);


        if (
            !isNaN(year) &&
            !isNaN(month)
        ) {

            const daysInMonth =
                new Date(
                    year,
                    month,
                    0
                ).getDate();


            for (
                let day = 1;
                day <= daysInMonth;
                day++
            ) {

                const label =
                    `${String(day).padStart(2, "0")}/` +
                    `${String(month).padStart(2, "0")}/` +
                    `${year}`;


                labels.push(
                    label
                );
            }
        }
    }


    /*
     * Fallback: jika bulan tidak diketahui,
     * gunakan tanggal-tanggal yang ada pada
     * data seperti sebelumnya.
     */

    if (!labels.length) {

        labels =
            Object.keys(counts).sort(
                function(a, b) {

                    const partsA =
                        a.split("/");

                    const partsB =
                        b.split("/");

                    const keyA =
                        `${partsA[2]}-${partsA[1]}-${partsA[0]}`;

                    const keyB =
                        `${partsB[2]}-${partsB[1]}-${partsB[0]}`;

                    return keyA.localeCompare(
                        keyB
                    );
                }
            );
    }


    const values =
        labels.map(
            function(label) {

                return counts[label] || 0;
            }
        );


    charts.daily =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Jumlah Pekerjaan",

                            data: values,

                            backgroundColor:
                                "#0F62B5",

                            borderRadius: 6
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: false
                        }
                    },

                    scales: {

                        y: {

                            beginAtZero: true,

                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            }
        );


    if (!labels.length && canvas.parentElement) {

        console.info(
            "Tidak ada data pekerjaan pada bulan " +
            (selectedMonth || "-") +
            "."
        );
    }
}


/* =========================================================
   GRAFIK BULANAN
========================================================= */

function renderMonthlyChart() {

    const canvas =
        $("lineChart");


    if (!canvas) {
        return;
    }


    if (charts.monthly) {

        charts.monthly.destroy();
    }


    /* -----------------------------------------
       RENTANG BULAN YANG DIPILIH USER
    ----------------------------------------- */

    const fromInput =
        $("monthlyChartFrom");

    const toInput =
        $("monthlyChartTo");

    const availableMonths =
        getAvailableMonths();

    const selectedFrom =
        (fromInput && fromInput.value) ||
        availableMonths[0] ||
        "";

    const selectedTo =
        (toInput && toInput.value) ||
        availableMonths[availableMonths.length - 1] ||
        "";


    const counts = {};


    DATA.forEach(
        function(row) {

            if (!row.dateObject) {
                return;
            }


            const key =
                `${row.dateObject.getFullYear()}-${String(
                    row.dateObject.getMonth() + 1
                ).padStart(2, "0")}`;


            /*
             * Hanya hitung baris yang berada
             * pada rentang bulan yang dipilih.
             */

            if (
                selectedFrom &&
                key < selectedFrom
            ) {
                return;
            }

            if (
                selectedTo &&
                key > selectedTo
            ) {
                return;
            }


            counts[key] =
                (counts[key] || 0) + 1;
        }
    );


    const labels =
        Object.keys(
            counts
        ).sort();


    const values =
        labels.map(
            function(label) {

                return counts[label];
            }
        );


    charts.monthly =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Jumlah Pekerjaan",

                            data: values,

                            tension: 0.3,

                            borderColor:
                                "#0F62B5",

                            backgroundColor:
                                "rgba(15, 98, 181, 0.12)",

                            fill: true
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: false
                        }
                    }
                }
            }
        );
}


/* =========================================================
   GRAFIK ULP
========================================================= */

function renderUnitChart() {

    const canvas =
        $("unitChart");


    if (!canvas) {
        return;
    }


    if (charts.unit) {

        charts.unit.destroy();
    }


    const counts = {};


    DATA.forEach(
        function(row) {

            const unit =
                row.ulp ||
                "Tidak diketahui";


            counts[unit] =
                (counts[unit] || 0) + 1;
        }
    );


    const labels =
        Object.keys(counts);


    const values =
        labels.map(
            function(label) {

                return counts[label];
            }
        );


    charts.unit =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Jumlah Pekerjaan",

                            data: values,

                            backgroundColor:
                                "#2E8CE0",

                            borderRadius: 6
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: false
                        }
                    }
                }
            }
        );
}


/* =========================================================
   GRAFIK UP3
========================================================= */

function renderUp3Chart() {

    const canvas =
        $("up3Chart");


    if (!canvas) {
        return;
    }


    if (charts.up3) {

        charts.up3.destroy();
    }


    const counts = {};


    DATA.forEach(
        function(row) {

            const unit =
                row.up3 ||
                "Tidak diketahui";


            counts[unit] =
                (counts[unit] || 0) + 1;
        }
    );


    const labels =
        Object.keys(counts);


    const values =
        labels.map(
            function(label) {

                return counts[label];
            }
        );


    charts.up3 =
        new Chart(
            canvas,
            {

                type: "doughnut",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Jumlah Pekerjaan",

                            data: values,

                            backgroundColor: [
                                "#0F62B5",
                                "#2E8CE0",
                                "#7FB8EC",
                                "#0A2A54",
                                "#B8D9F7",
                                "#5AA6E0"
                            ]
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false
                }
            }
        );
}


/* =========================================================
   GRAFIK ULP (DASHBOARD)
========================================================= */

function renderDashboardUnitChart() {

    const canvas =
        $("dashboardUnitChart");


    if (!canvas) {
        return;
    }


    if (charts.dashboardUnit) {

        charts.dashboardUnit.destroy();
    }


    const counts = {};


    DATA.forEach(
        function(row) {

            const unit =
                row.ulp ||
                "Tidak diketahui";


            counts[unit] =
                (counts[unit] || 0) + 1;
        }
    );


    const labels =
        Object.keys(counts);


    const values =
        labels.map(
            function(label) {

                return counts[label];
            }
        );


    charts.dashboardUnit =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Jumlah Pekerjaan",

                            data: values,

                            backgroundColor:
                                "#2E8CE0",

                            borderRadius: 6
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: false
                        }
                    }
                }
            }
        );
}


/* =========================================================
   GRAFIK UP3 (DASHBOARD)
========================================================= */

function renderDashboardUp3Chart() {

    const canvas =
        $("dashboardUp3Chart");


    if (!canvas) {
        return;
    }


    if (charts.dashboardUp3) {

        charts.dashboardUp3.destroy();
    }


    const counts = {};


    DATA.forEach(
        function(row) {

            const unit =
                row.up3 ||
                "Tidak diketahui";


            counts[unit] =
                (counts[unit] || 0) + 1;
        }
    );


    const labels =
        Object.keys(counts);


    const values =
        labels.map(
            function(label) {

                return counts[label];
            }
        );


    charts.dashboardUp3 =
        new Chart(
            canvas,
            {

                type: "doughnut",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Jumlah Pekerjaan",

                            data: values,

                            backgroundColor: [
                                "#0F62B5",
                                "#2E8CE0",
                                "#7FB8EC",
                                "#0A2A54",
                                "#B8D9F7",
                                "#5AA6E0"
                            ]
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false
                }
            }
        );
}


/* =========================================================
   GRAFIK JENIS PEKERJAAN
========================================================= */

function renderJobChart() {

    const canvas =
        $("jobChart");


    if (!canvas) {
        return;
    }


    if (charts.job) {

        charts.job.destroy();
    }


    const counts = {};


    DATA.forEach(
        function(row) {

            const job =
                row.job ||
                "Tidak diketahui";


            counts[job] =
                (counts[job] || 0) + 1;
        }
    );


    const labels =
        Object.keys(counts);


    const values =
        labels.map(
            function(label) {

                return counts[label];
            }
        );


    charts.job =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "Jumlah Pekerjaan",

                            data: values,

                            backgroundColor:
                                "#0A2A54",

                            borderRadius: 6
                        }

                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: false
                        }
                    }
                }
            }
        );
}


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        console.log(
            "Website CCTV UID SSTB dimulai."
        );


        /* -----------------------------------------
           THEME
        ----------------------------------------- */

        loadTheme();


        /* -----------------------------------------
           NAVIGATION
        ----------------------------------------- */

        document
            .querySelectorAll(
                ".nav-link"
            )
            .forEach(
                function(link) {

                    link.addEventListener(
                        "click",
                        function(event) {

                            event.preventDefault();


                            const view =
                                this.dataset.view;


                            if (!view) {
                                return;
                            }


                            showView(
                                view
                            );
                        }
                    );
                }
            );


        /* -----------------------------------------
           TOMBOL DATA VIEW
        ----------------------------------------- */

        document
            .querySelectorAll(
                "[data-view-target]"
            )
            .forEach(
                function(button) {

                    button.addEventListener(
                        "click",
                        function() {

                            const view =
                                this.dataset.viewTarget;


                            if (view) {

                                showView(
                                    view
                                );
                            }
                        }
                    );
                }
            );


        /* -----------------------------------------
           SEARCH GLOBAL
        ----------------------------------------- */

        const globalSearch =
            $("globalSearch");


        if (globalSearch) {

            globalSearch.addEventListener(
                "input",
                function() {

                    searchData(
                        this.value
                    );
                }
            );
        }


        /* -----------------------------------------
           SEARCH LAPORAN
        ----------------------------------------- */

        const laporanSearch =
            $("laporanSearch");


        if (laporanSearch) {

            laporanSearch.addEventListener(
                "input",
                function() {

                    searchData(
                        this.value
                    );
                }
            );
        }


        /* -----------------------------------------
           SEARCH MONITORING
        ----------------------------------------- */

        const monitoringSearch =
            $("monitoringSearch");


        if (monitoringSearch) {

            monitoringSearch.addEventListener(
                "input",
                function() {

                    const keyword =
                        this.value
                            .toLowerCase()
                            .trim();


                    if (!keyword) {

                        renderMonitoring();

                        return;
                    }


                    const filtered =
                        DATA.filter(
                            function(row) {

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


                                return text.includes(
                                    keyword
                                );
                            }
                        );


                    const tbody =
                        $("monitoringTable");


                    if (!tbody) {
                        return;
                    }


                    tbody.innerHTML = "";


                    const sortedFiltered =
                        getSortedByDateDesc(
                            filtered
                        );


                    sortedFiltered.forEach(
                        function(row, index) {

                            const tr =
                                document.createElement(
                                    "tr"
                                );


                            tr.innerHTML = `

                                <td>
                                    ${index + 1}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.dateText || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.up3 || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.ulp || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.device || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.job || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.location || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.officer || "-"
                                    )}
                                </td>

                            `;


                            tbody.appendChild(
                                tr
                            );
                        }
                    );
                }
            );
        }


        /* -----------------------------------------
           THEME BUTTON
        ----------------------------------------- */

        const themeButton =
            $("themeToggle");


        if (themeButton) {

            themeButton.addEventListener(
                "click",
                toggleTheme
            );
        }


        /* -----------------------------------------
           MOBILE MENU
        ----------------------------------------- */

        const mobileMenu =
            $("mobileMenu");


        const sidebar =
            $("sidebar");


        if (
            mobileMenu &&
            sidebar
        ) {

            mobileMenu.addEventListener(
                "click",
                function() {

                    sidebar.classList.toggle(
                        "open"
                    );
                }
            );
        }


        /* -----------------------------------------
           MODAL CLOSE
        ----------------------------------------- */

        const closeModal =
            $("closeEditModal");


        if (closeModal) {

            closeModal.addEventListener(
                "click",
                closeEditModal
            );
        }


        /* -----------------------------------------
           MODAL CANCEL
        ----------------------------------------- */

        const cancelButton =
            $("cancelEditBtn");


        if (cancelButton) {

            cancelButton.addEventListener(
                "click",
                closeEditModal
            );
        }


        /* -----------------------------------------
           FORM EDIT
        ----------------------------------------- */

        const editForm =
            $("editForm");


        if (editForm) {

            editForm.addEventListener(
                "submit",
                saveEdit
            );
        }


        /* -----------------------------------------
           KLIK LUAR MODAL
        ----------------------------------------- */

        const editModal =
            $("editModal");


        if (editModal) {

            editModal.addEventListener(
                "click",
                function(event) {

                    if (
                        event.target ===
                        editModal
                    ) {

                        closeEditModal();
                    }
                }
            );
        }


        /* -----------------------------------------
           SETTINGS DRAWER
        ----------------------------------------- */

        const settingsBtn =
            $("settingsBtn");


        const settingsBtnLaporan =
            $("settingsBtnLaporan");


        const drawerOverlay =
            $("drawerOverlay");


        const closeDrawer =
            $("closeDrawer");


        if (
            settingsBtn &&
            drawerOverlay
        ) {

            settingsBtn.addEventListener(
                "click",
                function() {

                    drawerOverlay.classList.add(
                        "active"
                    );
                }
            );
        }


        if (
            settingsBtnLaporan &&
            drawerOverlay
        ) {

            settingsBtnLaporan.addEventListener(
                "click",
                function() {

                    drawerOverlay.classList.add(
                        "active"
                    );
                }
            );
        }


        if (closeDrawer) {

            closeDrawer.addEventListener(
                "click",
                function() {

                    drawerOverlay.classList.remove(
                        "active"
                    );
                }
            );
        }


        if (drawerOverlay) {

            drawerOverlay.addEventListener(
                "click",
                function(event) {

                    if (
                        event.target ===
                        drawerOverlay
                    ) {

                        drawerOverlay.classList.remove(
                            "active"
                        );
                    }
                }
            );
        }


        /* -----------------------------------------
           LOAD URL BUTTON
        ----------------------------------------- */

        const loadUrlBtn =
            $("loadUrlBtn");


        const csvUrlInput =
            $("csvUrlInput");


        const statusMsg =
            $("statusMsg");


        if (csvUrlInput) {

            csvUrlInput.value =
                localStorage.getItem(
                    STORAGE_URL
                ) ||
                DEFAULT_CSV_URL;
        }


        if (loadUrlBtn) {

            loadUrlBtn.addEventListener(
                "click",
                async function() {

                    const url =
                        csvUrlInput
                            ? csvUrlInput.value.trim()
                            : "";


                    if (!url) {

                        alert(
                            "URL Google Sheets belum diisi."
                        );

                        return;
                    }


                    if (statusMsg) {

                        statusMsg.textContent =
                            "Menghubungkan...";
                    }


                    const success =
                        await loadFromURL(
                            url
                        );


                    if (statusMsg) {

                        statusMsg.textContent =
                            success
                                ? "Data berhasil terhubung."
                                : "Gagal menghubungkan data.";
                    }
                }
            );
        }


        /* -----------------------------------------
           FILTER GRAFIK — PEKERJAAN PER HARI
        ----------------------------------------- */

        const dailyChartMonth =
            $("dailyChartMonth");


        if (dailyChartMonth) {

            dailyChartMonth.addEventListener(
                "change",
                function() {

                    renderDailyChart();
                }
            );
        }


        /* -----------------------------------------
           FILTER GRAFIK — PEKERJAAN PER BULAN
        ----------------------------------------- */

        const monthlyChartFrom =
            $("monthlyChartFrom");

        const monthlyChartTo =
            $("monthlyChartTo");


        if (monthlyChartFrom) {

            monthlyChartFrom.addEventListener(
                "change",
                function() {

                    /*
                     * Jaga agar "Dari" tidak
                     * melewati "Sampai".
                     */

                    if (
                        monthlyChartTo &&
                        monthlyChartTo.value &&
                        monthlyChartFrom.value >
                            monthlyChartTo.value
                    ) {

                        monthlyChartTo.value =
                            monthlyChartFrom.value;
                    }


                    renderMonthlyChart();
                }
            );
        }


        if (monthlyChartTo) {

            monthlyChartTo.addEventListener(
                "change",
                function() {

                    /*
                     * Jaga agar "Sampai" tidak
                     * lebih awal dari "Dari".
                     */

                    if (
                        monthlyChartFrom &&
                        monthlyChartFrom.value &&
                        monthlyChartTo.value <
                            monthlyChartFrom.value
                    ) {

                        monthlyChartFrom.value =
                            monthlyChartTo.value;
                    }


                    renderMonthlyChart();
                }
            );
        }


        /* -----------------------------------------
           REFRESH
        ----------------------------------------- */

        const refreshBtn =
            $("refreshBtnMain");


        if (refreshBtn) {

            refreshBtn.addEventListener(
                "click",
                async function() {

                    refreshBtn.disabled =
                        true;


                    refreshBtn.textContent =
                        "↻ Memuat...";


                    const url =
                        localStorage.getItem(
                            STORAGE_URL
                        ) ||
                        DEFAULT_CSV_URL;


                    await loadFromURL(
                        url
                    );


                    await loadCctvSummary();


                    refreshBtn.disabled =
                        false;


                    refreshBtn.textContent =
                        "↻ Refresh";
                }
            );
        }


        /* -----------------------------------------
           LOAD DATA AWAL
        ----------------------------------------- */

        const savedURL =
            localStorage.getItem(
                STORAGE_URL
            );


        const csvURL =
            savedURL ||
            DEFAULT_CSV_URL;


        console.log(
            "CSV URL:",
            csvURL
        );


        console.log(
            "API URL:",
            DEFAULT_API_URL
        );


        await loadFromURL(
            csvURL
        );


        await loadCctvSummary();


        console.log(
            "Website selesai dimuat."
        );
    }
);


/* =========================================================
   AGAR onclick HTML BISA MEMANGGIL EDIT
========================================================= */

window.openEditModal =
    openEditModal;


window.closeEditModal =
    closeEditModal;


window.saveEdit =
    saveEdit;