FROM nvidia/cuda:12.1-devel-ubuntu22.04

# Metadatos
LABEL maintainer="Sandra IA 8.0 Pro"
LABEL version="8.0-enterprise"
LABEL description="Qwen3-Omni multimodal end-to-end model for Sandra IA"

# Variables de entorno
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV NVIDIA_VISIBLE_DEVICES=all
ENV CUDA_HOME=/usr/local/cuda

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    git \
    curl \
    wget \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Actualizar pip
RUN pip3 install --upgrade pip setuptools wheel

# Instalar PyTorch con soporte CUDA
RUN pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Instalar dependencias de Qwen3-Omni
RUN pip3 install \
    transformers \
    accelerate \
    optimum \
    neural-speed \
    vllm \
    fastchat \
    gradio \
    uvicorn \
    pydantic \
    numpy \
    scipy \
    librosa \
    soundfile \
    pillow \
    opencv-python-headless \
    requests \
    aiohttp \
    websockets \
    && pip3 cache purge

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración
COPY ./config/model_config.json /app/config/model_config.json
COPY ./scripts/start_qwen3_omni.sh /app/scripts/start_qwen3_omni.sh

# Hacer script ejecutable
RUN chmod +x /app/scripts/start_qwen3_omni.sh

# Crear directorio para modelos
RUN mkdir -p /models

# Exponer puertos
EXPOSE 8000  # API REST
EXPOSE 8001  # WebSocket streaming
EXPOSE 7860  # Interfaz web (opcional)

# Comando por defecto
CMD ["/app/scripts/start_qwen3_omni.sh"]

# HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1