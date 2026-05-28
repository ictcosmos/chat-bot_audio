import base64
import os
import subprocess
import tempfile
import threading
from typing import Optional

import numpy as np
import soundfile as sf
import torch
from faster_whisper import WhisperModel
from groq import Groq
from gtts import gTTS

from app.config import GROQ_API_KEY
from app.services.gemini_service import ask_gemini_search_grounded

try:
    from kokoro import KPipeline
except Exception:
    KPipeline = None

try:
    from silero_vad import load_silero_vad, get_speech_timestamps
except Exception:
    load_silero_vad = None
    get_speech_timestamps = None


GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.1-8b-instant")

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "large-v3")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

KOKORO_VOICE = os.getenv("KOKORO_VOICE", "af_heart")

# Strict Silero VAD settings to reduce Whisper hallucination.
# If real speech is being missed, lower threshold to 0.60 or 0.65.
# If hallucination still happens, increase threshold to 0.80 or 0.85.
SILERO_VAD_THRESHOLD = float(os.getenv("SILERO_VAD_THRESHOLD", "0.72"))
SILERO_MIN_SPEECH_MS = int(os.getenv("SILERO_MIN_SPEECH_MS", "600"))
SILERO_MIN_SILENCE_MS = int(os.getenv("SILERO_MIN_SILENCE_MS", "900"))
SILERO_SPEECH_PAD_MS = int(os.getenv("SILERO_SPEECH_PAD_MS", "80"))
SILERO_MIN_TOTAL_SPEECH_MS = int(os.getenv("SILERO_MIN_TOTAL_SPEECH_MS", "900"))
SILERO_MIN_AUDIO_MS = int(os.getenv("SILERO_MIN_AUDIO_MS", "700"))

groq_client = Groq(api_key=GROQ_API_KEY)

_whisper_model = None
_kokoro_pipeline = None
_silero_model = None

_whisper_lock = threading.Lock()
_kokoro_lock = threading.Lock()
_silero_lock = threading.Lock()

_voice_loading_status = {
    "silero_loading": False,
    "whisper_loading": False,
    "kokoro_loading": False,
    "last_error": "",
}


def get_silero_model():
    global _silero_model

    if _silero_model is not None:
        return _silero_model

    with _silero_lock:
        if _silero_model is not None:
            return _silero_model

        if load_silero_vad is None:
            raise RuntimeError(
                "Silero VAD is not installed correctly. Run: pip install silero-vad"
            )

        try:
            _voice_loading_status["silero_loading"] = True
            _voice_loading_status["last_error"] = ""

            print("[Voice] Loading Silero VAD...")
            _silero_model = load_silero_vad()
            print("[Voice] Silero VAD loaded.")

            return _silero_model

        except Exception as exc:
            _voice_loading_status["last_error"] = str(exc)
            raise

        finally:
            _voice_loading_status["silero_loading"] = False


def get_whisper_model():
    global _whisper_model

    if _whisper_model is not None:
        return _whisper_model

    with _whisper_lock:
        if _whisper_model is not None:
            return _whisper_model

        try:
            _voice_loading_status["whisper_loading"] = True
            _voice_loading_status["last_error"] = ""

            print(
                f"[Voice] Loading faster-whisper model: "
                f"{WHISPER_MODEL_SIZE}, device={WHISPER_DEVICE}, compute={WHISPER_COMPUTE_TYPE}"
            )

            _whisper_model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device=WHISPER_DEVICE,
                compute_type=WHISPER_COMPUTE_TYPE,
            )

            print("[Voice] faster-whisper loaded.")
            return _whisper_model

        except Exception as exc:
            _voice_loading_status["last_error"] = str(exc)
            raise

        finally:
            _voice_loading_status["whisper_loading"] = False


def get_kokoro_pipeline():
    global _kokoro_pipeline

    if _kokoro_pipeline is not None:
        return _kokoro_pipeline

    with _kokoro_lock:
        if _kokoro_pipeline is not None:
            return _kokoro_pipeline

        if KPipeline is None:
            raise RuntimeError(
                "Kokoro is not installed correctly. Run: pip install kokoro soundfile"
            )

        try:
            _voice_loading_status["kokoro_loading"] = True
            _voice_loading_status["last_error"] = ""

            print("[Voice] Loading Kokoro pipeline...")
            _kokoro_pipeline = KPipeline(lang_code="a")
            print("[Voice] Kokoro loaded.")

            return _kokoro_pipeline

        except Exception as exc:
            _voice_loading_status["last_error"] = str(exc)
            raise

        finally:
            _voice_loading_status["kokoro_loading"] = False


