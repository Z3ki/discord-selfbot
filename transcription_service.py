#!/usr/bin/env python3
"""
Persistent Transcription Service
Keeps Whisper model loaded in memory for fast transcription requests
"""

import sys
import json
import asyncio
import logging
from pathlib import Path
from typing import Dict, Optional, Any
import torch
from faster_whisper import WhisperModel

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TranscriptionService:
    def __init__(self):
        self.model: Optional[WhisperModel] = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")

    async def load_model(self):
        """Load the Whisper model into memory"""
        try:
            logger.info("Loading Whisper model (base)...")
            self.model = WhisperModel(
                "base",
                device=self.device,
                compute_type="float32",  # Better accuracy than int8
                num_workers=4  # Utilize multiple CPU cores
            )
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    async def transcribe(self, audio_path: str) -> Dict[str, Any]:
        """Transcribe audio file using the loaded model"""
        try:
            if not self.model:
                return {"success": False, "error": "Model not loaded"}

            logger.info(f"Transcribing {audio_path}")

            segments, info = self.model.transcribe(
                audio_path,
                beam_size=3,  # Reduced for speed with minimal accuracy loss
                vad_filter=True,  # Skip silence for faster processing
                word_timestamps=False,  # Disable timestamps for speed
                language=None  # Auto-detect language for better accuracy
            )

            transcription = ""
            for segment in segments:
                transcription += segment.text + " "

            transcription = transcription.strip()

            return {
                "success": True,
                "transcription": transcription,
                "language": info.language,
                "language_probability": info.language_probability
            }

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_status(self) -> Dict[str, Any]:
        """Get service status"""
        return {
            "status": "running",
            "device": self.device,
            "model_loaded": self.model is not None,
            "cuda_available": torch.cuda.is_available()
        }

# Global service instance
service = TranscriptionService()

async def handle_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle incoming transcription requests"""
    try:
        action = request_data.get("action")

        if action == "transcribe":
            audio_path = request_data.get("audio_path")
            if not audio_path:
                return {"success": False, "error": "audio_path required"}
            return await service.transcribe(audio_path)

        elif action == "status":
            return await service.get_status()

        else:
            return {"success": False, "error": f"Unknown action: {action}"}

    except Exception as e:
        logger.error(f"Request handling failed: {e}")
        return {"success": False, "error": str(e)}

async def main():
    """Main service loop - reads from stdin, writes to stdout"""
    logger.info("Starting Transcription Service...")

    # Load model on startup
    await service.load_model()

    logger.info("Transcription Service ready")

    try:
        # Read requests from stdin (line by line JSON)
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                response = await handle_request(request)
                # Write response as JSON line
                print(json.dumps(response), flush=True)
            except json.JSONDecodeError as e:
                error_response = {"success": False, "error": f"Invalid JSON: {e}"}
                print(json.dumps(error_response), flush=True)
            except Exception as e:
                error_response = {"success": False, "error": f"Processing error: {e}"}
                print(json.dumps(error_response), flush=True)

    except KeyboardInterrupt:
        logger.info("Transcription Service shutting down...")
    except Exception as e:
        logger.error(f"Service error: {e}")

if __name__ == "__main__":
    asyncio.run(main())