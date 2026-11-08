"""
Original score for the ZARI Deepavali film, synthesised from scratch (no samples, no licensing).
Raag Bhupali (S R G P D), Sa = C#3. Cues are locked to the animation in video.html.

  python3 music.py out.wav [duration]
"""
import sys, json
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 12.5
N = int(SR * DUR)
rng = np.random.default_rng(20261108)

SA = 138.59  # C#3
RATIO = {'S': 1, 'R': 9 / 8, 'G': 5 / 4, 'P': 3 / 2, 'D': 5 / 3}
def note(n, octave=0): return SA * RATIO[n] * 2 ** octave

# cues from video.html (window.cues())
IGNITE = 1.45
ROW = [5.166, 5.027, 4.849, 4.661, 4.490, 4.332, 4.497, 4.686, 4.812, 5.025, 5.168]
TITLE, SHEEN = 5.2, 9.4

L = np.zeros(N); Rch = np.zeros(N)
def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.414
    Rch[i:i + len(sig)] += sig * gain * r * 1.414

def tvec(d): return np.arange(int(d * SR)) / SR
def lp(x, fc, order=2): return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)

# ---- tanpura: Pa, Sa', Sa', Sa  with the jawari "buzz" (a resonance sweeping up the harmonics)
def tanpura_pluck(f, d=4.5):
    t = tvec(d); out = np.zeros_like(t)
    kc = 2.5 + 14 * (t / d) ** .7
    for k in range(1, 28):
        if f * k > 9000: break
        amp = k ** -0.9 * (1 + 2.2 * np.exp(-((k - kc) / 2.2) ** 2))
        out += amp * np.sin(2 * np.pi * f * k * t * (1 + 0.0006 * k) + rng.random() * 6.28)
    env = (1 - np.exp(-t / .012)) * np.exp(-t / 2.4)
    return out * env / 6

cycle = [(note('P', -1), -0.25), (note('S', 0), 0.1), (note('S', 0), 0.2), (note('S', -1), -0.1)]
t, k = 0.35, 0
while t < DUR:
    f, pan = cycle[k % 4]
    g = 0.55 * min(1, (t + .4) / 1.6)
    add(tanpura_pluck(f * (1 + rng.normal(0, .0005))), t, g, pan)
    t += 0.95 if k % 4 != 3 else 1.5
    k += 1

# ---- warm low pad (Sa + Pa), opening out after the flame catches
t = tvec(DUR - IGNITE)
pad = np.zeros_like(t)
for f, a in [(note('S', -1), 1), (note('P', -1), .55), (note('S', 0), .4), (note('G', 0), .12)]:
    for det in (-.0025, .0025):
        ph = 2 * np.pi * f * (1 + det) * t
        pad += a * (np.sin(ph) + .25 * np.sin(2 * ph) + .1 * np.sin(3 * ph))
pad = lp(pad, 900) * (1 - np.exp(-t / 1.6)) * (1 + .08 * np.sin(2 * np.pi * .18 * t))
add(pad / 9, IGNITE, 0.55)

# ---- ignition: soft breathy whoosh + oil-lamp catch, then a temple bell
d = 1.4; t = tvec(d)
whoosh = bp(rng.normal(0, 1, len(t)), 300, 3200) * (t / .06).clip(0, 1) * np.exp(-t / .35)
add(whoosh * .35, IGNITE - .04, 1.0, 0)
crk = np.zeros(int(.5 * SR))
for _ in range(18):
    i = int(rng.random() ** 2 * .45 * SR); crk[i:i + 40] += rng.normal(0, 1, 40) * np.exp(-np.arange(40) / 8) * rng.random()
add(hp(crk, 1500) * .5, IGNITE, 1.0, .05)

def bell(f, d=6.0, bright=1.0):
    t = tvec(d); out = np.zeros_like(t)
    for p, a, tau in [(.5, .5, 3.2), (1, 1, 2.6), (1.183, .5, 2.0), (1.506, .4, 1.6), (2.0, .35, 1.3), (2.74, .25 * bright, .9), (3.76, .15 * bright, .6), (5.4, .08 * bright, .35)]:
        out += a * np.sin(2 * np.pi * f * p * t + rng.random() * 6) * np.exp(-t / tau) * (1 + .004 * np.sin(2 * np.pi * 4.5 * t))
    return out * (1 - np.exp(-t / .002)) / 2.5
add(bell(note('S', 2)), IGNITE + .05, .32, 0)

