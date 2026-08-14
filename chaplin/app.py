import os
import gc
import torch

torch.set_num_threads(1)
torch.set_grad_enabled(False)

import gradio as gr
from pipelines.pipeline import InferencePipeline

config_filename = "./configs/LRS3_V_WER19.1.ini"
vsr_pipeline = None

try:
    vsr_pipeline = InferencePipeline(
        config_filename,
        device=torch.device("cpu"),
        detector="mediapipe",
        face_track=True
    )
    gc.collect()
except Exception as e:
    print("Error loading VSR model:", e)

def process_video(video_path):
    if not video_path or vsr_pipeline is None:
        return ""
    try:
        text = vsr_pipeline(video_path)
        gc.collect()
        return text.strip() if text else ""
    except Exception as e:
        return f"Error: {e}"

demo = gr.Interface(
    fn=process_video,
    inputs=gr.Video(sources=["webcam", "upload"]),
    outputs="text",
    title="Chaplin Silent Speech Recognition (VSR)",
    description="Auto-AVSR 3D-CNN Silent Lip Reading"
)

if __name__ == "__main__":
    demo.launch()
