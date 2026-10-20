/* =========================================================
   MENU BERKELOMPOK + HALAMAN 4DX + HALAMAN SAFETY BRIEFING
   - Dropdown sidebar: tertutup saat dibuka, terbuka saat diklik
   - Membuat halaman LM 1.1 s.d. LM 2.2 (diisi oleh 4dx-data.js)
   - Membuat wadah halaman Safety Briefing (diisi oleh safety-briefing.js)
   - Perpindahan halaman untuk menu 4DX dan Safety Briefing

   CATATAN: Link spreadsheet 4DX TIDAK diisi di file ini.
            Isi di bagian atas 4dx-data.js (LINK_4DX).
========================================================= */

(function () {

    "use strict";

    const style = document.createElement("style");

    style.id = "menu4dx-css";
    style.textContent =
        ".nav-group > .nav-group-items { display: none !important; }" +
        ".nav-group.open > .nav-group-items { display: block !important; max-height: none !important; overflow: visible !important; }";

    document.head.appendChild(style);

    /* Semua grup tertutup saat web dibuka */
    document.querySelectorAll(".nav-group.open").forEach(function (g) {
        g.classList.remove("open");
    });

    /* Fase capture di window: jalan paling awal, sehingga tidak toggle ganda */
    window.addEventListener("click", function (event) {

        const btn = event.target.closest ? event.target.closest(".nav-group-btn") : null;

        if (!btn) { return; }

        const group = btn.parentElement;

        if (!group || !group.classList.contains("nav-group")) { return; }

        event.preventDefault();
        event.stopImmediatePropagation();

        group.classList.toggle("open");

    }, true);


    /* ---------- WADAH HALAMAN ---------- */

    const main = document.querySelector("main.main") || document.querySelector("main");

    /* Halaman Safety Briefing (isinya dibangun oleh safety-briefing.js) */
    if (main && !document.getElementById("view-safety")) {

        const safety = document.createElement("section");

        safety.className = "view";
        safety.id = "view-safety";

        main.appendChild(safety);
    }

    /* Halaman LM 4DX */
    const LMS = [
        { id: "4dx-lm11", code: "LM 1.1" },
        { id: "4dx-lm12", code: "LM 1.2" },
        { id: "4dx-lm13", code: "LM 1.3" },
        { id: "4dx-lm21", code: "LM 2.1" },
        { id: "4dx-lm22", code: "LM 2.2" }
    ];

    function card(label) {
        return '<div class="kpi-card"><div class="kpi-icon"></div><div>' +
            "<span>" + label + "</span><strong>-</strong></div></div>";
    }

    LMS.forEach(function (lm) {

        if (!main || document.getElementById("view-" + lm.id)) { return; }

        const section = document.createElement("section");

        section.className = "view";
        section.id = "view-" + lm.id;

        section.innerHTML =
            '<div class="page-header"><div><h1>4DX - ' + lm.code + "</h1>" +
            "<p>Data Realisasi " + lm.code + " dari Spreadsheet 4DX.</p></div></div>" +
            '<div class="kpi-grid">' +
            card("Realisasi") + card("Jumlah Data") + card("Realisasi Terakhir") +
            "</div>" +
            '<div class="panel"><div class="fdx-empty">Memuat data realisasi...</div></div>';

        main.appendChild(section);
    });


    /* ---------- PINDAH HALAMAN (4DX & SAFETY) ---------- */

    document.addEventListener("click", function (event) {

        const link = event.target.closest
            ? event.target.closest('.nav-link[data-view^="4dx-"], .nav-link[data-view="safety"]')
            : null;

        if (!link) { return; }

        event.preventDefault();

        const name = link.getAttribute("data-view");
        const target = document.getElementById("view-" + name);

        if (!target) { return; }

        document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
        document.querySelectorAll(".nav-link").forEach(function (l) { l.classList.remove("active"); });

        target.classList.add("active");
        link.classList.add("active");

        const title = document.querySelector(".topbar-title");

        if (title) {
            title.textContent = name === "safety"
                ? "Safety Briefing"
                : "4DX - " + link.textContent.trim();
        }

        window.scrollTo(0, 0);
    });

})();