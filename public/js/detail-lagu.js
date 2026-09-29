// public/js/detail-lagu.js

let currentSong = null;
let canManageLagu = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inisialisasi Auth
    if (window.authReady) {
        await window.authReady;
    }

    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    canManageLagu = window.isSuperAdmin || role === 'admin' || role === 'music director';

    const urlParams = new URLSearchParams(window.location.search);
    const songId = urlParams.get('id');
    const jadwalId = urlParams.get('jadwal_id');
    const songIndexStr = urlParams.get('index');

    if (!songId) {
        alert('ID Lagu tidak ditemukan!');
        window.location.href = '/bank-lagu';
        return;
    }

    await fetchSongDetail(songId);
    setupInteractions(songId);

    if (jadwalId) {
        await handleSetlistMode(jadwalId, songIndexStr);
    }
});

async function handleSetlistMode(jadwalId, songIndexStr) {
    try {
        const res = await fetch(`/api/jadwal/${jadwalId}`);
        const { data } = await res.json();

        if (data && data.daftar_lagu) {
            const index = parseInt(songIndexStr);
            const daftar = data.daftar_lagu;

            // 1. Ganti Back Button & Sidebar
            const btnBack = document.getElementById('btn-back-lagu');
            const backText = document.getElementById('back-text');
            if (btnBack) {
                btnBack.removeAttribute('onclick');
                btnBack.onclick = () => window.location.href = `/detail-jadwal.html?id=${jadwalId}`;
            }
            if (backText) backText.style.display = 'inline';

            // Ganti sidebar aktif ke menu jadwal (sudah dihandle secara sinkron di HTML, tapi kita pastikan ulang atributnya saja)
            document.body.setAttribute('data-active', 'jadwal');

            // 2. Munculkan Setlist Bar
            const setlistBar = document.getElementById('setlist-bar');
            if (setlistBar) setlistBar.style.display = 'flex';

            const setlistTitle = document.getElementById('setlist-title');
            const setlistDate = document.getElementById('setlist-date');

            if (setlistTitle) setlistTitle.textContent = data.judul || data.tema_pelayanan;

            if (setlistDate && data.tanggal) {
                const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                const d = new Date(data.tanggal);
                setlistDate.textContent = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
            }

            // 3. Tombol Prev & Next
            const btnPrev = document.getElementById('btn-setlist-prev');
            const btnNext = document.getElementById('btn-setlist-next');

            if (btnPrev) {
                if (index > 0) {
                    btnPrev.onclick = () => window.location.href = `/detail-lagu.html?id=${daftar[index - 1].id_lagu}&jadwal_id=${jadwalId}&index=${index - 1}`;
                    btnPrev.style.color = 'var(--primary-color)';
                    btnPrev.style.cursor = 'pointer';
                } else {
                    btnPrev.style.color = '#cbd5e0';
                    btnPrev.style.cursor = 'not-allowed';
                }
            }

            if (btnNext) {
                if (index < daftar.length - 1) {
                    btnNext.onclick = () => window.location.href = `/detail-lagu.html?id=${daftar[index + 1].id_lagu}&jadwal_id=${jadwalId}&index=${index + 1}`;
                    btnNext.style.background = 'var(--primary-color)';
                    btnNext.style.cursor = 'pointer';
                } else {
                    btnNext.style.background = '#cbd5e0';
                    btnNext.style.cursor = 'not-allowed';
                }
            }

            // 4. Override Transpose sesuai nada dasar yang diset di jadwal
            const targetKey = daftar[index].nada_dasar;
            const transposeSelect = document.querySelector('.transpose-select');
            if (targetKey && transposeSelect && targetKey !== currentSong.nada_dasar) {
                transposeSelect.value = targetKey;
                transposeSelect.dispatchEvent(new Event('change'));
            }
        }
    } catch (err) {
        console.error("Setlist mode error:", err);
    }
}

async function fetchSongDetail(id) {
    try {
        const res = await fetch(`/api/lagu/${id}`);
        if (!res.ok) throw new Error('Lagu tidak ditemukan');
        const { data } = await res.json();
        currentSong = data;

        renderSongDetail();
    } catch (err) {
        alert(err.message);
        window.location.href = '/bank-lagu';
    }
}

