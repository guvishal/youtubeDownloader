document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('download-form');
    const urlInput = document.getElementById('youtube-url');
    const fetchBtn = document.getElementById('fetch-btn');
    const fetchLoader = document.getElementById('fetch-loader');
    const errorMessage = document.getElementById('error-message');
    const resultsSection = document.getElementById('results-section');

    const videoThumbnail = document.getElementById('video-thumbnail');
    const videoTitle = document.getElementById('video-title');
    const videoDuration = document.getElementById('video-duration');
    const videoQuality = document.getElementById('video-quality');

    const downloadVideoBtn = document.getElementById('download-video-btn');
    const dlVideoLoader = document.getElementById('dl-video-loader');
    const downloadAudioBtn = document.getElementById('download-audio-btn');
    const dlAudioLoader = document.getElementById('dl-audio-loader');

    let currentUrl = '';

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return 'N/A';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        resultsSection.classList.add('hidden');
        currentUrl = urlInput.value.trim();

        if (!currentUrl) return;

        // UI Loading State
        fetchBtn.disabled = true;
        fetchLoader.classList.remove('hidden');

        try {
            const response = await fetch('/api/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: currentUrl })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to fetch video info.');
            }

            const data = await response.json();
            
            // Populate UI
            videoThumbnail.src = data.thumbnail;
            videoTitle.textContent = data.title;
            videoDuration.textContent = formatTime(data.duration);
            
            // Populate Video Formats
            videoQuality.innerHTML = '<option value="" disabled selected>Select Quality</option>';
            
            // Remove duplicates based on resolution
            const seenRes = new Set();
            data.video_formats.forEach(format => {
                if (!seenRes.has(format.resolution)) {
                    seenRes.add(format.resolution);
                    const option = document.createElement('option');
                    option.value = format.format_id;
                    const sizeStr = format.filesize ? ` ~${formatBytes(format.filesize)}` : '';
                    option.textContent = `${format.resolution} - ${format.ext} ${sizeStr}`;
                    videoQuality.appendChild(option);
                }
            });

            if (videoQuality.options.length === 1) {
                const opt = document.createElement('option');
                opt.value = "";
                opt.textContent = "No MP4 formats found, using best available";
                videoQuality.appendChild(opt);
                videoQuality.selectedIndex = 1;
            } else {
                // Auto select first option (usually highest quality)
                videoQuality.selectedIndex = 1;
            }

            resultsSection.classList.remove('hidden');
        } catch (error) {
            showError(error.message);
        } finally {
            fetchBtn.disabled = false;
            fetchLoader.classList.add('hidden');
        }
    });

    async function handleDownload(isAudio) {
        const url = encodeURIComponent(currentUrl);
        const formatId = videoQuality.value || '';
        
        const btn = isAudio ? downloadAudioBtn : downloadVideoBtn;
        const loader = isAudio ? dlAudioLoader : dlVideoLoader;

        // UI Loading State
        btn.disabled = true;
        loader.classList.remove('hidden');
        hideError();

        try {
            let apiUrl = `/api/download?url=${url}&is_audio=${isAudio}`;
            if (!isAudio && formatId) {
                apiUrl += `&format_id=${formatId}`;
            }

            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                // Try parsing JSON error
                let errorDetails = "Download failed.";
                try {
                    const errData = await response.json();
                    errorDetails = errData.detail || errorDetails;
                } catch(e) {}
                throw new Error(errorDetails);
            }

            // Extract filename from headers if possible
            const disposition = response.headers.get('Content-Disposition');
            let filename = isAudio ? 'download.mp3' : 'download.mp4'; // Better fallback
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) { 
                    filename = matches[1].replace(/['"]/g, '');
                }
                const filenameStarRegex = /filename\*=utf-8''([^;\n]*)/i;
                const starMatches = filenameStarRegex.exec(disposition);
                if (starMatches != null && starMatches[1]) {
                    filename = decodeURIComponent(starMatches[1]);
                }
            }

            // Create blob and download link
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();

        } catch (error) {
            showError(error.message);
        } finally {
            btn.disabled = false;
            loader.classList.add('hidden');
        }
    }

    downloadVideoBtn.addEventListener('click', () => handleDownload(false));
    downloadAudioBtn.addEventListener('click', () => handleDownload(true));
});
