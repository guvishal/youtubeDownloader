from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import os
import uuid
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# Make sure static and downloads directories exist
os.makedirs("static", exist_ok=True)
os.makedirs("downloads", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

class URLRequest(BaseModel):
    url: str

@app.post("/api/info")
async def get_video_info(req: URLRequest):
    url = req.url
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=False)
            
            # Extract basic info
            title = info_dict.get('title', 'Unknown Title')
            thumbnail = info_dict.get('thumbnail', '')
            duration = info_dict.get('duration', 0)

            # Filter formats
            formats = info_dict.get('formats', [])
            video_formats = []
            audio_formats = []

            for f in formats:
                # Video format
                if f.get('vcodec') != 'none':
                    # Filter for mp4 only videos
                    if f.get('ext') == 'mp4':
                        video_formats.append({
                            'format_id': f.get('format_id'),
                            'ext': f.get('ext'),
                            'resolution': f.get('resolution') or f"{f.get('width')}x{f.get('height')}",
                            'fps': f.get('fps'),
                            'filesize': f.get('filesize') or f.get('filesize_approx'),
                            'note': f.get('format_note', ''),
                            'has_audio': f.get('acodec') != 'none'
                        })
                # Audio format
                if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                    audio_formats.append({
                        'format_id': f.get('format_id'),
                        'ext': f.get('ext'),
                        'abr': f.get('abr'),
                        'filesize': f.get('filesize') or f.get('filesize_approx')
                    })
            
            # Remove formats without filesize for cleaner sorting, or treat as 0
            def get_filesize(x):
                val = x.get('filesize')
                return val if isinstance(val, (int, float)) else 0
                
            video_formats = sorted(video_formats, key=get_filesize, reverse=True)
            audio_formats = sorted(audio_formats, key=get_filesize, reverse=True)

            return {
                "title": title,
                "thumbnail": thumbnail,
                "duration": duration,
                "video_formats": video_formats,
                "audio_formats": audio_formats
            }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/download")
async def download_video(url: str, format_id: str = None, is_audio: bool = False):
    temp_id = str(uuid.uuid4())
    
    if is_audio:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': f'downloads/{temp_id}.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': True,
            'ffmpeg_location': '/opt/homebrew/bin/ffmpeg',
        }
    else:
        # User specified a format_id for the video
        if format_id:
            format_str = f'{format_id}+bestaudio[ext=m4a]/bestvideo+bestaudio/best'
        else:
            format_str = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            
        ydl_opts = {
            'format': format_str,
            'outtmpl': f'downloads/{temp_id}.%(ext)s',
            'merge_output_format': 'mp4',
            'quiet': True,
            'ffmpeg_location': '/opt/homebrew/bin/ffmpeg',
        }

    try:
        def run_dl():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get('title', 'Video')
                safe_title = "".join([c for c in title if c.isalnum() or c in " -_"]).strip()
                if not safe_title:
                    safe_title = "download"
                return ydl.prepare_filename(info), safe_title
        
        filepath, title = await asyncio.to_thread(run_dl)
        
        # Audio extraction changes the extension to mp3
        if is_audio:
            filepath = filepath.rsplit('.', 1)[0] + '.mp3'
            ext = 'mp3'
        else:
            ext = 'mp4'

        if not os.path.exists(filepath):
            # Sometimes ffmpeg fails to merge, fallback
            files = os.listdir('downloads')
            for f in files:
                if temp_id in f:
                    filepath = os.path.join('downloads', f)
                    if filepath.endswith('.mkv') or filepath.endswith('.webm'):
                        ext = filepath.split('.')[-1]
                    break

        if not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail="Download failed to generate file.")

        filename = f"{title}.{ext}"
        from starlette.background import BackgroundTask
        
        def cleanup():
            try:
                # Keep file in the directory
                # os.remove(filepath)
                pass
            except Exception:
                pass
                
        return FileResponse(filepath, media_type='application/octet-stream', filename=filename, background=BackgroundTask(cleanup))
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
