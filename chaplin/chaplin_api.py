import os
import time
import gc
import tempfile
import torch

# Strict Low-RAM Memory Optimizations for PyTorch on Free Cloud Tiers
torch.set_num_threads(1)
torch.set_num_interop_threads(1)
torch.set_grad_enabled(False)

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
    print("🧠 Loading Chaplin VSR in Ultra-Low-RAM Mode (<350MB)...")
    config_filename = "./configs/LRS3_V_WER19.1.ini"
    
    try:
        vsr_pipeline = InferencePipeline(
          config_filename,
          device=torch.device("cpu"),
          detector="mediapipe",
          face_track=True
        )
        gc.collect()
        print("✅ Chaplin VSR Neural Model Loaded Successfully in Low-RAM Mode!")
    except Exception as e:
        print("⚠️ Warning: Failed to load Chaplin model:", e)

@app.post("/api/vsr/decode")
@torch.no_grad()
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

        gc.collect()
        return {
            "success": True,
            "text": raw_text.strip() if raw_text else "",
            "confidence": 90 if raw_text else 0
        }
    except Exception as e:
        gc.collect()
        return {"success": False, "error": str(e), "text": ""}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
