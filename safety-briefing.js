/* =========================================================
   LAPORAN SAFETY BRIEFING & RESPON PESAN KESELAMATAN  (v4)
   Terhubung ke Google Spreadsheet (CSV). Tampilan dibuat
   otomatis dari kolom yang ada di spreadsheet.

   Perubahan v4:
   - Kolom tanggal lain (selain Timestamp) disembunyikan dari tabel
   - Timestamp ditampilkan format Indonesia: DD/MM/YYYY HH:mm:ss
========================================================= */

(function () {

    "use strict";

    /* =====================================================
       KONFIGURASI  — TEMPEL LINK SPREADSHEET DI SINI
    ===================================================== */

    const SOURCES = [
        {
            key: "safety",
            name: "Safety Briefing & Respon Pesan Keselamatan",
            url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTxSvBgrMtmueqBRyNnWMZVM0rfvbj72RBT7djNNOaDLaj0dHnneMbCTy9LfzUk_R1B2xesnYAPkm-l/pub?gid=1867496529&single=true&output=csv"
        }
        /* contoh dua sumber:
        ,{
            key: "respon",
            name: "Respon Pesan Keselamatan",
            url: "PASTE_LINK_SHEET_KEDUA_DI_SINI"
        }
        */
    ];

    const STORAGE_PREFIX = "safety_url_";
    const PAGE_SIZE = 25;

    const MONTHS = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const BLUE = "#0F62B5";

    const PALETTE = [
        "#0F62B5", "#F97316", "#16A34A", "#DC2626",
        "#7C3AED", "#0D9488", "#EAB308", "#DB2777", "#64748B"
    ];


    /* =====================================================
       CSS
    ===================================================== */

    (function injectCss() {

        const css = `
        #view-safety .sf-source-row { display: flex; gap: 8px; flex-wrap: wrap; }
        #view-safety .sf-source-row input { flex: 1; min-width: 240px; }
        #view-safety .sf-hint { margin-top: 8px; font-size: 11.5px; color: var(--muted); line-height: 1.7; }

        #view-safety .sf-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        #view-safety .sf-tab {
            border: 1px solid var(--line); background: var(--bg-card); color: var(--ink);
            border-radius: 999px; padding: 8px 16px; font-size: 12.8px; font-weight: 600;
        }
        #view-safety .sf-tab.active { background: var(--pln-blue); border-color: var(--pln-blue); color: #fff; }

        #view-safety .sf-filter-bar {
            display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 14px;
            background: var(--bg-card); border: 1px solid var(--line);
            border-radius: var(--radius-lg); box-shadow: var(--shadow-card);
            padding: 14px 18px; margin-bottom: 18px;
        }
        #view-safety .sf-filter-item { display: flex; flex-direction: column; gap: 4px; min-width: 160px; flex: 1 1 160px; max-width: 260px; }
        #view-safety .sf-filter-item label { font-size: 11.5px; font-weight: 600; color: var(--muted); }
        #view-safety .sf-filter-item select,
        #view-safety .sf-filter-item input,
        #view-safety .sf-ctrl select {
            border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px;
            font-size: 12.5px; color: var(--ink); background: var(--pln-sky); outline: none;
        }
        #view-safety .sf-filter-item select,
        #view-safety .sf-filter-item input { width: 100%; padding: 8px 10px; }
        #view-safety .sf-filter-item select:focus,
        #view-safety .sf-filter-item input:focus,
        #view-safety .sf-ctrl select:focus {
            border-color: var(--pln-blue-light);
            box-shadow: 0 0 0 3px rgba(46, 140, 224, .15);
        }
        #view-safety .sf-info { margin-left: auto; font-size: 12px; color: var(--muted); padding-bottom: 8px; }
        #view-safety .sf-info b { color: var(--ink); }

        body.dark #view-safety .sf-filter-item select,
        body.dark #view-safety .sf-filter-item input,
        body.dark #view-safety .sf-ctrl select { background: #0B1B33; color: var(--ink); border-color: var(--line); }
        body.dark #view-safety .sf-tab { background: var(--bg-card); }
        body.dark #view-safety .sf-tab.active { background: var(--pln-blue); }

        #view-safety .sf-charts { margin-bottom: 20px; }
        #view-safety .sf-charts .chart-box { min-width: 0; }
        #view-safety .sf-charts .chart-container { max-width: none; }

        #view-safety .sf-ctrl { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

        #view-safety .sf-donut { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; }
        #view-safety .sf-donut-box { position: relative; width: 230px; height: 230px; flex-shrink: 0; }
        #view-safety .sf-legend { flex: 1; min-width: 190px; display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; }
        #view-safety .sf-legend-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; }
        #view-safety .sf-legend-dot { width: 10px; height: 10px; min-width: 10px; border-radius: 50%; margin-top: 4px; }
        #view-safety .sf-legend-name { flex: 1; color: var(--ink); font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
        #view-safety .sf-legend-val { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
        #view-safety .sf-legend-val b { color: var(--pln-navy); }
        body.dark #view-safety .sf-legend-val b { color: var(--white); }

        #view-safety details.sf-check summary { cursor: pointer; font-weight: 700; color: var(--pln-navy); font-size: 13.5px; }
        body.dark #view-safety details.sf-check summary { color: var(--white); }
        #view-safety .sf-check-body { margin-top: 12px; }
        #view-safety .sf-check h3 { font-size: 12.5px; margin: 14px 0 6px; }
        #view-safety .sf-mini { min-width: 0; }
        #view-safety .sf-mini th, #view-safety .sf-mini td { padding: 7px 10px; font-size: 12px; }

        #view-safety .sf-cell {
            max-width: 300px; min-width: 90px; white-space: normal;
            display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
            overflow: hidden; line-height: 1.45;
        }

        #view-safety .sf-time { white-space: nowrap; font-variant-numeric: tabular-nums; }

        #view-safety .sf-pager {
            display: flex; align-items: center; justify-content: space-between;
            gap: 10px; flex-wrap: wrap; margin-top: 14px; font-size: 12px; color: var(--muted);
        }
        #view-safety .sf-pager-btns { display: flex; gap: 8px; }
        #view-safety .sf-pager button:disabled { opacity: .45; cursor: not-allowed; }

        #view-safety .sf-empty { text-align: center; padding: 36px 16px; color: var(--muted); font-size: 13px; }
        `;

        const style = document.createElement("style");

        style.id = "safety-briefing-css";
        style.textContent = css;

        document.head.appendChild(style);

    })();


    /* =====================================================
       HELPER
    ===================================================== */

    const el = function (id) { return document.getElementById(id); };

    const esc = function (v) {
        return String(v == null ? "" : v)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };

    const norm = function (v) {
        return String(v == null ? "" : v)
            .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    };

    const isDark = function () { return document.body.classList.contains("dark"); };
    const tickColor = function () { return isDark() ? "#EAF2FC" : "#10233F"; };
    const gridColor = function () { return isDark() ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.07)"; };

    function shorten(text, max) {
        return text.length > max ? text.slice(0, max - 1) + "…" : text;
    }

    function pct(v, total) {
        return total ? (v / total * 100).toFixed(1).replace(".", ",") + "%" : "0%";
    }

    function monthKeyOf(d) {
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    }

    function monthLabel(mk) {
        const p = mk.split("-");
        return (MONTHS[Number(p[1]) - 1] || mk) + " " + p[0];
    }

    function parseDate(value) {

        const t = String(value == null ? "" : value).trim();

        if (!t) { return null; }

        const build = function (y, mo, d, h, mi, s) {

            if (mo < 1 || mo > 12 || d < 1 || d > 31) { return null; }

            const dt = new Date(y, mo - 1, d, h || 0, mi || 0, s || 0);

            return isNaN(dt.getTime()) ? null : dt;
        };

        let m = t.match(
            /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T,]+(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?/
        );

        if (m) {

            /* Format spreadsheet (lokasi Amerika): BULAN/TANGGAL/TAHUN, contoh 7/31/2026 */
            let month = Number(m[1]);
            let day = Number(m[2]);

            /* Angka pertama > 12 tidak mungkin bulan, jadi pasti tanggal/bulan */
            if (month > 12) {
                const tmp = month; month = day; day = tmp;
            }

            return build(Number(m[3]), month, day, Number(m[4]), Number(m[5]), Number(m[6]));
        }

        m = t.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);

        if (m) {
            return build(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
        }

        return null;
    }

    /* Format tampilan Indonesia: DD/MM/YYYY atau DD/MM/YYYY HH:mm:ss */
    function formatDateID(d, withTime) {

        const p = function (n) { return String(n).padStart(2, "0"); };

        let out = p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();

        if (withTime) {
            out += " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
        }

        return out;
    }

    function hasTimePart(value) {
        return /\d{1,2}[:.]\d{2}/.test(String(value == null ? "" : value));
    }

    function toCsvUrl(input) {

        const url = String(input || "").trim();

        if (!url || /PASTE_LINK/i.test(url)) { return ""; }

        if (/output=csv/i.test(url) || /tqx=out:csv/i.test(url)) { return url; }

        let m = url.match(/\/spreadsheets\/d\/e\/([^/?#]+)/);

        if (m) {

            const gid = (url.match(/[?&#]gid=(\d+)/) || [])[1];

            return "https://docs.google.com/spreadsheets/d/e/" + m[1] + "/pub?" +
                (gid ? "gid=" + gid + "&single=true&" : "") + "output=csv";
        }

        m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);

        if (m) {

            const gid = (url.match(/[?&#]gid=(\d+)/) || [])[1];

            return "https://docs.google.com/spreadsheets/d/" + m[1] +
                "/gviz/tq?tqx=out:csv" + (gid ? "&gid=" + gid : "");
        }

        return url;
    }

    function options(list, selected) {
        return list.map(function (o) {
            return '<option value="' + esc(o.value) + '"' +
                (String(o.value) === String(selected) ? " selected" : "") + ">" +
                esc(o.label) + "</option>";
        }).join("");
    }


    /* =====================================================
       STATE
    ===================================================== */

    function newState() {
        return {
            loaded: false,
            loadedAt: null,
            rawCount: 0,
            headers: [],
            shown: [],
            display: [],
            rows: [],
            sample: [],
            roles: {},
            filled: {},
            dateCol: "",
            catCols: [],
            chartCols: [],
            filterCols: [],
            cfg: [],
            trendMode: "month",
            filters: {},
            month: "",
            search: "",
            page: 1
        };
    }

    const states = SOURCES.map(newState);

    let active = 0;
    let charts = [];

    const cur = function () { return states[active]; };

    function getUrl(i) {
        return localStorage.getItem(STORAGE_PREFIX + SOURCES[i].key) || SOURCES[i].url;
    }


    /* =====================================================
       ANALISIS KOLOM (OTOMATIS)
    ===================================================== */

    function analyse(st, headers, data) {

        st.headers = headers;
        st.rawCount = data.length;
        st.sample = data.slice(0, 5);

        const colVals = {};

        headers.forEach(function (h) {
            colVals[h] = data
                .map(function (r) { return String(r[h] == null ? "" : r[h]).trim(); })
                .filter(Boolean);
        });

        st.shown = headers.filter(function (h) { return colVals[h].length > 0; });

        st.filled = {};

        headers.forEach(function (h) { st.filled[h] = colVals[h].length; });

        const isUrlCol = function (h) {
            const v = colVals[h];
            return v.length > 0 &&
                v.filter(function (x) { return /^https?:\/\//i.test(x); }).length / v.length >= 0.5;
        };

        /* Rasio tanggal dihitung dari contoh (maks 500 baris) agar cepat */
        const dateRatio = function (h) {

            const v = colVals[h].slice(0, 500);

            return v.length
                ? v.filter(function (x) { return parseDate(x); }).length / v.length
                : 0;
        };

        /* ---- Tentukan kolom tanggal utama (diutamakan kolom "Timestamp") ---- */

        st.dateCol = "";

        const byName = st.shown.filter(function (h) {
            return /timestamp|tanggal|tgl|waktu|date/i.test(h) && dateRatio(h) >= 0.6;
        });

        const stamp = byName.filter(function (h) { return /timestamp/i.test(h); });

        if (stamp.length) {
            st.dateCol = stamp[0];
        } else if (byName.length) {
            st.dateCol = byName[0];
        } else {
            const byContent = st.shown.filter(function (h) { return dateRatio(h) >= 0.8; });
            if (byContent.length) { st.dateCol = byContent[0]; }
        }

        /* ---- Kolom yang ditampilkan di tabel: kolom tanggal lain disembunyikan ---- */

        st.display = st.shown.filter(function (h) {

            if (h === st.dateCol) { return true; }

            return !(/tanggal|tgl|date/i.test(h) && dateRatio(h) >= 0.6);
        });

        st.rows = data.map(function (raw) {

            const d = st.dateCol ? parseDate(raw[st.dateCol]) : null;

            return {
                raw: raw,
                date: d,
                mk: d ? monthKeyOf(d) : "",
                text: st.shown.map(function (h) { return raw[h]; }).join(" ").toLowerCase()
            };
        });

        const priority = /unit|ulp|up3|jenis|kategori|status|respon|jabatan|lokasi|bidang|tim|pesan/i;

        const cats = [];

        st.roles = {};

        st.shown.forEach(function (h) {

            if (h === st.dateCol) { st.roles[h] = "Tanggal"; return; }
            if (isUrlCol(h)) { st.roles[h] = "Link"; return; }

            const v = colVals[h];
            const u = new Set(v.map(norm)).size;
            const avgLen = v.reduce(function (s, x) { return s + x.length; }, 0) / v.length;

            if (u < 2 || u > 40 || avgLen > 50 || (u === v.length && v.length > 15)) {
                st.roles[h] = "Teks";
                return;
            }

            st.roles[h] = "Kategori";

            cats.push({ col: h, unique: u, pri: priority.test(h) ? 0 : 1 });
        });

        cats.sort(function (a, b) { return (a.pri - b.pri) || (a.unique - b.unique); });

        st.catCols = cats.map(function (c) { return c.col; });
        st.chartCols = st.catCols.slice(0, 3);
        st.filterCols = st.catCols.slice(0, 4);

        st.cfg = st.chartCols.map(function (col) {

            const u = cats.find(function (c) { return c.col === col; }).unique;

            return { col: col, type: u <= 5 ? "donut" : "bar", top: 10 };
        });

        st.trendMode = "month";
        st.filters = {};
        st.month = "";
        st.search = "";
        st.page = 1;
    }


    /* =====================================================
       FILTER DATA
    ===================================================== */

    function filtered(st, skipMonth) {

        const q = norm(st.search);

        return st.rows.filter(function (r) {

            if (!skipMonth && st.month && r.mk !== st.month) { return false; }

            for (let i = 0; i < st.filterCols.length; i++) {

                const col = st.filterCols[i];
                const want = st.filters[col];

                if (want && norm(r.raw[col]) !== want) { return false; }
            }

            if (q && !r.text.includes(q)) { return false; }

            return true;
        });
    }


    /* =====================================================
       KERANGKA TAMPILAN
    ===================================================== */

    function buildShell() {

        const root = el("view-safety");

        if (!root) { return false; }

        const tabs = SOURCES.length > 1
            ? '<div class="sf-tabs" id="sfTabs">' +
              SOURCES.map(function (s, i) {
                  return '<button type="button" class="sf-tab' + (i === 0 ? " active" : "") +
                         '" data-i="' + i + '">' + esc(s.name) + "</button>";
              }).join("") + "</div>"
            : "";

        root.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Laporan Safety Briefing &amp; Respon Pesan Keselamatan</h1>
                    <p>Rekap laporan safety briefing dan respon pesan keselamatan berdasarkan data Spreadsheet.</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-secondary" id="sfExport" type="button">↓ Export CSV</button>
                    <button class="btn btn-primary" id="sfRefresh" type="button">↻ Refresh</button>
                </div>
            </div>

            ${tabs}

            <!-- Kotak koneksi: hanya tampil bila ada error -->
            <div class="panel" id="sfConnPanel" hidden>
                <div class="form-group">
                    <label for="sfUrl">Link Google Sheets</label>
                    <div class="sf-source-row">
                        <input type="text" id="sfUrl" placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=...">
                        <button class="btn btn-primary" id="sfConnect" type="button">Hubungkan</button>
                    </div>
                </div>
                <div class="status-message" id="sfStatus" style="margin-top:10px;">Menunggu koneksi...</div>
                <div class="sf-hint">
                    Pastikan spreadsheet sudah dipublikasikan (File → Bagikan → Publikasikan ke web, format CSV)
                    atau dibagikan ke "Siapa saja yang memiliki link".
                </div>
            </div>

            <div class="kpi-grid" id="sfKpi"></div>
            <div class="sf-filter-bar" id="sfFilters" hidden></div>
            <div class="chart-grid sf-charts" id="sfCharts"></div>

            <div class="panel">
                <div class="table-wrapper">
                    <table>
                        <thead id="sfHead"></thead>
                        <tbody id="sfBody">
                            <tr><td class="sf-empty">Memuat data...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="sf-pager" id="sfPager"></div>
            </div>

            <div class="panel" id="sfCheckPanel" hidden></div>
        `;

        el("sfUrl").value = getUrl(0);

        el("sfCharts").addEventListener("change", function (event) {

            const sel = event.target;

            if (!sel || !sel.dataset || !sel.dataset.kind) { return; }

            const st = cur();

            if (sel.dataset.kind === "trend") {
                st.trendMode = sel.value;
            } else {

                const cfg = st.cfg[Number(sel.dataset.i)];

                if (!cfg) { return; }

                if (sel.dataset.kind === "col") { cfg.col = sel.value; }
                if (sel.dataset.kind === "type") { cfg.type = sel.value; }
                if (sel.dataset.kind === "top") { cfg.top = Number(sel.value); }
            }

            drawCharts(st, filtered(st, false));
        });

        return true;
    }

    /* Kotak link/status hanya tampil saat terjadi error */
    function setStatus(msg, isError) {

        const s = el("sfStatus");

        if (!s) { return; }

        s.textContent = msg;
        s.style.color = isError ? "#DC2626" : "";

        const panel = el("sfConnPanel");

        if (panel) { panel.hidden = !isError; }
    }

    function uniqueOptions(st, col) {

        const map = {};

        st.rows.forEach(function (r) {

            const raw = String(r.raw[col] == null ? "" : r.raw[col]).trim();

            if (raw && !(norm(raw) in map)) { map[norm(raw)] = raw; }
        });

        return Object.keys(map)
            .map(function (k) { return { value: k, label: map[k] }; })
            .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }

    function buildFilters(st) {

        const box = el("sfFilters");

        if (!box) { return; }

        let html = "";

        if (st.dateCol) {

            const months = Array.from(new Set(
                st.rows.map(function (r) { return r.mk; }).filter(Boolean)
            )).sort().reverse();

            html += '<div class="sf-filter-item"><label for="sfFMonth">Bulan</label>' +
                '<select id="sfFMonth"><option value="">Semua Bulan</option>' +
                months.map(function (mk) {
                    return '<option value="' + mk + '"' + (st.month === mk ? " selected" : "") + ">" +
                        esc(monthLabel(mk)) + "</option>";
                }).join("") + "</select></div>";
        }

        st.filterCols.forEach(function (col, i) {

            html += '<div class="sf-filter-item"><label for="sfF' + i + '">' + esc(shorten(col, 40)) + "</label>" +
                '<select id="sfF' + i + '"><option value="">Semua</option>' +
                uniqueOptions(st, col).map(function (o) {
                    return '<option value="' + esc(o.value) + '"' +
                        (st.filters[col] === o.value ? " selected" : "") + ">" +
                        esc(shorten(o.label, 60)) + "</option>";
                }).join("") + "</select></div>";
        });

        html += '<div class="sf-filter-item"><label for="sfSearch">Cari</label>' +
            '<input type="text" id="sfSearch" placeholder="Cari di semua kolom..." value="' + esc(st.search) + '"></div>' +
            '<button type="button" class="btn btn-secondary" id="sfReset">Reset Filter</button>' +
            '<div class="sf-info" id="sfInfo"></div>';

        box.innerHTML = html;
        box.hidden = false;

        const monthSel = el("sfFMonth");

        if (monthSel) {
            monthSel.addEventListener("change", function () {
                st.month = monthSel.value;
                st.page = 1;
                renderData();
            });
        }

        st.filterCols.forEach(function (col, i) {

            el("sfF" + i).addEventListener("change", function () {
                st.filters[col] = this.value;
                st.page = 1;
                renderData();
            });
        });

        el("sfSearch").addEventListener("input", function () {
            st.search = this.value;
            st.page = 1;
            renderData();
        });

        el("sfReset").addEventListener("click", function () {

            st.month = "";
            st.search = "";
            st.filters = {};
            st.page = 1;

            buildFilters(st);
            renderData();
        });
    }


    /* =====================================================
       KARTU RINGKASAN
    ===================================================== */

    function renderKpi(st, rows) {

        const cards = [{ label: "Total Laporan", value: rows.length, hero: true }];

        if (st.dateCol) {

            const now = new Date();
            const today = now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
            const mk = monthKeyOf(now);

            cards.push({
                label: "Laporan Hari Ini",
                value: rows.filter(function (r) {
                    return r.date &&
                        (r.date.getFullYear() + "-" + r.date.getMonth() + "-" + r.date.getDate()) === today;
                }).length
            });

            cards.push({
                label: "Laporan Bulan Ini",
                value: rows.filter(function (r) { return r.mk === mk; }).length
            });
        }

        st.chartCols.slice(0, 4 - cards.length).forEach(function (col) {

            const set = new Set();

            rows.forEach(function (r) {
                const k = norm(r.raw[col]);
                if (k) { set.add(k); }
            });

            cards.push({ label: "Jumlah " + shorten(col, 28), value: set.size });
        });

        el("sfKpi").innerHTML = cards.slice(0, 4).map(function (c) {
            return '<div class="kpi-card' + (c.hero ? " kpi-card--hero" : "") + '">' +
                '<div class="kpi-icon"></div><div><span>' + esc(c.label) + "</span><strong>" +
                c.value + "</strong></div></div>";
        }).join("");
    }


    /* =====================================================
       GRAFIK
    ===================================================== */

    const valueLabels = {

        id: "sfValueLabels",

        afterDatasetsDraw: function (chart, args, opts) {

            if (!opts || !opts.display) { return; }

            const ctx = chart.ctx;
            const ds = chart.data.datasets[0];
            const meta = chart.getDatasetMeta(0);

            ctx.save();
            ctx.font = "bold 11px 'Segoe UI', sans-serif";
            ctx.fillStyle = tickColor();

            meta.data.forEach(function (item, i) {

                const v = ds.data[i];

                if (v == null || (opts.skipZero && !v)) { return; }

                const text = opts.total
                    ? v + " (" + pct(v, opts.total) + ")"
                    : String(v);

                if (opts.horizontal) {
                    ctx.textAlign = "left";
                    ctx.textBaseline = "middle";
                    ctx.fillText(text, item.x + 6, item.y);
                } else {
                    ctx.textAlign = "center";
                    ctx.textBaseline = "bottom";
                    ctx.fillText(text, item.x, item.y - 4);
                }
            });

            ctx.restore();
        }
    };

    function destroyCharts() {

        charts.forEach(function (c) { c.destroy(); });
        charts = [];
    }

    function countBy(rows, col) {

        const map = {};

        rows.forEach(function (r) {

            const raw = String(r.raw[col] == null ? "" : r.raw[col]).trim();

            if (!raw) { return; }

            const k = norm(raw);

            if (!map[k]) { map[k] = { label: raw, value: 0 }; }

            map[k].value++;
        });

        return Object.keys(map)
            .map(function (k) { return map[k]; })
            .sort(function (a, b) { return (b.value - a.value) || a.label.localeCompare(b.label); });
    }

    function addPanel(box, title, sub, controls, full, bodyHTML) {

        const panel = document.createElement("div");

        panel.className = "panel chart-box" + (full ? " chart-full" : "");

        panel.innerHTML =
            '<div class="panel-header"><div><h2>' + esc(title) + "</h2>" +
            (sub ? "<p>" + esc(sub) + "</p>" : "") +
            '</div><div class="sf-ctrl">' + controls + "</div></div>" + bodyHTML;

        box.appendChild(panel);

        return panel;
    }

    function canvasBody(idx, height) {
        return '<div class="chart-container" style="height:' + height +
            'px"><canvas id="sfChart' + idx + '"></canvas></div>';
    }

    function drawTrend(st, box, idx) {

        const base = filtered(st, true);

        const allMonths = Array.from(new Set(
            base.map(function (r) { return r.mk; }).filter(Boolean)
        )).sort();

        if (!allMonths.length) { return false; }

        let labels = [];
        let values = [];
        let title;
        let sub;

        if (st.trendMode === "day") {

            const target = st.month || allMonths[allMonths.length - 1];
            const p = target.split("-");
            const days = new Date(Number(p[0]), Number(p[1]), 0).getDate();

            const counts = {};

            base.forEach(function (r) {
                if (r.mk === target && r.date) {
                    const d = r.date.getDate();
                    counts[d] = (counts[d] || 0) + 1;
                }
            });

            for (let d = 1; d <= days; d++) {
                labels.push(String(d));
                values.push(counts[d] || 0);
            }

            title = "Jumlah Laporan per Hari";
            sub = monthLabel(target) + (st.month ? "" : " (bulan terbaru; ubah lewat filter Bulan)");

        } else {

            const counts = {};

            base.forEach(function (r) {
                if (r.mk) { counts[r.mk] = (counts[r.mk] || 0) + 1; }
            });

            labels = allMonths.map(monthLabel);
            values = allMonths.map(function (k) { return counts[k]; });

            title = "Jumlah Laporan per Bulan";
            sub = "Semua bulan yang ada di spreadsheet";
        }

        const controls =
            '<select data-kind="trend">' +
            options([{ value: "month", label: "Bulanan" }, { value: "day", label: "Harian" }], st.trendMode) +
            "</select>";

        addPanel(box, title, sub, controls, true, canvasBody(idx, 300));

        charts.push(new Chart(el("sfChart" + idx), {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Jumlah Laporan",
                    data: values,
                    backgroundColor: BLUE,
                    borderRadius: 4,
                    maxBarThickness: 46
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 22 } },
                plugins: {
                    legend: { display: false },
                    sfValueLabels: { display: true, skipZero: true }
                },
                scales: {
                    x: { ticks: { color: tickColor(), autoSkip: false, maxRotation: 0 }, grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, color: tickColor() },
                        grid: { color: gridColor() }
                    }
                }
            },
            plugins: [valueLabels]
        }));

        return true;
    }

    function drawCategory(st, rows, cfg, box, idx, cfgIndex) {

        const all = countBy(rows, cfg.col);
        const total = all.reduce(function (s, e) { return s + e.value; }, 0);

        const controls =
            '<select data-kind="col" data-i="' + cfgIndex + '">' +
            options(st.catCols.map(function (c) { return { value: c, label: shorten(c, 34) }; }), cfg.col) +
            "</select>" +
            '<select data-kind="type" data-i="' + cfgIndex + '">' +
            options([{ value: "bar", label: "Batang" }, { value: "donut", label: "Donat" }], cfg.type) +
            "</select>" +
            '<select data-kind="top" data-i="' + cfgIndex + '">' +
            options([
                { value: 5, label: "5 teratas" },
                { value: 10, label: "10 teratas" },
                { value: 15, label: "15 teratas" },
                { value: 99, label: "Semua" }
            ], cfg.top) + "</select>";

        const sub = total + " laporan terisi • " + all.length + " kategori";

        if (!all.length) {
            addPanel(box, "Jumlah per " + cfg.col, "", controls, false,
                '<div class="sf-empty">Tidak ada data pada kolom ini.</div>');
            return;
        }

        if (cfg.type === "donut") {

            const list = all.slice(0, 7);

            if (all.length > 7) {
                list.push({
                    label: "Lainnya",
                    value: all.slice(7).reduce(function (s, e) { return s + e.value; }, 0)
                });
            }

            const colors = list.map(function (e, i) { return PALETTE[i % PALETTE.length]; });

            addPanel(box, "Persentase per " + cfg.col, sub, controls, false,
                '<div class="sf-donut"><div class="sf-donut-box"><canvas id="sfChart' + idx + '"></canvas></div>' +
                '<div class="sf-legend">' +
                list.map(function (e, i) {
                    return '<div class="sf-legend-item"><span class="sf-legend-dot" style="background:' + colors[i] + '"></span>' +
                        '<span class="sf-legend-name">' + esc(e.label) + "</span>" +
                        '<span class="sf-legend-val"><b>' + e.value + "</b> • " + pct(e.value, total) + "</span></div>";
                }).join("") + "</div></div>");

            charts.push(new Chart(el("sfChart" + idx), {
                type: "doughnut",
                data: {
                    labels: list.map(function (e) { return e.label; }),
                    datasets: [{
                        data: list.map(function (e) { return e.value; }),
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: isDark() ? "#112543" : "#FFFFFF"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "55%",
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (c) {
                                    return " " + c.label + ": " + c.parsed + " (" + pct(c.parsed, total) + ")";
                                }
                            }
                        }
                    }
                }
            }));

            return;
        }

        const list = all.slice(0, cfg.top);
        const height = Math.max(240, list.length * 30 + 50);

        addPanel(box, "Jumlah per " + cfg.col,
            list.length < all.length ? sub + " • menampilkan " + list.length + " teratas" : sub,
            controls, false, canvasBody(idx, height));

        charts.push(new Chart(el("sfChart" + idx), {
            type: "bar",
            data: {
                labels: list.map(function (e) { return e.label; }),
                datasets: [{
                    label: "Jumlah Laporan",
                    data: list.map(function (e) { return e.value; }),
                    backgroundColor: BLUE,
                    borderRadius: 3,
                    barThickness: 18
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 78 } },
                plugins: {
                    legend: { display: false },
                    sfValueLabels: { display: true, horizontal: true, total: total },
                    tooltip: {
                        callbacks: {
                            label: function (c) {
                                return " " + c.parsed.x + " laporan (" + pct(c.parsed.x, total) + ")";
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0, color: tickColor() },
                        grid: { color: gridColor() }
                    },
                    y: {
                        ticks: {
                            color: tickColor(),
                            callback: function (v) {
                                return shorten(this.getLabelForValue(v), 30);
                            }
                        },
                        grid: { display: false }
                    }
                }
            },
            plugins: [valueLabels]
        }));
    }

    function drawCharts(st, rows) {

        destroyCharts();

        const box = el("sfCharts");

        box.innerHTML = "";

        if (typeof Chart === "undefined") { return; }

        let idx = 0;

        /* Grafik "Jumlah Laporan per Bulan" dimatikan
        if (st.dateCol && drawTrend(st, box, idx)) { idx++; }
        */
    }


    /* =====================================================
       TABEL
    ===================================================== */

    function cellHTML(value) {

        const v = String(value == null ? "" : value).trim();

        if (!v) { return "-"; }

        if (/^https?:\/\//i.test(v)) {

            const urls = v.match(/https?:\/\/[^\s,]+/g) || [];

            return urls.map(function (u, i) {
                return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">Lihat' +
                    (urls.length > 1 ? " " + (i + 1) : "") + "</a>";
            }).join(" · ");
        }

        return '<div class="sf-cell" title="' + esc(v) + '">' + esc(v) + "</div>";
    }

    /* Sel Timestamp: tampil format Indonesia (DD/MM/YYYY HH:mm:ss) */
    function dateCellHTML(row, col) {

        const rawValue = row.raw[col];

        if (!row.date) { return cellHTML(rawValue); }

        return '<span class="sf-time">' + esc(formatDateID(row.date, hasTimePart(rawValue))) + "</span>";
    }

    function renderTable(st, rows) {

        const head = el("sfHead");
        const body = el("sfBody");
        const pager = el("sfPager");

        head.innerHTML = "<tr><th>No</th>" +
            st.display.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr>";

        const sorted = st.dateCol
            ? rows.slice().sort(function (a, b) {
                return (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0);
            })
            : rows;

        const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

        if (st.page > pages) { st.page = pages; }

        const start = (st.page - 1) * PAGE_SIZE;
        const slice = sorted.slice(start, start + PAGE_SIZE);

        if (!slice.length) {

            body.innerHTML = '<tr><td colspan="' + (st.display.length + 1) +
                '" class="sf-empty">Data tidak ditemukan.</td></tr>';

            pager.innerHTML = "";

            return;
        }

        body.innerHTML = slice.map(function (r, i) {

            return "<tr><td>" + (start + i + 1) + "</td>" +
                st.display.map(function (h) {

                    if (h === st.dateCol) {
                        return "<td>" + dateCellHTML(r, h) + "</td>";
                    }

                    return "<td>" + cellHTML(r.raw[h]) + "</td>";

                }).join("") +
                "</tr>";

        }).join("");

        pager.innerHTML =
            "<span>Menampilkan " + (start + 1) + "–" + (start + slice.length) +
            " dari " + sorted.length + " laporan • Halaman " + st.page + " / " + pages + "</span>" +
            '<div class="sf-pager-btns">' +
            '<button type="button" class="btn btn-secondary" id="sfPrev"' + (st.page <= 1 ? " disabled" : "") + ">‹ Sebelumnya</button>" +
            '<button type="button" class="btn btn-secondary" id="sfNext"' + (st.page >= pages ? " disabled" : "") + ">Berikutnya ›</button>" +
            "</div>";

        el("sfPrev").addEventListener("click", function () {
            st.page--;
            renderTable(st, filtered(st, false));
        });

        el("sfNext").addEventListener("click", function () {
            st.page++;
            renderTable(st, filtered(st, false));
        });
    }


    /* =====================================================
       CEK DATA ASLI
    ===================================================== */

    function renderCheck(st, url) {

        const box = el("sfCheckPanel");

        if (!box) { return; }

        let host = "";

        try { host = new URL(url).hostname; } catch (e) { host = ""; }

        const time = st.loadedAt
            ? st.loadedAt.toLocaleTimeString("id-ID") + ", " + st.loadedAt.toLocaleDateString("id-ID")
            : "-";

        const colRows = st.headers.map(function (h) {
            return "<tr><td>" + esc(h) + "</td><td>" + (st.filled[h] || 0) + " / " + st.rawCount +
                "</td><td>" + esc(st.roles[h] || "Kosong") + "</td></tr>";
        }).join("");

        const sampleRows = st.sample.map(function (r) {
            return "<tr>" + st.shown.map(function (h) {
                return "<td>" + esc(shorten(String(r[h] == null ? "" : r[h]), 60)) + "</td>";
            }).join("") + "</tr>";
        }).join("");

        box.innerHTML =
            '<details class="sf-check"><summary>Cek Data Asli dari Spreadsheet</summary>' +
            '<div class="sf-check-body">' +
            "<p>Baris data di spreadsheet: <b>" + st.rawCount + "</b> • Terakhir dimuat: <b>" + esc(time) +
            "</b> • Sumber: <b>" + esc(host || "-") + "</b> • Kolom tanggal: <b>" +
            esc(st.dateCol || "tidak terdeteksi") + "</b></p>" +
            "<h3>Kolom yang terbaca</h3>" +
            '<div class="table-wrapper"><table class="sf-mini"><thead><tr><th>Kolom</th><th>Terisi</th><th>Dikenali sebagai</th></tr></thead><tbody>' +
            colRows + "</tbody></table></div>" +
            "<h3>5 baris pertama (mentah dari spreadsheet)</h3>" +
            '<div class="table-wrapper"><table class="sf-mini"><thead><tr>' +
            st.shown.map(function (h) { return "<th>" + esc(shorten(h, 30)) + "</th>"; }).join("") +
            "</tr></thead><tbody>" + sampleRows + "</tbody></table></div>" +
            "</div></details>";

        box.hidden = false;
    }

    function renderData() {

        const st = cur();

        if (!st.loaded) { return; }

        const rows = filtered(st, false);

        renderKpi(st, rows);
        drawCharts(st, rows);
        renderTable(st, rows);

        const info = el("sfInfo");

        if (info) {
            info.innerHTML = "Menampilkan <b>" + rows.length + "</b> dari <b>" + st.rows.length + "</b> laporan";
        }
    }


    /* =====================================================
       LOAD DATA
    ===================================================== */

    async function load(i) {

        const st = states[i];

        const baseUrl = toCsvUrl(getUrl(i));

        if (!baseUrl) {
            setStatus("Link spreadsheet belum diisi. Tempel link di kolom di atas, lalu tekan Hubungkan.", true);
            return false;
        }

        const url = baseUrl + (baseUrl.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();

        try {

            if (typeof Papa === "undefined") {
                throw new Error("PapaParse tidak ditemukan.");
            }

            setStatus("Memuat data...");

            const response = await fetch(url, { cache: "no-store" });

            if (!response.ok) {
                throw new Error(
                    "HTTP " + response.status +
                    " — pastikan spreadsheet dibagikan atau dipublikasikan."
                );
            }

            const text = await response.text();

            if (/^\s*<!doctype html|^\s*<html/i.test(text)) {
                throw new Error(
                    "Spreadsheet belum dibagikan ke 'Siapa saja yang memiliki link' " +
                    "atau belum dipublikasikan sebagai CSV."
                );
            }

            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: "greedy",
                transformHeader: function (h) { return String(h).trim(); }
            });

            const headers = (parsed.meta.fields || []).filter(Boolean);

            if (!headers.length || !parsed.data.length) {
                throw new Error("Spreadsheet kosong atau baris header tidak ditemukan.");
            }

            analyse(st, headers, parsed.data);

            st.loaded = true;
            st.loadedAt = new Date();

            console.log("Safety Briefing — kolom terdeteksi:", {
                tanggal: st.dateCol,
                kategori: st.catCols,
                grafik: st.chartCols,
                filter: st.filterCols,
                tampil: st.display,
                semuaKolom: st.shown,
                jumlahBaris: st.rawCount
            });

            if (i === active) {

                setStatus("Terhubung — " + st.rawCount + " baris data.", false);

                buildFilters(st);
                renderData();
                renderCheck(st, baseUrl);
            }

            return true;

        } catch (error) {

            console.error("Gagal memuat Safety Briefing:", error);

            setStatus("Gagal memuat data: " + error.message, true);

            return false;
        }
    }

    function exportCsv() {

        const st = cur();

        if (!st.loaded) {
            alert("Data belum dimuat.");
            return;
        }

        const rows = filtered(st, false);

        const csv = Papa.unparse({
            fields: st.display,
            data: rows.map(function (r) {
                return st.display.map(function (h) {

                    if (h === st.dateCol && r.date) {
                        return formatDateID(r.date, hasTimePart(r.raw[h]));
                    }

                    return r.raw[h] == null ? "" : r.raw[h];
                });
            })
        });

        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);
        link.download = "laporan-safety-briefing.csv";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    }

    function showSource(i) {

        active = i;

        document.querySelectorAll("#sfTabs .sf-tab").forEach(function (t) {
            t.classList.toggle("active", Number(t.dataset.i) === i);
        });

        el("sfUrl").value = getUrl(i);

        const st = cur();

        if (st.loaded) {
            setStatus("Terhubung — " + st.rawCount + " baris data.", false);
            buildFilters(st);
            renderData();
            renderCheck(st, toCsvUrl(getUrl(i)));
        } else {
            el("sfKpi").innerHTML = "";
            el("sfCharts").innerHTML = "";
            el("sfFilters").hidden = true;
            el("sfCheckPanel").hidden = true;
            el("sfHead").innerHTML = "";
            el("sfBody").innerHTML = '<tr><td class="sf-empty">Memuat data...</td></tr>';
            el("sfPager").innerHTML = "";
            load(i);
        }
    }


    /* =====================================================
       INISIALISASI
    ===================================================== */

    document.addEventListener("DOMContentLoaded", function () {

        if (!buildShell()) { return; }

        el("sfConnect").addEventListener("click", function () {

            const value = el("sfUrl").value.trim();

            if (!value) {
                alert("Link spreadsheet belum diisi.");
                return;
            }

            localStorage.setItem(STORAGE_PREFIX + SOURCES[active].key, value);

            states[active] = newState();

            load(active);
        });

        el("sfRefresh").addEventListener("click", function () {

            states[active] = newState();

            load(active);
        });

        el("sfExport").addEventListener("click", exportCsv);

        document.querySelectorAll("#sfTabs .sf-tab").forEach(function (tab) {
            tab.addEventListener("click", function () {
                showSource(Number(tab.dataset.i));
            });
        });

        const navLink = document.querySelector('.nav-link[data-view="safety"]');

        if (navLink) {
            navLink.addEventListener("click", function () {

                const st = cur();

                if (!st.loaded) {
                    load(active);
                } else {
                    setTimeout(renderData, 60);
                }
            });
        }

        const themeBtn = el("themeToggle");

        if (themeBtn) {
            themeBtn.addEventListener("click", function () {
                if (cur().loaded) { setTimeout(renderData, 50); }
            });
        }
    });

})();