// ==========================================
// KONFIGURASI SUPABASE (SUDAH TERISI OTOMATIS)
// ==========================================
const SUPABASE_URL      = 'https://ocqedmogvkcvfkjekayr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcWVkbW9ndmtjdmZramVrYXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NTk0NzIsImV4cCI6MjEwODIzNTQ3Mn0.bQFVAIbaquQOj7sTT_CZQbZmgE7v2EmnpkE-zbW6w3Y';
    
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE_NAME = 'kalkulator_state';
const DOC_ID = 'data-kalkulator-utama';

let timerAutoSave;
const statusEl = document.getElementById('status-save');

// FUNGSI SIMPAN (AUTO-SAVE)
async function simpanData() {
    statusEl.innerText = "Menyimpan...";
    statusEl.style.color = "#94a3b8";
    
    const arrayModal = [];
    document.querySelectorAll('.baris-modal').forEach(baris => {
        const bahan = baris.querySelector('.pilih-bahan').value;
        const qty = baris.querySelector('.input-qty').value;
        const harga = baris.querySelector('.input-harga').value;
        
        if (bahan || qty || harga) {
            arrayModal.push({ bahan, qty, harga });
        }
    });

    const dataForm = {
        modal_bahan: arrayModal,
        daging: document.getElementById('input-daging').value,
        jeroan: document.getElementById('input-jeroan').value,
    };

    const { error } = await supabaseClient
        .from(TABLE_NAME)
        .upsert({ id: DOC_ID, form_data: dataForm, updated_at: new Date() });

    if (error) {
        console.error("Gagal save:", error.message);
        statusEl.innerText = "Gagal menyimpan! Cek database/RLS.";
        statusEl.style.color = "#ef4444"; // Merah
    } else {
        const time = new Date().toLocaleTimeString('id-ID');
        statusEl.innerText = `Tersimpan otomatis (${time})`;
        statusEl.style.color = "#4ade80"; // Hijau
    }
}

// FUNGSI DEBOUNCE (JEDA 1 DETIK)
function handleInput() {
    clearTimeout(timerAutoSave);
    timerAutoSave = setTimeout(simpanData, 1000); 
}

// FUNGSI BUAT BARIS BARU (DINAMIS)
function buatBarisBaru(bahan = '', qty = '', harga = '') {
    const container = document.getElementById('container-modal');
    const div = document.createElement('div');
    div.className = 'baris-modal';
    
    const opsiBahan = ['Ayam', 'Beras', 'Bumbu', 'Gas'];
    let selectOptions = '<option value="">-- Pilih Bahan --</option>';
    opsiBahan.forEach(opt => {
        selectOptions += `<option value="${opt}" ${bahan === opt ? 'selected' : ''}>${opt}</option>`;
    });

    div.innerHTML = `
        <select class="pilih-bahan">${selectOptions}</select>
        <input type="number" class="input-qty" value="${qty}" placeholder="Qty">
        <input type="number" class="input-harga" value="${harga}" placeholder="Harga">
        <button type="button" class="btn-hapus">Hapus Baris</button>
    `;

    div.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', handleInput);
        el.addEventListener('change', handleInput);
    });

    div.querySelector('.btn-hapus').addEventListener('click', () => {
        div.remove();
        handleInput(); 
    });

    container.appendChild(div);
}

// FUNGSI LOAD DATA SAAT REFRESH
async function muatData() {
    statusEl.innerText = "Memuat data...";
    
    const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select('form_data')
        .eq('id', DOC_ID)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error("Gagal load:", error.message);
        statusEl.innerText = "Gagal memuat data.";
        statusEl.style.color = "#ef4444";
        return;
    }

    statusEl.innerText = "";

    if (data && data.form_data) {
        const form = data.form_data;
        document.getElementById('input-daging').value = form.daging || '';
        document.getElementById('input-jeroan').value = form.jeroan || '';

        const container = document.getElementById('container-modal');
        container.innerHTML = '';

        if (form.modal_bahan && form.modal_bahan.length > 0) {
            form.modal_bahan.forEach(item => {
                buatBarisBaru(item.bahan, item.qty, item.harga);
            });
        } else {
            buatBarisBaru();
        }
    } else {
        buatBarisBaru(); // Jika data kosong di DB, buat 1 baris kosong
    }
}

// JALANKAN SAAT HALAMAN DIBUKA
document.addEventListener('DOMContentLoaded', () => {
    muatData();

    document.getElementById('input-daging').addEventListener('input', handleInput);
    document.getElementById('input-jeroan').addEventListener('input', handleInput);

    document.getElementById('btn-tambah').addEventListener('click', () => {
        buatBarisBaru();
    });
});
