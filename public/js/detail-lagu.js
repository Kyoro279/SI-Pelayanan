//variabel global buat nyimpen data lagu yang lagi dibuka saat ini
let currentSong = null;
//variabel buat ngecek apakah user punya hak akses buat ngedit/hapus lagu ini
let canManageLagu = false;

//semua kode di dalam fungsi ini bakal dijalanin pas HTML udah beres dimuat
document.addEventListener('DOMContentLoaded', async () => {
    //inisialisasi auth (ngecek status login user)
    //tunggu pengecekan dari layout.js selesai dulu
    if (window.authReady) {
        await window.authReady;
    }

    //ambil role-nya, kalau nggak login anggap aja 'guest' (tamu)
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    //yang boleh edit/hapus lagu cuma super admin, admin, sama music director
    canManageLagu = window.isSuperAdmin || role === 'admin' || role === 'music director';

    //ambil parameter dari URL (misal: localhost:3000/detail-lagu?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const songId = urlParams.get('id'); //ambil ID lagunya
    const jadwalId = urlParams.get('jadwal_id'); //ambil ID jadwal (kepake kalau dia buka lagu ini dari setlist jadwal)
    const songIndexStr = urlParams.get('index'); //urutan lagu di jadwal

    //kalau nggak ada ID lagu di URL, balikin lagi ke halaman bank lagu
    if (!songId) {
        alert('ID Lagu tidak ditemukan!');
        window.location.href = '/bank-lagu';
        return;
    }

    //panggil fungsi buat narik detail lagunya dari backend
    await fetchSongDetail(songId);
    //pasang fungsi-fungsi tombol (seperti hapus, ganti nada, hide chord)
    setupInteractions(songId);

    //kalau user buka halaman ini lewat setlist di detail-jadwal, kita ubah tampilannya jadi "Mode Setlist"
    if (jadwalId) {
        await handleSetlistMode(jadwalId, songIndexStr);
    }
});

