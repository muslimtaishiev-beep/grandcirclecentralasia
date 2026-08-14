FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/chaplin

COPY chaplin/ ./
RUN pip install --no-cache-dir -r requirements.txt uvicorn fastapi python-multipart

RUN mkdir -p benchmarks/LRS3/language_models/lm_en_subword/ benchmarks/LRS3/models/LRS3_V_WER19.1/ && \
    curl -L https://huggingface.co/Amanvir/lm_en_subword/resolve/main/model.json -o benchmarks/LRS3/language_models/lm_en_subword/model.json && \
    curl -L https://huggingface.co/Amanvir/lm_en_subword/resolve/main/model.pth -o benchmarks/LRS3/language_models/lm_en_subword/model.pth && \
    curl -L https://huggingface.co/Amanvir/LRS3_V_WER19.1/resolve/main/model.json -o benchmarks/LRS3/models/LRS3_V_WER19.1/model.json && \
    curl -L https://huggingface.co/Amanvir/LRS3_V_WER19.1/resolve/main/model.pth -o benchmarks/LRS3/models/LRS3_V_WER19.1/model.pth

ENV PORT=10000
EXPOSE 10000

CMD ["python3", "-m", "uvicorn", "chaplin_api:app", "--host", "0.0.0.0", "--port", "10000"]
