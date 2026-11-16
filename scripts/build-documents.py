"""Build editable handover documents from the maintained Markdown sources."""
from pathlib import Path
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output' / 'documents'
OUT.mkdir(parents=True, exist_ok=True)

def clean(text):
    return text.replace('**', '').replace('`', '').replace('–', '-').replace('—', '-').replace('’', "'").replace('“', '"').replace('”', '"')

def build(source, filename, label):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    sec.top_margin = sec.bottom_margin = Inches(.7)
    sec.left_margin = sec.right_margin = Inches(.78)
    sec.footer_distance = Inches(.3)
    for sty in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2', 'Heading 3', 'List Bullet', 'List Number']:
        st = doc.styles[sty]
        st.font.name = 'Aptos'
        st.font.color.rgb = RGBColor(0, 0, 0)
        st.paragraph_format.space_after = Pt(8)
    normal = doc.styles['Normal']
    normal.font.size = Pt(10.5)
    normal.paragraph_format.line_spacing = 1.12
    normal.paragraph_format.widow_control = True
    doc.styles['Title'].font.size = Pt(27)
    doc.styles['Title'].font.bold = True
    doc.styles['Title'].paragraph_format.space_after = Pt(14)
    doc.styles['Heading 1'].font.size = Pt(16)
    doc.styles['Heading 1'].font.bold = True
    doc.styles['Heading 1'].paragraph_format.space_before = Pt(13)
    doc.styles['Heading 1'].paragraph_format.space_after = Pt(9)
    doc.styles['Heading 2'].font.size = Pt(12)
    doc.styles['Heading 2'].font.bold = True
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = footer.add_run(f'ARENIX  |  {label.upper()}  |  ')
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string('666666')
    field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)
    lines = (ROOT / 'docs' / source).read_text(encoding='utf-8').splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1; continue
        if line == '<!-- PAGE -->':
            doc.add_page_break(); i += 1; continue
        if line.startswith('```'):
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                p = doc.add_paragraph()
                p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.line_spacing = 1.0
                p.paragraph_format.left_indent = Inches(.12)
                p.paragraph_format.keep_with_next = i + 1 < len(lines) and not lines[i+1].startswith('```')
                r = p.add_run(lines[i]); r.font.name = 'Consolas'; r.font.size = Pt(9.5)
                i += 1
            i += 1; continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [clean(s.strip()) for s in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', c.replace(' ', '')) for c in cells): rows.append(cells)
                i += 1
            table = doc.add_table(rows=0, cols=len(rows[0]))
            table.autofit = False
            widths = [2.0, 4.94] if len(rows[0]) == 2 else [1.15, 3.2, 2.59]
            if rows[0][0] == 'Relation':
                widths = [1.7, 3.0, 2.24]
            for rownum, cells in enumerate(rows):
                row = table.add_row()
                props = row._tr.get_or_add_trPr()
                cant = OxmlElement('w:cantSplit'); props.append(cant)
                if rownum == 0:
                    repeat = OxmlElement('w:tblHeader'); props.append(repeat)
                for j, text in enumerate(cells):
                    cell = row.cells[j]; cell.width = Inches(widths[j])
                    tcpr = cell._tc.get_or_add_tcPr()
                    margins = OxmlElement('w:tcMar')
                    for side in ['top', 'left', 'bottom', 'right']:
                        item = OxmlElement('w:' + side); item.set(qn('w:w'), '90'); item.set(qn('w:type'), 'dxa'); margins.append(item)
                    tcpr.append(margins)
                    if rownum == 0:
                        shade = OxmlElement('w:shd'); shade.set(qn('w:fill'), 'E9EDE6'); tcpr.append(shade)
                    p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(3); p.paragraph_format.line_spacing = 1.06
                    r = p.add_run(text); r.font.size = Pt(9.5); r.bold = rownum == 0
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            continue
        if line.startswith('# '):
            doc.add_paragraph(clean(line[2:]), 'Title')
        elif line.startswith('## '):
            doc.add_paragraph(clean(line[3:]), 'Heading 1')
        elif line.startswith('### '):
            doc.add_paragraph(clean(line[4:]), 'Heading 2')
        elif line.startswith('- '):
            doc.add_paragraph(clean(line[2:]), 'List Bullet')
        elif re.match(r'^\d+\. ', line):
            p = doc.add_paragraph(clean(line))
            p.paragraph_format.left_indent = Inches(.15)
            p.paragraph_format.first_line_indent = Inches(-.15)
        else:
            doc.add_paragraph(clean(line))
        i += 1
    doc.core_properties.title = label
    doc.core_properties.subject = 'Arenix football and futsal tournament management'
    doc.core_properties.author = 'Ahad Sajjad'
    doc.core_properties.keywords = 'React NestJS Supabase Arenix'
    # Word's default template can contain a blue paragraph border on Title.
    for root in (doc._element, doc.styles._element):
        for border in root.xpath('.//w:pBdr'):
            border.getparent().remove(border)
    path = OUT / filename
    doc.save(path)
    print(path)

build('setup-guide.md', 'Arenix_Complete_Setup_Guide.docx', 'Complete Setup Guide')
build('project-documentation.md', 'Arenix_Project_Documentation.docx', 'Project Documentation')