def is_silero_loaded() -> bool:
    return _silero_model is not None


def is_whisper_loaded() -> bool:
    return _whisper_model is not None


def is_kokoro_loaded() -> bool:
    return _kokoro_pipeline is not None


def get_voice_model_status() -> dict:
    return {
        "silero_loaded": is_silero_loaded(),
        "whisper_loaded": is_whisper_loaded(),
        "kokoro_loaded": is_kokoro_loaded(),
        "silero_loading": _voice_loading_status["silero_loading"],
        "whisper_loading": _voice_loading_status["whisper_loading"],
        "kokoro_loading": _voice_loading_status["kokoro_loading"],
        "last_error": _voice_loading_status["last_error"],
        "whisper_model": WHISPER_MODEL_SIZE,
        "whisper_device": WHISPER_DEVICE,
        "whisper_compute_type": WHISPER_COMPUTE_TYPE,
        "kokoro_voice": KOKORO_VOICE,
        "silero_threshold": SILERO_VAD_THRESHOLD,
        "silero_min_speech_ms": SILERO_MIN_SPEECH_MS,
        "silero_min_total_speech_ms": SILERO_MIN_TOTAL_SPEECH_MS,
    }


def preload_voice_models() -> dict:
    get_silero_model()
    get_whisper_model()

    kokoro_loaded = False

    try:
        get_kokoro_pipeline()
        kokoro_loaded = True
    except Exception as exc:
        print(f"[Voice] Kokoro preload failed: {exc}")
        _voice_loading_status["last_error"] = str(exc)

    return get_voice_model_status()


def _extension_from_mime(mime_type: str) -> str:
    mime_type = (mime_type or "").lower()

    if "webm" in mime_type:
        return ".webm"
    if "wav" in mime_type:
        return ".wav"
    if "mpeg" in mime_type or "mp3" in mime_type:
        return ".mp3"
    if "mp4" in mime_type:
        return ".mp4"
    if "m4a" in mime_type:
        return ".m4a"
    if "ogg" in mime_type:
        return ".ogg"

    return ".webm"


def has_devanagari(text: str) -> bool:
    return any("\u0900" <= char <= "\u097F" for char in text or "")


def detect_language(text: str) -> str:
    if not text:
        return "en"

    return "ne" if has_devanagari(text) else "en"


def detect_requested_reply_language(transcript: str, detected_language: str = "en") -> str:
    text = (transcript or "").lower()

    nepali_requests = [
        "reply in nepali",
        "answer in nepali",
        "speak in nepali",
        "nepali ma",
        "nepali maa",
        "nepali language",
        "नेपालीमा",
        "नेपाली मा",
        "नेपाली भाषामा",
        "नेपालीमा जवाफ",
        "नेपालीमा भन",
        "नेपालीमा भन्नु",
    ]

    english_requests = [
        "reply in english",
        "answer in english",
        "speak in english",
        "english ma",
        "english maa",
        "english language",
        "अंग्रेजीमा",
        "अङ्ग्रेजीमा",
        "english मा",
    ]

    if any(phrase in text for phrase in nepali_requests):
        return "ne"

    if any(phrase in text for phrase in english_requests):
        return "en"

    if has_devanagari(transcript):
        return "ne"

    return detected_language if detected_language in {"en", "ne"} else "en"


def convert_audio_to_16k_wav(input_path: str) -> str:
    """
    Convert webm/mp3/m4a/etc. to mono 16k wav using ffmpeg.
    This avoids torchaudio/torchcodec dependency for Silero audio I/O.
    """
    output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name

    command = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        output_path,
    ]

    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    if result.returncode != 0:
        try:
            os.remove(output_path)
        except Exception:
            pass

        raise RuntimeError(f"ffmpeg audio conversion failed: {result.stderr}")

    return output_path


def load_wav_for_silero(wav_path: str):
    """
    Load wav using soundfile instead of torchaudio.
    Returns torch tensor expected by Silero.
    """
    audio, sample_rate = sf.read(wav_path, dtype="float32")

    if sample_rate != 16000:
        raise RuntimeError(f"Expected 16000 Hz after ffmpeg conversion, got {sample_rate}")

    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    return torch.from_numpy(audio)


