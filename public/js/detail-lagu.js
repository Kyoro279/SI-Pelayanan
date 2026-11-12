//variabel global buat nyimpen data lagu yang sedang dibuka
let currentSong = null;
//status hak akses user untuk mengedit atau menghapus lagu
let canManageLagu = false;
//daftar urutan 12 nada untuk fitur transpose chord
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
//pemetaan nada mol (flat) ke kres (sharp) supaya transpose tetap jalan untuk semua nada
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

//jalankan inisialisasi saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', async () => {
    //tunggu proses autentikasi dari layout.js selesai
    if (window.authReady) {
        await window.authReady;
    }

    //cek role user yang sedang login untuk menentukan hak akses edit/hapus
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    canManageLagu = window.isSuperAdmin || role === 'admin' || role === 'music director';

    //ambil parameter id lagu dan parameter jadwal (jika dibuka dari setlist jadwal)
    const urlParams = new URLSearchParams(window.location.search);
    const songId = urlParams.get('id');
    const jadwalId = urlParams.get('jadwal_id');
    const songIndexStr = urlParams.get('index');

    //kalau id lagu tidak ada di URL, kembalikan ke halaman bank lagu
    if (!songId) {
        alert('ID Lagu tidak ditemukan!');
        window.location.href = '/bank-lagu';
        return;
    }

    //ambil detail lagu dari server dan pasang event tombol-tombol halaman
    await fetchSongDetail(songId);
    setupInteractions(songId);

    //kalau dibuka dari daftar lagu di jadwal pelayanan, aktifkan tampilan mode setlist
    if (jadwalId) {
        await handleSetlistMode(jadwalId, songIndexStr);
    }
});

//fungsi buat mengatur navigasi setlist saat lagu dibuka dari halaman detail jadwal
async function handleSetlistMode(jadwalId, songIndexStr) {
    try {
        //ambil data jadwal pelayanan untuk melihat urutan daftar lagunya
        const res = await fetch(`/api/jadwal/${jadwalId}`);
        const { data } = await res.json();

        if (!data || !data.daftar_lagu) return;

        const index = parseInt(songIndexStr);
        const daftar = data.daftar_lagu;

        //ubah fungsi tombol kembali supaya mengarah balik ke halaman detail jadwal
        const btnBack = document.getElementById('btn-back-lagu');
        const backText = document.getElementById('back-text');
        if (btnBack) {
            btnBack.removeAttribute('onclick');
            btnBack.onclick = () => window.location.href = `/detail-jadwal.html?id=${jadwalId}`;
        }
        if (backText) backText.style.display = 'inline';

        //tandai menu aktif di sidebar menjadi menu jadwal
        document.body.setAttribute('data-active', 'jadwal');

        //munculkan bar informasi setlist di bagian atas halaman
        const setlistBar = document.getElementById('setlist-bar');
        if (setlistBar) setlistBar.style.display = 'flex';

        //isi nama jadwal dan tanggal pelayanan pada bar setlist
        const setlistTitle = document.getElementById('setlist-title');
        const setlistDate = document.getElementById('setlist-date');
        if (setlistTitle) setlistTitle.textContent = data.tema_kotbah || data.judul || '-';

        if (setlistDate && data.tanggal) {
            const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const d = new Date(data.tanggal);
            setlistDate.textContent = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
        }

        //atur tombol navigasi lagu sebelumnya (prev) dan selanjutnya (next)
        const btnPrev = document.getElementById('btn-setlist-prev');
        const btnNext = document.getElementById('btn-setlist-next');

        //aktifkan tombol prev kalau bukan lagu urutan pertama
        if (btnPrev) {
            if (index > 0) {
                const prevId = daftar[index - 1].id_lagu || daftar[index - 1].id;
                btnPrev.onclick = () => window.location.href = `/detail-lagu.html?id=${prevId}&jadwal_id=${jadwalId}&index=${index - 1}`;
                btnPrev.style.color = 'var(--primary-color)';
                btnPrev.style.cursor = 'pointer';
            } else {
                btnPrev.style.color = '#cbd5e0';
                btnPrev.style.cursor = 'not-allowed';
            }
        }

        //aktifkan tombol next kalau masih ada lagu berikutnya di setlist
        if (btnNext) {
            if (index < daftar.length - 1) {
                const nextId = daftar[index + 1].id_lagu || daftar[index + 1].id;
                btnNext.onclick = () => window.location.href = `/detail-lagu.html?id=${nextId}&jadwal_id=${jadwalId}&index=${index + 1}`;
                btnNext.style.background = 'var(--primary-color)';
                btnNext.style.cursor = 'pointer';
            } else {
                btnNext.style.background = '#cbd5e0';
                btnNext.style.cursor = 'not-allowed';
            }
        }

        //otomatis ubah transpose jika nada dasar di setlist jadwal berbeda dengan nada asli lagu
        const rawTargetKey = (daftar[index].nada_dasar || '').trim();
        const targetKey = FLAT_TO_SHARP[rawTargetKey] || rawTargetKey;
        const rawSongKey = (currentSong.nada_dasar || '').trim();
        const songKey = FLAT_TO_SHARP[rawSongKey] || rawSongKey;
        const transposeSelect = document.querySelector('.transpose-select');
        if (targetKey && transposeSelect && targetKey !== songKey) {
            transposeSelect.value = targetKey;
            transposeSelect.dispatchEvent(new Event('change'));
        }
    } catch (err) {
        console.error('Setlist mode error:', err);
    }
}

