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
    print(f"🧠 Loading Chaplin VSR (Auto-AVSR LRS3) neural network on {device_str}...")
    config_filename = "./configs/LRS3_V_WER19.1.ini"
    
    try:
        vsr_pipeline = InferencePipeline(
          config_filename,
          device=device,
          detector="mediapipe",
          face_track=True
        )
        print(f"✅ Chaplin VSR Neural Model Loaded Successfully on {device_str}!")
    except Exception as e:
        import traceback
        print("⚠️ Warning: Failed to load Chaplin model:", e)
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
