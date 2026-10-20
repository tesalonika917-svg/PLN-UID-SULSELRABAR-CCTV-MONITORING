/* =========================================================
   MENU CCV — ccv-tambahan.js  (VERSI 2)
   Letakkan di folder yang sama dengan index.html.
   index.html sudah memanggil file ini setelah script.js.
   Tidak perlu mengubah script.js maupun style.css
   (CSS tambahan disuntikkan otomatis oleh file ini).
========================================================= */

(function () {

    "use strict";

    /* ---------- KONFIGURASI ---------- */

    const CCV_SHEET_ID = "12iEoMBhEwXpr0-7gTN4wTj5ELK6zEKqwOn-Q_O00F-c";
    const CCV_GID = "2107324745";

    /*
     * URL default. Anda bisa menggantinya dengan link "Publish to web"
     * (format CSV) yang berakhiran ...&output=csv
     */
    const CCV_DEFAULT_URL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQppVdIH3xSAFqNXB6d0gf2cst2pVSN8VBc8odyURSAxm0M8FZh1mrJKmLQMT4dZO0OKMDt3HiBLiyu/pub?gid=1752847300&single=true&output=csv";

    const CCV_STORAGE = "cctv_ccv_csv_url";

    const CCV_MONTHS = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const CCV_MONTHS_EN = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
    ];

    const CCV_RISK_LABEL = {
        "1": "RC1 Bekerja Pada Jaringan Tidak Bertegangan",
        "2": "RC2 Bekerja Pada Ketinggian",
        "3": "RC3 Bekerja Pada Jaringan Bertegangan"
    };

    const CCV_RISK_COLOR = {
        "1": "#EA4335",
        "2": "#FBBC04",
        "3": "#34A853"
    };

    const CCV_OTHER_COLORS = ["#7C3AED", "#0D9488", "#DB2777", "#64748B"];

    /* Kategori Total Observer (urutan tampil sama seperti di Sheets) */
    const CCV_OBS_CATS = [
        "Pelaksana Pekerjaan",
        "Pengawas/Koordinator Pekerjaan",
        "K3L",
        "Manajemen (Asisten Manager ke atas)",
        "DIVISI K3L",
        "DIVISI Pembina"
    ];

    const CCV_OBS_OTHER = "Lainnya";

    let ccvRows = [];
    let ccvCharts = {};
    let ccvLoaded = false;


    /* ---------- CSS TAMBAHAN (disuntikkan otomatis) ---------- */

    (function injectCss() {

        const css = `
        /* Susunan rapi: 2 kolom x 2 baris + ULP selebar penuh */
        #view-ccv .ccv-layout {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-areas:
                "bulan risk"
                "unit  observer"
                "ulp   ulp";
            align-items: stretch;
            gap: 18px;
        }

        #view-ccv .ccv-layout > .panel {
            display: flex;
            flex-direction: column;
        }

        #view-ccv .ccv-box-bulan    { height: 300px; }
        #view-ccv .ccv-box-unit     { height: 340px; }
        #view-ccv .ccv-box-observer { height: 340px; }
        #view-ccv .ccv-box-ulp      { height: 420px; }

        #view-ccv .ccv-p-risk .ccv-donut-wrap {
            flex: 1;
            padding: 0;
        }

        @media (max-width: 900px) {
            #view-ccv .ccv-layout {
                grid-template-columns: minmax(0, 1fr);
                grid-template-areas:
                    "bulan"
                    "risk"
                    "unit"
                    "observer"
                    "ulp";
            }
        }

        /* Filter lokal khusus grafik ULP */
        #view-ccv .ccv-local-filter {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 10px 14px;
            margin: -2px 0 14px;
        }

        #view-ccv .ccv-local-filter label {
            font-size: 11.5px;
            font-weight: 600;
            color: var(--muted);
            margin-right: 4px;
        }

        #view-ccv .ccv-local-filter select,
        #view-ccv .ccv-local-filter input[type="text"] {
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 7px 10px;
            font-size: 12.5px;
            color: var(--ink);
            background: var(--pln-sky);
            outline: none;
        }

        #view-ccv .ccv-local-filter input[type="text"] { min-width: 190px; }

        #view-ccv .ccv-local-filter select:focus,
        #view-ccv .ccv-local-filter input[type="text"]:focus {
            border-color: var(--pln-blue-light);
            box-shadow: 0 0 0 3px rgba(46, 140, 224, 0.15);
        }

        #view-ccv .ccv-local-info {
            font-size: 12px;
            color: var(--muted);
        }

        body.dark #view-ccv .ccv-local-filter select,
        body.dark #view-ccv .ccv-local-filter input[type="text"] {
            background: #0B1B33;
            color: var(--ink);
            border-color: var(--line);
        }

        /* Bar filter */
        #view-ccv .ccv-filter-bar {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-end;
            gap: 12px 14px;
            background: var(--bg-card);
            border: 1px solid var(--line);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-card);
            padding: 14px 18px;
            margin-bottom: 18px;
        }

        #view-ccv .ccv-filter-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 160px;
            flex: 1 1 160px;
            max-width: 260px;
        }

        #view-ccv .ccv-filter-item label {
            font-size: 11.5px;
            font-weight: 600;
            color: var(--muted);
        }

        #view-ccv .ccv-filter-item select {
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 12.5px;
            color: var(--ink);
            background: var(--pln-sky);
            outline: none;
            width: 100%;
        }

        #view-ccv .ccv-filter-item select:focus {
            border-color: var(--pln-blue-light);
            box-shadow: 0 0 0 3px rgba(46, 140, 224, 0.15);
        }

        #view-ccv .ccv-filter-info {
            margin-left: auto;
            font-size: 12px;
            color: var(--muted);
            padding-bottom: 8px;
        }

        #view-ccv .ccv-filter-info b { color: var(--ink); }

        body.dark #view-ccv .ccv-filter-item select {
            background: #0B1B33;
            color: var(--ink);
            border-color: var(--line);
        }
        `;

        const style = document.createElement("style");

        style.id = "ccv-injected-css";
        style.textContent = css;

        document.head.appendChild(style);

    })();


    /* ---------- HELPER ---------- */

    const el = function (id) { return document.getElementById(id); };

    const norm = function (v) {
        return String(v == null ? "" : v)
            .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    };

    const esc = function (v) {
        return String(v == null ? "" : v)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };

    const isDark = function () {
        return document.body.classList.contains("dark");
    };

    const textColor = function () {
        return isDark() ? "#EAF2FC" : "#10233F";
    };

    const gridColor = function () {
        return isDark() ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)";
    };

    function setStatus(msg, isError) {

        const s = el("ccvStatus");

        if (!s) { return; }

        s.textContent = msg;
        s.style.color = isError ? "#DC2626" : "";
    }

    function findCol(headers, keywords) {

        for (let i = 0; i < headers.length; i++) {

            const h = norm(headers[i]);

            if (keywords.every(function (k) { return h.includes(k); })) {
                return headers[i];
            }
        }

        return null;
    }

    function monthIndexFromText(text) {

        const t = norm(text);

        if (!t) { return -1; }

        for (let i = 0; i < 12; i++) {

            if (
                t.includes(CCV_MONTHS[i].toLowerCase()) ||
                t.includes(CCV_MONTHS_EN[i])
            ) {
                return i;
            }
        }

        for (let i = 0; i < 12; i++) {

            if (t.slice(0, 3) === CCV_MONTHS_EN[i].slice(0, 3)) {
                return i;
            }
        }

        return -1;
    }

    function monthIndexFromTimestamp(ts) {

        const m = String(ts || "").match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);

        if (!m) { return -1; }

        const a = Number(m[1]);
        const b = Number(m[2]);

        if (a > 12) { return b - 1; }
        if (b > 12) { return a - 1; }

        return b - 1;
    }

    function yearFromTimestamp(ts) {

        const m = String(ts || "").match(/(\d{4})/);

        return m ? m[1] : "";
    }

    function riskKeyOf(value) {

        const m = String(value || "").match(/rc\s*([123])/i);

        return m ? m[1] : "";
    }

    /* Kelompokkan jabatan observer ke 6 kategori */
    function observerCategory(value) {

        const t = norm(value);

        if (!t) { return ""; }

        if (t.includes("divisi") && t.includes("pembina")) { return "DIVISI Pembina"; }
        if (t.includes("divisi") && t.includes("k3")) { return "DIVISI K3L"; }
        if (t.includes("manajemen") || t.includes("manajer") ||
            t.includes("manager") || t.includes("asisten")) {
            return "Manajemen (Asisten Manager ke atas)";
        }
        if (t.includes("pengawas") || t.includes("koordinator")) {
            return "Pengawas/Koordinator Pekerjaan";
        }
        if (t.includes("pelaksana")) { return "Pelaksana Pekerjaan"; }
        if (t.includes("k3")) { return "K3L"; }

        return CCV_OBS_OTHER;
    }

    function makeRow(o) {

        const rk = riskKeyOf(o.risk);

        return {
            year: o.year || "",
            month: o.month,
            observer: o.observer || "",
            obsCat: observerCategory(o.observer),
            unit: o.unit || "",
            unitKey: norm(o.unit),
            ulp: o.ulp || "",
            ulpKey: norm(o.ulp),
            risk: o.risk || "",
            riskKey: rk || norm(o.risk)
        };
    }

    function countBy(rows, getter) {

        const map = {};

        rows.forEach(function (r) {

            const raw = getter(r);

            if (!raw) { return; }

            const key = norm(raw);

            if (!map[key]) { map[key] = { label: raw, value: 0 }; }

            map[key].value++;
        });

        return Object.keys(map)
            .map(function (k) { return map[k]; })
            .sort(function (a, b) {
                return (b.value - a.value) || a.label.localeCompare(b.label);
            });
    }

    function shorten(label, max) {
        return label.length > max ? label.slice(0, max - 1) + "…" : label;
    }


    /* ---------- PLUGIN ANGKA ---------- */

    const ccvValueLabels = {

        id: "ccvValueLabels",

        afterDatasetsDraw: function (chart, args, opts) {

            if (!opts || !opts.display) { return; }

            const ctx = chart.ctx;

            ctx.save();
            ctx.font = "bold 11px 'Segoe UI', sans-serif";
            ctx.fillStyle = textColor();

            chart.data.datasets.forEach(function (ds, i) {

                const meta = chart.getDatasetMeta(i);

                meta.data.forEach(function (item, idx) {

                    const v = ds.data[idx];

                    if (v === null || v === undefined) { return; }

                    if (opts.horizontal) {
                        ctx.textAlign = "left";
                        ctx.textBaseline = "middle";
                        ctx.fillText(v, item.x + 6, item.y);
                    } else {
                        ctx.textAlign = "center";
                        ctx.textBaseline = "bottom";
                        ctx.fillText(v, item.x, item.y - 5);
                    }
                });
            });

            ctx.restore();
        }
    };

    const ccvDonutPercent = {

        id: "ccvDonutPercent",

        afterDatasetsDraw: function (chart) {

            const ds = chart.data.datasets[0];
            const meta = chart.getDatasetMeta(0);

            const total = ds.data.reduce(function (s, v) { return s + v; }, 0);

            if (!total) { return; }

            const ctx = chart.ctx;

            ctx.save();
            ctx.font = "bold 12px 'Segoe UI', sans-serif";
            ctx.fillStyle = "#10233F";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            meta.data.forEach(function (arc, idx) {

                const pct = ds.data[idx] / total * 100;

                if (pct < 4) { return; }

                const angle = (arc.startAngle + arc.endAngle) / 2;
                const r = (arc.innerRadius + arc.outerRadius) / 2;

                ctx.fillText(
                    pct.toFixed(1) + "%",
                    arc.x + Math.cos(angle) * r,
                    arc.y + Math.sin(angle) * r
                );
            });

            ctx.restore();
        }
    };


    /* ---------- LOAD DATA ---------- */

    function parseRows(csvText) {

        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: function (h) { return String(h).trim(); }
        });

        const headers = parsed.meta.fields || [];

        const cTimestamp = findCol(headers, ["timestamp"]);
        const cBulan = headers.find(function (h) { return norm(h) === "bulan"; }) ||
                       findCol(headers, ["bulan"]);

        /* Utamakan kolom JABATAN/POSISI (bukan kolom nama observer) */
        const cObserver = findCol(headers, ["jabatan"]) ||
                          findCol(headers, ["posisi"]) ||
                          findCol(headers, ["observer"]);

        const cUnit = findCol(headers, ["unit pelaksana"]);
        const cUlp = findCol(headers, ["unit layanan"]);
        const cRisk = findCol(headers, ["risk containment"]);

        console.log("Kolom CCV terdeteksi:", {
            timestamp: cTimestamp, bulan: cBulan, observer: cObserver,
            unit: cUnit, ulp: cUlp, risk: cRisk
        });

        if (!cTimestamp && !cBulan) {
            throw new Error(
                "Kolom Timestamp/Bulan tidak ditemukan. Kolom tersedia: " +
                headers.join(" | ")
            );
        }

        return parsed.data.map(function (row) {

            const ts = cTimestamp ? row[cTimestamp] : "";

            let mi = cBulan ? monthIndexFromText(row[cBulan]) : -1;

            if (mi < 0) { mi = monthIndexFromTimestamp(ts); }

            return makeRow({
                year: yearFromTimestamp(ts),
                month: mi,
                observer: cObserver ? String(row[cObserver] || "").trim() : "",
                unit: cUnit ? String(row[cUnit] || "").trim() : "",
                ulp: cUlp ? String(row[cUlp] || "").trim() : "",
                risk: cRisk ? String(row[cRisk] || "").trim() : ""
            });

        }).filter(function (r) {
            return r.month >= 0 || r.unit || r.ulp || r.observer;
        });
    }

    async function ccvLoad(url) {

        try {

            if (typeof Papa === "undefined") {
                throw new Error("PapaParse tidak ditemukan.");
            }

            setStatus("Memuat data CCV...");

            const response = await fetch(url, { cache: "no-store" });

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const text = await response.text();

            if (/^\s*<!doctype html|^\s*<html/i.test(text)) {
                throw new Error(
                    "Link bukan CSV. Gunakan link berakhiran output=csv (bukan pubhtml)."
                );
            }

            ccvRows = parseRows(text);

            localStorage.setItem(CCV_STORAGE, url);

            ccvLoaded = true;

            fillYearOptions();
            fillFilterOptions();

            setStatus("Data CCV terhubung — " + ccvRows.length + " laporan.");

            ccvRender();

            return true;

        } catch (error) {

            console.error("Gagal memuat CCV:", error);

            setStatus("Gagal memuat data CCV: " + error.message, true);

            return false;
        }
    }

    function ccvSampleData() {

        const units = [
            "UP3 BAUBAU", "UP3 BULUKUMBA", "UP3 KENDARI", "UP3 MAKASSAR SELATAN",
            "UP3 MAKASSAR UTARA", "UP3 MAMUJU", "UP3 PALOPO", "UP3 PAREPARE",
            "UP3 PINRANG", "UP3 WATAMPONE", "UP2D MAKASSAR"
        ];

        const ulps = [
            "ULP BAU-BAU KOTA", "ULP BANTAENG", "ULP KALUMPANG", "ULP SELAYAR",
            "ULP SINJAI", "ULP TANETE", "ULP JENEPONTO", "ULP MAROS", "ULP PANGKEP"
        ];

        const rows = [];

        for (let i = 0; i < 400; i++) {

            rows.push(makeRow({
                year: "2026",
                month: Math.floor(Math.random() * 8),
                observer: CCV_OBS_CATS[Math.min(
                    CCV_OBS_CATS.length - 1,
                    Math.floor(Math.pow(Math.random(), 2.2) * CCV_OBS_CATS.length)
                )],
                unit: units[Math.floor(Math.random() * units.length)],
                ulp: ulps[Math.floor(Math.random() * ulps.length)],
                risk: CCV_RISK_LABEL[String(1 + Math.floor(Math.pow(Math.random(), 0.4) * 3))]
            }));
        }

        ccvRows = rows;
        ccvLoaded = true;

        fillYearOptions();
        fillFilterOptions();

        setStatus("Menampilkan DATA CONTOH (bukan data asli).");

        ccvRender();
    }


    /* ---------- FILTER ---------- */

    function fillYearOptions() {

        const sel = el("ccvYear");

        if (!sel) { return; }

        const current = sel.value || "all";

        const years = Array.from(new Set(
            ccvRows.map(function (r) { return r.year; }).filter(Boolean)
        )).sort();

        sel.innerHTML = '<option value="all">Semua Tahun</option>' +
            years.map(function (y) {
                return '<option value="' + esc(y) + '">' + esc(y) + "</option>";
            }).join("");

        sel.value = years.includes(current) ? current : "all";
    }

    function buildFilterBar() {

        const layout = document.querySelector("#view-ccv .ccv-layout");

        if (!layout || el("ccvFilterBar")) { return; }

        const bar = document.createElement("div");

        bar.className = "ccv-filter-bar";
        bar.id = "ccvFilterBar";

        bar.innerHTML = `
            <div class="ccv-filter-item">
                <label for="ccvFMonth">Bulan</label>
                <select id="ccvFMonth"><option value="all">Semua Bulan</option></select>
            </div>
            <div class="ccv-filter-item">
                <label for="ccvFUnit">Unit Pelaksana (UP2D/UP3)</label>
                <select id="ccvFUnit"><option value="all">Semua Unit</option></select>
            </div>
            <div class="ccv-filter-item">
                <label for="ccvFUlp">Unit Layanan (ULP)</label>
                <select id="ccvFUlp"><option value="all">Semua ULP</option></select>
            </div>
            <div class="ccv-filter-item">
                <label for="ccvFRisk">Risk Containment</label>
                <select id="ccvFRisk"><option value="all">Semua RC</option></select>
            </div>
            <div class="ccv-filter-item">
                <label for="ccvFObs">Jabatan Observer</label>
                <select id="ccvFObs"><option value="all">Semua Jabatan</option></select>
            </div>
            <button type="button" class="btn btn-secondary" id="ccvFReset">Reset Filter</button>
            <div class="ccv-filter-info" id="ccvFInfo"></div>
        `;

        layout.parentNode.insertBefore(bar, layout);

        ["ccvFMonth", "ccvFUnit", "ccvFUlp", "ccvFRisk", "ccvFObs"].forEach(function (id) {
            el(id).addEventListener("change", ccvRender);
        });

        el("ccvFReset").addEventListener("click", function () {

            ["ccvFMonth", "ccvFUnit", "ccvFUlp", "ccvFRisk", "ccvFObs"].forEach(function (id) {
                el(id).value = "all";
            });

            const y = el("ccvYear");

            if (y) { y.value = "all"; }

            ccvRender();
        });
    }

    /* Filter lokal khusus grafik ULP: cari nama, urutan, dan Top N */
    function buildUlpFilter() {

        const panel = document.querySelector("#view-ccv .ccv-p-ulp");

        if (!panel || el("ccvUlpFilter")) { return; }

        const title = panel.querySelector(".ccv-title");

        const box = document.createElement("div");

        box.className = "ccv-local-filter";
        box.id = "ccvUlpFilter";

        box.innerHTML = `
            <div>
                <label for="ccvUlpSearch">Cari ULP</label>
                <input type="text" id="ccvUlpSearch" placeholder="Ketik nama ULP...">
            </div>
            <div>
                <label for="ccvUlpTop">Tampilkan</label>
                <select id="ccvUlpTop">
                    <option value="all">Semua ULP</option>
                    <option value="10">10 teratas</option>
                    <option value="20">20 teratas</option>
                    <option value="30">30 teratas</option>
                </select>
            </div>
            <div>
                <label for="ccvUlpSort">Urutkan</label>
                <select id="ccvUlpSort">
                    <option value="desc">Terbanyak ke sedikit</option>
                    <option value="asc">Tersedikit ke banyak</option>
                    <option value="az">Nama A–Z</option>
                </select>
            </div>
            <button type="button" class="text-btn" id="ccvUlpReset">Reset</button>
            <span class="ccv-local-info" id="ccvUlpInfo"></span>
        `;

        title.insertAdjacentElement("afterend", box);

        /* Hanya grafik ULP yang digambar ulang */
        const redraw = function () {
            if (ccvLoaded) { drawUlp(getRows(false)); }
        };

        el("ccvUlpSearch").addEventListener("input", redraw);
        el("ccvUlpTop").addEventListener("change", redraw);
        el("ccvUlpSort").addEventListener("change", redraw);

        el("ccvUlpReset").addEventListener("click", function () {
            el("ccvUlpSearch").value = "";
            el("ccvUlpTop").value = "all";
            el("ccvUlpSort").value = "desc";
            redraw();
        });
    }

    function fillSelect(id, allLabel, items) {

        const sel = el(id);

        if (!sel) { return; }

        const current = sel.value || "all";

        sel.innerHTML = '<option value="all">' + esc(allLabel) + "</option>" +
            items.map(function (it) {
                return '<option value="' + esc(it.value) + '">' + esc(it.label) + "</option>";
            }).join("");

        const exists = items.some(function (it) { return it.value === current; });

        sel.value = exists ? current : "all";
    }

    function uniqueItems(getKey, getLabel) {

        const map = {};

        ccvRows.forEach(function (r) {

            const k = getKey(r);

            if (k && !(k in map)) { map[k] = getLabel(r); }
        });

        return Object.keys(map)
            .map(function (k) { return { value: k, label: map[k] }; })
            .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }

    function fillFilterOptions() {

        buildFilterBar();

        fillSelect("ccvFMonth", "Semua Bulan", CCV_MONTHS.map(function (m, i) {
            return { value: String(i), label: m };
        }));

        fillSelect("ccvFUnit", "Semua Unit",
            uniqueItems(function (r) { return r.unitKey; },
                        function (r) { return r.unit; }));

        fillSelect("ccvFUlp", "Semua ULP",
            uniqueItems(function (r) { return r.ulpKey; },
                        function (r) { return r.ulp; }));

        fillSelect("ccvFRisk", "Semua RC",
            uniqueItems(function (r) { return r.riskKey; },
                        function (r) {
                            const rk = riskKeyOf(r.risk);
                            return rk ? CCV_RISK_LABEL[rk] : r.risk;
                        }));

        const present = {};

        ccvRows.forEach(function (r) { if (r.obsCat) { present[r.obsCat] = true; } });

        fillSelect("ccvFObs", "Semua Jabatan",
            CCV_OBS_CATS.concat([CCV_OBS_OTHER])
                .filter(function (c) { return present[c]; })
                .map(function (c) { return { value: c, label: c }; }));
    }

    function val(id) {

        const e = el(id);

        return e ? e.value : "all";
    }

    /* skipMonth = true untuk grafik bulanan (agar tetap menampilkan 12 bulan) */
    function getRows(skipMonth) {

        const y = val("ccvYear");
        const m = val("ccvFMonth");
        const u = val("ccvFUnit");
        const l = val("ccvFUlp");
        const k = val("ccvFRisk");
        const o = val("ccvFObs");

        return ccvRows.filter(function (r) {

            if (y !== "all" && r.year !== y) { return false; }
            if (!skipMonth && m !== "all" && String(r.month) !== m) { return false; }
            if (u !== "all" && r.unitKey !== u) { return false; }
            if (l !== "all" && r.ulpKey !== l) { return false; }
            if (k !== "all" && r.riskKey !== k) { return false; }
            if (o !== "all" && r.obsCat !== o) { return false; }

            return true;
        });
    }


    /* ---------- RENDER GRAFIK ---------- */

    function destroyChart(key) {

        if (ccvCharts[key]) {
            ccvCharts[key].destroy();
            ccvCharts[key] = null;
        }
    }

    function baseScales() {

        const tick = { color: textColor(), font: { size: 11 } };

        return {
            x: {
                ticks: Object.assign({
                    autoSkip: false, maxRotation: 90, minRotation: 45
                }, tick),
                grid: { display: false }
            },
            y: {
                beginAtZero: true,
                ticks: Object.assign({ precision: 0 }, tick),
                grid: { color: gridColor() }
            }
        };
    }

    function drawMonthly(rows) {

        destroyChart("bulan");

        const canvas = el("ccvBulananChart");

        if (!canvas) { return; }

        const counts = new Array(12).fill(0);

        rows.forEach(function (r) {
            if (r.month >= 0) { counts[r.month]++; }
        });

        ccvCharts.bulan = new Chart(canvas, {
            type: "line",
            data: {
                labels: CCV_MONTHS.map(function (m) { return m.toUpperCase(); }),
                datasets: [{
                    label: "Jumlah CCV",
                    data: counts,
                    borderColor: "#34A853",
                    backgroundColor: "rgba(52,168,83,0.22)",
                    fill: true,
                    tension: 0,
                    pointRadius: 3,
                    pointBackgroundColor: "#34A853"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 22, right: 14 } },
                plugins: {
                    legend: { display: false },
                    ccvValueLabels: { display: true }
                },
                scales: baseScales()
            },
            plugins: [ccvValueLabels]
        });
    }

    function drawUnit(rows) {

        destroyChart("unit");

        const canvas = el("ccvUnitChart");

        if (!canvas) { return; }

        const list = countBy(rows, function (r) { return r.unit; });

        const scales = baseScales();

        scales.x.ticks.callback = function (v) {
            return shorten(this.getLabelForValue(v), 18);
        };

        ccvCharts.unit = new Chart(canvas, {
            type: "bar",
            data: {
                labels: list.map(function (e) { return e.label; }),
                datasets: [{
                    label: "Jumlah CCV",
                    data: list.map(function (e) { return e.value; }),
                    backgroundColor: "#7BA7F7",
                    borderRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 20 } },
                plugins: {
                    legend: { display: false },
                    ccvValueLabels: { display: true }
                },
                scales: scales
            },
            plugins: [ccvValueLabels]
        });
    }

    function drawRisk(rows) {

        destroyChart("risk");

        const canvas = el("ccvRiskChart");
        const legend = el("ccvRiskLegend");

        if (!canvas) { return; }

        const map = {};
        const order = [];

        rows.forEach(function (r) {

            if (!r.risk) { return; }

            const rk = riskKeyOf(r.risk);
            const key = rk || norm(r.risk);

            if (!map[key]) {
                map[key] = {
                    label: rk ? CCV_RISK_LABEL[rk] : r.risk,
                    color: rk ? CCV_RISK_COLOR[rk]
                              : CCV_OTHER_COLORS[order.length % CCV_OTHER_COLORS.length],
                    value: 0
                };
                order.push(key);
            }

            map[key].value++;
        });

        order.sort();

        const items = order.map(function (k) { return map[k]; });

        const total = items.reduce(function (s, i) { return s + i.value; }, 0);

        ccvCharts.risk = new Chart(canvas, {
            type: "doughnut",
            data: {
                labels: items.map(function (i) { return i.label; }),
                datasets: [{
                    data: items.map(function (i) { return i.value; }),
                    backgroundColor: items.map(function (i) { return i.color; }),
                    borderWidth: 2,
                    borderColor: isDark() ? "#112543" : "#FFFFFF"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "50%",
                plugins: { legend: { display: false } }
            },
            plugins: [ccvDonutPercent]
        });

        if (legend) {

            legend.innerHTML = items.length
                ? items.map(function (i) {

                    const pct = total ? (i.value / total * 100).toFixed(1) : "0.0";

                    return '<div class="ccv-legend-item">' +
                        '<span class="ccv-legend-dot" style="background:' + i.color + ';"></span>' +
                        '<div class="ccv-legend-text"><strong>' + esc(i.label) + "</strong>" +
                        "<span>" + i.value + " laporan • " + pct + "%</span></div></div>";

                }).join("")
                : '<div style="color:var(--muted);font-size:12px;">Belum ada data.</div>';
        }
    }

    function drawObserver(rows) {

        destroyChart("observer");

        const canvas = el("ccvObserverChart");

        if (!canvas) { return; }

        /* Hitung per kategori jabatan (6 kategori tetap) */
        const counts = {};

        CCV_OBS_CATS.forEach(function (c) { counts[c] = 0; });

        counts[CCV_OBS_OTHER] = 0;

        rows.forEach(function (r) {
            if (r.obsCat) { counts[r.obsCat] = (counts[r.obsCat] || 0) + 1; }
        });

        const labels = CCV_OBS_CATS.slice();

        if (counts[CCV_OBS_OTHER] > 0) { labels.push(CCV_OBS_OTHER); }

        const tick = { color: textColor(), font: { size: 11 } };

        ccvCharts.observer = new Chart(canvas, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Total Observer",
                    data: labels.map(function (l) { return counts[l]; }),
                    backgroundColor: "#9FC5E8",
                    borderRadius: 3,
                    barThickness: 28
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 48 } },
                plugins: {
                    legend: { display: false },
                    ccvValueLabels: { display: true, horizontal: true }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: Object.assign({ precision: 0 }, tick),
                        grid: { color: gridColor() }
                    },
                    y: {
                        ticks: Object.assign({
                            callback: function (v) {
                                return shorten(this.getLabelForValue(v), 28);
                            }
                        }, tick),
                        grid: { display: false }
                    }
                }
            },
            plugins: [ccvValueLabels]
        });
    }

    function drawUlp(rows) {

        destroyChart("ulp");

        const canvas = el("ccvUlpChart");

        if (!canvas) { return; }

        let list = countBy(rows, function (r) { return r.ulp; });

        const totalUlp = list.length;

        /* ----- filter lokal grafik ULP ----- */

        const q = norm(val("ccvUlpSearch") === "all" ? "" : (el("ccvUlpSearch") || {}).value);
        const sortMode = (el("ccvUlpSort") || {}).value || "desc";
        const topN = (el("ccvUlpTop") || {}).value || "all";

        if (q) {
            list = list.filter(function (e) { return norm(e.label).includes(q); });
        }

        if (sortMode === "asc") {
            list.sort(function (a, b) { return (a.value - b.value) || a.label.localeCompare(b.label); });
        } else if (sortMode === "az") {
            list.sort(function (a, b) { return a.label.localeCompare(b.label); });
        }

        if (topN !== "all") {
            list = list.slice(0, Number(topN));
        }

        const localInfo = el("ccvUlpInfo");

        if (localInfo) {
            localInfo.textContent = "Menampilkan " + list.length + " dari " + totalUlp + " ULP";
        }

        const wrap = canvas.parentElement;

        if (wrap) {
            wrap.style.minWidth = Math.max(list.length, 1) * 26 + "px";
        }

        const scales = baseScales();

        scales.x.ticks.font = { size: 10 };
        scales.x.ticks.callback = function (v) {
            return shorten(this.getLabelForValue(v), 22);
        };

        ccvCharts.ulp = new Chart(canvas, {
            type: "bar",
            data: {
                labels: list.map(function (e) { return e.label; }),
                datasets: [{
                    label: "Jumlah CCV",
                    data: list.map(function (e) { return e.value; }),
                    backgroundColor: "#FFD966",
                    borderRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: scales
            }
        });
    }

    function ccvRender() {

        if (typeof Chart === "undefined") {
            setStatus("Chart.js tidak ditemukan.", true);
            return;
        }

        const rows = getRows(false);

        drawMonthly(getRows(true));
        drawUnit(rows);
        drawRisk(rows);
        drawObserver(rows);
        drawUlp(rows);

        const info = el("ccvFInfo");

        if (info) {
            info.innerHTML = "Menampilkan <b>" + rows.length +
                "</b> dari <b>" + ccvRows.length + "</b> laporan";
        }
    }


    /* ---------- INISIALISASI ---------- */

    document.addEventListener("DOMContentLoaded", function () {

        buildFilterBar();
        buildUlpFilter();

        const urlInput = el("ccvCsvUrl");

        if (urlInput) {
            urlInput.value = localStorage.getItem(CCV_STORAGE) || CCV_DEFAULT_URL;
        }

        const connectBtn = el("ccvConnectBtn");

        if (connectBtn) {
            connectBtn.addEventListener("click", function () {

                const url = urlInput ? urlInput.value.trim() : "";

                if (!url) {
                    alert("URL Google Sheets CSV belum diisi.");
                    return;
                }

                ccvLoad(url);
            });
        }

        const refreshBtn = el("ccvRefreshBtn");

        if (refreshBtn) {
            refreshBtn.addEventListener("click", function () {
                ccvLoad(
                    (urlInput && urlInput.value.trim()) ||
                    localStorage.getItem(CCV_STORAGE) ||
                    CCV_DEFAULT_URL
                );
            });
        }

        const sampleBtn = el("ccvSampleBtn");

        if (sampleBtn) {
            sampleBtn.addEventListener("click", ccvSampleData);
        }

        const yearSel = el("ccvYear");

        if (yearSel) {
            yearSel.addEventListener("change", ccvRender);
        }

        document.querySelectorAll('.nav-link[data-view="ccv"]').forEach(function (link) {

            link.addEventListener("click", function () {

                const title = document.querySelector(".topbar-title");

                if (title) { title.textContent = "CCV"; }

                setTimeout(function () {

                    if (!ccvLoaded) {
                        ccvLoad(
                            localStorage.getItem(CCV_STORAGE) || CCV_DEFAULT_URL
                        );
                    } else {
                        ccvRender();
                    }

                }, 60);
            });
        });

        const themeBtn = el("themeToggle");

        if (themeBtn) {
            themeBtn.addEventListener("click", function () {
                if (ccvLoaded) { setTimeout(ccvRender, 50); }
            });
        }
    });

})();