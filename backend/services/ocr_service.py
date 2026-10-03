import io
import logging
from pathlib import Path
from typing import Any, List, Optional, Tuple, Union
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)

_ocr_engine = None


def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ocr_engine = RapidOCR()
            logger.info("RapidOCR engine initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize RapidOCR engine: {e}")
            _ocr_engine = False
    return _ocr_engine if _ocr_engine is not False else None


def ocr_image(image_input: Any) -> str:
    """
    Runs high-performance local OCR on a single image file, bytes, or PIL Image.
    Returns plain text with lines separated by newlines.
    """
    engine = get_ocr_engine()
    if not engine:
        return ""

    try:
        if isinstance(image_input, (Path, str)):
            p = Path(image_input)
            if not p.exists():
                return ""
            img_arg = str(p)
        elif isinstance(image_input, bytes):
            img_arg = np.array(Image.open(io.BytesIO(image_input)))
        elif isinstance(image_input, Image.Image):
            img_arg = np.array(image_input)
        else:
            img_arg = image_input

        result, _ = engine(img_arg)
        if not result:
            return ""

        lines = [item[1].strip() for item in result if item and len(item) > 1 and item[1].strip()]
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"OCR failed: {e}")
        return ""


def ocr_document_pages(storage_dir: Path, total_pages: int) -> List[Tuple[int, str]]:
    """
    Extracts text locally for all pages in a document storage directory.
    Returns list of (page_number, text).
    """
    results: List[Tuple[int, str]] = []
    for p_num in range(1, total_pages + 1):
        p_path = storage_dir / f"page_{p_num}.png"
        if p_path.exists():
            text = ocr_image(p_path)
            results.append((p_num, text))
            logger.info(f"Local OCR completed for page {p_num}/{total_pages} ({len(text)} chars)")
        else:
            results.append((p_num, ""))
    return results