def detect_speech_with_silero(audio_path: str) -> dict:
    """
    Strict backend VAD check using Silero.

    This prevents Whisper hallucination by rejecting:
    - pure silence
    - very short sounds
    - clicks/noise
    - tiny speech fragments
    """
    if get_speech_timestamps is None:
        raise RuntimeError("Silero VAD is not installed correctly.")

    model = get_silero_model()
    wav_path = None

    try:
        wav_path = convert_audio_to_16k_wav(audio_path)
        wav = load_wav_for_silero(wav_path)

        audio_duration_ms = round((len(wav) / 16000) * 1000, 2)

        if audio_duration_ms < SILERO_MIN_AUDIO_MS:
            return {
                "has_speech": False,
                "reason": "audio_too_short",
                "audio_duration_ms": audio_duration_ms,
                "speech_timestamps": [],
                "speech_ms": 0,
                "threshold": SILERO_VAD_THRESHOLD,
            }

        speech_timestamps = get_speech_timestamps(
            wav,
            model,
            sampling_rate=16000,
            threshold=SILERO_VAD_THRESHOLD,
            min_speech_duration_ms=SILERO_MIN_SPEECH_MS,
            min_silence_duration_ms=SILERO_MIN_SILENCE_MS,
            speech_pad_ms=SILERO_SPEECH_PAD_MS,
        )

        total_speech_ms = 0

        for item in speech_timestamps:
            start = item.get("start", 0)
            end = item.get("end", 0)
            total_speech_ms += max(0, end - start) / 16

        total_speech_ms = round(total_speech_ms, 2)

        if not speech_timestamps:
            return {
                "has_speech": False,
                "reason": "no_speech_detected",
                "audio_duration_ms": audio_duration_ms,
                "speech_timestamps": [],
                "speech_ms": total_speech_ms,
                "threshold": SILERO_VAD_THRESHOLD,
            }

        if total_speech_ms < SILERO_MIN_TOTAL_SPEECH_MS:
            return {
                "has_speech": False,
                "reason": "speech_too_short",
                "audio_duration_ms": audio_duration_ms,
                "speech_timestamps": speech_timestamps,
                "speech_ms": total_speech_ms,
                "threshold": SILERO_VAD_THRESHOLD,
            }

        return {
            "has_speech": True,
            "reason": "speech_detected",
            "audio_duration_ms": audio_duration_ms,
            "speech_timestamps": speech_timestamps,
            "speech_ms": total_speech_ms,
            "threshold": SILERO_VAD_THRESHOLD,
        }

    finally:
        if wav_path and os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception:
                pass


def _is_likely_whisper_hallucination(transcript: str) -> bool:
    if not transcript:
        return True

    cleaned = transcript.lower().strip()
    cleaned = cleaned.strip(".!?,-–— ")

    if len(cleaned) < 3:
        return True

    bad_hallucinations = {
        "thank you",
        "thanks",
        "thanks for watching",
        "thank you for watching",
        "subscribe",
        "like and subscribe",
        "bye",
        "goodbye",
        "you",
        "okay",
        "ok",
        "hmm",
        "um",
        "uh",
        "music",
        "background music",
    }

    if cleaned in bad_hallucinations:
        return True

    # Repeated hallucination-like text
    words = cleaned.split()
    if len(words) >= 4 and len(set(words)) <= 2:
        return True

    return False


