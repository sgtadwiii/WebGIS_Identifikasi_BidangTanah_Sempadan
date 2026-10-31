/**
 * WebGIS Map Configuration Script (Leaflet.js)
 * Desa Lontar, Kec. Tirtayasa, Kab. Serang
 * Disesuaikan dengan Legenda Peta Resmi (Jalan, Sungai, Batas, & Tutupan Lahan)
 */

const LONTAR_CENTER = [-5.972229812413505, 106.2972349864214];
const LONTAR_ZOOM = 14;

// Basemap Tile Layers
const basemaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
};

// Global Map & Layers
let mapMain = null;
let geojsonBatasDesaLayer = null;
let geojsonBatasAdminLayer = null;
let geojsonTutupanLahanLayer = null;
let geojsonSempadanLayer = null;
let geojsonJalanLayer = null;
let geojsonSungaiLayer = null;
let geojsonMangroveLayer = null; 
let geojsonPemukimanLayer = null; 
let currentBasemap = 'satellite';

let mapLahan = null;
let geojsonLahanLayer = null;
let mapIdentifikasi = null;
// Menyimpan referensi layer bidang untuk pencarian
let parcelLayersList = [];

// Palet Warna Sesuai Gambar Legenda Resmi Anda
const colorPalette = {
    'Permukiman': '#ef4444',       // Merah
    'Sawah': '#fde047',            // Kuning
    'Kebun / Tegalan': '#d97706',    // Coklat/Tegalan (Opsional)
    'Tambak': '#2563eb',           // Biru
    'Mangrove': '#15803d',         // Hijau Tua
    'Badan Air': '#38bdf8',        // Biru Muda / Saluran
    'Lahan Terbuka': '#d4b28c',    // Coklat Muda / Krem
    'Fasilitas Umum': '#c084fc'
};

// Fetch JSON Helper
async function fetchJSON(filepath) {
    try {
        const response = await fetch(filepath);
        if (!response.ok) throw new Error(`Gagal memuat ${filepath}`);
        return await response.json();
    } catch (error) {
        console.warn(`Peringatan: Gagal memuat ${filepath}`, error);
        return null;
    }
}

