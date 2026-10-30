"""Pack real menu frames, then store GIF deltas without changing decoded pixels."""
from pathlib import Path
from PIL import Image, ImageSequence
import subprocess, sys, json, hashlib
source, output = Path(sys.argv[1]), Path(sys.argv[2])
subprocess.run([sys.executable, str(Path(__file__).with_name('pack-material-25.py')), str(source), str(output)], check=True)
original = Image.open(output)
palette = Image.new('P', (1, 1)); palette.putpalette(original.getpalette())
frames, durations = [], []
for frame in ImageSequence.Iterator(original):
    frames.append(frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE))
    durations.append(frame.info['duration'])
delta = output.with_name(output.stem + '-delta.gif')
frames[0].save(delta, save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=1, optimize=False)
decoded = Image.open(delta)
for expected, actual in zip(frames, ImageSequence.Iterator(decoded), strict=True):
    assert expected.convert('RGB').tobytes() == actual.convert('RGB').tobytes()
original.close(); decoded.close(); delta.replace(output)
meta = json.loads(output.with_suffix('.json').read_text())
meta.update(deltaFrames=True, pixelVerified=True, sha256=hashlib.sha256(output.read_bytes()).hexdigest())
output.with_suffix('.json').write_text(json.dumps(meta, indent=2))

