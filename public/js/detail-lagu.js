// Variabel global buat nyimpen data lagu yang lagi dibuka saat ini
let currentSong = null;
// Variabel buat ngecek apakah user punya hak akses buat ngedit/hapus lagu ini
let canManageLagu = false;

// Semua kode di dalam fungsi ini bakal dijalanin pas HTML udah beres dimuat
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inisialisasi Auth (Ngecek status login user)
    // Tunggu pengecekan dari layout.js selesai dulu
    if (window.authReady) {
        await window.authReady;
    }

    // Ambil role-nya, kalau nggak login anggap aja 'guest' (tamu)
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    // Yang boleh edit/hapus lagu cuma super admin, admin, sama music director
    canManageLagu = window.isSuperAdmin || role === 'admin' || role === 'music director';

    // Ambil parameter dari URL (misal: localhost:3000/detail-lagu?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const songId = urlParams.get('id'); // Ambil ID lagunya
    const jadwalId = urlParams.get('jadwal_id'); // Ambil ID jadwal (kepake kalau dia buka lagu ini dari setlist jadwal)
    const songIndexStr = urlParams.get('index'); // Urutan lagu di jadwal

    // Kalau nggak ada ID lagu di URL, balikin lagi ke halaman bank lagu
    if (!songId) {
        alert('ID Lagu tidak ditemukan!');
        window.location.href = '/bank-lagu';
        return;
    }

    // Panggil fungsi buat narik detail lagunya dari backend
    await fetchSongDetail(songId);
    // Pasang fungsi-fungsi tombol (seperti hapus, ganti nada, hide chord)
    setupInteractions(songId);

    // Kalau user buka halaman ini lewat setlist di detail-jadwal, kita ubah tampilannya jadi "Mode Setlist"
    if (jadwalId) {
        await handleSetlistMode(jadwalId, songIndexStr);
    }
});

// Fungsi khusus kalau lagu dibuka dari daftar lagu di jadwal pelayanan
async function handleSetlistMode(jadwalId, songIndexStr) {
    try {
        // Tarik data jadwalnya dulu biar tau lagu-lagunya apa aja
        const res = await fetch(`/api/jadwal/${jadwalId}`);
        const { data } = await res.json();

        // Cek kalau daftar lagunya ada
        if (data && data.daftar_lagu) {
            const index = parseInt(songIndexStr);
            const daftar = data.daftar_lagu;

            // 1. Ganti Tombol "Back" & Warna Sidebar
            const btnBack = document.getElementById('btn-back-lagu');
            const backText = document.getElementById('back-text');
            // Kalau aslinya tombol back ngarah ke "Bank Lagu", sekarang kita arahin balik ke "Detail Jadwal"
            if (btnBack) {
                btnBack.removeAttribute('onclick');
                btnBack.onclick = () => window.location.href = `/detail-jadwal.html?id=${jadwalId}`;
            }
            if (backText) backText.style.display = 'inline';

            // Biar menu sidebar yang nyala itu menu "Jadwal", bukan menu "Bank Lagu"
            document.body.setAttribute('data-active', 'jadwal');

            // 2. Munculkan Header Khusus Setlist (Bar hitam di atas)
            const setlistBar = document.getElementById('setlist-bar');
            if (setlistBar) setlistBar.style.display = 'flex';

            // Isi teks judul jadwal & tanggalnya
            const setlistTitle = document.getElementById('setlist-title');
            const setlistDate = document.getElementById('setlist-date');

            if (setlistTitle) setlistTitle.textContent = data.judul || data.tema_pelayanan;

            if (setlistDate && data.tanggal) {
                const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                const d = new Date(data.tanggal);
                setlistDate.textContent = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
            }

            // 3. Setup Tombol Prev & Next (Buat pindah-pindah lagu di setlist)
            const btnPrev = document.getElementById('btn-setlist-prev');
            const btnNext = document.getElementById('btn-setlist-next');

            // Logika buat tombol Mundur (Prev)
            if (btnPrev) {
                if (index > 0) { // Kalau bukan lagu pertama, tombolnya bisa diklik
                    btnPrev.onclick = () => window.location.href = `/detail-lagu.html?id=${daftar[index - 1].id_lagu}&jadwal_id=${jadwalId}&index=${index - 1}`;
                    btnPrev.style.color = 'var(--primary-color)';
                    btnPrev.style.cursor = 'pointer';
                } else { // Kalau udah paling awal, tombolnya dimatiin warnanya
                    btnPrev.style.color = '#cbd5e0';
                    btnPrev.style.cursor = 'not-allowed';
                }
            }

            // Logika buat tombol Maju (Next)
            if (btnNext) {
                if (index < daftar.length - 1) { // Kalau bukan lagu terakhir
                    btnNext.onclick = () => window.location.href = `/detail-lagu.html?id=${daftar[index + 1].id_lagu}&jadwal_id=${jadwalId}&index=${index + 1}`;
                    btnNext.style.background = 'var(--primary-color)';
                    btnNext.style.cursor = 'pointer';
                } else {
                    btnNext.style.background = '#cbd5e0';
                    btnNext.style.cursor = 'not-allowed';
                }
            }

            // 4. Override Transpose!
            // Kadang nada dasar asli lagu 'C', tapi di jadwal ini disepakatin main di 'D'.
            // Maka kita paksa ganti selector nadanya ke nada yang ada di setlist jadwal.
            const targetKey = daftar[index].nada_dasar;
            const transposeSelect = document.querySelector('.transpose-select');
            if (targetKey && transposeSelect && targetKey !== currentSong.nada_dasar) {
                transposeSelect.value = targetKey;
                // Lempar event change biar fungsi transposer-nya (di bawah) jalan buat ganti teks lirik
                transposeSelect.dispatchEvent(new Event('change'));
            }
        }
    } catch (err) {
        console.error("Setlist mode error:", err);
    }
}