// Inisialisasi Peta Utama
async function initMainMap() {
    if (mapMain) return;

    mapMain = L.map('main-map').setView(LONTAR_CENTER, LONTAR_ZOOM);
    basemaps[currentBasemap].addTo(mapMain);

    // 1. Batas Desa Lontar (Garis hitam putus-putus tebal)
    const batasData = await fetchJSON('data/batslontar.json');
    if (batasData) {
        geojsonBatasDesaLayer = L.geoJSON(batasData, {
            style: { color: '#000000', weight: 3, dashArray: '6, 6', fillOpacity: 0.0, fillColor: 'transparent' },
            onEachFeature: (feature, layer) => {
                const p = feature.properties || {};
                const luas = (typeof p.Luas_ha === 'number') ? p.Luas_ha.toFixed(2) : (p.luas_ha || '-');
                const namaObj = p.NAMOBJ || p.nama || 'Desa Lontar';
                layer.bindPopup(`<div class="text-xs font-sans"><b>Batas Desa Lontar</b><br>Nama: ${namaObj}<br>Luas: ${luas} ha</div>`);
            }
        }).addTo(mapMain);
        mapMain.fitBounds(geojsonBatasDesaLayer.getBounds());
    }

    // 1b. Batas Desa Sekitar / Administrasi (Garis abu-abu putus-putus)
    const adminData = await fetchJSON('data/batasadministrasi.json');
    if (adminData) {
        geojsonBatasAdminLayer = L.geoJSON(adminData, {
            style: { color: '#64748b', weight: 2, dashArray: '4, 4', fillOpacity: 0.0 }
        }).addTo(mapMain);
    }

    // 2. Sempadan Pantai
    const sempadanData = await fetchJSON('data/sempadan_pantai.json');
    if (sempadanData) {
        geojsonSempadanLayer = L.geoJSON(sempadanData, {
            style: {
                color: '#e11d48',
                weight: 2,
                dashArray: '5, 5',
                fillColor: '#fb7185',
                fillOpacity: 0.3
            }
        }).addTo(mapMain);
    }

    // 3. Jalan (Garis Merah sesuai legenda)
    const jalanData = await fetchJSON('data/datajalan.json');
    if (jalanData) {
        geojsonJalanLayer = L.geoJSON(jalanData, {
            style: { color: '#dc2626', weight: 2.5, opacity: 0.9 },
            onEachFeature: (feature, layer) => {
                const p = feature.properties || {};
                layer.bindPopup(`<div class="text-xs font-sans"><b>Jalan</b><br>Keterangan: ${p.REMARK || p.name || 'Jalan Desa'}</div>`);
            }
        }).addTo(mapMain);
    }

    // 4. Sungai (Garis Biru sesuai legenda)
    const sungaiData = await fetchJSON('data/datasungai.json');
    if (sungaiData) {
        geojsonSungaiLayer = L.geoJSON(sungaiData, {
            style: { color: '#2563eb', weight: 2, opacity: 0.85 },
            onEachFeature: (feature, layer) => {
                const p = feature.properties || {};
                layer.bindPopup(`<div class="text-xs font-sans"><b>Sungai / Saluran</b><br>Nama: ${p.REMARK || p.name || '-'}</div>`);
            }
        }).addTo(mapMain);
    }

    // 5. Tutupan Lahan (Bidang Tanah, Mangrove, Pemukiman, Sawah, Tambak, dll)
    const tutupanLahanData = await fetchJSON('data/TutupanLahan.json');
    if (tutupanLahanData) {
        const mangroveFeatures = [];
        const pemukimanFeatures = [];

        geojsonTutupanLahanLayer = L.geoJSON(tutupanLahanData, {
            style: function(feature) {
                const kelas = feature.properties.Kelas;
                return {
                    fillColor: colorPalette[kelas] || '#94a3b8',
                    weight: 0.5,
                    color: '#ffffff',
                    fillOpacity: 0.75
                };
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                
                parcelLayersList.push({ feature, layer });

                if (p.Kelas === 'Mangrove') mangroveFeatures.push(feature);
                if (p.Kelas === 'Permukiman') pemukimanFeatures.push(feature);

                layer.bindPopup(`
                    <div class="text-xs font-sans space-y-1">
                        <div class="font-bold text-slate-800 border-b pb-1 mb-1">Bidang No: ${p.No_bidang || '-'}</div>
                        <div><b>Kelas:</b> ${p.Kelas || '-'}</div>
                        <div><b>Luas:</b> ${p['luas ha'] || '-'} ha (${p['luas m3'] || '-'} m²)</div>
                        <div><b>Status:</b> <span class="${p.Status && p.Status.includes('didalam') ? 'text-rose-600 font-bold' : 'text-emerald-600'}">${p.Status || '-'}</span></div>
                    </div>
                `);
            }
        }).addTo(mapMain);

        if (mangroveFeatures.length > 0) {
            geojsonMangroveLayer = L.geoJSON({type: "FeatureCollection", features: mangroveFeatures}, {
                style: { fillColor: colorPalette['Mangrove'], weight: 0.5, color: '#fff', fillOpacity: 0.8 }
            });
        }
        if (pemukimanFeatures.length > 0) {
            geojsonPemukimanLayer = L.geoJSON({type: "FeatureCollection", features: pemukimanFeatures}, {
                style: { fillColor: colorPalette['Permukiman'], weight: 0.5, color: '#fff', fillOpacity: 0.8 }
            });
        }
    }
}

// Toggle Basemap
function toggleBasemap(type) {
    if (!mapMain) return;
    mapMain.removeLayer(basemaps[currentBasemap]);
    basemaps[type].addTo(mapMain);
    currentBasemap = type;
}

