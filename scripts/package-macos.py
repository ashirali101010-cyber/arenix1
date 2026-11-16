"""Create the source-only handover ZIP, excluding credentials and build caches."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent.parent
destination = root / 'output' / 'Arenix_macOS.zip'
sources = []
for name in ['.env.example', '.gitignore', 'AGENTS.md', 'README.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts']:
    sources.append(root / name)
for directory in ['apps', 'packages', 'scripts', 'supabase', 'tests', 'docs']:
    sources.extend(p for p in (root / directory).rglob('*') if p.is_file())
sources.extend((root / 'output' / 'documents').glob('*.docx'))
excluded = {'node_modules', '.git', 'tmp', 'dist', 'coverage', '__pycache__'}
manifest = json.loads((root / 'package.json').read_text())
assert 'supabase' not in manifest.get('devDependencies', {})
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(set(sources)):
        relative = path.relative_to(root)
        if any(part in excluded for part in relative.parts) or path.is_symlink() or path.suffix == '.pyc':
            continue
        if path.name.startswith('.env') and path.name != '.env.example':
            continue
        archive.write(path, Path('Arenix') / relative)
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert 'Arenix/package.json' in archive.namelist()
    assert 'Arenix/.env' not in archive.namelist()
    assert 'Arenix/supabase/config.toml' not in archive.namelist()
    print(f'{destination}\n{len(archive.namelist())} files, {destination.stat().st_size} bytes')
