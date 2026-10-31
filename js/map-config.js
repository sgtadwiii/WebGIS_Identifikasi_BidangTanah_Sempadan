/**
 * WebGIS Map Configuration & Leaflet Initialization Script
 * Desa Lontar, Kec. Tirtayasa, Kab. Serang
 */

// Koordinat Pusat Desa Lontar
const LONTAR_CENTER = [-5.9785, 106.3150];
const LONTAR_ZOOM = 14;

// Global Map Instances
let mapMain = null;
let mapLahan = null;
let mapIdentifikasi = null;

// Global Layer Groups & Data Cache
let geojsonLayers = {
    admin: null,
    parcels: null,
    mangrove: null,
    pemukiman: null,
    sempadan: null
};

let cachedTutupanLahan = null;
let cachedBatasDesa = null;
let cachedSempadan = null;

// Basemap Definitions
const basemaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
    })
};

let currentBasemapKey = 'satellite';

/**
 * Helper untuk Mengambil File JSON dengan Aman
 */
async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Gagal memuat ${url}`);
        return await res.json();
    } catch (err) {
        console.warn(err);
        return null;
    }
}

/**
 * PENGATURAN KONTROL AKSES POPUP (Berdasarkan Status Login Admin)
 */
function createParcelPopupContent(p) {
    // Mengecek apakah user saat ini berstatus admin yang sedang login
    const isLoggedInAdmin = currentUser && currentUser.role === 'admin';

    // Jika belum login, sembunyikan nomor bidang & luas dengan status terkunci
    const noBidangHTML = isLoggedInAdmin 
        ? `<div class="font-bold text-slate-800 border-b pb-1 mb-1 text-sm">Bidang No: ${p.No_bidang || '-'}</div>` 
        : `<div class="font-bold text-slate-500 border-b pb-1 mb-1 text-xs italic flex items-center gap-1"><i class="fa-solid fa-lock text-amber-500"></i> Bidang No: [Terkunci / Login Admin]</div>`;

    const luasHTML = isLoggedInAdmin 
        ? `<div><b>Luas:</b> ${p['luas ha'] || p.luas_ha || 0} ha (${p['luas m3'] ? (p['luas m3'] * 1000).toFixed(2) : '-'} m²)</div>`
        : `<div class="text-slate-400 italic flex items-center gap-1"><i class="fa-solid fa-lock text-amber-500"></i> <b>Luas:</b> [Memerlukan Login Admin]</div>`;

    return `
        <div class="text-xs font-sans space-y-1 p-1 min-w-[190px]">
            ${noBidangHTML}
            <div><b>Kelas:</b> ${p.Kelas || '-'}</div>
            ${luasHTML}
            <div><b>Status Sempadan:</b> <span class="font-semibold text-emerald-600">${p.Status || '-'}</span></div>
        </div>
    `;
}

/**
 * 1. INISIALISASI PETA UTAMA (Tab: Peta & Layer)
 */
async function initMainMap(forceReload = false) {
    if (mapMain && !forceReload) return;
    
    if (mapMain && forceReload) {
        mapMain.remove();
        mapMain = null;
    }

    const mapContainer = document.getElementById('main-map');
    if (!mapContainer) return;

    mapMain = L.map('main-map').setView(LONTAR_CENTER, LONTAR_ZOOM);
    basemaps[currentBasemapKey].addTo(mapMain);

    // Muat data geojson jika belum di-cache
    if (!cachedTutupanLahan) cachedTutupanLahan = await fetchJSON('data/TutupanLahan.json');
    if (!cachedBatasDesa) cachedBatasDesa = await fetchJSON('data/batslontar.json');
    if (!cachedSempadan) cachedSempadan = await fetchJSON('data/sempadan_pantai.json');

    // Layer Batas Desa
    if (cachedBatasDesa) {
        geojsonLayers.admin = L.geoJSON(cachedBatasDesa, {
            style: { color: '#000000', weight: 2.5, dashArray: '5, 5', fillOpacity: 0.0 }
        }).addTo(mapMain);
    }

    // Layer Sempadan Pantai
    if (cachedSempadan) {
        geojsonLayers.sempadan = L.geoJSON(cachedSempadan, {
            style: { color: '#e11d48', weight: 2, dashArray: '4, 4', fillColor: '#fb7185', fillOpacity: 0.3 }
        }).addTo(mapMain);
    }

    // Layer Tutupan Lahan & Bidang Tanah (Dengan Pewarnaan Klasifikasi)
    if (cachedTutupanLahan) {
        const colorMapping = {
            'Permukiman': '#ef4444',
            'Sawah': '#fde047',
            'Kebun / Tegalan': '#d97706',
            'Tambak': '#2563eb',
            'Mangrove': '#15803d',
            'Badan Air': '#38bdf8',
            'Lahan Terbuka': '#d4b28c'
        };

        geojsonLayers.parcels = L.geoJSON(cachedTutupanLahan, {
            style: function(feature) {
                const kelas = feature.properties.Kelas || 'Lainnya';
                return {
                    fillColor: colorMapping[kelas] || '#94a3b8',
                    weight: 0.6,
                    color: '#ffffff',
                    fillOpacity: 0.75
                };
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(createParcelPopupContent(feature.properties));
            }
        }).addTo(mapMain);
    }
}

/**
 * 2. INISIALISASI PETA LAHAN (Tab: Penggunaan Lahan)
 */
async function initLahanMap(forceReload = false) {
    if (mapLahan && !forceReload) return;

    if (mapLahan && forceReload) {
        mapLahan.remove();
        mapLahan = null;
    }

    const container = document.getElementById('map-lahan');
    if (!container) return;

    mapLahan = L.map('map-lahan').setView(LONTAR_CENTER, LONTAR_ZOOM);
    basemaps['satellite'].addTo(mapLahan);

    if (!cachedTutupanLahan) cachedTutupanLahan = await fetchJSON('data/TutupanLahan.json');
    if (!cachedBatasDesa) cachedBatasDesa = await fetchJSON('data/batslontar.json');

    if (cachedBatasDesa) {
        L.geoJSON(cachedBatasDesa, {
            style: { color: '#000000', weight: 2, dashArray: '4, 4', fillOpacity: 0.0 }
        }).addTo(mapLahan);
    }

    if (cachedTutupanLahan) {
        L.geoJSON(cachedTutupanLahan, {
            style: function(feature) {
                const colors = { 'Permukiman': '#ef4444', 'Sawah': '#fde047', 'Kebun / Tegalan': '#d97706', 'Tambak': '#2563eb', 'Mangrove': '#15803d', 'Badan Air': '#38bdf8', 'Lahan Terbuka': '#d4b28c' };
                return { fillColor: colors[feature.properties.Kelas] || '#94a3b8', weight: 0.5, color: '#fff', fillOpacity: 0.8 };
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(createParcelPopupContent(feature.properties));
            }
        }).addTo(mapLahan);
    }
}

/**
 * 3. INISIALISASI PETA IDENTIFIKASI SEMPADAN (Tab: Identifikasi)
 */
async function initIdentifikasiMap(forceReload = false) {
    if (mapIdentifikasi && !forceReload) return;

    if (mapIdentifikasi && forceReload) {
        mapIdentifikasi.remove();
        mapIdentifikasi = null;
    }

    const container = document.getElementById('map-identifikasi');
    if (!container) return;

    mapIdentifikasi = L.map('map-identifikasi').setView(LONTAR_CENTER, LONTAR_ZOOM);
    basemaps['satellite'].addTo(mapIdentifikasi);

    if (!cachedBatasDesa) cachedBatasDesa = await fetchJSON('data/batslontar.json');
    if (!cachedSempadan) cachedSempadan = await fetchJSON('data/sempadan_pantai.json');
    if (!cachedTutupanLahan) cachedTutupanLahan = await fetchJSON('data/TutupanLahan.json');

    if (cachedBatasDesa) {
        L.geoJSON(cachedBatasDesa, {
            style: { color: '#000000', weight: 2, dashArray: '4, 4', fillOpacity: 0.0 }
        }).addTo(mapIdentifikasi);
    }

    if (cachedSempadan) {
        L.geoJSON(cachedSempadan, {
            style: { color: '#e11d48', weight: 2, dashArray: '5, 5', fillColor: '#fb7185', fillOpacity: 0.35 }
        }).addTo(mapIdentifikasi);
    }

    if (cachedTutupanLahan) {
        L.geoJSON(cachedTutupanLahan, {
            style: function(feature) {
                const status = (feature.properties.Status || '').toLowerCase();
                let fillColor = '#10b981'; // Luar Sempadan (Hijau)
                if (status.includes('didalam') || status.includes('dalam')) fillColor = '#ef4444'; // Merah
                else if (status.includes('beririsan') || status.includes('irisan')) fillColor = '#f59e0b'; // Kuning

                return { fillColor: fillColor, weight: 0.5, color: '#ffffff', fillOpacity: 0.7 };
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(createParcelPopupContent(feature.properties));
            }
        }).addTo(mapIdentifikasi);
    }
}

/**
 * Kontrol Ganti Basemap (OSM Vektor / Esri Satelit)
 */
function toggleBasemap(type) {
    if (!mapMain) return;
    mapMain.removeLayer(basemaps[currentBasemapKey]);
    currentBasemapKey = type;
    basemaps[currentBasemapKey].addTo(mapMain);
}

/**
 * Kontrol Opacity Layer pada Peta Utama
 */
function changeOpacity(layerName, val) {
    const opacityVal = val / 100;
    const valSpan = document.getElementById(`val-${layerName}`);
    if (valSpan) valSpan.innerText = val;

    if (geojsonLayers[layerName] && mapMain.hasLayer(geojsonLayers[layerName])) {
        geojsonLayers[layerName].setStyle({ fillOpacity: opacityVal, opacity: opacityVal });
    }
}

/**
 * Kontrol Toggle Checkbox Layer On/Off
 */
function toggleLayer(layerName) {
    if (!mapMain) return;
    const checkbox = document.getElementById(`layer-${layerName}`);
    if (!checkbox) return;

    if (checkbox.checked) {
        if (geojsonLayers[layerName]) mapMain.addLayer(geojsonLayers[layerName]);
    } else {
        if (geojsonLayers[layerName]) mapMain.removeLayer(geojsonLayers[layerName]);
    }
}

/**
 * Fitur Pencarian Bidang Tanah Berdasarkan Nomor Bidang (`map-search`)
 */
function searchParcel() {
    const keyword = document.getElementById('map-search').value.trim().toLowerCase();
    if (!keyword || !mapMain || !cachedTutupanLahan) return;

    let foundFeature = null;
    let foundLayer = null;

    geojsonLayers.parcels.eachLayer(layer => {
        const p = layer.feature.properties;
        const noBidang = (p.No_bidang || '').toLowerCase();
        if (noBidang.includes(keyword)) {
            foundFeature = feature;
            foundLayer = layer;
        }
    });

    if (foundLayer) {
        mapMain.fitBounds(foundLayer.getBounds(), { maxZoom: 18 });
        foundLayer.openPopup();
    }
}