// Fungsi utama buat ngambil data lagu satuan
async function fetchSongDetail(id) {
    try {
        const res = await fetch(`/api/lagu/${id}`);
        if (!res.ok) throw new Error('Lagu tidak ditemukan');
        const { data } = await res.json();
        // Simpen data yang didapet ke variabel global biar gampang diakses
        currentSong = data;

        // Abis data dapet, langsung render HTML-nya
        renderSongDetail();
    } catch (err) {
        alert(err.message);
        window.location.href = '/bank-lagu';
    }
}

// Fungsi buat nulis ulang isi HTML pakai data dari currentSong
function renderSongDetail() {
    if (!currentSong) return;

    // 1. Header (Judul & Penyanyi)
    const titleEl = document.querySelector('.song-title-large');
    const artistEl = document.querySelector('.song-artist-large');
    if (titleEl) titleEl.textContent = currentSong.judul;
    if (artistEl) artistEl.textContent = currentSong.penyanyi || 'Unknown Artist';

    // Ganti title tab browser biar dinamis
    document.title = `${currentSong.judul} - KITTEENS HUB`;

    // 2. Tunjukin / Umpetin Tombol Edit dan Hapus sesuai hak akses
    const btnEdit = document.querySelector('.btn-edit');
    const btnDelete = document.querySelector('.btn-delete-filled');
    if (canManageLagu) {
        if (btnEdit) {
            // Arahin ke halaman edit bawa ID lagunya
            btnEdit.onclick = () => window.location.href = `/edit-lagu?id=${currentSong.id}`;
        }
    } else {
        // Kalau bukan admin, sembunyiin tombolnya biar gak bisa iseng ngeklik
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    }

    // 3. Tulis Nada Dasar Original di pojok kanan
    const originalKeyEl = document.querySelector('.control-value');
    if (originalKeyEl) originalKeyEl.textContent = currentSong.nada_dasar || '-';

    // 4. Bikin list dropdown buat fitur ubah nada (Transpose)
    const transposeSelect = document.querySelector('.transpose-select');
    const originalKey = currentSong.nada_dasar || 'C'; // Default ke C kalau kosong
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    if (transposeSelect) {
        transposeSelect.innerHTML = '';
        NOTES.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            option.textContent = note;
            // Pilih (selected) note yang sama kayak nada dasar lagu aslinya
            if (note === originalKey) option.selected = true;
            transposeSelect.appendChild(option);
        });
    }

    // 5. Nampilin Thumbnail YouTube
    const videoLink = document.querySelector('.video-thumbnail-link');
    const videoThumbnail = document.querySelector('.video-thumbnail');
    if (currentSong.link_youtube) {
        // Bikin kotaknya bisa diklik nuju link youtube
        videoLink.href = currentSong.link_youtube;
        // Kita cabut ID youtube-nya buat ngambil gambar thumbnail otomatis dari server Google
        const videoId = extractYouTubeId(currentSong.link_youtube);
        if (videoId) {
            videoThumbnail.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`;
        }
    } else {
        // Kalau nggak ada link-nya, hilangin aja kotaknya
        if (videoLink) videoLink.style.display = 'none';
    }

    // 6. Terjemahin lirik mentah jadi komponen HTML & Jump Links (Loncat ke Verse/Chorus)
    const lyricsContainer = document.getElementById('lyricsContainer');
    const jumpList = document.querySelector('.jump-list');

    if (lyricsContainer && jumpList && currentSong.chord_lirik) {
        // Manggil fungsi ribet buat misahin lirik dan chord (ada di bawah)
        const { html, jumpLinks } = parseLyricsToHtml(currentSong.chord_lirik);
        lyricsContainer.innerHTML = html;
        jumpList.innerHTML = jumpLinks;
    }
}

// Fungsi pembantu buat ekstrak ID Unik dari berbagai bentuk URL Youtube
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    // ID youtube itu selalu 11 karakter
    return (match && match[2].length === 11) ? match[2] : null;
}

// Ini fungsi yang mikir keras gimana ngerubah teks mentah dari database jadi HTML Lirik + Chord
function parseLyricsToHtml(rawLyrics) {
    // 1. Pisahin lirik per section (Verse, Chorus, dll) berdasarkan jeda ENTER kosong (\n\n)
    const blocks = rawLyrics.split(/\n\s*\n/);
    let html = '';
    let jumpLinks = ''; // Buat kumpulin menu "Loncat ke bagian..."
    let sectionCount = 0;

    blocks.forEach(block => {
        if (!block.trim()) return;

        // Pisahin lagi per baris dalam satu blok
        const lines = block.split('\n');

        let sectionTitle = '';
        let sectionId = `section-${sectionCount}`;
        let startIndex = 0; // Kalo baris pertama itu judul (Verse 1), kita mulai render lirik dari baris kedua (index 1)

        // Cek kalau baris pertama itu dikurung "(...)" atau "[...]" berarti itu judul section!
        const firstLineMatch = lines[0].match(/^[\(\[](.+)[\)\]]$/i);
        if (firstLineMatch) {
            sectionTitle = lines[0].trim();
            // Bikin ID unik buat HTML-nya biar bisa dituju sama tombol 'Jump'
            sectionId = sectionTitle.replace(/[\W_]+/g, '').toLowerCase() + sectionCount;
            startIndex = 1;
        }

        // Kalau dapet nama section, catet jadi link jump!
        if (sectionTitle) {
            jumpLinks += `<li><a href="#${sectionId}">${sectionTitle.replace(/[\(\)\[\]]/g, '')}</a></li>`;
        }

        // Bikin wadah buat section lirik ini
        html += `<div class="lyrics-section" id="${sectionId}">`;
        if (sectionTitle) {
            html += `<div class="section-title">${sectionTitle}</div>`;
        }

        // Looping semua baris lirik di section ini
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            html += `<div class="lyric-line">`;

<<<<<<< HEAD
            // --- INTI ALGORITMA PENEMPATAN CHORD ---
            // Format mentah dari database biasanya: "Tuhan Engkau [G]baik"
            // Tujuannya agar chord G tepat berada di atas huruf 'b' pada kata 'baik'.
            
            // 1. Memotong baris teks menggunakan Regex (Regular Expression)
            // Regex ini mendeteksi pola teks apapun yang diapit kurung siku, misal: [G], [Am7], [C#m/E]
            // split() akan memecah string menjadi Array. 
            // Contoh "Tuhan Engkau [G]baik" menjadi -> ["Tuhan Engkau ", "[G]", "baik"]
=======
            // Nah ini bagian seru: mecah teks biasa dan teks chord!
            // Kita nyari kata yang dikurung [...] misal: [G] atau [C#m/B]
>>>>>>> origin/Lagu-History-Komen
            const segments = line.split(/(\[[A-G][#b]?m?[0-9]*(?:\/[A-G][#b]?)?\])/g);

            let htmlSegment = '';
            let currentChord = ''; // Variabel "gantungan" untuk menyimpan chord sementara

<<<<<<< HEAD
            // 2. Memproses setiap potongan (teks maupun chord) satu per satu
=======
            // Looping hasil pecahan tadi
>>>>>>> origin/Lagu-History-Komen
            segments.forEach(seg => {
                // Jika potongan ini adalah chord (diawali '[' dan diakhiri ']')
                if (seg.startsWith('[') && seg.endsWith(']')) {
<<<<<<< HEAD
                    
                    // Jika sebelumnya sudah ada chord yang "menggantung" (belum ada teks bawahnya), cetak dulu.
                    // (Kasus di mana ada chord bersebelahan seperti [G][Am])
                    if (currentChord) {
                        htmlSegment += `<span class="lyric-segment"><span class="chord"><span data-original="${currentChord}">${currentChord}</span></span><span class="text">&nbsp;</span></span>`;
                    }
                    // Simpan chord baru ini tanpa tanda kurung siku (ambil isi tengahnya)
                    currentChord = seg.slice(1, -1);
                } 
                // Jika potongan ini adalah lirik (teks biasa)
                else {
                    // Mengubah spasi biasa menjadi '&nbsp;' agar spasi tidak hilang/runtuh saat di-render HTML
                    const cleanText = seg.replace(/ /g, '&nbsp;');
                    
=======
                    // Kalau segmen ini adalah CHORD
                    if (currentChord) { // Kalau ada sisa chord yang ga nempel sama lirik
                        htmlSegment += `<span class="lyric-segment"><span class="chord"><span data-original="${currentChord}">${currentChord}</span></span><span class="text">&nbsp;</span></span>`;
                    }
                    currentChord = seg.slice(1, -1); // Buang kurung [ ] nya
                } else {
                    // Kalau segmen ini adalah TEKS LIRIK
                    const cleanText = seg.replace(/ /g, '&nbsp;'); // Jaga spasinya tetep utuh
>>>>>>> origin/Lagu-History-Komen
                    if (currentChord || cleanText) {
                        // Memulai membuat satu blok kolom vertikal
                        htmlSegment += `<span class="lyric-segment">`;
                        
                        // -- Bagian Atas (Kotak Chord) --
                        if (currentChord) {
<<<<<<< HEAD
                            // Cetak chord yang sedang "menggantung" di atas
=======
                            // Tempelin chord-nya di atas teks ini. 
                            // data-original penting banget buat patokan kalau kita mau nge-transpose (naikin/turunin nada)
>>>>>>> origin/Lagu-History-Komen
                            htmlSegment += `<span class="chord"><span data-original="${currentChord}">${currentChord}</span></span>`;
                            currentChord = ''; // Kosongkan gantungan karena sudah dipakai
                        } else {
                            // Jika tidak ada chord, buat kotak kosong agar baris tetap sejajar
                            htmlSegment += `<span class="chord empty"></span>`;
                        }
                        
                        // -- Bagian Bawah (Kotak Teks Lirik) --
                        // Cetak potongan teks persis di bawah kotak chord tadi
                        htmlSegment += `<span class="text">${cleanText || '&nbsp;'}</span></span>`;
                    }
                }
            });

<<<<<<< HEAD
            // 3. Membersihkan Sisa
            // Jika baris lagu berakhir dengan chord (misal: "Haleluya [C]"), 
            // maka cetak chord terakhir itu dengan teks kosong di bawahnya
=======
            // Kalau pas habis baca satu baris eh chord-nya nyisa (biasanya buat out-ro), cetak aja
>>>>>>> origin/Lagu-History-Komen
            if (currentChord) {
                htmlSegment += `<span class="lyric-segment"><span class="chord"><span data-original="${currentChord}">${currentChord}</span></span><span class="text">&nbsp;</span></span>`;
            }

            html += `${htmlSegment}</div>`;
        }

        html += `</div>`;
        sectionCount++;
    });

    return { html, jumpLinks };
}

// Pasang fungsi interaktif (diklik/diubah)
function setupInteractions(songId) {
    // 1. Logika buat nyembunyiin chord (Tombol mata)
    const toggleBtn = document.getElementById('toggleChordBtn');
    const chordIcon = document.getElementById('chordIcon');
    const lyricsContainer = document.getElementById('lyricsContainer');
    let chordsVisible = true; // State bawaan: chord nyala

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            chordsVisible = !chordsVisible;
            if (chordsVisible) {
                // Munculin chord dan ganti icon jadi mata kebuka (eye-slash artinya dicoret)
                lyricsContainer.classList.remove('hide-chords');
                chordIcon.classList.remove('ph-eye');
                chordIcon.classList.add('ph-eye-slash');
            } else {
                // Sembunyiin chord pake CSS (ada class hide-chords) dan icon mata biasa
                lyricsContainer.classList.add('hide-chords');
                chordIcon.classList.remove('ph-eye-slash');
                chordIcon.classList.add('ph-eye');
            }
        });
    }

    // 2. Tombol Delete (Merah) di pojok
    const deleteBtn = document.querySelector('.btn-delete-filled');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const confirmDelete = confirm("Apakah Anda yakin ingin menghapus lagu ini?");
            if (confirmDelete) {
                try {
                    // Panggil API delete dengan ID lagu
                    const res = await fetch(`/api/lagu/${songId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('Gagal menghapus lagu');
                    window.location.href = '/bank-lagu'; // Balik ke beranda
                } catch (err) {
                    alert(err.message);
                }
            }
        });
    }

    // 3. Fitur "Loncat ke..." (Smooth Scroll dari sidebar lirik)
    // Kenapa pasang di document? Soalnya listnya digenerate lewat JS (Dinamis), jadi aman kalo pake "event delegation"
    document.addEventListener('click', (e) => {
        // Cek apa yang diklik itu tag link (A) yang ada di dalem blok .jump-list
        if (e.target.tagName === 'A' && e.target.closest('.jump-list')) {
            e.preventDefault(); // Jangan lakuin aksi default dari link (refresh)
            const targetId = e.target.getAttribute('href').substring(1); // Ambil '#verse1' buang pagar jadi 'verse1'
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                // Scroll smooth ke tujuan
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    // 4. Fitur Transpose (Ubah Nada)
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const transposeSelect = document.querySelector('.transpose-select');

    // Fungsi kecil pembantu buat naikin/turunin SATU BUAH chord berdasar jarak step-nya
    function transposeChord(chord, steps) {
        // Potong nada dasarnya dari jenisnya. Misal: C#m -> C# (root) dan m (suffix)
        const match = chord.match(/^([A-G][#b]?)(.*)$/);
        if (!match) return chord; // Kalau bukan chord, balikin aslinya

        let root = match[1];
        const suffix = match[2];

        // Posisi root ini di piano ada di index ke berapa?
        let index = NOTES.indexOf(root);
        if (index === -1) return chord;

        // Hitung index nada baru (naik atau turun 'steps' jarak), % 12 biar muter terus di keyboard
        let newIndex = (index + steps) % 12;
        if (newIndex < 0) newIndex += 12; // Handle negatif (mundur)

        // Balikin root baru ditempel suffix-nya (misal: F# + m)
        return NOTES[newIndex] + suffix;
    }

    if (transposeSelect) {
        // Kalo pilihan dropdown berubah...
        transposeSelect.addEventListener('change', (e) => {
            const selectedKey = e.target.value; // Nada tujuan, e.g. "G"
            const originalKey = currentSong.nada_dasar || 'C'; // Nada awal, e.g. "C"

            // Jaraknya berapa nada?
            const originalIndex = NOTES.indexOf(originalKey);
            const selectedIndex = NOTES.indexOf(selectedKey);
            const steps = selectedIndex - originalIndex;

            // Cari semua chord di halaman
            const chordSpans = document.querySelectorAll('.chord span');
            chordSpans.forEach(span => {
                // Ambil nada aslinya dari atribut yang tadi disiapin pas ngerender HTML
                const originalChord = span.getAttribute('data-original');

                // Kasus spesial: Chord Bass (misal D/F#)
                if (originalChord.includes('/')) {
                    const parts = originalChord.split('/'); // Pecah jadi D dan F#
                    const tRoot = transposeChord(parts[0], steps); // Transpose D
                    const tBass = transposeChord(parts[1], steps); // Transpose F#
                    span.textContent = `${tRoot}/${tBass}`;
                } else {
                    // Kasus biasa
                    span.textContent = transposeChord(originalChord, steps);
                }
            });
        });
    }
}
