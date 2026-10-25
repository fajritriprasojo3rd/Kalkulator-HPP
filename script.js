// ==========================================
// KONFIGURASI SUPABASE
// ==========================================
const SUPABASE_URL      = 'https://ocqedmogvkcvfkjekayr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcWVkbW9ndmtjdmZramVrYXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NTk0NzIsImV4cCI6MjEwODIzNTQ3Mn0.bQFVAIbaquQOj7sTT_CZQbZmgE7v2EmnpkE-zbW6w3Y';
    
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Global
let daftarProduk = [], daftarKontak = [], semuaTransaksi = [], pengaturanBisnis = {};
let chartInstance = null;
let keranjangOrder = {};
let currentPin = ""; 
let inputPin = ""; 

const statusEl = document.getElementById('status-save');
const statusKoneksi = document.getElementById('status-koneksi');
const fmtRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

// ==========================================
// 1. LAYAR KUNCI (PIN & BIOMETRIK)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Cek PIN di localStorage
    currentPin = localStorage.getItem('kaspro_pin');
    if (!currentPin) {
        localStorage.setItem('kaspro_pin', '1234');
        currentPin = '1234';
    }
    if (window.PublicKeyCredential) {
        document.getElementById('btn-biometric').style.display = 'flex';
    }
});

function pressPin(num) {
    const display = document.getElementById('pin-display');
    if (num === 'del') inputPin = inputPin.slice(0, -1);
    else if (inputPin.length < 4) inputPin += num;
    
    display.innerText = '*'.repeat(inputPin.length);

    if (inputPin.length === 4) {
        if (inputPin === currentPin) {
            document.getElementById('lock-screen').style.display = 'none';
            initApp(); // Mulai Aplikasi
        } else {
            alert("PIN Salah!");
            inputPin = ""; display.innerText = "";
        }
    }
}

async function unlockWithBiometric() {
    try {
        if (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            await navigator.credentials.get({ publicKey: { challenge, userVerification: "required" } });
            document.getElementById('lock-screen').style.display = 'none';
            initApp();
        } else {
            alert("Perangkat tidak mendukung biometrik.");
        }
    } catch (err) { alert("Gagal autentikasi biometrik."); }
}

// ==========================================
// 2. OFFLINE & SYNC LOGIC
// ==========================================
function updateConnectionStatus() {
    if (navigator.onLine) {
        statusKoneksi.style.backgroundColor = 'var(--success)';
        syncOfflineData();
    } else {
        statusKoneksi.style.backgroundColor = 'var(--danger)';
        statusEl.innerText = "Mode Offline";
        statusEl.style.color = "var(--warning)";
    }
}
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

function addToSyncQueue(table, action, data, id = null) {
    let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push({ table, action, data, id, timestamp: Date.now() });
    localStorage.setItem('sync_queue', JSON.stringify(queue));
    statusEl.innerText = "Tersimpan (Offline)";
    statusEl.style.color = "var(--warning)";
}

async function syncOfflineData() {
    let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    if (queue.length === 0) return;

    statusEl.innerText = "Sinkronisasi...";
    statusEl.style.color = "var(--primary)";

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        let error = null;
        if (item.action === 'insert') {
            const res = await supabaseClient.from(item.table).insert([item.data]);
            error = res.error;
        } else if (item.action === 'update') {
            const res = await supabaseClient.from(item.table).update(item.data).eq('id', item.id);
            error = res.error;
        } else if (item.action === 'delete') {
            const res = await supabaseClient.from(item.table).delete().eq('id', item.id);
            error = res.error;
        }

        if (error) { console.error("Gagal sync:", error); break; } 
        else { queue.shift(); localStorage.setItem('sync_queue', JSON.stringify(queue)); }
    }

    statusEl.innerText = "Tersinkronisasi ✓";
    statusEl.style.color = "var(--success)";
    setTimeout(() => statusEl.innerText = "", 2000);

    // Refresh Data
    loadDashboard(); loadRiwayat(); 
}

// ==========================================
// 3. PWA INSTALL PROMPT
// ==========================================
let deferredPrompt;
const installBanner = document.getElementById('install-banner');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    if (!localStorage.getItem('install_dismissed')) installBanner.style.display = 'flex';
});

document.getElementById('btn-install-app')?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') console.log('User installed app');
        deferredPrompt = null; installBanner.style.display = 'none';
    }
});

document.getElementById('btn-tutup-install')?.addEventListener('click', () => {
    installBanner.style.display = 'none';
    localStorage.setItem('install_dismissed', 'true');
});