function renderSongDetail() {
    if (!currentSong) return;

    // Header
    const titleEl = document.querySelector('.song-title-large');
    const artistEl = document.querySelector('.song-artist-large');
    if (titleEl) titleEl.textContent = currentSong.judul;
    if (artistEl) artistEl.textContent = currentSong.penyanyi || 'Unknown Artist';
    document.title = `${currentSong.judul} - KITTEENS HUB`;

    // Actions
    const btnEdit = document.querySelector('.btn-edit');
    const btnDelete = document.querySelector('.btn-delete-filled');
    if (canManageLagu) {
        if (btnEdit) {
            btnEdit.onclick = () => window.location.href = `/edit-lagu?id=${currentSong.id}`;
        }
    } else {
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    }

    // Key
    const originalKeyEl = document.querySelector('.control-value');
    if (originalKeyEl) originalKeyEl.textContent = currentSong.nada_dasar || '-';

    // Transpose Select Setup
    const transposeSelect = document.querySelector('.transpose-select');
    const originalKey = currentSong.nada_dasar || 'C'; // Default to C if none
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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

    // YouTube Video
    const videoLink = document.querySelector('.video-thumbnail-link');
    const videoThumbnail = document.querySelector('.video-thumbnail');
    if (currentSong.link_youtube) {
        videoLink.href = currentSong.link_youtube;
        const videoId = extractYouTubeId(currentSong.link_youtube);
        if (videoId) {
            videoThumbnail.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`;
        }
    } else {
        if (videoLink) videoLink.style.display = 'none';
    }

    // Parse Lyrics
    const lyricsContainer = document.getElementById('lyricsContainer');
    const jumpList = document.querySelector('.jump-list');

    if (lyricsContainer && jumpList && currentSong.chord_lirik) {
        const { html, jumpLinks } = parseLyricsToHtml(currentSong.chord_lirik);
        lyricsContainer.innerHTML = html;
        jumpList.innerHTML = jumpLinks;
    }
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function parseLyricsToHtml(rawLyrics) {
    // Memisahkan berdasarkan blok kosong (tiap section)
    const blocks = rawLyrics.split(/\n\s*\n/);
    let html = '';
    let jumpLinks = '';
    let sectionCount = 0;

    blocks.forEach(block => {
        if (!block.trim()) return;

        const lines = block.split('\n');

        // Cari nama section (misal: (Verse 1), [Chorus], dll) pada baris pertama
        let sectionTitle = '';
        let sectionId = `section-${sectionCount}`;
        let startIndex = 0;

        const firstLineMatch = lines[0].match(/^[\(\[](.+)[\)\]]$/i);
        if (firstLineMatch) {
            sectionTitle = lines[0].trim();
            sectionId = sectionTitle.replace(/[\W_]+/g, '').toLowerCase() + sectionCount;
            startIndex = 1;
        }

        if (sectionTitle) {
            jumpLinks += `<li><a href="#${sectionId}">${sectionTitle.replace(/[\(\)\[\]]/g, '')}</a></li>`;
        }

        html += `<div class="lyrics-section" id="${sectionId}">`;
        if (sectionTitle) {
            html += `<div class="section-title">${sectionTitle}</div>`;
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            html += `<div class="lyric-line">`;

            // Parsing inline chord e.g. "I love you, [G]Lord"
            const segments = line.split(/(\[[A-G][#b]?m?[0-9]*(?:\/[A-G][#b]?)?\])/g);

            let htmlSegment = '';
            let currentChord = '';

            segments.forEach(seg => {
                if (seg.startsWith('[') && seg.endsWith(']')) {
                    // Flush if there is a pending chord without text
                    if (currentChord) {
                        htmlSegment += `<span class="lyric-segment"><span class="chord"><span data-original="${currentChord}">${currentChord}</span></span><span class="text">&nbsp;</span></span>`;
                    }
                    currentChord = seg.slice(1, -1);
                } else {
                    const cleanText = seg.replace(/ /g, '&nbsp;');
                    if (currentChord || cleanText) {
                        htmlSegment += `<span class="lyric-segment">`;
                        if (currentChord) {
                            htmlSegment += `<span class="chord"><span data-original="${currentChord}">${currentChord}</span></span>`;
                            currentChord = '';
                        } else {
                            htmlSegment += `<span class="chord empty"></span>`;
                        }
                        htmlSegment += `<span class="text">${cleanText || '&nbsp;'}</span></span>`;
                    }
                }
            });

            // Flush remaining chord if end of line
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

function setupInteractions(songId) {
    // 1. Hide/Unhide Chord Logic
    const toggleBtn = document.getElementById('toggleChordBtn');
    const chordIcon = document.getElementById('chordIcon');
    const lyricsContainer = document.getElementById('lyricsContainer');
    let chordsVisible = true;

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            chordsVisible = !chordsVisible;
            if (chordsVisible) {
                lyricsContainer.classList.remove('hide-chords');
                chordIcon.classList.remove('ph-eye');
                chordIcon.classList.add('ph-eye-slash');
            } else {
                lyricsContainer.classList.add('hide-chords');
                chordIcon.classList.remove('ph-eye-slash');
                chordIcon.classList.add('ph-eye');
            }
        });
    }

    // 2. Delete Confirmation
    const deleteBtn = document.querySelector('.btn-delete-filled');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const confirmDelete = confirm("Apakah Anda yakin ingin menghapus lagu ini?");
            if (confirmDelete) {
                try {
                    const res = await fetch(`/api/lagu/${songId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('Gagal menghapus lagu');
                    window.location.href = '/bank-lagu';
                } catch (err) {
                    alert(err.message);
                }
            }
        });
    }

    // 3. Jump to Section (Smooth Scroll) - menggunakan event delegation karena elemen dinamis
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

    //4. Transpose Logic
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const transposeSelect = document.querySelector('.transpose-select');

    function transposeChord(chord, steps) {
        const match = chord.match(/^([A-G][#b]?)(.*)$/);
        if (!match) return chord;

        let root = match[1];
        const suffix = match[2];

        let index = NOTES.indexOf(root);
        if (index === -1) return chord;

        let newIndex = (index + steps) % 12;
        if (newIndex < 0) newIndex += 12;

        return NOTES[newIndex] + suffix;
    }

    if (transposeSelect) {
        transposeSelect.addEventListener('change', (e) => {
            const selectedKey = e.target.value;
            const originalKey = currentSong.nada_dasar || 'C';
            const originalIndex = NOTES.indexOf(originalKey);
            const selectedIndex = NOTES.indexOf(selectedKey);

            const steps = selectedIndex - originalIndex;

            const chordSpans = document.querySelectorAll('.chord span');
            chordSpans.forEach(span => {
                const originalChord = span.getAttribute('data-original');
                // Pisahkan kalau chord ada bass (misal C/G)
                if (originalChord.includes('/')) {
                    const parts = originalChord.split('/');
                    const tRoot = transposeChord(parts[0], steps);
                    const tBass = transposeChord(parts[1], steps);
                    span.textContent = `${tRoot}/${tBass}`;
                } else {
                    span.textContent = transposeChord(originalChord, steps);
                }
            });
        });
    }
}