def transcribe_audio_with_faster_whisper(
    audio_data: bytes,
    mime_type: str = "audio/webm",
) -> dict:
    if not audio_data:
        raise ValueError("No audio data received.")

    suffix = _extension_from_mime(mime_type)
    temp_path: Optional[str] = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name

        vad_result = detect_speech_with_silero(temp_path)

        if not vad_result.get("has_speech"):
            return {
                "transcript": "",
                "language": "en",
                "input_language": "en",
                "detected_language_raw": "",
                "model": WHISPER_MODEL_SIZE,
                "no_speech": True,
                "vad": vad_result,
            }

        model = get_whisper_model()

        segments, info = model.transcribe(
            temp_path,
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
            no_speech_threshold=0.75,
            log_prob_threshold=-0.7,
            compression_ratio_threshold=2.4,
            vad_parameters={
                "threshold": SILERO_VAD_THRESHOLD,
                "min_speech_duration_ms": SILERO_MIN_SPEECH_MS,
                "min_silence_duration_ms": SILERO_MIN_SILENCE_MS,
                "speech_pad_ms": SILERO_SPEECH_PAD_MS,
            },
        )

        transcript_parts = []

        for segment in segments:
            if segment.text:
                transcript_parts.append(segment.text.strip())

        transcript = " ".join(transcript_parts).strip()

        if _is_likely_whisper_hallucination(transcript):
            return {
                "transcript": "",
                "language": "en",
                "input_language": "en",
                "detected_language_raw": "",
                "model": WHISPER_MODEL_SIZE,
                "no_speech": True,
                "vad": {
                    **vad_result,
                    "reason": "likely_whisper_hallucination",
                    "hallucinated_text": transcript,
                },
            }

        raw_lang = getattr(info, "language", None) or ""
        local_lang = detect_language(transcript)

        if raw_lang.startswith("ne"):
            detected_lang = "ne"
        elif raw_lang.startswith("hi") and has_devanagari(transcript):
            detected_lang = "ne"
        elif local_lang == "ne":
            detected_lang = "ne"
        else:
            detected_lang = "en"

        output_lang = detect_requested_reply_language(transcript, detected_lang)

        return {
            "transcript": transcript,
            "language": output_lang,
            "input_language": detected_lang,
            "detected_language_raw": raw_lang,
            "model": WHISPER_MODEL_SIZE,
            "no_speech": False,
            "vad": vad_result,
        }

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def needs_current_search(text: str) -> bool:
    if not text:
        return False

    q = text.lower().strip()

    english_keywords = [
        "current",
        "latest",
        "today",
        "yesterday",
        "tomorrow",
        "this week",
        "this month",
        "recent",
        "news",
        "search",
        "google",
        "web",
        "online",
        "right now",
        "now",
        "weather",
        "price",
        "stock",
        "score",
        "who won",
        "when is",
        "what happened",
        "update",
        "updates",
    ]

    nepali_keywords = [
        "आज",
        "हिजो",
        "भोलि",
        "अहिले",
        "हाल",
        "ताजा",
        "नयाँ",
        "समाचार",
        "खोज",
        "गुगल",
        "वेब",
        "मौसम",
        "मूल्य",
        "कति",
        "कसले जित्यो",
    ]

    return any(keyword in q for keyword in english_keywords + nepali_keywords)


def ask_groq_from_transcript(transcript: str, output_language: str = "en") -> dict:
    if not transcript or not transcript.strip():
        fallback = (
            "मैले स्पष्ट सुन्न सकिनँ। कृपया फेरि भन्नुहोस्।"
            if output_language == "ne"
            else "I could not hear anything clearly. Please try again."
        )

        return {
            "answer": fallback,
            "model": GROQ_CHAT_MODEL,
            "provider": "groq",
            "route": "voice_groq_normal",
            "token_usage": {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "provider": "groq",
                "model": GROQ_CHAT_MODEL,
            },
        }

    if output_language == "ne":
        system_prompt = (
            "You are a helpful Nepali voice assistant. "
            "Always reply in natural Nepali. "
            "Keep the answer short, conversational, and clear. "
            "If the user explicitly asks for English, then reply in English."
        )
    else:
        system_prompt = (
            "You are a helpful English voice assistant. "
            "Always reply in natural English. "
            "Keep the answer short, conversational, and clear. "
            "If the user explicitly asks for Nepali, then reply in Nepali."
        )

    response = groq_client.chat.completions.create(
        model=GROQ_CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": transcript},
        ],
        temperature=0.5,
        max_tokens=300,
    )

    answer = response.choices[0].message.content or ""

    usage = getattr(response, "usage", None)
    input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
    output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
    total_tokens = (
        getattr(usage, "total_tokens", input_tokens + output_tokens)
        if usage
        else input_tokens + output_tokens
    )

    return {
        "answer": answer.strip(),
        "model": GROQ_CHAT_MODEL,
        "provider": "groq",
        "route": "voice_groq_normal",
        "token_usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "provider": "groq",
            "model": GROQ_CHAT_MODEL,
        },
    }