// ==========================================
// 4. NAVIGASI & PENGATURAN
// ==========================================
function setupNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
            if(btn.dataset.target === 'tab-beranda') renderChart();
        });
    });
}

async function loadPengaturan() {
    const { data } = await supabaseClient.from('pengaturan').select('*').eq('id', 1).single();
    if(data) {
        pengaturanBisnis = data;
        document.getElementById('header-nama-bisnis').innerText = "💼 " + data.nama_bisnis;
        document.getElementById('setting-nama').value = data.nama_bisnis || '';
        document.getElementById('setting-wa').value = data.no_wa_toko || '';
    }
}

async function simpanPengaturan() {
    const nama = document.getElementById('setting-nama').value;
    const wa = document.getElementById('setting-wa').value;
    await supabaseClient.from('pengaturan').update({ nama_bisnis: nama, no_wa_toko: wa }).eq('id', 1);
    alert("Pengaturan disimpan!"); loadPengaturan();
}

// ==========================================
// 5. MASTER DATA (PRODUK & KONTAK)
// ==========================================
async function loadMasterData() {
    const { data: prod } = await supabaseClient.from('master_produk').select('*').order('nama_produk');
    daftarProduk = prod || [];
    document.getElementById('select-belanja').innerHTML = '<option value="">-- Pilih Produk --</option>' + daftarProduk.map(p => `<option value="${p.id}" data-harga="${p.harga_satuan}">${p.nama_produk}</option>`).join('');
    renderMasterProduk(); renderKatalog();

    const { data: kontak } = await supabaseClient.from('kontak').select('*').order('nama');
    daftarKontak = kontak || [];
    document.getElementById('order-pelanggan').innerHTML = '<option value="">-- Pilih Pelanggan --</option>' + daftarKontak.filter(k=>k.tipe==='pelanggan').map(k => `<option value="${k.id}">${k.nama} (${k.no_hp})</option>`).join('');
    renderMasterKontak();
}

function renderMasterProduk() {
    document.getElementById('list-produk-container').innerHTML = daftarProduk.map(p => `
        <div class="item-produk"><div><div style="font-weight:bold;">${p.nama_produk}</div><div style="color:var(--warning); font-size:12px;">${fmtRp(p.harga_satuan)}</div></div>
        <button class="btn-icon" style="color:var(--danger)" onclick="hapusData('master_produk', ${p.id})">🗑️</button></div>
    `).join('');
}
function renderMasterKontak() {
    document.getElementById('list-kontak-container').innerHTML = daftarKontak.map(k => `
        <div class="item-produk"><div><div style="font-weight:bold;">${k.nama} <span style="font-size:10px; background:var(--border-color); padding:2px 5px; border-radius:4px;">${k.tipe}</span></div><div style="font-size:12px; color:var(--text-muted);">${k.no_hp || '-'}</div></div>
        <button class="btn-icon" style="color:var(--danger)" onclick="hapusData('kontak', ${k.id})">🗑️</button></div>
    `).join('');
}

async function tambahProduk() {
    const nama = document.getElementById('input-nama-produk-baru').value;
    const harga = parseFloat(document.getElementById('input-harga-produk-baru').value);
    if(!nama || !harga) return alert("Isi data!");
    await supabaseClient.from('master_produk').insert([{ nama_produk: nama, harga_satuan: harga }]);
    document.getElementById('input-nama-produk-baru').value = ''; document.getElementById('input-harga-produk-baru').value = '';
    loadMasterData();
}

async function tambahKontak() {
    const nama = document.getElementById('input-nama-kontak').value;
    const tipe = document.getElementById('input-tipe-kontak').value;
    const hp = document.getElementById('input-hp-kontak').value;
    if(!nama) return alert("Isi nama!");
    await supabaseClient.from('kontak').insert([{ nama, tipe, no_hp: hp }]);
    document.getElementById('input-nama-kontak').value = ''; document.getElementById('input-hp-kontak').value = '';
    loadMasterData();
}

window.hapusData = async function(table, id) {
    if(!confirm("Hapus data ini?")) return;
    await supabaseClient.from(table).delete().eq('id', id);
    loadMasterData();
}

