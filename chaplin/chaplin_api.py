import os
import sys
import time
import tempfile
import torch

# Fix working directory so config and model files are found regardless of launch location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pipelines.pipeline import InferencePipeline

app = FastAPI(title="Chaplin Visual Speech Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vsr_pipeline = None

@app.on_event("startup")
def load_vsr_model():
    global vsr_pipeline
    device_str = "cuda:0" if torch.cuda.is_available() else "cpu"
    device = torch.device(device_str)
    print(f"🧠 [STARTUP] Initializing Chaplin VSR (Auto-AVSR LRS3) on {device_str}...")
    
    # Auto-ensure benchmarks directory structure & json files
    import urllib.request
    import subprocess
    os.makedirs("benchmarks/LRS3/language_models/lm_en_subword/", exist_ok=True)
    os.makedirs("benchmarks/LRS3/models/LRS3_V_WER19.1/", exist_ok=True)
    
    lm_json = "benchmarks/LRS3/language_models/lm_en_subword/model.json"
    model_json = "benchmarks/LRS3/models/LRS3_V_WER19.1/model.json"
    lm_pth = "benchmarks/LRS3/language_models/lm_en_subword/model.pth"
    lrs3_pth = "benchmarks/LRS3/models/LRS3_V_WER19.1/model.pth"

    if not os.path.exists(lm_json) or os.path.getsize(lm_json) < 10:
        print("📥 Fetching missing lm_en_subword/model.json...")
        urllib.request.urlretrieve("https://huggingface.co/Amanvir/lm_en_subword/resolve/main/model.json", lm_json)
    if not os.path.exists(model_json) or os.path.getsize(model_json) < 10:
        print("📥 Fetching missing LRS3_V_WER19.1/model.json...")
        urllib.request.urlretrieve("https://huggingface.co/Amanvir/LRS3_V_WER19.1/resolve/main/model.json", model_json)

    if not os.path.exists(lm_pth) or os.path.getsize(lm_pth) < 10 * 1024 * 1024:
        print("📥 Fetching valid lm_en_subword/model.pth (205MB)...")
        subprocess.run(["curl", "-L", "https://huggingface.co/Amanvir/lm_en_subword/resolve/main/model.pth", "-o", lm_pth])

    if not os.path.exists(lrs3_pth) or os.path.getsize(lrs3_pth) < 50 * 1024 * 1024:
        print("📥 Fetching valid LRS3_V_WER19.1/model.pth (955MB)...")
        subprocess.run(["curl", "-L", "https://huggingface.co/Amanvir/LRS3_V_WER19.1/resolve/main/model.pth", "-o", lrs3_pth])

    config_filename = "./configs/LRS3_V_WER19.1.ini"
    
    try:
        vsr_pipeline = InferencePipeline(
          config_filename,
          device=device,
          detector="mediapipe",
          face_track=True
        )
        print(f"✅ [SUCCESS] Chaplin VSR Neural Model Loaded Successfully on {device_str}!")
    except Exception as e:
        import traceback
        print("⚠️ [ERROR] Failed to load Chaplin model:", e)
        traceback.print_exc()

@app.post("/api/vsr/decode")
async def decode_video(video: UploadFile = File(...)):
    if vsr_pipeline is None:
        return {"success": False, "error": "VSR Model not initialized", "text": ""}
    
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
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