// Toggle Checkbox Layer Visibility
function toggleLayer(layerName) {
    if (!mapMain) return;
    let targetLayer = null;

    if (layerName === 'admin') {
        const checkboxAdmin = document.getElementById('layer-admin');
        const checkboxDesa = document.getElementById('layer-border-desa');
        if (geojsonBatasAdminLayer) {
            if (checkboxAdmin && checkboxAdmin.checked) {
                mapMain.addLayer(geojsonBatasAdminLayer);
            } else {
                mapMain.removeLayer(geojsonBatasAdminLayer);
            }
        }
        if (geojsonBatasDesaLayer) {
            if (checkboxDesa && checkboxDesa.checked) {
                mapMain.addLayer(geojsonBatasDesaLayer);
            } else {
                mapMain.removeLayer(geojsonBatasDesaLayer);
            }
        }
    }
    if (layerName === 'parcels') targetLayer = geojsonTutupanLahanLayer;
    if (layerName === 'mangrove') targetLayer = geojsonMangroveLayer;
    if (layerName === 'pemukiman') targetLayer = geojsonPemukimanLayer;
    if (layerName === 'sempadan') targetLayer = geojsonSempadanLayer;
    if (layerName === 'jalan') targetLayer = geojsonJalanLayer;
    if (layerName === 'sungai') targetLayer = geojsonSungaiLayer;

    if (!targetLayer) return;

    const checkbox = document.getElementById(`layer-${layerName}`);
    if (checkbox && checkbox.checked) {
        mapMain.addLayer(targetLayer);
    } else if (checkbox) {
        mapMain.removeLayer(targetLayer);
    }
}

// Dynamic Opacity Controller via Slider
function changeOpacity(layerName, value) {
    const opacity = value / 100;
    const valEl = document.getElementById(`val-${layerName}`);
    if (valEl) valEl.innerText = value;

    let targetLayer = null;
    if (layerName === 'parcels') targetLayer = geojsonTutupanLahanLayer;
    if (layerName === 'mangrove') targetLayer = geojsonMangroveLayer;
    if (layerName === 'pemukiman') targetLayer = geojsonPemukimanLayer;
    if (layerName === 'sempadan') targetLayer = geojsonSempadanLayer;

    if (targetLayer) {
        targetLayer.setStyle({ fillOpacity: opacity, opacity: opacity });
    }
}

// Fungsi Pencarian Nomor Bidang Tanah
function searchParcel() {
    const query = document.getElementById('map-search').value.trim().toLowerCase();
    if (!query) return;

    const found = parcelLayersList.find(item => {
        const noBidang = String(item.feature.properties.No_bidang || '').toLowerCase();
        return noBidang.includes(query);
    });

    if (found) {
        mapMain.fitBounds(found.layer.getBounds(), { maxZoom: 18 });
        found.layer.openPopup();
    }
}