// ==========================================
// 6. KATALOG & ORDER WA
// ==========================================
function renderKatalog() {
    document.getElementById('katalog-list').innerHTML = daftarProduk.map(p => `
        <div class="item-produk">
            <div><div style="font-weight:bold;">${p.nama_produk}</div><div style="color:var(--warning); font-size:12px;">${fmtRp(p.harga_satuan)}</div></div>
            <div style="display:flex; align-items:center; gap:10px;">
                <button onclick="ubahOrder(${p.id}, -1)" style="background:var(--border-color); border:none; color:white; width:30px; height:30px; border-radius:50%; font-size:18px;">-</button>
                <span id="qty-${p.id}" style="font-weight:bold; width:20px; text-align:center;">0</span>
                <button onclick="ubahOrder(${p.id}, 1)" style="background:var(--primary); border:none; color:white; width:30px; height:30px; border-radius:50%; font-size:18px;">+</button>
            </div>
        </div>
    `).join('');
}

window.ubahOrder = function(id, perubahan) {
    const produk = daftarProduk.find(p => p.id === id);
    if(!keranjangOrder[id]) keranjangOrder[id] = { ...produk, qty: 0 };
    keranjangOrder[id].qty += perubahan;
    if(keranjangOrder[id].qty <= 0) delete keranjangOrder[id];
    document.getElementById(`qty-${id}`).innerText = keranjangOrder[id] ? keranjangOrder[id].qty : 0;
    updateOrderSummary();
}

function updateOrderSummary() {
    let html = ""; let total = 0;
    Object.values(keranjangOrder).forEach(item => {
        html += `<div style="display:flex; justify-content:space-between;"><span>${item.nama_produk} (${item.qty}x)</span> <span>${fmtRp(item.qty * item.harga_satuan)}</span></div>`;
        total += item.qty * item.harga_satuan;
    });
    document.getElementById('order-summary').innerHTML = html ? html + `<hr style="border-color:var(--border-color); margin:10px 0;"><div style="font-weight:bold; color:var(--success); display:flex; justify-content:space-between;"><span>Total:</span> <span>${fmtRp(total)}</span></div>` : "Belum ada pesanan.";
}

window.kirimKeWA = function() {
    const pelangganId = document.getElementById('order-pelanggan').value;
    if(!pelangganId) return alert("Pilih pelanggan dulu!");
    const pelanggan = daftarKontak.find(k => k.id == pelangganId);
    if(!pelanggan.no_hp) return alert("Pelanggan ini belum punya No HP di CRM!");
    if(Object.keys(keranjangOrder).length === 0) return alert("Keranjang pesanan kosong!");

    let pesan = `Halo *${pelanggan.nama}*, pesanan Anda di *${pengaturanBisnis.nama_bisnis || 'Toko Kami'}*:\n\n`;
    let total = 0;
    Object.values(keranjangOrder).forEach(item => {
        pesan += `- ${item.nama_produk} (${item.qty}x) = ${fmtRp(item.qty * item.harga_satuan)}\n`;
        total += item.qty * item.harga_satuan;
    });
    pesan += `\n*Total: ${fmtRp(total)}*\n\nTerima kasih!`;
    
    const waUrl = `https://wa.me/${pelanggan.no_hp.replace(/^0/, '62')}?text=${encodeURIComponent(pesan)}`;
    window.open(waUrl, '_blank');
};

// ==========================================
// 7. TRANSAKSI KASIR (Hutang/Piutang/Prive)
// ==========================================
document.getElementById('select-belanja').addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    if(opt.dataset.harga) document.getElementById('input-harga-belanja').value = opt.dataset.harga;
});

document.getElementById('btn-simpan-belanja').addEventListener('click', async () => {
    const prodId = document.getElementById('select-belanja').value;
    const qty = parseFloat(document.getElementById('input-qty-belanja').value);
    const harga = parseFloat(document.getElementById('input-harga-belanja').value);
    const kategori = document.getElementById('kategori-belanja').value;
    const isHutang = document.getElementById('cek-hutang-belanja').checked;
    
    if(!prodId || !qty || !harga) return alert("Lengkapi data!");
    const produk = daftarProduk.find(p => p.id == prodId);
    const dataTrx = { tipe: 'pengeluaran', keterangan: `Beli ${produk.nama_produk} (${qty}x)`, nominal: qty * harga, kategori: kategori, status: isHutang ? 'belum lunas' : 'lunas' };

    if(navigator.onLine) {
        await supabaseClient.from('transaksi').insert([dataTrx]);
        statusEl.innerText = "Tersimpan (Online)";
    } else {
        addToSyncQueue('transaksi', 'insert', dataTrx);
        semuaTransaksi.unshift({ ...dataTrx, id: Date.now(), created_at: new Date().toISOString() });
    }
    
    alert("Dicatat!"); document.getElementById('input-qty-belanja').value = ''; document.getElementById('input-harga-belanja').value = ''; document.getElementById('cek-hutang-belanja').checked = false;
    loadDashboard(); loadRiwayat();
});

