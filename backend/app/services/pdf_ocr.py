"""Bounded OCR for scanned lab pages. Preserve page order; never invent text."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def ocr_pdf_pages(filename,pages):
    if not pages:return {}
    if len(pages)>25:raise ValueError('Scanned manuals support up to 25 OCR pages; split this file.')
    if not shutil.which('pdftoppm'):raise ValueError('Scanned PDF requires Poppler (pdftoppm) on the backend.')
    with tempfile.TemporaryDirectory(prefix='labmate_ocr_') as folder:
        root=Path(folder)
        for page in pages:
            subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','2000',
                            '-png',str(Path(filename).resolve()),str(root/f'page-{page:03}')],
                           check=True,timeout=20,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        tesseract=shutil.which('tesseract')
        if tesseract:
            for page in pages:
                subprocess.run([tesseract,str(root/f'page-{page:03}.png'),str(root/f'page-{page:03}'),'-l','eng','--psm','3'],
                               check=True,timeout=20,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        elif os.name=='nt':
            script=Path(__file__).resolve().parents[1]/'scripts'/'windows_ocr.ps1'
            subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(script),'-Root',str(root)],
                           check=True,timeout=min(120,len(pages)*15+10),stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        else:raise ValueError('Scanned PDF requires tesseract-ocr on the backend.')
        result={page:(root/f'page-{page:03}.txt').read_text(encoding='utf-8-sig').strip() for page in pages}
        if any(len(text)<20 for text in result.values()):raise ValueError('Some scanned pages could not be read reliably; upload a clearer scan.')
        return result
