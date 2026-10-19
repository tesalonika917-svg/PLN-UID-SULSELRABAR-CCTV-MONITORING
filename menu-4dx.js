/* =========================================================
   MENU BERKELOMPOK (ACCORDION) + HALAMAN 4DX & SAFETY BRIEFING
   CSS menu disuntikkan otomatis oleh file ini.
========================================================= */

(function () {

    "use strict";

    /* ---------- CSS MENU ---------- */

    (function injectCss() {

        const css = `
        /* ===== Grup menu (tombol dropdown) ===== */
        .sidebar .nav-group { position: relative; }

        .sidebar .nav-group-btn {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 9px 12px;
            border: 1px solid transparent;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.88);
            font-size: 13.2px;
            font-weight: 600;
            text-align: left;
            cursor: pointer;
            transition: background .18s ease, border-color .18s ease, color .18s ease;
        }

        .sidebar .nav-group-btn:hover {
            background: rgba(255, 255, 255, 0.11);
            color: #fff;
        }

        .sidebar .nav-group-btn:focus-visible {
            outline: 2px solid var(--pln-yellow);
            outline-offset: 2px;
        }

        /* Ikon dalam kotak (grup tingkat 1) */
        .sidebar .nav-group > .nav-group-btn > span:first-child {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.10);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            flex-shrink: 0;
            transition: background .18s ease;
        }

        .sidebar .nav-group > .nav-group-btn > span:nth-child(2) { flex: 1; }

        .sidebar .nav-group-btn .chev {
            font-style: normal;
            font-size: 11px;
            opacity: .75;
            transition: transform .22s ease;
        }

        /* Grup terbuka */
        .sidebar .nav-group.open > .nav-group-btn {
            background: rgba(255, 255, 255, 0.12);
            color: #fff;
        }

        .sidebar .nav-group.open > .nav-group-btn .chev { transform: rotate(180deg); }

        /* Grup yang berisi halaman aktif */
        .sidebar .nav-group.has-active > .nav-group-btn {
            border-color: rgba(255, 199, 44, 0.35);
            color: #fff;
        }

        .sidebar .nav-group.has-active > .nav-group-btn > span:first-child {
            background: var(--pln-yellow);
            color: var(--pln-navy);
        }

        /* ===== Isi grup ===== */
        .sidebar .nav-group-items {
            display: none;
            flex-direction: column;
            gap: 2px;
            margin: 4px 0 8px 22px;
            padding-left: 10px;
            border-left: 2px solid rgba(255, 255, 255, 0.12);
        }

        .sidebar .nav-group.open > .nav-group-items {
            display: flex;
            animation: navSlide .22s ease;
        }

        @keyframes navSlide {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        /* ===== Menu anak ===== */
        .sidebar .nav-link.nav-sub {
            padding: 8px 12px;
            font-size: 12.8px;
            gap: 10px;
            border-radius: 9px;
            color: rgba(255, 255, 255, 0.72);
        }

        .sidebar .nav-link.nav-sub > span:first-child {
            width: auto;
            text-align: left;
            font-size: inherit;
            opacity: 1;
        }

        .sidebar .nav-link.nav-sub > span.sub-dot {
            width: 6px;
            height: 6px;
            min-width: 6px;
            border-radius: 50%;
            background: currentColor;
            opacity: .5;
        }

        .sidebar .nav-link.nav-sub:hover {
            background: rgba(255, 255, 255, 0.09);
            color: #fff;
        }

        .sidebar .nav-link.nav-sub.active {
            background: var(--pln-blue);
            color: #fff;
            font-weight: 600;
            box-shadow: 0 6px 14px rgba(15, 98, 181, 0.45);
        }

        .sidebar .nav-link.nav-sub.active > span.sub-dot {
            background: var(--pln-yellow);
            opacity: 1;
        }

        .sidebar .nav-link.nav-sub2 { padding-left: 14px; white-space: nowrap; }

        /* Grup tingkat 2 (WIG 1 / WIG 2) */
        .sidebar .nav-group-2 > .nav-group-btn {
            padding: 7px 10px;
            font-size: 12.6px;
            background: rgba(255, 255, 255, 0.04);
        }

        .sidebar .nav-group-2 > .nav-group-btn > span:first-child {
            flex: 1;
            width: auto;
            height: auto;
            background: none;
            border-radius: 0;
            justify-content: flex-start;
            font-size: inherit;
        }

        .sidebar .nav-group-2.has-active > .nav-group-btn > span:first-child {
            background: none;
            color: var(--pln-yellow);
        }

        .sidebar .nav-group-2 > .nav-group-items { margin-left: 10px; }

        /* ===== Menu tunggal: Safety Briefing & Panduan ===== */
        .sidebar .nav-link[data-view="safety"],
        .sidebar .nav-link[data-view="panduan"] {
            align-items: center;
            gap: 12px;
            padding: 9px 12px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.88);
            font-weight: 600;
            margin-top: 2px;
        }

        .sidebar .nav-link[data-view="safety"] > span:first-child,
        .sidebar .nav-link[data-view="panduan"] > span:first-child {
            width: 28px;
            height: 28px;
            min-width: 28px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.10);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            opacity: 1;
        }

        .sidebar .nav-link[data-view="safety"]:hover,
        .sidebar .nav-link[data-view="panduan"]:hover {
            background: rgba(255, 255, 255, 0.11);
            color: #fff;
        }

        .sidebar .nav-link[data-view="safety"].active,
        .sidebar .nav-link[data-view="panduan"].active {
            background: var(--pln-blue);
            color: #fff;
            box-shadow: 0 6px 16px rgba(15, 98, 181, 0.45);
        }

        .sidebar .nav-link[data-view="safety"].active > span:first-child,
        .sidebar .nav-link[data-view="panduan"].active > span:first-child {
            background: var(--pln-yellow);
            color: var(--pln-navy);
        }

        .sidebar .navigation { gap: 6px; }

        /* ===== Halaman 4DX ===== */
        .wig-banner {
            background: var(--pln-sky);
            border-left: 4px solid var(--pln-blue);
            border-radius: var(--radius-md);
            padding: 14px 18px;
            margin-bottom: 18px;
        }

        .wig-banner b {
            display: block;
            color: var(--pln-navy);
            margin-bottom: 4px;
            font-size: 13px;
        }

        .wig-banner span { color: var(--ink); font-size: 13px; line-height: 1.6; }

        body.dark .wig-banner b { color: var(--white); }

        .placeholder-box {
            text-align: center;
            padding: 48px 16px;
            color: var(--muted);
            border: 2px dashed var(--line);
            border-radius: var(--radius-md);
            font-size: 13px;
        }

        .kpi-grid.kpi-3 { grid-template-columns: repeat(3, 1fr); }

        @media (max-width: 860px) {
            .kpi-grid.kpi-3 { grid-template-columns: 1fr; }
        }

        @media (prefers-reduced-motion: reduce) {
            .sidebar .nav-group.open > .nav-group-items { animation: none; }
        }
        `;

        const style = document.createElement("style");

        style.id = "menu-4dx-css";
        style.textContent = css;

        document.head.appendChild(style);

    })();


    /* ---------- DATA HALAMAN ---------- */

    const WIG_TEXT = {
        "WIG 1": "Mempertahankan angka kecelakaan kerja dari 0 menjadi 0 pada tanggal 31 Desember 2026.",
        "WIG 2": "Menurunkan angka kecelakaan masyarakat umum dari 12 kali menjadi 8 kali pada 31 Desember 2025."
    };

    const PAGES = [
        {
            id: "4dx-lm11", wig: "WIG 1", code: "LM 1.1", col: "Realisasi LM 1.1",
            title: "Melakukan evaluasi penerbitan izin kerja"
        },
        {
            id: "4dx-lm12", wig: "WIG 1", code: "LM 1.2", col: "Realisasi LM 1.2",
            title: "Pelaksanaan kegiatan rutin safety patrol dan observasi pekerjaan Yantek dan Konstruksi (KHS)"
        },
        {
            id: "4dx-lm13", wig: "WIG 1", code: "LM 1.3", col: "Realisasi LM 1.3",
            title: "Melakukan pre-survey pekerjaan pemeliharaan terencana, rehabilitasi jaringan distribusi dan KHS"
        },
        {
            id: "4dx-lm21", wig: "WIG 2", code: "LM 2.1", col: "Realisasi LM 2.1",
            title: "Melaksanakan kegiatan rutin safety patrol pada kegiatan masyarakat yang berpotensi membahayakan, bangunan yang mendekati jaringan dan pohon produktif mendekati jaringan"
        },
        {
            id: "4dx-lm22", wig: "WIG 2", code: "LM 2.2", col: "Realisasi LM 2.2",
            title: "Melakukan edukasi dan sosialisasi bahaya listrik kepada perusahaan/pengusaha, pengelola usaha hiburan dan stakeholder"
        }
    ];

    const TITLES = {
        safety: "Laporan Safety Briefing & Respon Pesan Keselamatan"
    };

    const main = document.querySelector("main.main");

    function addView(id, heading, sub, bodyHTML) {

        const section = document.createElement("section");

        section.className = "view";
        section.id = "view-" + id;

        section.innerHTML =
            '<div class="page-header"><div><h1>' + heading +
            "</h1><p>" + sub + "</p></div></div>" + bodyHTML;

        main.appendChild(section);
    }

    PAGES.forEach(function (p) {

        TITLES[p.id] = "4DX — " + p.code;

        addView(
            p.id,
            p.code + " — " + p.wig,
            p.title,

            '<div class="wig-banner"><b>' + p.wig + "</b><span>" +
            WIG_TEXT[p.wig] + "</span></div>" +

            '<div class="kpi-grid kpi-3">' +
                '<div class="kpi-card kpi-card--hero"><div class="kpi-icon"></div>' +
                    "<div><span>Realisasi</span><strong>-</strong></div></div>" +
                '<div class="kpi-card"><div class="kpi-icon"></div>' +
                    "<div><span>Target</span><strong>-</strong></div></div>" +
                '<div class="kpi-card"><div class="kpi-icon"></div>' +
                    "<div><span>Capaian</span><strong>-</strong></div></div>" +
            "</div>" +

            '<div class="panel"><div class="placeholder-box">Data kolom "' + p.col +
            '" dari spreadsheet akan ditampilkan di sini setelah dihubungkan.</div></div>'
        );
    });

    addView(
        "safety",
        TITLES.safety,
        "Rekap laporan safety briefing dan respon pesan keselamatan.",
        '<div class="panel"><div class="placeholder-box">' +
        "Data dari spreadsheet akan ditampilkan di sini setelah dihubungkan." +
        "</div></div>"
    );


    /* ---------- SIDEBAR: ACCORDION ---------- */

    /* Tutup sebuah grup beserta semua grup di dalamnya */
    function closeGroup(group) {

        group.classList.remove("open");

        group.querySelectorAll(".nav-group").forEach(function (g) {
            g.classList.remove("open");
        });
    }

    /* Tandai grup halaman aktif; buka grup induknya hanya bila openParents = true */
    function syncSidebar(openParents) {

        const active = document.querySelector(".sidebar .nav-link.active");

        document.querySelectorAll(".sidebar .nav-group").forEach(function (g) {
            g.classList.remove("has-active");
        });

        if (!active) { return; }

        const chain = [];

        let group = active.closest(".nav-group");

        while (group) {

            chain.push(group);

            group = group.parentElement
                ? group.parentElement.closest(".nav-group")
                : null;
        }

        if (openParents) {

            document.querySelectorAll(".sidebar .nav-group").forEach(function (g) {
                if (chain.indexOf(g) === -1) { g.classList.remove("open"); }
            });
        }

        chain.forEach(function (g) {
            g.classList.add("has-active");
            if (openParents) { g.classList.add("open"); }
        });
    }

    document.addEventListener("DOMContentLoaded", function () {

        const sidebar = document.querySelector(".sidebar");

        /* Klik tombol grup: buka yang ditekan, tutup saudara-saudaranya */
        document.querySelectorAll(".sidebar .nav-group-btn").forEach(function (btn) {

            btn.addEventListener("click", function () {

                const group = btn.parentElement;
                const willOpen = !group.classList.contains("open");

                Array.from(group.parentElement.children).forEach(function (sib) {
                    if (sib !== group && sib.classList.contains("nav-group")) {
                        closeGroup(sib);
                    }
                });

                if (willOpen) {
                    group.classList.add("open");
                } else {
                    closeGroup(group);
                }
            });
        });

        /* Judul topbar + tutup sidebar di layar kecil */
        document.querySelectorAll(".nav-link[data-view]").forEach(function (link) {

            link.addEventListener("click", function () {

                const title = TITLES[link.dataset.view];
                const bar = document.querySelector(".topbar-title");

                if (title && bar) { bar.textContent = title; }

                if (sidebar) { sidebar.classList.remove("open"); }
            });
        });

        /*
         * Pindah halaman lewat tombol lain ("Lihat Semua") membuka grup
         * induknya. Klik langsung pada menu di sidebar tidak mengubah
         * buka/tutup grup. Penanda dipasang di fase capture supaya aktif
         * sebelum script.js mengganti menu yang aktif.
         */
        let sidebarClickInProgress = false;

        if (sidebar) {
            sidebar.addEventListener("click", function () {
                sidebarClickInProgress = true;
                setTimeout(function () { sidebarClickInProgress = false; }, 0);
            }, true);
        }

        const observer = new MutationObserver(function () {
            syncSidebar(!sidebarClickInProgress);
        });

        document.querySelectorAll(".sidebar .nav-link").forEach(function (link) {
            observer.observe(link, { attributes: true, attributeFilter: ["class"] });
        });

        /* Keadaan awal: semua grup tertutup, hanya ditandai grup yang aktif */
        document.querySelectorAll(".sidebar .nav-group").forEach(function (g) {
            g.classList.remove("open");
        });

        syncSidebar(false);
    });

})();