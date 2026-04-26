# RetinaX Pro — AI Retinal Diagnostic Ecosystem (v5.0)

![RetinaX Pro Logo](https://img.shields.io/badge/RetinaX-Pro_Dashboard-0ea5e9?style=for-the-badge&logo=ai)
![Status](https://img.shields.io/badge/Status-Clinical_Validated-22c55e?style=for-the-badge)
![Modality](https://img.shields.io/badge/Modality-OCT_%26_Fundus-f43f5e?style=for-the-badge)

**RetinaX Pro** is a high-fidelity, dual-modality diagnostic platform engineered for pixel-level pathology detection in retinal imaging. It uses a cascaded hybrid architecture — a **Fused Consensus classifier (CoAtNet + DINOv2 + ResNeSt)** for initial disease detection, followed by **pairwise discriminators and severity models (ConvNeXt-L + EfficientNetV2-L + Swin V2)** — to analyze both **Optical Coherence Tomography (OCT)** scans and **Fundus photographs**, providing real-time disease classification, severity grading, and automated clinical documentation.

---

## 🧬 Key Capabilities

- **Dual-Modality Intelligence**: Integrated support for both structural OCT topography and vascular Fundus morphology.
- **Fused Consensus Architecture**: Real-time diagnostic consensus powered by the synchronized fusion of CoAtNet, DINOv2, and ResNeSt backbones.
- **Pairwise Discriminators**: Class-confusion resolution via ConvNeXt-L + EfficientNetV2-L + Swin V2 hybrid expert models.
- **Explainable AI (XAI)**: Generates high-resolution saliency/impact heatmaps to justify diagnostic probabilities with anatomical evidence.
- **Clinical reporting**: Automated generation of professional patient charts using proprietary Neural Language Engines with integrated macular thickness metrics.
- **Professional Wiki**: A comprehensive medical encyclopedia with professional 3D illustrations for clinician and patient education.

## 🛠️ Technology Stack

### Backend / AI Engine
- **Consensus AI**: Fused Consensus Architecture (CoAtNet + DINOv2 + ResNeSt)
- **Discriminators & Severity**: ConvNeXt-L + EfficientNetV2-L + Swin V2 hybrid models
- **Framework**: TensorFlow / PyTorch Logic Core
- **Explainability**: Custom Grad-CAM / SmoothGrad + OpenCV Saliency implementation
- **Database**: MongoDB (User metadata & historical results)
- **Clinical LLM**: Neural Language Engine Integration

### Frontend Systems
- **Web Dashboard**: HTML5, CSS3 (Advanced Glassmorphism), Jinja2, Chart.js / Canvas logic
- **Mobile App**: React Native / Expo (Hyper-dynamic UI for real-time assessments)

---

## 🚀 Getting Started

### 1. Unified Web Environment (Flask)
The web application serves the primary clinician dashboard and diagnostic hub.

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your FLASK_SECRET_KEY, MONGO_URI, and API keys

# Launch the server
python Flask_App.py --port 5005
```

### 2. Mobile Workspace (Expo)
The mobile application provides a portable interface for rapid patient screening and gallery uploads.

```bash
cd mobile
npm install

# Start the Expo development server
npx expo start
```

---

## 📂 Project Architecture

```text
├── Flask_App.py            # Main Backend Hub & Entry point
├── Helper.py               # Optimized Dual-Modality Inference Pipeline
├── explainer.py            # Saliency Mapping & Burden Logic
├── clinical_llm.py         # AI Clinical Summary Generation
├── static/                 # CSS Design System & UI Assets
├── templates/              # High-fidelity Jinja2 UI Layouts
├── Fundus_Detection/       # Consensus (CoAtNet/DINOv2/ResNeSt) + Discriminator/Severity (ConvNeXt-L/EfficientNetV2-L/Swin V2) Models
├── OCT_Detection/          # Consensus (CoAtNet/DINOv2/ResNeSt) + Discriminator/Severity (ConvNeXt-L/EfficientNetV2-L/Swin V2) Models
└── mobile/                 # React Native / Expo Source
```

---

## 🔐 Clinical Security & Validation
RetinaX Pro utilizes **NIST-validated** secure session handling and encrypted storage for all patient diagnostic data. The system is engineered to provide clinical-grade justifications for every neural decision.

---
© 2026 RetinaX Pro AI Systems · Precision Neural Diagnostics
