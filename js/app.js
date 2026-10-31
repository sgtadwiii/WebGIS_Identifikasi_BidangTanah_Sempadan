// Global Chart Instances
let chartLandUseObj = null;
let chartCategoryBarObj = null;
let chartCoastalUsePieObj = null;

/**
 * Tab Switcher (Single Page Application)
 * @param {string} tabId - ID halaman yang akan dituju ('home', 'peta', 'lahan', 'identifikasi', 'statistik')
 */
function switchTab(tabId) {
    // 1. Sembunyikan semua section halaman
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));

    // 2. Reset style tombol sidebar/nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-slate-800', 'text-white');
        btn.classList.add('text-slate-300');
    });

    // 3. Tampilkan section yang dipilih
    const activePage = document.getElementById(`page-${tabId}`);
    if (activePage) activePage.classList.remove('hidden');

    // 4. Highlight tombol nav yang aktif
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) {
        activeNav.classList.add('active', 'bg-slate-800', 'text-white');
        activeNav.classList.remove('text-slate-300');
    }

    // 5. Autoclose Sidebar pada perangkat mobile (HP)
    if (window.innerWidth < 768) {
        closeMobileSidebar();
    }

    // 6. Lazy load peta Leaflet & Chart (dengan delay agar DOM siap dibaca ukurannya)
    setTimeout(() => {
        if (tabId === 'peta') {
            if (typeof initMainMap === 'function') initMainMap();
            if (typeof mapMain !== 'undefined' && mapMain) mapMain.invalidateSize();
        } else if (tabId === 'lahan') {
            if (typeof initLahanMap === 'function') initLahanMap();
            if (typeof mapLahan !== 'undefined' && mapLahan) mapLahan.invalidateSize();
            loadAndRenderLandUseData(); // Sinkronisasi otomatis data Chart & Tabel dari TutupanLahan.json
        } else if (tabId === 'identifikasi') {
            if (typeof initIdentifikasiMap === 'function') initIdentifikasiMap();
            if (typeof mapIdentifikasi !== 'undefined' && mapIdentifikasi) mapIdentifikasi.invalidateSize();
            loadAndRenderZoningStats(); // Sinkronisasi otomatis statistik zonasi sempadan
        } else if (tabId === 'statistik') {
            loadAndRenderStatistics(); // Sinkronisasi otomatis halaman statistik & card total bidang
        }
    }, 150);
}

/**
 * Fungsi untuk Mengambil Data dari TutupanLahan.json dan Sinkronisasi Chart & Tabel Lahan
 */
async function loadAndRenderLandUseData() {
    try {
        const response = await fetch('data/TutupanLahan.json');
        if (!response.ok) throw new Error('Gagal memuat TutupanLahan.json');
        const data = await response.json();

        const classAreaMap = {};
        let totalLuasKeseluruhan = 0;

        // Akumulasi luas berdasarkan kelas dari GeoJSON
        data.features.forEach(feature => {
            const p = feature.properties || {};
            const kelas = p.Kelas || 'Lainnya';
            const luas = parseFloat(p['luas ha'] || p.luas_ha || 0);

            if (!classAreaMap[kelas]) {
                classAreaMap[kelas] = 0;
            }
            classAreaMap[kelas] += luas;
            totalLuasKeseluruhan += luas;
        });

        const sortedClasses = Object.keys(classAreaMap).sort((a, b) => classAreaMap[b] - classAreaMap[a]);
        const labels = sortedClasses;
        const luasValues = sortedClasses.map(c => parseFloat(classAreaMap[c].toFixed(1)));

        // 1. Render Chart Donat dengan Data Sinkron
        renderLandUseChart(labels, luasValues, totalLuasKeseluruhan);

        // 2. Render Tabel HTML secara Dinamis dari Data JSON
        renderLandUseTable(sortedClasses, classAreaMap, totalLuasKeseluruhan);

    } catch (error) {
        console.warn('Gagal memuat JSON untuk tabel/chart:', error);
    }
}

/**
 * Render Doughnut Chart dengan Keterangan Label & Tooltip Interaktif
 */