//fungsi khusus kalau lagu dibuka dari daftar lagu di jadwal pelayanan
async function handleSetlistMode(jadwalId, songIndexStr) {
    try {
        //tarik data jadwalnya dulu biar tau lagu-lagunya apa aja
        const res = await fetch(`/api/jadwal/${jadwalId}`);
        const { data } = await res.json();

        //cek kalau daftar lagunya ada
        if (data && data.daftar_lagu) {
            const index = parseInt(songIndexStr);
            const daftar = data.daftar_lagu;

            //ganti tombol "Back" & warna sidebar
            const btnBack = document.getElementById('btn-back-lagu');
            const backText = document.getElementById('back-text');
            //kalau aslinya tombol back ngarah ke "Bank Lagu", sekarang kita arahin balik ke "Detail Jadwal"
            if (btnBack) {
                btnBack.removeAttribute('onclick');
                btnBack.onclick = () => window.location.href = `/detail-jadwal.html?id=${jadwalId}`;
            }
            if (backText) backText.style.display = 'inline';

            //biar menu sidebar yang nyala itu menu "Jadwal", bukan menu "Bank Lagu"
            document.body.setAttribute('data-active', 'jadwal');

            //munculkan header khusus setlist (bar hitam di atas)
            const setlistBar = document.getElementById('setlist-bar');
            if (setlistBar) setlistBar.style.display = 'flex';

            //isi teks judul jadwal & tanggalnya
            const setlistTitle = document.getElementById('setlist-title');
            const setlistDate = document.getElementById('setlist-date');

            if (setlistTitle) setlistTitle.textContent = data.judul || data.tema_pelayanan;

            if (setlistDate && data.tanggal) {
                const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                const d = new Date(data.tanggal);
                setlistDate.textContent = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
            }

            //setup tombol Prev & Next (buat pindah-pindah lagu di setlist)
            const btnPrev = document.getElementById('btn-setlist-prev');
            const btnNext = document.getElementById('btn-setlist-next');

            //logika buat tombol mundur (Prev)
            if (btnPrev) {
                if (index > 0) { //kalau bukan lagu pertama, tombolnya bisa diklik
                    const prevId = daftar[index - 1].id_lagu || daftar[index - 1].id;
                    btnPrev.onclick = () => window.location.href = `/detail-lagu.html?id=${prevId}&jadwal_id=${jadwalId}&index=${index - 1}`;
                    btnPrev.style.color = 'var(--primary-color)';
                    btnPrev.style.cursor = 'pointer';
                } else { //kalau udah paling awal, tombolnya dimatiin warnanya
                    btnPrev.style.color = '#cbd5e0';
                    btnPrev.style.cursor = 'not-allowed';
                }
            }

            //logika buat tombol maju (Next)
            if (btnNext) {
                if (index < daftar.length - 1) { //kalau bukan lagu terakhir
                    const nextId = daftar[index + 1].id_lagu || daftar[index + 1].id;
                    btnNext.onclick = () => window.location.href = `/detail-lagu.html?id=${nextId}&jadwal_id=${jadwalId}&index=${index + 1}`;
                    btnNext.style.background = 'var(--primary-color)';
                    btnNext.style.cursor = 'pointer';
                } else {
                    btnNext.style.background = '#cbd5e0';
                    btnNext.style.cursor = 'not-allowed';
                }
            }

            //override transpose!
            //kadang nada dasar asli lagu 'C', tapi di jadwal ini disepakatin main di 'D'.
            //maka kita paksa ganti selector nadanya ke nada yang ada di setlist jadwal.
            const targetKey = (daftar[index].nada_dasar || '').trim();
            const songKey = (currentSong.nada_dasar || '').trim();
            const transposeSelect = document.querySelector('.transpose-select');
            if (targetKey && transposeSelect && targetKey !== songKey) {
                transposeSelect.value = targetKey;
                //lempar event change biar fungsi transposer-nya (di bawah) jalan buat ganti teks lirik
                transposeSelect.dispatchEvent(new Event('change'));
            }
        }
    } catch (err) {
        console.error("Setlist mode error:", err);
    }
}

//fungsi utama buat ngambil data lagu satuan
async function fetchSongDetail(id) {
    try {
        const res = await fetch(`/api/lagu/${id}`);
        if (!res.ok) throw new Error('Lagu tidak ditemukan');
        const { data } = await res.json();
        //simpen data yang didapet ke variabel global biar gampang diakses
        currentSong = data;

        //abis data dapet, langsung render HTML-nya
        renderSongDetail();
    } catch (err) {
        alert(err.message);
        window.location.href = '/bank-lagu';
    }
}