document.getElementById('btn-simpan-jualan').addEventListener('click', async () => {
    const ket = document.getElementById('input-ket-jualan').value;
    const nominal = parseFloat(document.getElementById('input-nominal-jualan').value);
    const kategori = document.getElementById('kategori-jualan').value;
    const isPiutang = document.getElementById('cek-piutang-jualan').checked;
    
    if(!ket || !nominal) return alert("Lengkapi data!");
    const dataTrx = { tipe: 'pemasukan', keterangan: ket, nominal: nominal, kategori: kategori, status: isPiutang ? 'belum lunas' : 'lunas' };

    if(navigator.onLine) {
        await supabaseClient.from('transaksi').insert([dataTrx]);
        statusEl.innerText = "Tersimpan (Online)";
    } else {
        addToSyncQueue('transaksi', 'insert', dataTrx);
        semuaTransaksi.unshift({ ...dataTrx, id: Date.now(), created_at: new Date().toISOString() });
    }
    
    alert("Dicatat!"); document.getElementById('input-ket-jualan').value = ''; document.getElementById('input-nominal-jualan').value = ''; document.getElementById('cek-piutang-jualan').checked = false;
    loadDashboard(); loadRiwayat();
});

document.getElementById('btn-simpan-prive').addEventListener('click', async () => {
    const ket = document.getElementById('input-ket-prive').value;
    const nominal = parseFloat(document.getElementById('input-nominal-prive').value);
    
    if(!ket || !nominal) return alert("Lengkapi data prive!");
    const dataTrx = { tipe: 'prive', keterangan: ket, nominal: nominal, status: 'lunas' };

    if(navigator.onLine) {
        await supabaseClient.from('transaksi').insert([dataTrx]);
        statusEl.innerText = "Tersimpan (Online)";
    } else {
        addToSyncQueue('transaksi', 'insert', dataTrx);
        semuaTransaksi.unshift({ ...dataTrx, id: Date.now(), created_at: new Date().toISOString() });
    }
    
    alert("Dana pribadi berhasil ditarik!"); document.getElementById('input-ket-prive').value = ''; document.getElementById('input-nominal-prive').value = '';
    loadDashboard(); loadRiwayat();
});

// ==========================================
// 8. DASHBOARD & CHART
// ==========================================
async function loadDashboard() {
    if(navigator.onLine) {
        const { data } = await supabaseClient.from('transaksi').select('*').order('created_at', { ascending: false });
        semuaTransaksi = data || [];
    }
    
    let masuk = 0, keluar = 0, prive = 0;
    semuaTransaksi.forEach(trx => {
        if(trx.status === 'lunas') { 
            if(trx.tipe === 'pemasukan') masuk += Number(trx.nominal);
            if(trx.tipe === 'pengeluaran') keluar += Number(trx.nominal);
            if(trx.tipe === 'prive') prive += Number(trx.nominal);
        }
    });

    document.getElementById('dash-saldo').innerText = fmtRp(masuk - keluar - prive);
    document.getElementById('dash-masuk').innerText = fmtRp(masuk);
    document.getElementById('dash-keluar').innerText = fmtRp(keluar);
    document.getElementById('dash-prive').innerText = fmtRp(prive);
    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('chartKeuangan');
    if(!ctx) return;
    const labels = [], dataMasuk = [], dataKeluar = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
        let m = 0, k = 0;
        semuaTransaksi.forEach(t => {
            if(t.created_at.split('T')[0] === dateStr && t.status === 'lunas') {
                if(t.tipe === 'pemasukan') m += Number(t.nominal);
                if(t.tipe === 'pengeluaran' || t.tipe === 'prive') k += Number(t.nominal);
            }
        });
        dataMasuk.push(m); dataKeluar.push(k);
    }

    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar', data: { labels, datasets: [
            { label: 'Masuk', data: dataMasuk, backgroundColor: '#22c55e', borderRadius: 4 },
            { label: 'Keluar/Prive', data: dataKeluar, backgroundColor: '#ef4444', borderRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: {display:false} }, y: { ticks: { color: '#94a3b8' }, grid: {color:'#334155'} } } }
    });
}

// ==========================================
// 9. RIWAYAT & FILTER
// ==========================================
async function loadRiwayat() {
    if(navigator.onLine) {
        const { data } = await supabaseClient.from('transaksi').select('*').order('created_at', { ascending: false });
        semuaTransaksi = data || [];
    }
    filterRiwayat();
}