# ---- threshold lamps: a santoor-like pluck as each pair lights, climbing the raag
def santoor(f, d=2.4):
    t = tvec(d); out = np.zeros_like(t)
    for det in (-.0018, 0, .0021):          # courses of strings, slightly apart
        for k, a in [(1, 1), (2, .45), (3, .3), (4, .12), (5, .08)]:
            out += a * np.sin(2 * np.pi * f * (1 + det) * k * t) * np.exp(-t * (1.6 + .9 * k))
    hit = hp(rng.normal(0, 1, len(t)), 3000) * np.exp(-t / .004) * .3
    return (out / 4 + hit) * (1 - np.exp(-t / .0015))
scale = [note('S', 1), note('R', 1), note('G', 1), note('P', 1), note('D', 1), note('S', 2)]
order = np.argsort(ROW); groups = []
for i in order:
    if groups and ROW[i] - groups[-1][0] < .06: groups[-1][1].append(i)
    else: groups.append([ROW[i], [i]])
for gi, (tg, idx) in enumerate(groups):
    for i in idx:
        add(santoor(scale[min(gi, 5)]), ROW[i], .2, (i - 5) / 6)

# ---- bansuri phrase under the greeting (breath, delayed vibrato, meend between notes)
def bansuri(phrase, t0):
    total = sum(d for _, _, d in phrase) + 1.8
    t = tvec(total); f = np.zeros_like(t); amp = np.zeros_like(t)
    cur = 0.0
    for n, o, d in phrase:
        i0, i1 = int(cur * SR), int((cur + d) * SR)
        f[i0:i1] = note(n, o); amp[i0:i1] = 1; cur += d
    f[int(cur * SR):] = f[int(cur * SR) - 1]
    # meend: glide between notes, and a gentle breath envelope
    f = lp(np.r_[np.full(4000, f[0]), f], 9, 1)[4000:]
    tail = np.exp(-np.maximum(0, t - cur) / .7)
    amp = lp(np.r_[np.zeros(2000), amp], 4, 1)[2000:] * np.where(t > cur, tail, 1)
    vib = 1 + .006 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t % 1.2) / .6, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(ph) + .22 * np.sin(2 * ph) + .06 * np.sin(3 * ph)
    breath = bp(rng.normal(0, 1, len(t)), 1200, 6000) * .05
    return (tone + breath) * amp * .3
phrase = [('G', 1, .9), ('R', 1, .45), ('G', 1, .55), ('P', 1, 1.1), ('D', 1, .55), ('P', 1, .5), ('G', 1, .6), ('R', 1, .35), ('S', 1, 1.6)]
add(bansuri(phrase, TITLE + .3), TITLE + .3, .55, -.08)

# ---- closing shimmer: small bells with the gold sheen
for j in range(7):
    add(bell(note(['S', 'G', 'P', 'D', 'S', 'G', 'P'][j], 3 if j > 3 else 2) * (1 + rng.normal(0, .002)), 2.5, .5),
        SHEEN + j * .07 + rng.random() * .03, .07, rng.uniform(-.6, .6))

# ---- quiet lamp crackle through the film
for _ in range(12):
    tc = rng.uniform(IGNITE + .6, DUR - .5); n = int(.012 * SR)
    add(lp(hp(rng.normal(0, 1, n) * np.exp(-np.arange(n) / 70), 1800), 7000) * rng.uniform(.03, .07), tc, 1, rng.uniform(-.2, .2))

# ---- room: synthetic hall reverb, decorrelated per channel
def ir(seed, d=3.2):
    r = np.random.default_rng(seed); t = tvec(d)
    return lp(r.normal(0, 1, len(t)), 5200) * np.exp(-t / .75) * (1 - np.exp(-t / .01))
wetL = fftconvolve(L, ir(1))[:N]; wetR = fftconvolve(Rch, ir(2))[:N]
s = np.max(np.abs(np.r_[wetL, wetR])) / max(1e-9, np.max(np.abs(np.r_[L, Rch])))
outL = L + wetL / s * .45; outR = Rch + wetR / s * .45

tt = np.arange(N) / SR
fade = np.clip(tt / .4, 0, 1) * np.clip((DUR - tt) / 1.4, 0, 1)
out = np.stack([outL, outR], 1) * fade[:, None]
out = hp(out.T, 35).T
out /= np.max(np.abs(out)) / 0.89  # ~ -1 dBFS peak
import wave
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1], f'{DUR}s')
