// scripts/notify-indexnow.js
import fetch from 'node-fetch';
import fs from 'fs/promises'; // Using fs/promises for asynchronous file operations
import path from 'path';     // <--- ENSURE THIS LINE IS PRESENT AND CORRECT
import { fileURLToPath } from 'url';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // 'path' is used here

// --- Konfigurasi Anda ---
const YOUR_DOMAIN = 'https://bokepjepangindo.pages.dev'; // Ganti dengan domain Anda yang sebenarnya
const API_KEY_NAME = '8a25e954-979f-4f37-a7d5-86c8dc0443a6'; // Ganti dengan GUID Anda
const API_KEY_LOCATION = `${YOUR_DOMAIN}/${API_KEY_NAME}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
// --- Akhir Konfigurasi ---

// Path langsung ke file videos.json Anda
const VIDEOS_JSON_PATH = path.resolve(__dirname, '../src/data/videos.json');
// Path ke cache URL terakhir yang dikirim (akan disimpan di root proyek)
const LAST_SENT_URLS_CACHE = path.resolve(__dirname, '../.indexnow_cache.json');

/**
 * Fungsi untuk mendapatkan semua URL video dari file videos.json.
 * Menggunakan fs.readFile untuk kompatibilitas yang lebih luas.
 */
async function getAllVideoUrls() {
    try {
        // Baca konten file JSON sebagai string
        const fileContent = await fs.readFile(VIDEOS_JSON_PATH, 'utf-8');
        // Parse string JSON menjadi objek JavaScript
        const allVideos = JSON.parse(fileContent);

        if (!Array.isArray(allVideos)) {
            console.error('Data videos.json tidak dalam format array yang diharapkan.');
            return [];
        }

        // Fungsi slugify dasar, bisa disesuaikan jika Anda punya implementasi yang lebih kompleks
        const slugify = (text) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        return allVideos.map(video => {
            const slug = slugify(video.title);
            return `${YOUR_DOMAIN}/${slug}-${video.id}/`;
        });
    } catch (error) {
        console.error('Gagal memuat atau memproses videos.json:', error);
        return [];
    }
}

/**
 * Mengirim daftar URL ke IndexNow API.
 * Mendukung pengiriman chunking jika daftar URL sangat panjang.
 */
async function sendToIndexNow(urlsToSend) {
    if (urlsToSend.length === 0) {
        console.log('Tidak ada URL baru atau yang diperbarui untuk dikirim ke IndexNow.');
        return;
    }

    // Batasan IndexNow API adalah 10.000 URL per permintaan
    const chunkSize = 10000; 
    for (let i = 0; i < urlsToSend.length; i += chunkSize) {
        const chunk = urlsToSend.slice(i, i + chunkSize);

        const payload = {
            host: new URL(YOUR_DOMAIN).hostname,
            key: API_KEY_NAME,
            keyLocation: API_KEY_LOCATION,
            urlList: chunk,
        };

        try {
            console.log(`Mengirim ${chunk.length} URL ke IndexNow (chunk ${Math.floor(i / chunkSize) + 1})...`);
            const response = await fetch(INDEXNOW_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log(`Berhasil mengirim chunk URL ke IndexNow. Status: ${response.status}`);
            } else {
                console.error(`Gagal mengirim chunk URL ke IndexNow: ${response.status} - ${response.statusText}`);
                const errorBody = await response.text();
                console.error('Response body:', errorBody);
            }
        } catch (error) {
            console.error('Terjadi kesalahan saat mengirim ke IndexNow:', error);
        }
    }
}

/**
 * Fungsi utama yang mengelola proses notifikasi IndexNow.
 * Membandingkan URL saat ini dengan cache URL sebelumnya untuk mengirim hanya yang baru/diperbarui.
 */
async function main() {
    const currentUrls = await getAllVideoUrls();
    let lastSentUrls = [];

    try {
        const cacheContent = await fs.readFile(LAST_SENT_URLS_CACHE, 'utf-8');
        lastSentUrls = JSON.parse(cacheContent);
    } catch (error) {
        // File cache belum ada atau rusak, ini normal untuk pertama kali
        console.log('Cache IndexNow tidak ditemukan atau rusak, akan mengirim semua URL baru.');
    }

    // Filter URL yang benar-benar baru atau belum pernah dikirim
    const urlsToSubmit = currentUrls.filter(url => !lastSentUrls.includes(url));

    await sendToIndexNow(urlsToSubmit);

    // Setelah semua pengiriman selesai, perbarui cache dengan URL yang saat ini ada di situs.
    try {
        await fs.writeFile(LAST_SENT_URLS_CACHE, JSON.stringify(currentUrls), 'utf-8');
        console.log('Cache IndexNow berhasil diperbarui.');
    } catch (error) {
        console.error('Gagal memperbarui cache IndexNow:', error);
    }
}

// Jalankan fungsi utama
main();