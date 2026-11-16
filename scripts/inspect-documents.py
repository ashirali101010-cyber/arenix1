from pathlib import Path
import argparse
import os
from pdf2image import convert_from_path
from pypdf import PdfReader
from PIL import Image, ImageOps, ImageDraw
root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description='Render document QA PDFs to page images')
parser.add_argument('--poppler-bin', default=os.environ.get('POPPLER_BIN'))
parser.add_argument('--input-dir', default=str(root / 'tmp' / 'docs'))
args = parser.parse_args()
poppler = args.poppler_bin
for pdf in Path(args.input_dir).rglob('*.pdf'):
    pages = convert_from_path(str(pdf), dpi=120, poppler_path=poppler)
    print(pdf.stem, len(pages), 'pages')
    for i, img in enumerate(pages):
        img.save(pdf.parent / f'page-{i+1:02d}.png')
    for start in range(0, len(pages), 2):
        canvas = Image.new('RGB', (1240, 840), '#dde1da')
        draw = ImageDraw.Draw(canvas)
        for j, original in enumerate(pages[start:start+2]):
            img = original.copy(); img.thumbnail((600, 790))
            canvas.paste(img, (10 + j * 620, 30))
            draw.text((10 + j * 620, 10), f'{pdf.stem} page {start+j+1}', fill='black')
        canvas.save(pdf.parent / f'review-{start//2+1:02d}.png')