def ask_gemini_search_from_transcript(transcript: str, output_language: str = "en") -> dict:
    if output_language == "ne":
        prompt = f"""
You are a helpful Nepali voice assistant.

The user asked this by voice:
{transcript}

Use Google Search grounding for current/latest information if needed.
Reply naturally and briefly in Nepali.
"""
    else:
        prompt = f"""
You are a helpful English voice assistant.

The user asked this by voice:
{transcript}

Use Google Search grounding for current/latest information if needed.
Reply naturally and briefly in English.
"""

    result = ask_gemini_search_grounded(prompt)

    return {
        "answer": result.get("answer", "").strip(),
        "model": result.get("token_usage", {}).get("model", "gemini-search"),
        "provider": "gemini_search",
        "route": "voice_gemini_current_search",
        "token_usage": result.get("token_usage", {}),
    }


def answer_from_transcript(transcript: str, output_language: str = "en") -> dict:
    if needs_current_search(transcript):
        print("[Voice] Routing to Gemini Search grounding.")
        return ask_gemini_search_from_transcript(transcript, output_language)

    print("[Voice] Routing to Groq normal chat.")
    return ask_groq_from_transcript(transcript, output_language)


def generate_nepali_tts_gtts(text: str) -> dict:
    if not text or not text.strip():
        raise ValueError("No text provided for Nepali TTS.")

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_path = temp_file.name

        try:
            tts = gTTS(text=text, lang="ne", slow=False)
            tts.save(temp_path)
        except Exception:
            tts = gTTS(text=text, lang="hi", slow=False)
            tts.save(temp_path)

        with open(temp_path, "rb") as f:
            audio_bytes = f.read()

        return {
            "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
            "audio_mime_type": "audio/mpeg",
            "tts_provider": "gtts",
        }

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def generate_english_tts_kokoro(text: str) -> dict:
    if not text or not text.strip():
        raise ValueError("No text provided for English TTS.")

    temp_path = None

    try:
        pipeline = get_kokoro_pipeline()

        audio_chunks = []

        generator = pipeline(
            text,
            voice=KOKORO_VOICE,
            speed=1.0,
            split_pattern=r"\n+",
        )

        for _, _, audio in generator:
            if audio is None:
                continue

            audio_np = np.asarray(audio, dtype=np.float32)
            audio_chunks.append(audio_np)

        if not audio_chunks:
            raise RuntimeError("Kokoro did not generate any audio.")

        full_audio = np.concatenate(audio_chunks)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_path = temp_file.name

        sf.write(temp_path, full_audio, 24000)

        with open(temp_path, "rb") as f:
            audio_bytes = f.read()

        return {
            "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
            "audio_mime_type": "audio/wav",
            "tts_provider": "kokoro",
        }

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def generate_tts(text: str, output_language: str = "en") -> dict:
    if output_language == "ne":
        return generate_nepali_tts_gtts(text)

    return generate_english_tts_kokoro(text)


def process_voice_audio(
    audio_data: bytes,
    mime_type: str = "audio/webm",
) -> dict:
    transcription_result = transcribe_audio_with_faster_whisper(audio_data, mime_type)

    if transcription_result.get("no_speech"):
        return {
            "transcript": "",
            "answer": "",
            "language": "en",
            "input_language": "en",
            "provider": "",
            "route": "voice_no_speech",
            "stt_provider": "faster-whisper",
            "stt_model": transcription_result.get("model", WHISPER_MODEL_SIZE),
            "detected_language_raw": "",
            "model": "",
            "token_usage": {},
            "audio_base64": "",
            "audio_mime_type": "",
            "tts_provider": "",
            "vad": transcription_result.get("vad", {}),
            "no_speech": True,
        }

    transcript = transcription_result.get("transcript", "")
    output_language = transcription_result.get("language", "en")
    input_language = transcription_result.get("input_language", output_language)

    chat_result = answer_from_transcript(transcript, output_language)

    answer = chat_result.get("answer", "")
    tts_result = generate_tts(answer, output_language)

    return {
        "transcript": transcript,
        "answer": answer,
        "language": output_language,
        "input_language": input_language,
        "provider": chat_result.get("provider", ""),
        "route": chat_result.get("route", ""),
        "stt_provider": "faster-whisper",
        "stt_model": transcription_result.get("model", WHISPER_MODEL_SIZE),
        "detected_language_raw": transcription_result.get("detected_language_raw", ""),
        "model": chat_result.get("model", ""),
        "token_usage": chat_result.get("token_usage", {}),
        "audio_base64": tts_result.get("audio_base64", ""),
        "audio_mime_type": tts_result.get("audio_mime_type", ""),
        "tts_provider": tts_result.get("tts_provider", ""),
        "vad": transcription_result.get("vad", {}),
        "no_speech": False,
    }