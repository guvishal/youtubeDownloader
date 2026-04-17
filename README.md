# HD TubeDownloader

A high-performance, modern YouTube Downloader web application built with Python (FastAPI) on the backend and native HTML5/CSS3/JS on the frontend. 

It allows you to download YouTube videos in their highest possible HD qualities (which splits video/audio streams natively) and seamlessly merges them together using `yt-dlp` and `ffmpeg`. It also provides an option to extract just the MP3 audio.

## Prerequisites

Before running the application, make sure you have the following installed:
- Python 3.8+
- [FFmpeg](https://ffmpeg.org/download.html) (Core requirement for merging HD streams)

**For MacOS Users:**
You can easily install FFmpeg using Homebrew:
```bash
brew install ffmpeg
```
*(Note: If you are running on a different OS or architecture, you may need to update the `ffmpeg_location` path located inside `main.py`).*

## Setup Instructions

1. **Activate the Virtual Environment:**
   ```bash
   source venv/bin/activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

To start the local Uvicorn server, simply run:

```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

*(Alternatively, you can just run `source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8001` in one line).*

Once running, open your web browser and navigate to:
**http://localhost:8001**

## Features
- **Glassmorphic UI Design**: Clean, modern, responsive aesthetics using vanilla CSS and JavaScript.
- **Dynamic Format Fetching**: Instantly polls YouTube and provides a list of all available high-definition resolutions.
- **Adaptive Merging**: Securely merges separate high-resolution DASH video and audio streams seamlessly using FFmpeg.
- **Intelligent File Naming**: Extracts the true human-readable title of the YouTube video, ensuring correct UTF-8 handling and natively forcing standard `.mp4` and `.mp3` extensions.