//fungsi buat mengambil data detail satu lagu dari backend API
async function fetchSongDetail(id) {
    try {
        const res = await fetch(`/api/lagu/${id}`);
        if (!res.ok) throw new Error('Lagu tidak ditemukan');
        const { data } = await res.json();
        //simpan ke variabel global lalu render ke halaman
        currentSong = data;
        renderSongDetail();
    } catch (err) {
        alert(err.message);
        window.location.href = '/bank-lagu';
    }
}

//fungsi buat mengisi seluruh elemen halaman detail lagu dari data currentSong
function renderSongDetail() {
    if (!currentSong) return;

    //siapkan data judul, penyanyi, id, dan nada dasar asli
    const title = currentSong.judul_lagu || currentSong.judul || 'Tanpa Judul';
    const artist = currentSong.pengarang || currentSong.penyanyi || 'Unknown Artist';
    const songId = currentSong.id_lagu || currentSong.id;
    const key = (currentSong.nada_dasar || '').trim() || '-';

    //tampilkan judul lagu dan nama penyanyi di bagian header
    const titleEl = document.querySelector('.song-title-large');
    const artistEl = document.querySelector('.song-artist-large');
    if (titleEl) titleEl.textContent = title;
    if (artistEl) artistEl.textContent = artist;
    document.title = `${title} - KITTEENS HUB`;

    //atur visibilitas tombol edit dan hapus sesuai hak akses role
    const btnEdit = document.querySelector('.btn-edit');
    const btnDelete = document.querySelector('.btn-delete-filled');
    if (canManageLagu) {
        if (btnEdit) btnEdit.onclick = () => window.location.href = `/edit-lagu?id=${songId}`;
    } else {
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    }

    //tampilkan nada dasar original
    const originalKeyEl = document.querySelector('.control-value');
    if (originalKeyEl) originalKeyEl.textContent = key;

    //buat daftar pilihan nada pada dropdown transpose
    const transposeSelect = document.querySelector('.transpose-select');
    const normalizedKey = FLAT_TO_SHARP[key] || key;
    const originalKey = normalizedKey !== '-' ? normalizedKey : 'C';
    if (transposeSelect) {
        transposeSelect.innerHTML = '';
        NOTES.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            option.textContent = note;
            if (note === originalKey) option.selected = true;
            transposeSelect.appendChild(option);
        });
    }

    //pasang link dan gambar thumbnail video youtube jika tersedia
    const videoLink = document.querySelector('.video-thumbnail-link');
    const videoThumbnail = document.querySelector('.video-thumbnail');
    if (currentSong.link_youtube) {
        videoLink.href = currentSong.link_youtube;
        const videoId = extractYouTubeId(currentSong.link_youtube);
        if (videoId) {
            videoThumbnail.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`;
        }
    } else if (videoLink) {
        videoLink.style.display = 'none';
    }

    //ubah teks chord & lirik mentah menjadi elemen HTML dan daftar pintasan section
    const lyricsContainer = document.getElementById('lyricsContainer');
    const jumpList = document.querySelector('.jump-list');
    if (lyricsContainer && jumpList && currentSong.chord_lirik) {
        const { html, jumpLinks } = parseLyricsToHtml(currentSong.chord_lirik);
        lyricsContainer.innerHTML = html;
        jumpList.innerHTML = jumpLinks;
    }
}

//fungsi bantu buat mengambil 11 karakter ID video dari link youtube
function extractYouTubeId(url) {
    if (!url) return null;
    //ambil ID setelah parameter v=, youtu.be/, atau embed/
    if (url.includes('v=')) return url.split('v=')[1].substring(0, 11);
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].substring(0, 11);
    if (url.includes('embed/')) return url.split('embed/')[1].substring(0, 11);
    return null;
}

//fungsi bantu buat mengecek apakah satu baris hanya berisi kumpulan chord (contoh: "C G D/F# Em")
function isChordLine(line) {
    if (line.includes('[') || line.includes(']')) return false;
    const words = line.trim().split(/\s+/);
    if (!words[0]) return false;
    const polaChord = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|[0-9])*(\/[A-G][#b]?)?$/;
    return words.every(word => polaChord.test(word));
}

//fungsi bantu buat mencatat setiap chord beserta posisi index spasinya di dalam satu baris chord
function getChordPositions(chordLine) {
    const list = [];
    let pos = 0;
    while (pos < chordLine.length) {
        if (chordLine[pos] === ' ') {
            pos++;
        } else {
            let end = pos;
            while (end < chordLine.length && chordLine[end] !== ' ') {
                end++;
            }
            list.push({ chord: chordLine.slice(pos, end), index: pos });
            pos = end;
        }
    }
    return list;
}

//fungsi buat merangkai elemen HTML pasangan chord di atas dan potongan lirik di bawah
function buatSegmen(chord, text = '&nbsp;', isChordOnly = false) {
    const chordHtml = chord
        ? `<span class="chord"><span data-original="${chord}">${chord}</span></span>`
        : `<span class="chord empty">${isChordOnly ? text : ''}</span>`;
    const textHtml = isChordOnly ? '' : `<span class="text">${text}</span>`;
    return `<span class="lyric-segment">${chordHtml}${textHtml}</span>`;
}

//fungsi buat mengubah teks chord & lirik dari database menjadi struktur HTML
function parseLyricsToHtml(rawLyrics) {
    //pecah lirik per bagian (intro, verse, chorus) berdasarkan baris kosong
    const blocks = rawLyrics.split(/\n\s*\n/);
    let html = '';
    let jumpLinks = '';
    let sectionCount = 0;

    blocks.forEach(block => {
        if (!block.trim()) return;

        //pecah blok menjadi array per baris
        const lines = block.split('\n');
        let sectionTitle = '';
        const sectionId = `section-${sectionCount}`;
        let startIndex = 0;

        //cek apakah baris pertama adalah judul bagian seperti [Intro] atau [Chorus]
        const firstLine = lines[0].trim();
        if ((firstLine.startsWith('[') && firstLine.endsWith(']')) || (firstLine.startsWith('(') && firstLine.endsWith(')'))) {
            sectionTitle = firstLine;
            startIndex = 1;
            //tambahkan ke daftar menu jump to section di sebelah kanan
            jumpLinks += `<li><a href="#${sectionId}">${firstLine.slice(1, -1)}</a></li>`;
        }

        //mulai bungkus satu bagian lirik
        html += `<div class="lyrics-section" id="${sectionId}">`;
        if (sectionTitle) {
            html += `<div class="section-title">${sectionTitle}</div>`;
        }

        //proses setiap baris di dalam bagian ini
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].replace(/\r$/, '');
            if (!line.trim()) continue;

            //kalau baris ini adalah baris chord, pasangkan dengan baris lirik di bawahnya (jika ada)
            if (isChordLine(line)) {
                const nextLine = (i + 1 < lines.length) ? lines[i + 1].replace(/\r$/, '') : '';
                const nextTrim = nextLine.trim();
                const isNextSection = (nextTrim.startsWith('[') && nextTrim.endsWith(']')) || (nextTrim.startsWith('(') && nextTrim.endsWith(')'));
                const hasLyricBelow = nextTrim !== '' && !isChordLine(nextLine) && !isNextSection;

                const isChordOnly = !hasLyricBelow;
                //samakan panjang lirik dengan baris chord supaya pemotongan index karakter pas
                const paddedLyric = (hasLyricBelow ? nextLine : '').padEnd(line.length, ' ');
                const chords = getChordPositions(line);
                let htmlSegment = '';

                //kalau ada teks lirik atau spasi sebelum chord pertama muncul (contoh: "Bless the " sebelum chord C)
                if (chords.length > 0 && chords[0].index > 0) {
                    const awalText = paddedLyric.slice(0, chords[0].index).replace(/ /g, '&nbsp;');
                    htmlSegment += buatSegmen('', awalText, isChordOnly);
                }

                //potong baris lirik tepat mengikuti posisi index masing-masing chord di atasnya
                chords.forEach((item, idx) => {
                    const start = item.index;
                    const end = (idx + 1 < chords.length) ? chords[idx + 1].index : paddedLyric.length;
                    const sliceText = paddedLyric.slice(start, end);

                    if (sliceText.trim() === '') {
                        //kalau di bawah chord kosong (seperti pada intro atau ujung lirik), cetak chord beserta jarak spasinya
                        htmlSegment += buatSegmen(item.chord, '&nbsp;', isChordOnly);
                        const spaceCount = end - (start + item.chord.length);
                        if (spaceCount > 0) {
                            htmlSegment += buatSegmen('', '&nbsp;'.repeat(spaceCount), isChordOnly);
                        }
                    } else {
                        //tempatkan chord tepat di atas potongan huruf lirik yang sejajar dengan indexnya
                        htmlSegment += buatSegmen(item.chord, sliceText.replace(/ /g, '&nbsp;'), false);
                    }
                });

                html += `<div class="lyric-line${isChordOnly ? ' chord-only' : ''}">${htmlSegment}</div>`;
                //lompati baris lirik di bawahnya karena sudah digabung dengan baris chord ini
                if (hasLyricBelow) i++;
            } else {
                //kalau baris ini hanya lirik biasa tanpa baris chord di atasnya
                html += `<div class="lyric-line">${buatSegmen('', line.replace(/ /g, '&nbsp;'), false)}</div>`;
            }
        }

        html += `</div>`;
        sectionCount++;
    });

    return { html, jumpLinks };
}

//fungsi buat memasang interaksi tombol hide chord, hapus lagu, jump section, dan transpose
function setupInteractions(songId) {
    //fitur tampilkan atau sembunyikan chord saat tombol mata diklik
    const toggleBtn = document.getElementById('toggleChordBtn');
    const chordIcon = document.getElementById('chordIcon');
    const lyricsContainer = document.getElementById('lyricsContainer');
    let chordsVisible = true;

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            chordsVisible = !chordsVisible;
            lyricsContainer.classList.toggle('hide-chords', !chordsVisible);
            chordIcon.className = chordsVisible ? 'ph ph-eye-slash' : 'ph ph-eye';
        });
    }

    //fitur hapus lagu saat tombol tempat sampah merah diklik
    const deleteBtn = document.querySelector('.btn-delete-filled');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm('Apakah Anda yakin ingin menghapus lagu ini?')) return;
            try {
                const res = await fetch(`/api/lagu/${songId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Gagal menghapus lagu');
                window.location.href = '/bank-lagu';
            } catch (err) {
                alert(err.message);
            }
        });
    }

    //fitur scroll halus ke bagian lagu tertentu saat link di kotak jump to section diklik
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.closest('.jump-list')) {
            e.preventDefault();
            const targetId = e.target.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    //fungsi bantu buat menggeser satu nada chord sebanyak jumlah step transpose
    function transposeChord(chord, steps) {
        if (!chord) return chord;
        //pisahkan nada dasar (misal C#, Eb, atau G) dengan akhiran chordnya (misal m, sus4, atau 7)
        const isSharpOrFlat = chord[1] === '#' || chord[1] === 'b';
        const rawRoot = isSharpOrFlat ? chord.slice(0, 2) : chord[0];
        const root = FLAT_TO_SHARP[rawRoot] || rawRoot;
        const suffix = isSharpOrFlat ? chord.slice(2) : chord.slice(1);

        //cari posisi nada dasar pada array NOTES lalu geser sesuai selisih step
        const index = NOTES.indexOf(root);
        if (index === -1) return chord;

        const newIndex = (index + steps + 12) % 12;
        return NOTES[newIndex] + suffix;
    }

    //fitur transpose untuk mengubah seluruh chord di halaman saat dropdown nada diubah
    const transposeSelect = document.querySelector('.transpose-select');
    if (transposeSelect) {
        transposeSelect.addEventListener('change', (e) => {
            //hitung jarak perpindahan dari nada dasar asli ke nada dasar tujuan
            const selectedKey = e.target.value;
            const rawOriginalKey = (currentSong.nada_dasar || '').trim() || 'C';
            const originalKey = FLAT_TO_SHARP[rawOriginalKey] || rawOriginalKey;
            const steps = NOTES.indexOf(selectedKey) - NOTES.indexOf(originalKey);

            //ubah teks setiap elemen chord berdasarkan atribut data-original
            document.querySelectorAll('.chord span').forEach(span => {
                const originalChord = span.getAttribute('data-original');
                //kalau chord memiliki nada bass (slash chord seperti D/F# atau C/G), transpose keduanya
                if (originalChord.includes('/')) {
                    const parts = originalChord.split('/');
                    span.textContent = `${transposeChord(parts[0], steps)}/${transposeChord(parts[1], steps)}`;
                } else {
                    span.textContent = transposeChord(originalChord, steps);
                }
            });
        });
    }
}
