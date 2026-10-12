import base64, json, subprocess, sys, time, urllib.request, pathlib
S = pathlib.Path(__file__).parent
W = pathlib.Path('/Users/mikolajskaziak/Desktop/FitIT/backend/src/FitIt.Api/wwwroot')
out = subprocess.run(['dotnet', 'user-secrets', 'list', '--id', 'fitit-api-dev'], capture_output=True, text=True).stdout
KEY = next(l.split('=', 1)[1].strip() for l in out.splitlines() if l.startswith('Fal:ApiKey'))
H = {'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json'}
def uri(path):
    p = pathlib.Path(path)
    mime = 'image/png' if p.suffix == '.png' else 'image/jpeg'
    return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()
KEEP = ("Keep this exact mannequin: same body, same pose, same framing and scale, same featureless matte head, full body from head to feet in frame, "
        "same plain pale sage seamless backdrop #E6EBE3, same soft daylight and floor shadow. Dress it realistically, garments fitted naturally on the body. "
        "No text, no logos, no human face, nothing else added to the scene.")
LOOKS = {
 'normal': "Dress this exact mannequin in exactly these garments, shown in the reference images: the white button-down shirt worn open collar under the grey crew-neck knit sweater, straight blue jeans, white leather sneakers. ",
 'cold': "Dress this exact mannequin as for a cold day: the black wool overcoat worn open over the grey crew-neck knit sweater, a thick camel wool scarf wrapped around the neck, straight blue jeans, white leather sneakers. Same jeans and sneakers as in the base picture; only the upper layers change. ",
 'warm': "Dress this exact mannequin as for a warm day: only the plain white short-sleeve T-shirt, straight blue jeans, white leather sneakers. Same jeans and sneakers as in the base picture; no sweater, no jacket, no scarf. ",
}
GARMENTS = {'normal': ['white_shirt.png', 'gray_sweater.png', 'blue_jeans.png', 'white_sneakers.png'],
            'cold': ['black_winter_coat.png', 'gray_sweater.png'], 'warm': ['white_tshirt.png']}
def run(sex, look, base):
    refs = [uri(base)] + [uri(W / 'starter' / g) for g in GARMENTS[look]]
    body = json.dumps({'prompt': LOOKS[look] + KEEP, 'image_urls': refs, 'aspect_ratio': '3:4', 'resolution': '1K', 'num_images': 1, 'output_format': 'png'}).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request('https://queue.fal.run/fal-ai/nano-banana-2/edit', data=body, headers=H), timeout=120))
    for _ in range(100):
        time.sleep(3)
        st = json.load(urllib.request.urlopen(urllib.request.Request(r['status_url'], headers=H), timeout=60))
        if st['status'] == 'COMPLETED': break
        if st['status'] not in ('IN_QUEUE', 'IN_PROGRESS'):
            print('failed', st['status']); sys.exit(1)
    res = json.load(urllib.request.urlopen(urllib.request.Request(r['response_url'], headers=H), timeout=60))
    name = sys.argv[4] if len(sys.argv) > 4 else f'{sex}-{look}'
    (S / f'{name}.png').write_bytes(urllib.request.urlopen(res['images'][0]['url'], timeout=120).read())
    print(name, 'ok')
sex, look, base = sys.argv[1], sys.argv[2], sys.argv[3]
run(sex, look, base)