//fungsi buat nulis ulang isi HTML pakai data dari currentSong
function renderSongDetail() {
    if (!currentSong) return;

    const title = currentSong.judul_lagu || currentSong.judul || 'Tanpa Judul';
    const artist = currentSong.pengarang || currentSong.penyanyi || 'Unknown Artist';
    const songId = currentSong.id_lagu || currentSong.id;
    const key = (currentSong.nada_dasar || '').trim() || '-';

    //header (judul & penyanyi)
    const titleEl = document.querySelector('.song-title-large');
    const artistEl = document.querySelector('.song-artist-large');
    if (titleEl) titleEl.textContent = title;
    if (artistEl) artistEl.textContent = artist;

    //ganti title tab browser biar dinamis
    document.title = `${title} - KITTEENS HUB`;

    //tunjukin / umpetin tombol Edit dan Hapus sesuai hak akses
    const btnEdit = document.querySelector('.btn-edit');
    const btnDelete = document.querySelector('.btn-delete-filled');
    if (canManageLagu) {
        if (btnEdit) {
            //arahin ke halaman edit bawa ID lagunya
            btnEdit.onclick = () => window.location.href = `/edit-lagu?id=${songId}`;
        }
    } else {
        //kalau bukan admin, sembunyiin tombolnya biar gak bisa iseng ngeklik
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    }

    //tulis nada dasar original di pojok kanan
    const originalKeyEl = document.querySelector('.control-value');
    if (originalKeyEl) originalKeyEl.textContent = key;

    //bikin list dropdown buat fitur ubah nada (transpose)
    const transposeSelect = document.querySelector('.transpose-select');
    const originalKey = key !== '-' ? key : 'C'; //default ke C kalau kosong
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    if (transposeSelect) {
        transposeSelect.innerHTML = '';
        NOTES.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            option.textContent = note;
            //pilih (selected) note yang sama kayak nada dasar lagu aslinya
            if (note === originalKey) option.selected = true;
            transposeSelect.appendChild(option);
        });
    }

    //nampilin thumbnail YouTube
    const videoLink = document.querySelector('.video-thumbnail-link');
    const videoThumbnail = document.querySelector('.video-thumbnail');
    if (currentSong.link_youtube) {
        //bikin kotaknya bisa diklik nuju link youtube
        videoLink.href = currentSong.link_youtube;
        //kita cabut ID youtube-nya buat ngambil gambar thumbnail otomatis dari server Google
        const videoId = extractYouTubeId(currentSong.link_youtube);
        if (videoId) {
            videoThumbnail.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`;
        }
    } else {
        //kalau nggak ada link-nya, hilangin aja kotaknya
        if (videoLink) videoLink.style.display = 'none';
    }

    //terjemahin lirik mentah jadi komponen HTML & jump links (loncat ke Verse/Chorus)
    const lyricsContainer = document.getElementById('lyricsContainer');
    const jumpList = document.querySelector('.jump-list');

    if (lyricsContainer && jumpList && currentSong.chord_lirik) {
        //manggil fungsi ribet buat misahin lirik dan chord (ada di bawah)
        const { html, jumpLinks } = parseLyricsToHtml(currentSong.chord_lirik);
        lyricsContainer.innerHTML = html;
        jumpList.innerHTML = jumpLinks;
    }
}

//fungsi pembantu buat ekstrak ID unik dari berbagai bentuk URL Youtube
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    //id youtube itu selalu 11 karakter
    return (match && match[2].length === 11) ? match[2] : null;
}

//ini fungsi yang mikir keras gimana ngerubah teks mentah dari database jadi HTML lirik + chord
function parseLyricsToHtml(rawLyrics) {
    //pisahin lirik per section (Verse, Chorus, dll) berdasarkan jeda ENTER kosong (\n\n)
    const blocks = rawLyrics.split(/\n\s*\n/);
    let html = '';
    let jumpLinks = ''; //buat kumpulin menu "Loncat ke bagian..."
    let sectionCount = 0;

    blocks.forEach(block => {
        if (!block.trim()) return;

        //pisahin lagi per baris dalam satu blok
        const lines = block.split('\n');

        let sectionTitle = '';
        let sectionId = `section-${sectionCount}`;
        let startIndex = 0; //kalo baris pertama itu judul (Verse 1), kita mulai render lirik dari baris kedua (index 1)

        //cek kalau baris pertama itu dikurung "(...)" atau "[...]" berarti itu judul section!
        const firstLineMatch = lines[0].match(/^[\(\[](.+)[\)\]]$/i);
        if (firstLineMatch) {
            sectionTitle = lines[0].trim();
            //bikin ID unik buat HTML-nya biar bisa dituju sama tombol 'Jump'
            sectionId = sectionTitle.replace(/[\W_]+/g, '').toLowerCase() + sectionCount;
            startIndex = 1;
        }

        //kalau dapet nama section, catet jadi link jump!
        if (sectionTitle) {
            jumpLinks += `<li><a href="#${sectionId}">${sectionTitle.replace(/[\(\)\[\]]/g, '')}</a></li>`;
        }

        //bikin wadah buat section lirik ini
        html += `<div class="lyrics-section" id="${sectionId}">`;
        if (sectionTitle) {
            html += `<div class="section-title">${sectionTitle}</div>`;
        }

        //looping semua baris lirik di section ini
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].replace(/\r$/, '');
            if (!line.trim()) continue;

            //nah ini bagian seru: mecah teks biasa dan teks chord!
            //kita nyari kata yang dikurung [...] misal: [G] atau [C#m/B]
            const segments = line.split(/(\[[A-G][#b]?m?[0-9]*(?:\/[A-G][#b]?)?\])/g);
            const isChordOnlyLine = segments.some(s => s.startsWith('[') && s.endsWith(']')) &&
                segments.every(s => (s.startsWith('[') && s.endsWith(']')) || s.trim() === '');

            html += `<div class="lyric-line${isChordOnlyLine ? ' chord-only' : ''}">`;

            let htmlSegment = '';
            let currentChord = '';

            //looping hasil pecahan tadi
            segments.forEach(seg => {
                if (!seg) return;

                if (seg.startsWith('[') && seg.endsWith(']')) {
                    //kalau segmen ini adalah CHORD
                    if (currentChord) { //kalau ada sisa chord yang ga nempel sama lirik
                        htmlSegment += `<span class="lyric-segment"><span class="chord"><span data-original="${currentChord}">${currentChord}</span></span>${isChordOnlyLine ? '' : '<span class="text">&nbsp;</span>'}</span>`;
                    }
                    currentChord = seg.slice(1, -1); //buang kurung [ ] nya
                } else if (seg.trim() === '') {
                    //kalau segmen ini cuma berisi SPASI (misal spasi antar chord: [G] [Em] [C] [G])
                    //cetak dulu chord sebelumnya supaya spasi ini tidak tertelan di bawah chord tersebut
                    if (currentChord) {
                        htmlSegment += `<span class="lyric-segment"><span class="chord"><span data-original="${currentChord}">${currentChord}</span></span>${isChordOnlyLine ? '' : '<span class="text">&nbsp;</span>'}</span>`;
                        currentChord = '';
                    }
                    const cleanSpaces = seg.replace(/ /g, '&nbsp;');
                    htmlSegment += `<span class="lyric-segment"><span class="chord empty">${cleanSpaces}</span>${isChordOnlyLine ? '' : `<span class="text">${cleanSpaces}</span>`}</span>`;
                } else {
                    //kalau segmen ini adalah TEKS LIRIK
                    const cleanText = seg.replace(/ /g, '&nbsp;'); //jaga spasinya tetep utuh
                    if (currentChord || cleanText) {
                        htmlSegment += `<span class="lyric-segment">`;
                        if (currentChord) {
                            //tempelin chord-nya di atas teks ini. 
                            //data-original penting banget buat patokan kalau kita mau nge-transpose (naikin/turunin nada)
                            htmlSegment += `<span class="chord"><span data-original="${currentChord}">${currentChord}</span></span>`;
                            currentChord = '';
                        } else {
                            htmlSegment += `<span class="chord empty"></span>`;
                        }
                        htmlSegment += `<span class="text">${cleanText || '&nbsp;'}</span></span>`;
                    }
                }
            });

            //kalau pas habis baca satu baris eh chord-nya nyisa (biasanya buat out-ro), cetak aja
            if (currentChord) {
                htmlSegment += `<span class="lyric-segment"><span class="chord"><span data-original="${currentChord}">${currentChord}</span></span>${isChordOnlyLine ? '' : '<span class="text">&nbsp;</span>'}</span>`;
            }

            html += `${htmlSegment}</div>`;
        }

        html += `</div>`;
        sectionCount++;
    });

    return { html, jumpLinks };
}

//pasang fungsi interaktif (diklik/diubah)
function setupInteractions(songId) {
    //logika buat nyembunyiin chord (tombol mata)
    const toggleBtn = document.getElementById('toggleChordBtn');
    const chordIcon = document.getElementById('chordIcon');
    const lyricsContainer = document.getElementById('lyricsContainer');
    let chordsVisible = true; //state bawaan: chord nyala

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            chordsVisible = !chordsVisible;
            if (chordsVisible) {
                //munculin chord dan ganti icon jadi mata kebuka (eye-slash artinya dicoret)
                lyricsContainer.classList.remove('hide-chords');
                chordIcon.classList.remove('ph-eye');
                chordIcon.classList.add('ph-eye-slash');
            } else {
                //sembunyiin chord pake CSS (ada class hide-chords) dan icon mata biasa
                lyricsContainer.classList.add('hide-chords');
                chordIcon.classList.remove('ph-eye-slash');
                chordIcon.classList.add('ph-eye');
            }
        });
    }

    //tombol delete (merah) di pojok
    const deleteBtn = document.querySelector('.btn-delete-filled');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const confirmDelete = confirm("Apakah Anda yakin ingin menghapus lagu ini?");
            if (confirmDelete) {
                try {
                    //panggil API delete dengan ID lagu
                    const res = await fetch(`/api/lagu/${songId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('Gagal menghapus lagu');
                    window.location.href = '/bank-lagu'; //balik ke beranda
                } catch (err) {
                    alert(err.message);
                }
            }
        });
    }

    //fitur "Loncat ke..." (smooth scroll dari sidebar lirik)
    //kenapa pasang di document? soalnya listnya digenerate lewat JS (dinamis), jadi aman kalo pake "event delegation"
    document.addEventListener('click', (e) => {
        //cek apa yang diklik itu tag link (A) yang ada di dalem blok .jump-list
        if (e.target.tagName === 'A' && e.target.closest('.jump-list')) {
            e.preventDefault(); //jangan lakuin aksi default dari link (refresh)
            const targetId = e.target.getAttribute('href').substring(1); //ambil '#verse1' buang pagar jadi 'verse1'
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                //scroll smooth ke tujuan
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    //fitur transpose (ubah nada)
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const transposeSelect = document.querySelector('.transpose-select');

    //fungsi kecil pembantu buat naikin/turunin satu buah chord berdasar jarak step-nya
    function transposeChord(chord, steps) {
        //potong nada dasarnya dari jenisnya. misal: C#m -> C# (root) dan m (suffix)
        const match = chord.match(/^([A-G][#b]?)(.*)$/);
        if (!match) return chord; //kalau bukan chord, balikin aslinya

        let root = match[1];
        const suffix = match[2];

        //posisi root ini di piano ada di index ke berapa?
        let index = NOTES.indexOf(root);
        if (index === -1) return chord;

        //hitung index nada baru (naik atau turun 'steps' jarak), % 12 biar muter terus di keyboard
        let newIndex = (index + steps) % 12;
        if (newIndex < 0) newIndex += 12; //handle negatif (mundur)

        //balikin root baru ditempel suffix-nya (misal: F# + m)
        return NOTES[newIndex] + suffix;
    }

    if (transposeSelect) {
        //kalo pilihan dropdown berubah...
        transposeSelect.addEventListener('change', (e) => {
            const selectedKey = e.target.value; //nada tujuan, e.g. "G"
            const originalKey = currentSong.nada_dasar || 'C'; //nada awal, e.g. "C"

            //jaraknya berapa nada?
            const originalIndex = NOTES.indexOf(originalKey);
            const selectedIndex = NOTES.indexOf(selectedKey);
            const steps = selectedIndex - originalIndex;

            //cari semua chord di halaman
            const chordSpans = document.querySelectorAll('.chord span');
            chordSpans.forEach(span => {
                //ambil nada aslinya dari atribut yang tadi disiapin pas ngerender HTML
                const originalChord = span.getAttribute('data-original');

                //kasus spesial: chord bass (misal D/F#)
                if (originalChord.includes('/')) {
                    const parts = originalChord.split('/'); //pecah jadi D dan F#
                    const tRoot = transposeChord(parts[0], steps); //transpose D
                    const tBass = transposeChord(parts[1], steps); //transpose F#
                    span.textContent = `${tRoot}/${tBass}`;
                } else {
                    //kasus biasa
                    span.textContent = transposeChord(originalChord, steps);
                }
            });
        });
    }
}