// Fungsi Inisialisasi Peta Khusus Tab Lahan
async function initLahanMap() {
    if (mapLahan) return;

    // Inisialisasi peta pada div id="map-lahan"
    mapLahan = L.map('map-lahan').setView(LONTAR_CENTER, LONTAR_ZOOM);
    
    // Gunakan basemap satelit sebagai default
    basemaps['satellite'].addTo(mapLahan);

    // 1. Muat Batas Desa Lontar
    const batasData = await fetchJSON('data/batslontar.json');
    if (batasData) {
        L.geoJSON(batasData, {
            style: { color: '#000000', weight: 2.5, dashArray: '5, 5', fillOpacity: 0.0 }
        }).addTo(mapLahan);
        mapLahan.fitBounds(L.geoJSON(batasData).getBounds());
    }

    // 2. Muat Jalan & Sungai sebagai referensi visual
    const jalanData = await fetchJSON('data/datajalan.json');
    if (jalanData) {
        L.geoJSON(jalanData, { style: { color: '#dc2626', weight: 2, opacity: 0.8 } }).addTo(mapLahan);
    }

    const sungaiData = await fetchJSON('data/datasungai.json');
    if (sungaiData) {
        L.geoJSON(sungaiData, { style: { color: '#2563eb', weight: 1.8, opacity: 0.8 } }).addTo(mapLahan);
    }

    // 3. Muat Tutupan Lahan dengan Palet Warna Resmi
    const tutupanLahanData = await fetchJSON('data/TutupanLahan.json');
    if (tutupanLahanData) {
        geojsonLahanLayer = L.geoJSON(tutupanLahanData, {
            style: function(feature) {
                const kelas = feature.properties.Kelas;
                return {
                    fillColor: colorPalette[kelas] || '#94a3b8',
                    weight: 0.5,
                    color: '#ffffff',
                    fillOpacity: 0.75
                };
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(`
                    <div class="text-xs font-sans space-y-1">
                        <div class="font-bold text-slate-800 border-b pb-1 mb-1">Bidang No: ${p.No_bidang || '-'}</div>
                        <div><b>Kelas:</b> ${p.Kelas || '-'}</div>
                        <div><b>Luas:</b> ${p['luas ha'] || '-'} ha</div>
                        <div><b>Status:</b> ${p.Status || '-'}</div>
                    </div>
                `);
            }
        }).addTo(mapLahan);
    }
}

// Fungsi Inisialisasi Peta Khusus Tab Identifikasi Sempadan Pantai
async function initIdentifikasiMap() {
    if (mapIdentifikasi) return;

    // Inisialisasi peta pada div id="map-identifikasi"
    mapIdentifikasi = L.map('map-identifikasi').setView(LONTAR_CENTER, LONTAR_ZOOM);
    
    // Gunakan basemap satelit
    basemaps['satellite'].addTo(mapIdentifikasi);

    // 1. Muat Batas Desa Lontar
    const batasData = await fetchJSON('data/batslontar.json');
    if (batasData) {
        L.geoJSON(batasData, {
            style: { color: '#000000', weight: 2.5, dashArray: '5, 5', fillOpacity: 0.0 }
        }).addTo(mapIdentifikasi);
        mapIdentifikasi.fitBounds(L.geoJSON(batasData).getBounds());
    }

    // 2. Muat Sempadan Pantai (Highlight utama untuk identifikasi)
    const sempadanData = await fetchJSON('data/sempadan_pantai.json');
    if (sempadanData) {
        L.geoJSON(sempadanData, {
            style: {
                color: '#e11d48',
                weight: 2,
                dashArray: '5, 5',
                fillColor: '#fb7185',
                fillOpacity: 0.35
            }
        }).addTo(mapIdentifikasi);
    }

    // 3. Muat Tutupan Lahan / Bidang Tanah dengan pewarnaan status Sempadan (jika ada properti Status)
    const tutupanLahanData = await fetchJSON('data/TutupanLahan.json');
    if (tutupanLahanData) {
        L.geoJSON(tutupanLahanData, {
            style: function(feature) {
                const status = (feature.properties.Status || '').toLowerCase();
                let fillColor = '#10b981'; // Default Luar Sempadan (Hijau)
                
                if (status.includes('dalam')) fillColor = '#ef4444';      // Merah (Di Dalam)
                else if (status.includes('irisan') || status.includes('beririsan')) fillColor = '#f59e0b'; // Kuning/Amber (Beririsan)

                return {
                    fillColor: fillColor,
                    weight: 0.5,
                    color: '#ffffff',
                    fillOpacity: 0.7
                };
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(`
                    <div class="text-xs font-sans space-y-1">
                        <div class="font-bold text-slate-800 border-b pb-1 mb-1">Bidang No: ${p.No_bidang || '-'}</div>
                        <div><b>Status Sempadan:</b> <span class="font-semibold">${p.Status || '-'}</span></div>
                        <div><b>Luas:</b> ${p['luas ha'] || '-'} ha</div>
                    </div>
                `);
            }
        }).addTo(mapIdentifikasi);
    }
}