function renderLandUseChart(labels, dataValues, totalLuas) {
    const ctx = document.getElementById('chartLandUse');
    if (!ctx) return;

    // Update teks total luas di tengah donat
    const totalLuasEl = document.getElementById('total-luas-text');
    if (totalLuasEl) {
        totalLuasEl.innerText = `${totalLuas.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ha`;
    }

    // Warna konsisten sesuai legenda peta resmi
    const colorMapping = {
        'Permukiman': '#ef4444',
        'Sawah': '#fde047',
        'Kebun / Tegalan': '#d97706',
        'Tambak': '#2563eb',
        'Mangrove': '#15803d',
        'Badan Air': '#38bdf8',
        'Fasilitas Umum': '#c084fc',
        'Lahan Terbuka': '#d4b28c'
    };

    const backgroundColors = labels.map(label => colorMapping[label] || '#94a3b8');

    if (chartLandUseObj) {
        chartLandUseObj.destroy();
    }

    chartLandUseObj = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const percentage = totalLuas > 0 ? ((value / totalLuas) * 100).toFixed(1) : 0;
                            return ` ${label}: ${value} ha (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

/**
 * Render Baris Tabel Secara Dinamis dari Data JSON
 */
function renderLandUseTable(classes, areaMap, totalLuas) {
    const tbody = document.getElementById('landuse-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (classes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">Tidak ada data penggunaan lahan.</td></tr>`;
        return;
    }

    classes.forEach((kelas, index) => {
        const luas = areaMap[kelas];
        const persentase = totalLuas > 0 ? ((luas / totalLuas) * 100).toFixed(1) : 0;

        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        row.innerHTML = `
            <td class="px-6 py-3">${index + 1}</td>
            <td class="px-6 py-3 font-semibold text-slate-800">${kelas}</td>
            <td class="px-6 py-3 text-right">${luas.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
            <td class="px-6 py-3 text-right font-medium text-blue-600">${persentase}%</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Fungsi untuk Menghitung dan Menyinkronkan Statistik Zonasi Sempadan dari TutupanLahan.json
 */
async function loadAndRenderZoningStats() {
    try {
        const response = await fetch('data/TutupanLahan.json');
        if (!response.ok) throw new Error('Gagal memuat TutupanLahan.json');
        const data = await response.json();

        let countDalam = 0;
        let countBeririsan = 0;
        let countLuar = 0;

        // Iterasi setiap fitur di GeoJSON untuk mendeteksi properti 'Status'
        data.features.forEach(feature => {
            const p = feature.properties || {};
            const status = (p.Status || '').toLowerCase().trim();

            if (status.includes('didalam sempadan') || status.includes('dalam')) {
                countDalam++;
            } else if (status.includes('beririsan') || status.includes('irisan')) {
                countBeririsan++;
            } else if (status.includes('diluar sempadan') || status.includes('luar')) {
                countLuar++;
            }
        });

        const totalBidang = countDalam + countBeririsan + countLuar;

        // Masukkan hasil perhitungan ke elemen HTML tab identifikasi
        const elDalam = document.getElementById('count-dalam');
        const elBeririsan = document.getElementById('count-beririsan');
        const elLuar = document.getElementById('count-luar');
        const elTotal = document.getElementById('count-total');

        if (elDalam) elDalam.innerText = `${countDalam} bidang`;
        if (elBeririsan) elBeririsan.innerText = `${countBeririsan} bidang`;
        if (elLuar) elLuar.innerText = `${countLuar} bidang`;
        if (elTotal) elTotal.innerText = `${totalBidang} bidang`;

    } catch (error) {
        console.warn('Gagal memuat data zonasi sempadan:', error);
    }
}

/**
 * Fungsi untuk Menghitung dan Menyinkronkan Statistik Spasial & Kartu Total di Halaman Statistik
 */
async function loadAndRenderStatistics() {
    try {
        const response = await fetch('data/TutupanLahan.json');
        if (!response.ok) throw new Error('Gagal memuat TutupanLahan.json');
        const data = await response.json();

        let countDalam = 0;
        let countBeririsan = 0;
        let countLuar = 0;
        const coastalUseMap = {};

        data.features.forEach(feature => {
            const p = feature.properties || {};
            const status = (p.Status || '').toLowerCase().trim();
            const kelas = p.Kelas || 'Lainnya';

            if (status.includes('didalam sempadan') || status.includes('dalam')) {
                countDalam++;
            } else if (status.includes('beririsan') || status.includes('irisan')) {
                countBeririsan++;
            } else if (status.includes('diluar sempadan') || status.includes('luar')) {
                countLuar++;
            }

            if (status.includes('dalam') || status.includes('irisan')) {
                if (!coastalUseMap[kelas]) coastalUseMap[kelas] = 0;
                coastalUseMap[kelas]++;
            }
        });

        const totalBidang = countDalam + countBeririsan + countLuar;

        const pctDalam = totalBidang > 0 ? ((countDalam / totalBidang) * 100).toFixed(1) : 0;
        const pctBeririsan = totalBidang > 0 ? ((countBeririsan / totalBidang) * 100).toFixed(1) : 0;
        const pctLuar = totalBidang > 0 ? ((countLuar / totalBidang) * 100).toFixed(1) : 0;

        // Update Kartu Statistik Berdasarkan ID
        if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = totalBidang;
        if (document.getElementById('stat-dalam')) document.getElementById('stat-dalam').innerText = countDalam;
        if (document.getElementById('pct-dalam')) document.getElementById('pct-dalam').innerText = `(${pctDalam}%)`;

        if (document.getElementById('stat-beririsan')) document.getElementById('stat-beririsan').innerText = countBeririsan;
        if (document.getElementById('pct-beririsan')) document.getElementById('pct-beririsan').innerText = `(${pctBeririsan}%)`;

        if (document.getElementById('stat-luar')) document.getElementById('stat-luar').innerText = countLuar;
        if (document.getElementById('pct-luar')) document.getElementById('pct-luar').innerText = `(${pctLuar}%)`;

        // Render Grafik Statistik Dinamis
        renderStatChartsDynamic(countDalam, countBeririsan, countLuar, coastalUseMap);

    } catch (error) {
        console.warn('Gagal memuat statistik spasial:', error);
    }
}

/**
 * Render Bar & Pie Charts untuk Halaman Statistik Secara Dinamis
 */
function renderStatChartsDynamic(dalam, beririsan, luar, coastalMap) {
    // 1. Bar Chart Kategori Sempadan
    const ctxBar = document.getElementById('chartCategoryBar');
    if (ctxBar) {
        if (chartCategoryBarObj) chartCategoryBarObj.destroy();
        chartCategoryBarObj = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Dalam Sempadan', 'Beririsan Sempadan', 'Luar Sempadan'],
                datasets: [{
                    label: 'Jumlah Bidang',
                    data: [dalam, beririsan, luar],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
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

    // 2. Pie Chart Penggunaan Lahan Pesisir
    const ctxPie = document.getElementById('chartCoastalUsePie');
    if (ctxPie) {
        const labels = Object.keys(coastalMap);
        const values = Object.values(coastalMap);

        if (chartCoastalUsePieObj) chartCoastalUsePieObj.destroy();
        chartCoastalUsePieObj = new Chart(ctxPie, {
            type: 'pie',
            data: {
                labels: labels.length > 0 ? labels : ['Permukiman', 'Sawah', 'Tambak', 'Mangrove'],
                datasets: [{
                    data: values.length > 0 ? values : [25, 25, 25, 25],
                    backgroundColor: ['#ef4444', '#fde047', '#2563eb', '#15803d', '#d97706', '#94a3b8']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                }
            }
        });
    }
}

/**
 * Fungsi Buka/Tutup Sidebar Mobile
 */
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    
    if (sidebar && backdrop) {
        sidebar.classList.toggle('-translate-x-full');
        backdrop.classList.toggle('hidden');
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
    }
    if (backdrop && !backdrop.classList.contains('hidden')) {
        backdrop.classList.add('hidden');
    }
}

// Inisialisasi awal saat dokumen selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    switchTab('home');
});