// --- INISIALISASI SUPABASE ---
const SUPABASE_URL = 'URL_SUPABASE_ANDA';
const SUPABASE_ANON_KEY = 'ANON_KEY_ANDA';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE_NAME = 'kalkulator_state';
const DOC_ID = 'data-kalkulator-utama';

// Variabel penanda waktu untuk Auto-Save
let timerAutoSave;

// ==========================================
// 1. FUNGSI UNTUK MENYIMPAN SEMUA DATA (AUTO-SAVE)
// ==========================================
async function autoSaveData() {
    // A. Ambil data dari baris dinamis (Tambah Modal)
    const arrayModal = [];
    document.querySelectorAll('.baris-modal').forEach(baris => {
        const bahan = baris.querySelector('.pilih-bahan').value;
        const qty = baris.querySelector('.input-qty').value;
        const harga = baris.querySelector('.input-harga').value;
        
        // Hanya simpan jika baris tersebut ada isinya (tidak kosong melompong)
        if (bahan || qty || harga) {
            arrayModal.push({ bahan, qty, harga });
        }
    });

    // B. Kumpulkan semua data ke dalam satu object
    const dataForm = {
        modal_bahan: arrayModal, // Simpan sebagai Array
        daging: document.getElementById('input-daging')?.value || '',
        jeroan: document.getElementById('input-jeroan')?.value || '',
        // tambahkan input statis lainnya di sini
    };

    // C. Kirim ke Supabase (Upsert = Update kalau ada, Insert kalau baru)
    const { error } = await supabase
        .from(TABLE_NAME)
        .upsert({ 
            id: DOC_ID, 
            form_data: dataForm,
            updated_at: new Date()
        });

    if (error) {
        console.error("Auto-save gagal:", error.message);
    } else {
        // Tampilkan indikator kecil di layar (opsional)
        console.log("Tersimpan otomatis pada", new Date().toLocaleTimeString());
    }
}

// ==========================================
// 2. FUNGSI DEBOUNCE (Mencegah Spam Database)
// ==========================================
// Fungsi ini akan menunda penyimpanan 1 detik setelah user berhenti ngetik.
// Jadi kalau ngetik "1000", database nggak di-update 4 kali (1, 10, 100, 1000).
function handleInput() {
    clearTimeout(timerAutoSave);
    timerAutoSave = setTimeout(autoSaveData, 1000); 
}

// ==========================================
// 3. FUNGSI MEMBUAT BARIS BARU (DINAMIS)
// ==========================================
function buatBarisBaru(bahan = '', qty = '', harga = '') {
    const container = document.getElementById('container-modal');
    const barisBaru = document.createElement('div');
    barisBaru.className = 'baris-modal';
    
    // Template HTML baris baru
    barisBaru.innerHTML = `
        <select class="pilih-bahan">
            <option value="">-- Pilih Bahan --</option>
            <option value="Ayam" ${bahan === 'Ayam' ? 'selected' : ''}>Ayam</option>
            <option value="Beras" ${bahan === 'Beras' ? 'selected' : ''}>Beras</option>
        </select>
        <input type="number" class="input-qty" value="${qty}" placeholder="Qty">
        <input type="number" class="input-harga" value="${harga}" placeholder="Harga">
        <button type="button" class="btn-hapus-baris">X</button>
    `;

    // Tambahkan event auto-save ke inputan baru
    barisBaru.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', handleInput);
        el.addEventListener('change', handleInput);
    });

    // Event tombol hapus baris
    barisBaru.querySelector('.btn-hapus-baris').addEventListener('click', () => {
        barisBaru.remove();
        handleInput(); // Simpan ulang setelah baris dihapus
    });

    container.appendChild(barisBaru);
}

// ==========================================
// 4. FUNGSI LOAD DATA DARI SUPABASE (SAAT REFRESH)
// ==========================================
async function loadData() {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('form_data')
        .eq('id', DOC_ID)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error("Gagal load data:", error.message);
        return;
    }

    if (data && data.form_data) {
        const form = data.form_data;

        // A. Kembalikan input statis (Hasil Potongan)
        if(document.getElementById('input-daging')) document.getElementById('input-daging').value = form.daging || '';
        if(document.getElementById('input-jeroan')) document.getElementById('input-jeroan').value = form.jeroan || '';

        // B. Kembalikan baris dinamis (Tambah Modal)
        const container = document.getElementById('container-modal');
        container.innerHTML = ''; // Bersihkan form bawaan HTML

        if (form.modal_bahan && form.modal_bahan.length > 0) {
            // Looping data dari database, buat barisnya satu per satu
            form.modal_bahan.forEach(item => {
                buatBarisBaru(item.bahan, item.qty, item.harga);
            });
        } else {
            // Kalau belum ada data, buat 1 baris kosong bawaan
            buatBarisBaru();
        }
        
        console.log("Data berhasil dipulihkan!");
        
        // PENTING: Panggil fungsi hitung kalkulator Anda di sini!
        // hitungTotal(); 
    } else {
        // Jika baru pertama kali buka, buatkan 1 baris kosong
        buatBarisBaru();
    }
}

// ==========================================
// 5. EVENT LISTENER UTAMA SAAT HALAMAN DIBUKA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Tarik data dari Supabase
    loadData();

    // 2. Pasang auto-save ke input statis (Hasil Potongan)
    document.querySelectorAll('#input-daging, #input-jeroan').forEach(el => {
        el.addEventListener('input', handleInput);
    });

    // 3. Tombol Tambah Modal
    document.getElementById('btn-tambah-modal').addEventListener('click', () => {
        buatBarisBaru();
        // Tidak perlu save saat baris kosong ditambah, 
        // nanti tersimpan otomatis saat user mulai ngetik isinya.
    });
});
