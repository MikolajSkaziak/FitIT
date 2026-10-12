import json, subprocess, sys, time, urllib.request, pathlib
S = pathlib.Path(__file__).parent
out = subprocess.run(['dotnet', 'user-secrets', 'list', '--id', 'fitit-api-dev'], capture_output=True, text=True).stdout
KEY = next(l.split('=', 1)[1].strip() for l in out.splitlines() if l.startswith('Fal:ApiKey'))
H = {'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json'}
PROMPT = ("Straight-on, perfectly symmetrical photograph of a closed two-panel fitting-room curtain filling the entire frame edge to edge. "
          "Heavy natural linen in muted sage and bottle green, soft deep vertical pleats falling straight down, the two panels meeting at a clean vertical "
          "centre seam exactly in the middle of the image. A slim brushed-brass rail with small brass rings runs across the very top edge. "
          "Soft even daylight, gentle realistic shadows in the folds, subtle linen weave texture. Calm premium interior photograph, muted palette. "
          "No people, no text, no logos, no floor, no furniture, no props, no wall visible; the curtain fills the whole frame to all four edges.")
name, seed = sys.argv[1], int(sys.argv[2])
body = json.dumps({'prompt': PROMPT, 'aspect_ratio': '3:4', 'resolution': '2K', 'num_images': 1, 'output_format': 'png', 'seed': seed}).encode()
r = json.load(urllib.request.urlopen(urllib.request.Request('https://queue.fal.run/fal-ai/nano-banana-2', data=body, headers=H), timeout=60))
for _ in range(100):
    time.sleep(3)
    st = json.load(urllib.request.urlopen(urllib.request.Request(r['status_url'], headers=H), timeout=60))
    if st['status'] == 'COMPLETED': break
    if st['status'] not in ('IN_QUEUE', 'IN_PROGRESS'):
        print(name, 'failed', st['status']); sys.exit(1)
res = json.load(urllib.request.urlopen(urllib.request.Request(r['response_url'], headers=H), timeout=60))
(S / f'{name}.png').write_bytes(urllib.request.urlopen(res['images'][0]['url'], timeout=120).read())
print(name, 'ok')
