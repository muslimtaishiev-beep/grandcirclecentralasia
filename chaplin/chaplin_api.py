import os
import sys
import time
import tempfile
import traceback

# Fix working directory so config and model files are found regardless of launch location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

import torch
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Chaplin Visual Speech Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vsr_pipeline = None
startup_error = None
startup_info = {}

@app.on_event("startup")
def load_vsr_model():
    global vsr_pipeline, startup_error, startup_info
    import subprocess
    import urllib.request

    device_str = "cuda:0" if torch.cuda.is_available() else "cpu"
    device = torch.device(device_str)
    startup_info["device"] = device_str
    startup_info["cwd"] = os.getcwd()
    print(f"🧠 [STARTUP] cwd={os.getcwd()}, device={device_str}")

    # Ensure directories
    os.makedirs("benchmarks/LRS3/language_models/lm_en_subword/", exist_ok=True)
    os.makedirs("benchmarks/LRS3/models/LRS3_V_WER19.1/", exist_ok=True)

    lm_json = "benchmarks/LRS3/language_models/lm_en_subword/model.json"
    model_json = "benchmarks/LRS3/models/LRS3_V_WER19.1/model.json"
    lm_pth = "benchmarks/LRS3/language_models/lm_en_subword/model.pth"
    lrs3_pth = "benchmarks/LRS3/models/LRS3_V_WER19.1/model.pth"

    # Auto-fetch missing config json files
    for path, url in [
        (lm_json, "https://huggingface.co/Amanvir/lm_en_subword/resolve/main/model.json"),
        (model_json, "https://huggingface.co/Amanvir/LRS3_V_WER19.1/resolve/main/model.json"),
    ]:
        if not os.path.exists(path) or os.path.getsize(path) < 10:
            print(f"📥 Fetching {path}...")
            try:
                urllib.request.urlretrieve(url, path)
            except Exception as e:
                print(f"⚠️ Failed to fetch {path}: {e}")

    # Auto-fetch missing weight files
    for path, url, min_mb in [
        (lm_pth, "https://huggingface.co/Amanvir/lm_en_subword/resolve/main/model.pth", 10),
        (lrs3_pth, "https://huggingface.co/Amanvir/LRS3_V_WER19.1/resolve/main/model.pth", 50),
    ]:
        exists = os.path.exists(path)
        size_mb = os.path.getsize(path) / (1024*1024) if exists else 0
        startup_info[path] = f"exists={exists}, size={size_mb:.1f}MB"
        if not exists or size_mb < min_mb:
            print(f"📥 Fetching {path} (need >{min_mb}MB, have {size_mb:.1f}MB)...")
            subprocess.run(["curl", "-L", url, "-o", path])
            size_mb = os.path.getsize(path) / (1024*1024) if os.path.exists(path) else 0
            startup_info[path] = f"exists=True, size={size_mb:.1f}MB (after download)"

    config_filename = "./configs/LRS3_V_WER19.1.ini"
    startup_info["config_exists"] = os.path.exists(config_filename)

    try:
        from pipelines.pipeline import InferencePipeline
        vsr_pipeline = InferencePipeline(
            config_filename,
            device=device,
            detector="mediapipe",
            face_track=True
        )
        startup_info["status"] = "SUCCESS"
        print(f"✅ [SUCCESS] Chaplin VSR loaded on {device_str}!")
    except Exception as e:
        startup_error = traceback.format_exc()
        startup_info["status"] = "FAILED"
        startup_info["error"] = str(e)
        print(f"⚠️ [ERROR] {e}")
        traceback.print_exc()


@app.get("/api/vsr/status")
def get_status():
    """Diagnostic endpoint — open this URL in your browser to see exactly what went wrong."""
    return {
        "model_loaded": vsr_pipeline is not None,
        "startup_info": startup_info,
        "startup_error": startup_error,
    }


@app.post("/api/vsr/decode")
async def decode_video(video: UploadFile = File(...)):
    if vsr_pipeline is None:
        return {"success": False, "error": "VSR Model not initialized", "text": "", "debug": startup_error or "unknown"}

    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            content = await video.read()
            tmp.write(content)
            tmp_path = tmp.name

        raw_text = vsr_pipeline(tmp_path)

        try:
            os.remove(tmp_path)
        except Exception:
            pass

        return {
            "success": True,
            "text": raw_text.strip() if raw_text else "",
            "confidence": 90 if raw_text else 0
        }
    except Exception as e:
        return {"success": False, "error": str(e), "text": ""}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