document.getElementById('search-riwayat').addEventListener('input', filterRiwayat);
document.getElementById('filter-tipe').addEventListener('change', filterRiwayat);

function filterRiwayat() {
    const search = document.getElementById('search-riwayat').value.toLowerCase();
    const tipe = document.getElementById('filter-tipe').value;
    const container = document.getElementById('list-riwayat');
    
    let filtered = semuaTransaksi.filter(t => 
        (tipe === 'semua' || t.tipe === tipe) && t.keterangan.toLowerCase().includes(search)
    );

    container.innerHTML = filtered.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--text-muted);">Tidak ada data.</div>' : 
    filtered.map(trx => {
        const isMasuk = trx.tipe === 'pemasukan';
        const isPrive = trx.tipe === 'prive';
        const badge = trx.status === 'lunas' ? '<span class="trx-badge badge-lunas">LUNAS</span>' : '<span class="trx-badge badge-hutang">BELUM LUNAS</span>';
        const tgl = new Date(trx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        
        let amountClass = isMasuk ? 'text-in' : 'text-out';
        let amountText = `${isMasuk ? '+' : '-'} ${fmtRp(trx.nominal)}`;
        let titlePrefix = '';
        
        if (isPrive) {
            amountClass = ''; amountText = `- ${fmtRp(trx.nominal)}`; titlePrefix = '💸 ';
        }

        return `<div class="trx-item" style="${isPrive ? 'border-left: 3px solid var(--warning);' : ''}">
            <div class="trx-left">
                <div class="trx-title">${titlePrefix}${trx.keterangan}</div>
                <div class="trx-date">${tgl} ${isPrive ? '• Prive' : ''}</div>
                ${badge}
            </div>
            <div class="trx-right">
                <div class="trx-amount ${amountClass}" style="${isPrive ? 'color: var(--warning);' : ''}">${amountText}</div>
                <div class="trx-actions">
                    ${trx.status === 'belum lunas' ? `<button class="btn-icon" style="color:var(--success)" onclick="lunaskan(${trx.id})">✅</button>` : ''}
                    <button class="btn-icon" style="color:var(--danger)" onclick="hapusTrx(${trx.id})">🗑️</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.lunaskan = async function(id) {
    if(!confirm("Tandai transaksi ini sebagai LUNAS?")) return;
    if(navigator.onLine) await supabaseClient.from('transaksi').update({ status: 'lunas' }).eq('id', id);
    else addToSyncQueue('transaksi', 'update', { status: 'lunas' }, id);
    
    // Update local state for UI
    const trx = semuaTransaksi.find(t => t.id == id);
    if(trx) trx.status = 'lunas';
    
    loadDashboard(); filterRiwayat();
}

window.hapusTrx = async function(id) {
    if(!confirm("Hapus transaksi?")) return;
    if(navigator.onLine) await supabaseClient.from('transaksi').delete().eq('id', id);
    else addToSyncQueue('transaksi', 'delete', null, id);
    
    // Update local state for UI
    semuaTransaksi = semuaTransaksi.filter(t => t.id != id);
    
    loadDashboard(); filterRiwayat();
}

// ==========================================
// 10. EXPORT EXCEL & SCREENSHOT
// ==========================================
document.getElementById('btn-export-excel').addEventListener('click', () => {
    let csv = "Tanggal,Tipe,Keterangan,Kategori,Status,Nominal\n";
    semuaTransaksi.forEach(t => {
        const d = new Date(t.created_at).toLocaleDateString('id-ID');
        let tipeLabel = t.tipe;
        if (t.tipe === 'prive') tipeLabel = 'Prive (Pribadi)';
        csv += `${d},${tipeLabel},${t.keterangan.replace(/,/g,' ')},${t.kategori || 'Umum'},${t.status},${t.nominal}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_${pengaturanBisnis.nama_bisnis?.replace(/\s/g,'_') || 'KasPro'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
});

document.getElementById('btn-export-gambar').addEventListener('click', () => {
    const area = document.getElementById('area-laporan');
    html2canvas(area, { scale: 2, backgroundColor: '#0f172a' }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Screenshot_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png'); link.click();
    });
});

// ==========================================
// 11. INIT APLIKASI (Dipanggil setelah PIN benar)
// ==========================================
async function initApp() {
    updateConnectionStatus();
    setupNav();
    document.getElementById('tanggal-laporan').innerText = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Load data bertahap
    await loadPengaturan();
    await loadMasterData();
    await loadDashboard();
    await loadRiwayat();
    
    // Daftarkan Service Worker untuk PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Gagal', err));
    }
                }
