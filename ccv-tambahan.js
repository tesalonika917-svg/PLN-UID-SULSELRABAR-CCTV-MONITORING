(function () {

    "use strict";

    /* ---------- KONFIGURASI ---------- */

    /*
     * Link "Publikasikan ke web" format CSV (berakhiran output=csv).
     * Tab yang dibaca = tab jawaban formulir CCV.
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

    const CCV_RISK_COLOR = {
        "1": "#EA4335",
        "2": "#FBBC04",
        "3": "#34A853"
    };

    const CCV_OTHER_COLORS = ["#7C3AED", "#0D9488", "#DB2777", "#64748B"];

    let ccvRows = [];
    let ccvRawCount = 0;
    let ccvCharts = {};
    let ccvLoaded = false;
    let ccvLoadedAt = null;
    let ccvSource = "spreadsheet";
    let ccvDefaultYear = "all";
    let ccvFirstLoad = true;


    /* ---------- CSS TAMBAHAN (disuntikkan otomatis) ---------- */

    (function injectCss() {

        const css = `
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

        /* Penjelasan tiap grafik */
        #view-ccv .ccv-desc {
            font-size: 12px;
            line-height: 1.65;
            color: var(--muted);
            background: var(--pln-sky);
            border: 1px solid var(--line);
            border-radius: 10px;
            padding: 9px 12px;
            margin: 0 0 12px;
            text-align: left;
        }
        #view-ccv .ccv-desc b { color: var(--ink); }
        #view-ccv .ccv-desc .ccv-desc-live {
            display: block;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px dashed var(--line);
        }
        body.dark #view-ccv .ccv-desc { background: #0B1B33; }

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

        /* Panel cek data */
        #view-ccv details.ccv-check summary {
            cursor: pointer;
            font-weight: 700;
            color: var(--pln-navy);
            font-size: 13.5px;
        }
        body.dark #view-ccv details.ccv-check summary { color: var(--white); }
        #view-ccv .ccv-check-body { margin-top: 12px; font-size: 12.5px; line-height: 1.7; }
        #view-ccv .ccv-check h3 { font-size: 12.5px; margin: 14px 0 6px; }
        #view-ccv .ccv-mini { min-width: 0; }
        #view-ccv .ccv-mini th, #view-ccv .ccv-mini td { padding: 7px 10px; font-size: 12px; }
        #view-ccv .ccv-warn { color: #DC2626; font-weight: 700; }
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

    const clean = function (v) {
        return String(v == null ? "" : v)
            .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
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

    const fmt = function (n) {
        return Number(n).toLocaleString("id-ID");
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

    /*
     * Timestamp spreadsheet berformat BULAN/TANGGAL/TAHUN (contoh 1/31/2026 8:06:19).
     * Bila angka pertama > 12, pasti itu tanggal (format TANGGAL/BULAN/TAHUN).
     */
    function parseTimestamp(ts) {

        const t = String(ts == null ? "" : ts).trim();

        let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);

        if (m) {

            const a = Number(m[1]);
            const b = Number(m[2]);

            let month;
            let day;

            if (a > 12) { day = a; month = b; } else { month = a; day = b; }

            if (month < 1 || month > 12 || day < 1 || day > 31) { return null; }

            return { year: m[3], month: month - 1, day: day };
        }

        m = t.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);

        if (m) {

            const month = Number(m[2]);
            const day = Number(m[3]);

            if (month < 1 || month > 12 || day < 1 || day > 31) { return null; }

            return { year: m[1], month: month - 1, day: day };
        }

        return null;
    }

    function riskKeyOf(value) {

        const m = String(value || "").match(/rc\s*([123])/i);

        return m ? m[1] : "";
    }

    function makeRow(o) {

        const rk = riskKeyOf(o.risk);

        return {
            year: o.year || "",
            month: o.month,                 /* dari kolom "Bulan" (cadangan: Timestamp) */
            tsMonth: o.tsMonth == null ? -1 : o.tsMonth,   /* dari Timestamp */
            day: o.day || 0,
            observer: clean(o.observer),
            obsKey: norm(o.observer),
            unit: clean(o.unit),
            unitKey: norm(o.unit),
            ulp: clean(o.ulp),
            ulpKey: norm(o.ulp),
            risk: clean(o.risk),
            riskKey: rk || norm(o.risk)
        };
    }

    /* Hitung per nilai (tanpa membedakan huruf besar/kecil), urut terbanyak */
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
                    if (opts.skipZero && !v) { return; }

                    if (opts.horizontal) {
                        ctx.textAlign = "left";
                        ctx.textBaseline = "middle";
                        ctx.fillText(fmt(v), item.x + 6, item.y);
                    } else {
                        ctx.textAlign = "center";
                        ctx.textBaseline = "bottom";
                        ctx.fillText(fmt(v), item.x, item.y - 5);
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

        ccvRawCount = parsed.data.length;

        return parsed.data.map(function (row) {

            const ts = parseTimestamp(cTimestamp ? row[cTimestamp] : "");

            let mi = cBulan ? monthIndexFromText(row[cBulan]) : -1;

            if (mi < 0 && ts) { mi = ts.month; }

            return makeRow({
                year: ts ? ts.year : "",
                month: mi,
                tsMonth: ts ? ts.month : -1,
                day: ts ? ts.day : 0,
                observer: cObserver ? row[cObserver] : "",
                unit: cUnit ? row[cUnit] : "",
                ulp: cUlp ? row[cUlp] : "",
                risk: cRisk ? row[cRisk] : ""
            });

        }).filter(function (r) {
            return r.month >= 0 || r.unit || r.ulp || r.observer || r.risk;
        });
    }

    async function ccvLoad(url) {

        try {

            if (typeof Papa === "undefined") {
                throw new Error("PapaParse tidak ditemukan.");
            }

            setStatus("Memuat data CCV...");

            const sep = url.indexOf("?") >= 0 ? "&" : "?";

            const response = await fetch(url + sep + "_=" + Date.now(), { cache: "no-store" });

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
            ccvLoadedAt = new Date();
            ccvSource = "spreadsheet";

            afterDataReady();

            setStatus(
                "Data CCV terhubung — " + fmt(ccvRows.length) +
                " laporan dibaca dari spreadsheet."
            );

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

        const obs = [
            "Pelaksana Pekerjaan", "Pengawas/Koordinator Pekerjaan", "K3L",
            "Management (Asisten Manager Keatas)"
        ];

        const risks = [
            "RC1 Bekerja Pada Jaringan Tidak Bertegangan",
            "RC2 Bekerja Pada Ketinggian",
            "RC3 Bekerja Pada Jaringan Bertegangan"
        ];

        const rows = [];

        for (let i = 0; i < 400; i++) {

            const m = Math.floor(Math.random() * 8);

            rows.push(makeRow({
                year: "2026",
                month: m,
                tsMonth: m,
                day: 1 + Math.floor(Math.random() * 28),
                observer: obs[Math.floor(Math.pow(Math.random(), 2) * obs.length)],
                unit: units[Math.floor(Math.random() * units.length)],
                ulp: ulps[Math.floor(Math.random() * ulps.length)],
                risk: risks[Math.floor(Math.pow(Math.random(), 0.4) * 3)]
            }));
        }

        ccvRows = rows;
        ccvRawCount = rows.length;
        ccvLoaded = true;
        ccvLoadedAt = new Date();
        ccvSource = "contoh";

        afterDataReady();

        setStatus("Menampilkan DATA CONTOH (bukan data asli).");
    }

    function afterDataReady() {

        fillYearOptions();
        buildFilterBar();
        fillFilterOptions();
        ccvRender();
    }


    /* ---------- FILTER ---------- */

    function fillYearOptions() {

        const sel = el("ccvYear");

        if (!sel) { return; }

        const years = Array.from(new Set(
            ccvRows.map(function (r) { return r.year; }).filter(Boolean)
        )).sort();

        /* Bila ada lebih dari satu tahun, awal tampil tahun terbaru
           (supaya bulan yang sama dari tahun berbeda tidak tercampur). */
        ccvDefaultYear = years.length > 1 ? years[years.length - 1] : "all";

        const current = sel.value || "all";

        sel.innerHTML = '<option value="all">Semua Tahun</option>' +
            years.map(function (y) {
                return '<option value="' + esc(y) + '">' + esc(y) + "</option>";
            }).join("");

        if (ccvFirstLoad) {
            sel.value = ccvDefaultYear;
            ccvFirstLoad = false;
        } else {
            sel.value = years.includes(current) || current === "all" ? current : ccvDefaultYear;
        }
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

        el("ccvFMonth").addEventListener("change", ccvRender);
        el("ccvFRisk").addEventListener("change", ccvRender);
        el("ccvFObs").addEventListener("change", ccvRender);
        el("ccvFUlp").addEventListener("change", ccvRender);

        /* Pilihan ULP mengikuti Unit Pelaksana yang dipilih */
        el("ccvFUnit").addEventListener("change", function () {
            fillUlpOptions();
            ccvRender();
        });

        el("ccvFReset").addEventListener("click", function () {

            ["ccvFMonth", "ccvFUnit", "ccvFUlp", "ccvFRisk", "ccvFObs"].forEach(function (id) {
                el(id).value = "all";
            });

            const y = el("ccvYear");

            if (y) { y.value = ccvDefaultYear; }

            fillMonthOptions();
            fillUlpOptions();
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

    /* Kotak penjelasan di bawah judul tiap grafik */
    const DESC_IDS = {
        bulan: "ccvDescBulan",
        unit: "ccvDescUnit",
        risk: "ccvDescRisk",
        observer: "ccvDescObserver",
        ulp: "ccvDescUlp"
    };

    function ensureDescs() {

        Object.keys(DESC_IDS).forEach(function (key) {

            const panel = document.querySelector("#view-ccv .ccv-p-" + key);

            if (!panel || el(DESC_IDS[key])) { return; }

            const title = panel.querySelector(".ccv-title");

            if (!title) { return; }

            const box = document.createElement("div");

            box.className = "ccv-desc";
            box.id = DESC_IDS[key];

            title.insertAdjacentElement("afterend", box);
        });
    }

    function setDesc(key, staticHtml, liveHtml) {

        const box = el(DESC_IDS[key]);

        if (!box) { return; }

        box.innerHTML = staticHtml +
            (liveHtml ? '<span class="ccv-desc-live">' + liveHtml + "</span>" : "");
    }

    /* Panel "Cek Data Asli" di bawah semua grafik */
    function ensureCheckPanel() {

        if (el("ccvCheckPanel")) { return; }

        const layout = document.querySelector("#view-ccv .ccv-layout");

        if (!layout) { return; }

        const box = document.createElement("div");

        box.className = "panel";
        box.id = "ccvCheckPanel";
        box.style.marginTop = "18px";
        box.hidden = true;

        layout.insertAdjacentElement("afterend", box);
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

    function uniqueItems(rows, getKey, getLabel) {

        const map = {};

        rows.forEach(function (r) {

            const k = getKey(r);

            if (k && !(k in map)) { map[k] = getLabel(r); }
        });

        return Object.keys(map)
            .map(function (k) { return { value: k, label: map[k] }; })
            .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }

    /* Bulan yang benar-benar ada di data (dengan jumlah laporannya) */
    function fillMonthOptions() {

        const y = val("ccvYear");

        const counts = new Array(12).fill(0);

        ccvRows.forEach(function (r) {
            if (r.month >= 0 && (y === "all" || r.year === y)) { counts[r.month]++; }
        });

        const items = [];

        counts.forEach(function (n, i) {
            if (n > 0) {
                items.push({ value: String(i), label: CCV_MONTHS[i] + " (" + fmt(n) + ")" });
            }
        });

        fillSelect("ccvFMonth", "Semua Bulan", items);
    }

    function fillUlpOptions() {

        const u = val("ccvFUnit");

        const source = u === "all"
            ? ccvRows
            : ccvRows.filter(function (r) { return r.unitKey === u; });

        fillSelect("ccvFUlp", "Semua ULP",
            uniqueItems(source,
                function (r) { return r.ulpKey; },
                function (r) { return r.ulp; }));
    }

    function fillFilterOptions() {

        fillMonthOptions();

        fillSelect("ccvFUnit", "Semua Unit",
            uniqueItems(ccvRows,
                function (r) { return r.unitKey; },
                function (r) { return r.unit; }));

        fillUlpOptions();

        fillSelect("ccvFRisk", "Semua RC",
            uniqueItems(ccvRows,
                function (r) { return r.riskKey; },
                function (r) { return r.risk; }));

        fillSelect("ccvFObs", "Semua Jabatan",
            uniqueItems(ccvRows,
                function (r) { return r.obsKey; },
                function (r) { return r.observer; }));
    }

    function val(id) {

        const e = el(id);

        return e ? e.value : "all";
    }

    /* skipMonth = true hanya untuk grafik per-bulan (saat belum ada bulan dipilih) */
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
            if (o !== "all" && r.obsKey !== o) { return false; }

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

    function horizontalScales() {

        const tick = { color: textColor(), font: { size: 11 } };

        return {
            x: {
                beginAtZero: true,
                ticks: Object.assign({ precision: 0 }, tick),
                grid: { color: gridColor() }
            },
            y: {
                ticks: Object.assign({
                    callback: function (v) {
                        return shorten(this.getLabelForValue(v), 30);
                    }
                }, tick),
                grid: { display: false }
            }
        };
    }

    function setBoxHeight(canvas, count, rowH, min) {

        const wrap = canvas.parentElement;

        if (wrap) {
            wrap.style.height = Math.max(min, count * rowH + 60) + "px";
        }
    }

    /* Grafik 1: per BULAN (semua bulan) — atau per TANGGAL bila satu bulan dipilih */
    function drawMonthly() {

        destroyChart("bulan");

        const canvas = el("ccvBulananChart");

        if (!canvas) { return; }

        const mSel = val("ccvFMonth");
        const ySel = val("ccvYear");
        const titleEl = document.querySelector("#view-ccv .ccv-p-bulan .ccv-title");

        const yearText = ySel === "all" ? "semua tahun" : "tahun " + ySel;

        /* ===== MODE PER TANGGAL (satu bulan dipilih) ===== */

        if (mSel !== "all") {

            const m = Number(mSel);
            const rows = getRows(false);

            const years = countBy(rows, function (r) { return r.year; });

            const yearNum = ySel !== "all"
                ? Number(ySel)
                : (years.length ? Number(years[0].label) : new Date().getFullYear());

            const days = new Date(yearNum, m + 1, 0).getDate();

            const counts = new Array(days).fill(0);

            let placed = 0;

            rows.forEach(function (r) {
                if (r.tsMonth === m && r.day >= 1 && r.day <= days) {
                    counts[r.day - 1]++;
                    placed++;
                }
            });

            const notPlaced = rows.length - placed;

            if (titleEl) {
                titleEl.textContent = "CCV per Tanggal — " + CCV_MONTHS[m] + (ySel === "all" ? "" : " " + ySel);
            }

            setDesc("bulan",
                "Menghitung <b>jumlah laporan CCV per tanggal</b> pada bulan yang dipilih " +
                "(1 baris spreadsheet = 1 laporan). Tanggal dibaca dari kolom <b>Timestamp</b>. " +
                "Grafik ini otomatis kembali ke tampilan per bulan bila filter Bulan = Semua Bulan.",
                "Bulan <b>" + CCV_MONTHS[m] + "</b> (" + yearText + "): <b>" + fmt(rows.length) +
                "</b> laporan" +
                (notPlaced > 0
                    ? ", " + fmt(notPlaced) + " laporan tidak ditampilkan di grafik karena tanggal Timestamp-nya berbeda dari kolom Bulan."
                    : "."));

            ccvCharts.bulan = new Chart(canvas, {
                type: "bar",
                data: {
                    labels: counts.map(function (v, i) { return String(i + 1); }),
                    datasets: [{
                        label: "Jumlah CCV",
                        data: counts,
                        backgroundColor: "#34A853",
                        borderRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 22, right: 8 } },
                    plugins: {
                        legend: { display: false },
                        ccvValueLabels: { display: true, skipZero: true },
                        tooltip: {
                            callbacks: {
                                title: function (items) {
                                    return "Tanggal " + items[0].label + " " + CCV_MONTHS[m];
                                }
                            }
                        }
                    },
                    scales: (function () {
                        const s = baseScales();
                        s.x.ticks.maxRotation = 0;
                        s.x.ticks.minRotation = 0;
                        s.x.ticks.font = { size: 10 };
                        return s;
                    })()
                },
                plugins: [ccvValueLabels]
            });

            return;
        }

        /* ===== MODE PER BULAN (semua bulan) ===== */

        const rowsAll = getRows(true);

        const counts = new Array(12).fill(0);

        rowsAll.forEach(function (r) {
            if (r.month >= 0) { counts[r.month]++; }
        });

        const total = counts.reduce(function (s, v) { return s + v; }, 0);

        if (titleEl) { titleEl.textContent = "Kumulatif CCV UID Sulselrabar"; }

        setDesc("bulan",
            "Menghitung <b>jumlah laporan CCV per bulan</b> (1 baris spreadsheet = 1 laporan), " +
            "berdasarkan kolom <b>Bulan</b>. Mengikuti filter Tahun, Unit, ULP, Risk Containment dan Jabatan. " +
            "Pilih satu bulan di filter untuk melihat rinciannya per tanggal.",
            "Total pada grafik: <b>" + fmt(total) + "</b> laporan (" + yearText + ").");

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

    /* Grafik 2: per Unit Pelaksana (batang mendatar, nama lengkap terbaca) */
    function drawUnit(rows) {

        destroyChart("unit");

        const canvas = el("ccvUnitChart");

        if (!canvas) { return; }

        const list = countBy(rows, function (r) { return r.unit; });

        const total = list.reduce(function (s, e) { return s + e.value; }, 0);
        const empty = rows.length - total;

        setDesc("unit",
            "Menghitung <b>jumlah laporan CCV per Unit Pelaksana (UP3/UP2D)</b> dari kolom " +
            "<b>Nama Unit Pelaksana</b>. Satu laporan dihitung satu kali pada unit yang diisi pelapor.",
            "<b>" + fmt(total) + "</b> laporan di <b>" + list.length + "</b> unit" +
            (empty > 0 ? "; " + fmt(empty) + " laporan tidak mengisi unit sehingga tidak masuk grafik." : "."));

        setBoxHeight(canvas, list.length, 26, 300);

        ccvCharts.unit = new Chart(canvas, {
            type: "bar",
            data: {
                labels: list.map(function (e) { return e.label; }),
                datasets: [{
                    label: "Jumlah CCV",
                    data: list.map(function (e) { return e.value; }),
                    backgroundColor: "#7BA7F7",
                    borderRadius: 3,
                    barThickness: 16
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 52 } },
                plugins: {
                    legend: { display: false },
                    ccvValueLabels: { display: true, horizontal: true }
                },
                scales: horizontalScales()
            },
            plugins: [ccvValueLabels]
        });
    }

    /* Grafik 3: persentase Risk Containment (nilai asli dari spreadsheet) */
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
                    label: r.risk,
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
        const empty = rows.length - total;

        setDesc("risk",
            "Menghitung <b>porsi tiap Risk Containment</b> dari kolom <b>Pilih salah satu dari Top 3 " +
            "Risk Containment (RC)</b>. Persentase = jumlah laporan RC tersebut ÷ total laporan yang mengisi RC.",
            "Dasar perhitungan: <b>" + fmt(total) + "</b> laporan" +
            (empty > 0 ? " (" + fmt(empty) + " laporan tanpa RC tidak dihitung)." : "."));

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
                        "<span>" + fmt(i.value) + " laporan • " + pct + "%</span></div></div>";

                }).join("")
                : '<div style="color:var(--muted);font-size:12px;">Belum ada data.</div>';
        }
    }

    /* Grafik 4: Jabatan Observer (nilai asli dari spreadsheet) */
    function drawObserver(rows) {

        destroyChart("observer");

        const canvas = el("ccvObserverChart");

        if (!canvas) { return; }

        const list = countBy(rows, function (r) { return r.observer; });

        const total = list.reduce(function (s, e) { return s + e.value; }, 0);
        const empty = rows.length - total;

        setDesc("observer",
            "Menghitung <b>jumlah laporan berdasarkan jabatan/posisi pengisi (observer)</b> dari kolom " +
            "<b>Jabatan/Posisi Observer</b>. Yang dihitung adalah <b>jumlah laporan</b>, bukan jumlah orang unik — " +
            "satu observer yang mengisi 10 laporan dihitung 10.",
            "<b>" + fmt(total) + "</b> laporan dalam <b>" + list.length + "</b> jabatan" +
            (empty > 0 ? "; " + fmt(empty) + " laporan tanpa jabatan tidak dihitung." : "."));

        setBoxHeight(canvas, list.length, 44, 300);

        ccvCharts.observer = new Chart(canvas, {
            type: "bar",
            data: {
                labels: list.map(function (e) { return e.label; }),
                datasets: [{
                    label: "Total Observer",
                    data: list.map(function (e) { return e.value; }),
                    backgroundColor: "#9FC5E8",
                    borderRadius: 3,
                    barThickness: 26
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 52 } },
                plugins: {
                    legend: { display: false },
                    ccvValueLabels: { display: true, horizontal: true }
                },
                scales: horizontalScales()
            },
            plugins: [ccvValueLabels]
        });
    }

    /* Grafik 5: per Unit Layanan (ULP) */
    function drawUlp(rows) {

        destroyChart("ulp");

        const canvas = el("ccvUlpChart");

        if (!canvas) { return; }

        let list = countBy(rows, function (r) { return r.ulp; });

        const totalUlp = list.length;
        const total = list.reduce(function (s, e) { return s + e.value; }, 0);
        const empty = rows.length - total;

        /* ----- filter lokal grafik ULP ----- */

        const searchEl = el("ccvUlpSearch");

        const q = norm(searchEl ? searchEl.value : "");
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

        setDesc("ulp",
            "Menghitung <b>jumlah laporan CCV per Unit Layanan Pelanggan (ULP)</b> dari kolom " +
            "<b>Nama Unit Layanan Pelanggan</b>. Gunakan kotak pencarian, urutan dan batas tampilan di bawah " +
            "untuk menyaring grafik ini saja.",
            "<b>" + fmt(total) + "</b> laporan di <b>" + totalUlp + "</b> ULP" +
            (empty > 0 ? "; " + fmt(empty) + " laporan tidak mengisi ULP sehingga tidak masuk grafik." : "."));

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
                layout: { padding: { top: 18 } },
                plugins: {
                    legend: { display: false },
                    ccvValueLabels: { display: true }
                },
                scales: scales
            },
            plugins: [ccvValueLabels]
        });
    }

    /* Panel pembanding dengan spreadsheet */
    function renderCheck() {

        const box = el("ccvCheckPanel");

        if (!box) { return; }

        const byBulan = new Array(12).fill(0);
        const byStamp = new Array(12).fill(0);

        let mismatch = 0;
        let noMonth = 0;
        let noUnit = 0;
        let noUlp = 0;
        let noRisk = 0;
        let noObs = 0;

        ccvRows.forEach(function (r) {

            if (r.month >= 0) { byBulan[r.month]++; } else { noMonth++; }
            if (r.tsMonth >= 0) { byStamp[r.tsMonth]++; }

            if (r.month >= 0 && r.tsMonth >= 0 && r.month !== r.tsMonth) { mismatch++; }

            if (!r.unit) { noUnit++; }
            if (!r.ulp) { noUlp++; }
            if (!r.risk) { noRisk++; }
            if (!r.observer) { noObs++; }
        });

        const years = Array.from(new Set(
            ccvRows.map(function (r) { return r.year; }).filter(Boolean)
        )).sort();

        const time = ccvLoadedAt
            ? ccvLoadedAt.toLocaleTimeString("id-ID") + ", " + ccvLoadedAt.toLocaleDateString("id-ID")
            : "-";

        const monthRows = CCV_MONTHS.map(function (name, i) {

            if (!byBulan[i] && !byStamp[i]) { return ""; }

            const diff = byBulan[i] !== byStamp[i];

            return "<tr><td>" + name + "</td><td>" + fmt(byBulan[i]) + "</td><td>" +
                fmt(byStamp[i]) + "</td><td" + (diff ? ' class="ccv-warn"' : "") + ">" +
                (diff ? "Berbeda" : "Sama") + "</td></tr>";

        }).join("");

        box.innerHTML =
            '<details class="ccv-check"><summary>Cek Data Asli dari Spreadsheet</summary>' +
            '<div class="ccv-check-body">' +
            "<p>Sumber: <b>" + (ccvSource === "contoh" ? "DATA CONTOH" : "Google Sheets (CSV)") + "</b> • " +
            "Terakhir dimuat: <b>" + esc(time) + "</b> • " +
            "Baris data di spreadsheet: <b>" + fmt(ccvRawCount) + "</b> • " +
            "Baris yang dipakai: <b>" + fmt(ccvRows.length) + "</b> • " +
            "Tahun pada data: <b>" + esc(years.join(", ") || "-") + "</b></p>" +
            "<p>Bandingkan angka di bawah dengan Sheets (misalnya filter kolom <b>Bulan</b> lalu lihat jumlah baris di pojok kiri bawah). " +
            "Data Google yang dipublikasikan ke web bisa terlambat beberapa menit dari isi sheet.</p>" +
            "<h3>Jumlah laporan per bulan</h3>" +
            '<div class="table-wrapper"><table class="ccv-mini"><thead><tr><th>Bulan</th>' +
            "<th>Menurut kolom Bulan (dipakai grafik)</th><th>Menurut tanggal Timestamp</th><th>Status</th></tr></thead><tbody>" +
            (monthRows || '<tr><td colspan="4">Belum ada data.</td></tr>') + "</tbody></table></div>" +
            "<h3>Kualitas isian</h3>" +
            "<p>Laporan yang kolom <b>Bulan</b>-nya berbeda dengan tanggal Timestamp: <b" +
            (mismatch ? ' class="ccv-warn"' : "") + ">" + fmt(mismatch) + "</b> • " +
            "Tanpa bulan: <b>" + fmt(noMonth) + "</b> • " +
            "Tanpa Unit Pelaksana: <b>" + fmt(noUnit) + "</b> • " +
            "Tanpa ULP: <b>" + fmt(noUlp) + "</b> • " +
            "Tanpa Risk Containment: <b>" + fmt(noRisk) + "</b> • " +
            "Tanpa Jabatan Observer: <b>" + fmt(noObs) + "</b></p>" +
            "</div></details>";

        box.hidden = false;
    }

    function ccvRender() {

        if (typeof Chart === "undefined") {
            setStatus("Chart.js tidak ditemukan.", true);
            return;
        }

        ensureDescs();
        ensureCheckPanel();

        const rows = getRows(false);

        drawMonthly();
        drawUnit(rows);
        drawRisk(rows);
        drawObserver(rows);
        drawUlp(rows);

        renderCheck();

        const info = el("ccvFInfo");

        if (info) {
            info.innerHTML = "Menampilkan <b>" + fmt(rows.length) +
                "</b> dari <b>" + fmt(ccvRows.length) + "</b> laporan";
        }
    }


    /* ---------- INISIALISASI ---------- */

    document.addEventListener("DOMContentLoaded", function () {

        buildFilterBar();
        buildUlpFilter();
        ensureDescs();
        ensureCheckPanel();

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

        /* Ganti tahun: jumlah per bulan di filter Bulan ikut diperbarui */
        const yearSel = el("ccvYear");

        if (yearSel) {
            yearSel.addEventListener("change", function () {
                if (ccvLoaded) { fillMonthOptions(); }
                ccvRender();
            });
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