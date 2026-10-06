#!/usr/bin/env python3
"""Mock-ups of the FitIt mobile app. Every screen is built here as inline-styled HTML.

One colour only: sage (backdrop of every garment, selection, one emphasis panel) with a bottle green for actions;
everything else is neutral. This file is the source of the pages in docs/design/ekrany and of the design artifact.

  python3 docs/design/gen_design.py                   standalone pages in docs/design/ekrany, plus README.md
  python3 docs/design/gen_design.py --png             the same, plus a PNG of every page (needs Google Chrome)
  python3 docs/design/gen_design.py --preview DIR     one page with every screen, for checking layout in a browser
  python3 docs/design/gen_design.py --canvas OUT BASE_CANVAS_JSON     files for the design artifact, merged onto its canvas.json
"""
import argparse, json, os, re, subprocess, sys, tempfile, time
from html.parser import HTMLParser
from itertools import groupby
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))

# silhouette types cut from the author's reference image: (name, published asset url, local file)
SIL = {
    "k": [("Klepsydra", "/_blob/56142abd1c00d7032b8d8db24c358e09", "sylwetka-k-1-klepsydra.jpg"),
          ("Gruszka", "/_blob/3234fea5828cc4bae4dc9350f3b828d3", "sylwetka-k-2-gruszka.jpg"),
          ("Jabłko", "/_blob/9f12e9372e293dc1029d73cb85d9221d", "sylwetka-k-3-jablko.jpg"),
          ("Kolumna", "/_blob/71b6e38f63c586463850d7f27ef3f4ff", "sylwetka-k-4-kolumna.jpg"),
          ("Kielich", "/_blob/723a5ffc5f3b9631eb33f9d55c40adef", "sylwetka-k-5-kielich.jpg")],
    "m": [("Trójkąt", "/_blob/17d9f477697f99c4108985d2d7a7e512", "sylwetka-m-1-trojkat.jpg"),
          ("Odwrócony trójkąt", "/_blob/8357e19734c3d293ccd66a6d32a0e865", "sylwetka-m-2-odwrocony-trojkat.jpg"),
          ("Prostokąt", "/_blob/c7acdeef7ba3d8a79f349a3ad20595e8", "sylwetka-m-3-prostokat.jpg"),
          ("Owal", "/_blob/7d9148a7c1c6e2d26aeb25510f9b1e5c", "sylwetka-m-4-owal.jpg"),
          ("Trapez", "/_blob/cdfca85b0b4333640b00ebf85900f736", "sylwetka-m-5-trapez.jpg")],
}
ME = SIL["k"][0]

# ------------------------------------------------------------------ theme: sage + neutrals
L = dict(
    canvas="#F5F7F3", surface="#FFFFFF", text="#1F2A25", sec="#57625C", border="#E1E6DF", ctl="#838A84",
    action="#2F5D4C", on="#FFFFFF", danger="#A33B3B", ondanger="#FFFFFF", scrim="rgba(31,42,37,0.5)", skel="#E7ECE5",
    sage=("#DCE7DA", "#2B5846"), well="#DCE7DA", wellline="rgba(31,42,37,0.05)", cell="#FFFFFF", off=("#E1E6DF", "#57625C"),
    wxfill="#DCE7DA", gs="rgba(31,42,37,0.28)", gl="rgba(31,42,37,0.36)")
D = dict(
    canvas="#121815", surface="#1B2320", text="#ECF0EB", sec="#A5AFA8", border="#2A342F", ctl="#6E7972",
    action="#A8D2BD", on="#10201A", danger="#F2A3A3", ondanger="#2A0E0E", scrim="rgba(0,0,0,0.6)", skel="#252E29",
    sage=("#22362D", "#A8D2BD"), well="#C3D1C4", wellline="rgba(0,0,0,0)", cell="#1B2320", off=("#2A342F", "#A5AFA8"),
    wxfill="#2C4638", gs="rgba(31,42,37,0.28)", gl="rgba(31,42,37,0.36)")

FD = "'Bricolage Grotesque', 'Figtree', system-ui, sans-serif"
FB = "'Figtree', system-ui, -apple-system, 'Helvetica Neue', sans-serif"
FONTS = "family=Bricolage+Grotesque:opsz,wght@12..96,600&amp;family=Figtree:wght@400;600"
TY = {
    "meta": "font-size: 12px; line-height: 16px; font-weight: 400",
    "metam": "font-size: 12px; line-height: 16px; font-weight: 600",
    "sec": "font-size: 14px; line-height: 21px; font-weight: 400",
    "secm": "font-size: 14px; line-height: 21px; font-weight: 600",
    "body": "font-size: 16px; line-height: 24px; font-weight: 400",
    "label": "font-size: 16px; line-height: 24px; font-weight: 600",
    "sub": f"font-family: {FD}; font-size: 19px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em",
    "head": f"font-family: {FD}; font-size: 23px; line-height: 28px; font-weight: 600; letter-spacing: -0.01em",
    "disp": f"font-family: {FD}; font-size: 33px; line-height: 38px; font-weight: 600; letter-spacing: -0.02em; text-wrap: balance",
    "num": f"font-family: {FD}; font-size: 33px; line-height: 38px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums",
    "logo": f"font-family: {FD}; font-size: 48px; line-height: 52px; font-weight: 600; letter-spacing: -0.02em",
    "logos": f"font-family: {FD}; font-size: 28px; line-height: 34px; font-weight: 600; letter-spacing: -0.02em",
}
R_CTL, R_CARD, R_WELL, R_SHEET = 10, 16, 12, 20     # one shape rule: controls, cards, garment tiles, sheets


# ------------------------------------------------------------------ contrast gate
def _lum(h):
    h = h.lstrip("#")
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def _cr(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def contrast_report(name, T):
    bg, fg = T["sage"]
    pairs = [("text/canvas", T["text"], T["canvas"], 4.5), ("text/surface", T["text"], T["surface"], 4.5),
             ("sec/canvas", T["sec"], T["canvas"], 4.5), ("sec/surface", T["sec"], T["surface"], 4.5),
             ("on/action", T["on"], T["action"], 4.5), ("action/canvas", T["action"], T["canvas"], 4.5),
             ("action/surface", T["action"], T["surface"], 4.5), ("ctl/surface", T["ctl"], T["surface"], 3.0),
             ("ctl/canvas", T["ctl"], T["canvas"], 3.0), ("danger/surface", T["danger"], T["surface"], 4.5),
             ("danger/canvas", T["danger"], T["canvas"], 4.5), ("ondanger/danger", T["ondanger"], T["danger"], 4.5),
             ("off text/off fill", T["off"][1], T["off"][0], 4.5), ("action/sage (check, ring)", T["action"], bg, 3.0),
             ("sage fg/bg", fg, bg, 4.5), ("text/sage", T["text"], bg, 4.5), ("sec/sage", T["sec"], bg, 4.5),
             ("weather glyph line/canvas", T["text"], T["canvas"], 3.0)]
    rows = [(n, _cr(a, b), need) for n, a, b, need in pairs]
    return rows, [f"{name} {n}: {v:.2f} < {need}" for n, v, need in rows if v < need]


NAVY, WHITE, GREY, CAMEL, DENIM = "#27344F", "#F3F2EE", "#8E8E8A", "#C9B48A", "#3F5E82"
BROWN, OLIVE, BURG, LBLUE, CREAM, DGREY = "#6A4B35", "#5F6B4B", "#6F2536", "#A9C3DC", "#ECE4D2", "#55565A"

ICONS = {
    "sun": '<circle cx="12" cy="12" r="4.5"></circle><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"></path>',
    "hanger": '<path d="M12 8.5V7a2.5 2.5 0 1 0-2.5-2.5"></path><path d="M12 8.5 21.2 15.4a1.45 1.45 0 0 1-.87 2.6H3.67a1.45 1.45 0 0 1-.87-2.6L12 8.5Z"></path>',
    "bookmark": '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>',
    "user": '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    "plus": '<path d="M12 5v14M5 12h14"></path>',
    "search": '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.6-3.6"></path>',
    "sliders": '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"></path><circle cx="15" cy="7" r="2"></circle><circle cx="9" cy="17" r="2"></circle>',
    "right": '<path d="m9 18 6-6-6-6"></path>',
    "left": '<path d="m15 18-6-6 6-6"></path>',
    "x": '<path d="M18 6 6 18M6 6l12 12"></path>',
    "check": '<path d="M20 6 9 17l-5-5"></path>',
    "up": '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>',
    "down": '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>',
    "camera": '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path>',
    "more": '<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>',
    "eye": '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>',
    "navigation": '<path d="M3 11 22 2l-9 19-2-8-8-2z"></path>',
}


def icon(name, color, size=24):
    return (f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; display: block">{ICONS[name]}</svg>')


WX_NAMES = {"sun": "Słonecznie", "cloud-sun": "Przejaśnienia", "cloud": "Pochmurno", "rain": "Deszcz", "snow": "Śnieg"}


def wx(T, kind, size=64, muted=False, label=None):
    """Weather glyph: thin ink line with a sage fill. In the app: Phosphor duotone icons."""
    ink = T["ctl"] if muted else T["text"]
    fill = "none" if muted else T["wxfill"]
    st = f'stroke="{ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    cloud_mid = "M36 20h-2.52A16 16 0 1 0 18 40h18a10 10 0 0 0 0-20z"
    cloud_hi = "M34.2 14.2h-2.14A13.6 13.6 0 1 0 18.9 31.2h15.3a8.5 8.5 0 0 0 0-17z"
    cloud_low = "M28.5 23h-1.89A12 12 0 1 0 15 38h13.5a7.5 7.5 0 0 0 0-15z"
    shapes = {
        "sun": (f'<path d="M24 4v5M24 39v5M4 24h5M39 24h5M9.9 9.9l3.5 3.5M34.6 34.6l3.5 3.5M9.9 38.1l3.5-3.5M34.6 13.4l3.5-3.5" fill="none" {st}></path>'
                f'<circle cx="24" cy="24" r="9" fill="{fill}" {st}></circle>'),
        "cloud-sun": (f'<path d="M33 4V1M42 13h3M39.4 6.6l2.1-2.1M39.4 19.4l2.1 2.1M26.6 6.6l-2.1-2.1" fill="none" {st}></path>'
                      f'<circle cx="33" cy="13" r="6" fill="{fill}" {st}></circle><path d="{cloud_low}" fill="{fill}" {st}></path>'),
        "cloud": f'<path d="{cloud_mid}" fill="{fill}" {st}></path>',
        "rain": f'<path d="{cloud_hi}" fill="{fill}" {st}></path><path d="M16 36l-2 7M24 36l-2 7M32 36l-2 7" fill="none" {st}></path>',
        "snow": (f'<path d="{cloud_hi}" fill="{fill}" {st}></path><circle cx="15" cy="38" r="1.6" fill="{ink}"></circle>'
                 f'<circle cx="24" cy="42" r="1.6" fill="{ink}"></circle><circle cx="33" cy="38" r="1.6" fill="{ink}"></circle>'),
    }
    name = label or WX_NAMES[kind]
    return (f'<svg role="img" aria-label="{name}" width="{size}" height="{size}" viewBox="0 0 48 48" '
            f'style="flex-shrink: 0; display: block">{shapes[kind]}</svg>')


def box(style, inner, tag="div", attrs=""):
    a = (" " + attrs) if attrs else ""
    return f'<{tag}{a} style="{style}">{inner}</{tag}>'


def txt(tag, text, style, attrs=""):
    return box("margin: 0; " + style, text, tag, attrs)


def em(T, text):
    """Accent inside a headline: same typeface, the action colour."""
    return f'<span style="color: {T["action"]}">{text}</span>'


def btn(T, label, kind="primary", href=None, ic=None, full=True, compact=False, aria=None):
    h = 44 if compact else 48
    bg, fg, bd = {
        "primary": (T["action"], T["on"], T["action"]), "secondary": (T["surface"], T["text"], T["ctl"]),
        "text": ("transparent", T["action"], "transparent"), "danger": (T["danger"], T["ondanger"], T["danger"]),
        "dangertext": ("transparent", T["danger"], "transparent"), "off": (T["off"][0], T["off"][1], T["off"][0]),
    }[kind]
    style = (f"background: {bg}; color: {fg}; border: 1px solid {bd}; height: {h}px; box-sizing: border-box; border-radius: {R_CTL}px; "
             f"padding: 0 20px; display: flex; align-items: center; justify-content: center; gap: 8px; {TY['label']}; font-family: inherit; "
             f"cursor: pointer; text-decoration: none; white-space: nowrap; {'width: 100%' if full else 'flex-shrink: 0'}")
    inner = (icon(ic, fg, 20) if ic else "") + f"<span>{label}</span>"
    extra = (f' aria-label="{aria}"' if aria else "") + (' aria-disabled="true"' if kind == "off" else "")
    if href:
        return f'<a href="{href}"{extra} style="{style}">{inner}</a>'
    return f'<button type="button"{extra} style="{style}">{inner}</button>'


def iconbtn(T, ic, aria, href=None, color=None):
    style = ("width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: transparent; "
             f"border: none; padding: 0; cursor: pointer; flex-shrink: 0; border-radius: {R_CTL}px")
    inner = icon(ic, color or T["text"])
    if href:
        return f'<a href="{href}" aria-label="{aria}" style="{style}">{inner}</a>'
    return f'<button type="button" aria-label="{aria}" style="{style}">{inner}</button>'


def link(T, label, href, color=None):
    style = (f"{TY['secm']}; color: {color or T['action']}; text-decoration: underline; text-underline-offset: 3px; min-height: 44px; "
             "display: inline-flex; align-items: center; background: transparent; border: none; padding: 0; font-family: inherit; cursor: pointer")
    if href:
        return f'<a href="{href}" style="{style}">{label}</a>'
    return f'<button type="button" style="{style}">{label}</button>'


def field(T, fid, label, value="", ph="", typ="text", helper=None, lead=None, trail=None, aria=None):
    pad_l = "44px" if lead else "16px"
    pad_r = "48px" if trail else "16px"
    al = f' aria-label="{aria}"' if aria else ""
    inp = (f'<input id="{fid}" type="{typ}" value="{value}" placeholder="{ph}"{al} style="height: 48px; width: 100%; box-sizing: border-box; '
           f'border: 1px solid {T["ctl"]}; border-radius: {R_CTL}px; padding: 0 {pad_r} 0 {pad_l}; font-family: inherit; font-size: 16px; '
           f'line-height: 24px; color: {T["text"]}; background: {T["surface"]}; margin: 0">')
    extra = ""
    if lead:
        extra += box("position: absolute; left: 12px; top: 12px; pointer-events: none", icon(lead, T["sec"]), "span")
    if trail:
        extra += (f'<button type="button" aria-label="{trail[1]}" style="position: absolute; right: 2px; top: 2px; width: 44px; height: 44px; '
                  f'display: flex; align-items: center; justify-content: center; background: transparent; border: none; padding: 0; cursor: pointer">'
                  f'{icon(trail[0], T["sec"])}</button>')
    parts = ""
    if label:
        parts += f'<label for="{fid}" style="{TY["secm"]}; color: {T["text"]}">{label}</label>'
    parts += box("position: relative; display: flex", inp + extra)
    if helper:
        parts += txt("p", helper, f"{TY['meta']}; color: {T['sec']}")
    return box("display: flex; flex-direction: column; gap: 8px", parts)


def chip(T, label, aria):
    bg, fg = T["sage"]
    return (f'<button type="button" aria-label="{aria}" style="height: 44px; box-sizing: border-box; padding: 0 12px 0 16px; border-radius: 22px; '
            f'border: 1px solid {bg}; background: {bg}; color: {fg}; {TY["secm"]}; font-family: inherit; display: flex; '
            f'align-items: center; gap: 4px; cursor: pointer; flex-shrink: 0"><span>{label}</span>{icon("x", fg, 16)}</button>')


def card(T, inner, extra=""):
    return box(f"background: {T['surface']}; border: 1px solid {T['border']}; border-radius: {R_CARD}px; overflow: hidden; {extra}", inner, "section")


def option(T, label, on, role="radio"):
    """Selectable tile shared by occasions and styles: outlined when idle, sage fill, ring and check when chosen."""
    if on:
        look = f"background: {T['sage'][0]}; border: 2px solid {T['action']}; padding: 5px 11px 5px 15px"
        mark = icon("check", T["action"], 20)
    else:
        look = f"background: {T['surface']}; border: 1px solid {T['ctl']}; padding: 6px 16px"
        mark = ""
    return (f'<button type="button" role="{role}" aria-checked="{"true" if on else "false"}" style="{look}; min-height: 56px; box-sizing: border-box; '
            f'border-radius: {R_CTL}px; color: {T["text"]}; {TY["secm"]}; font-family: inherit; text-align: left; cursor: pointer; min-width: 0; '
            f'display: flex; align-items: center; justify-content: space-between; gap: 8px"><span style="min-width: 0">{label}</span>{mark}</button>')


def options(T, labels, chosen, aria, role="radio"):
    cells = "".join(option(T, lab, i in chosen, role) for i, lab in enumerate(labels))
    group = "radiogroup" if role == "radio" else "group"
    return box("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px", cells, "div", f'role="{group}" aria-label="{aria}"')


def segmented(T, opts, selected, aria, hrefs=None):
    cells = ""
    for i, o in enumerate(opts):
        on = i == selected
        bg, fg = (T["action"], T["on"]) if on else ("transparent", T["text"])
        style = (f"flex: 1; height: 44px; background: {bg}; color: {fg}; border: none; border-radius: 6px; {TY['secm']}; font-family: inherit; "
                 "cursor: pointer; padding: 0 4px; display: flex; align-items: center; justify-content: center; text-decoration: none; min-width: 0")
        if hrefs:
            cur = ' aria-current="page"' if on else ""
            cells += f'<a href="{hrefs[i]}"{cur} style="{style}">{o}</a>'
        else:
            cells += f'<button type="button" role="radio" aria-checked="{"true" if on else "false"}" style="{style}">{o}</button>'
    tag, attrs = ("nav", f'aria-label="{aria}"') if hrefs else ("div", f'role="radiogroup" aria-label="{aria}"')
    return box(f"display: flex; gap: 4px; padding: 3px; background: {T['surface']}; border: 1px solid {T['ctl']}; border-radius: {R_CTL}px; flex-shrink: 0",
               cells, tag, attrs)


def labeled(T, label, control, helper=None):
    parts = txt("p", label, f"{TY['secm']}; color: {T['text']}") + control
    if helper:
        parts += txt("p", helper, f"{TY['meta']}; color: {T['sec']}")
    return box("display: flex; flex-direction: column; gap: 8px", parts)


def switch(T, on, aria):
    track = T["action"] if on else T["ctl"]
    knob = T["on"] if on else T["surface"]
    side = "flex-end" if on else "flex-start"
    return (f'<button type="button" role="switch" aria-checked="{"true" if on else "false"}" aria-label="{aria}" style="width: 52px; height: 44px; '
            f'background: transparent; border: none; padding: 0; display: flex; align-items: center; cursor: pointer; flex-shrink: 0">'
            f'<span style="width: 52px; height: 32px; box-sizing: border-box; border-radius: 16px; background: {track}; padding: 2px; display: flex; '
            f'justify-content: {side}; align-items: center"><span style="width: 28px; height: 28px; border-radius: 14px; background: {knob}; display: block"></span></span></button>')


def srow(T, label, value=None, right=None, last=False, href=None, meta=None, chev=False, accent=False):
    left = txt("span", label, f"{TY['label'] if accent else TY['body']}; color: {T['action'] if accent else T['text']}")
    if meta:
        left = box("display: flex; flex-direction: column; gap: 2px; min-width: 0", left + txt("span", meta, f"{TY['meta']}; color: {T['sec']}"))
    r = ""
    if value:
        r += txt("span", value, f"{TY['body']}; color: {T['sec']}; font-variant-numeric: tabular-nums; text-align: right")
    if right:
        r += right
    if chev:
        r += icon("right", T["action"] if accent else T["sec"], 20)
    rbox = box("display: flex; align-items: center; gap: 8px; flex-shrink: 0", r) if r else ""
    bb = "none" if last else f"1px solid {T['border']}"
    base = ("min-height: 56px; box-sizing: border-box; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; "
            "gap: 16px; color: inherit")
    if href:
        return f'<a href="{href}" style="{base}; border-bottom: {bb}; text-decoration: none">{left}{rbox}</a>'
    if chev:
        return (f'<button type="button" style="{base}; width: 100%; background: transparent; border-top: none; border-left: none; border-right: none; '
                f'border-bottom: {bb}; font-family: inherit; text-align: left; cursor: pointer">{left}{rbox}</button>')
    return box(f"{base}; border-bottom: {bb}", left + rbox)


def tabbar(T, active, linked=True):
    items = [("today", "Dziś", "sun", "Main.dc.html"), ("wardrobe", "Szafa", "hanger", "Szafa.dc.html"),
             ("outfits", "Outfity", "bookmark", "Outfity.dc.html"), ("profile", "Profil", "user", "Profil.dc.html")]
    cells = ""
    for key, label, ic, href in items:
        on = key == active
        col = T["action"] if on else T["sec"]
        bar = f'<span style="width: 24px; height: 3px; border-radius: 0 0 2px 2px; background: {T["action"] if on else "transparent"}; display: block"></span>'
        inner = (bar + box("margin-top: 9px", icon(ic, col), "span")
                 + txt("span", label, f"{TY['metam']}; color: {col}; margin-top: 4px"))
        style = ("flex: 1; height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; "
                 "text-decoration: none; background: transparent; border: none; padding: 0; font-family: inherit; cursor: pointer")
        cur = ' aria-current="page"' if on else ""
        cells += (f'<a href="{href}"{cur} style="{style}">{inner}</a>' if linked else f'<button type="button"{cur} style="{style}">{inner}</button>')
    return box(f"display: flex; background: {T['surface']}; border-top: 1px solid {T['border']}; padding-bottom: 20px; flex-shrink: 0",
               cells, "nav", 'aria-label="Główne"')


def garment(kind, fill, T):
    base = f'fill="{fill}" stroke="{T["gs"]}" stroke-width="1.5" stroke-linejoin="round"'
    line = f'fill="none" stroke="{T["gl"]}" stroke-width="1.5" stroke-linecap="round"'
    shapes = {
        "tee": f'<path d="M34 16 L44 12 Q50 19 56 12 L66 16 L86 30 L78 44 L68 38 L68 88 L32 88 L32 38 L22 44 L14 30 Z" {base}></path>',
        "shirt": f'<path d="M34 14 L44 10 L50 17 L56 10 L66 14 L88 62 L78 67 L68 44 L68 90 L32 90 L32 44 L22 67 L12 62 Z" {base}></path><path d="M50 17 L50 90" {line}></path>',
        "sweater": f'<path d="M34 14 L43 11 Q50 18 57 11 L66 14 L88 62 L78 67 L68 44 L68 90 L32 90 L32 44 L22 67 L12 62 Z" {base}></path><path d="M32 83 L68 83" {line}></path>',
        "trousers": f'<path d="M30 10 L70 10 L76 92 L57 92 L50 34 L43 92 L24 92 Z" {base}></path><path d="M30 18 L70 18" {line}></path>',
        "coat": f'<path d="M34 10 L45 7 L50 16 L55 7 L66 10 L90 58 L80 63 L70 42 L72 95 L28 95 L30 42 L20 63 L10 58 Z" {base}></path><path d="M50 16 L50 95" {line}></path>',
        "sneakers": f'<path d="M8 64 Q8 52 20 52 L34 52 Q40 60 58 62 Q84 64 92 72 L92 78 L8 78 Z" {base}></path><path d="M8 72 L92 72" {line}></path>',
        "boots": f'<path d="M26 20 L50 20 L50 54 Q70 58 84 66 Q92 70 92 78 L26 78 Z" {base}></path><path d="M26 72 L92 72" {line}></path>',
        "scarf": f'<path d="M22 24 Q50 10 78 24 L74 36 Q50 24 26 36 Z" {base}></path><path d="M56 30 L69 32 L66 86 L54 84 Z" {base}></path>',
    }
    return f'<svg aria-hidden="true" viewBox="0 0 100 100" style="width: 100%; height: 100%; display: block">{shapes[kind]}</svg>'


def wellcss(T, radius=R_WELL):
    """Sage backdrop behind every garment photo, the same everywhere."""
    return f"background: {T['well']}; border: 1px solid {T['wellline']}; border-radius: {radius}px"


def gcell(kind, fill, T, h, pad=12, radius=R_WELL, extra=""):
    return box(f"height: {h}px; box-sizing: border-box; padding: {pad}px; display: flex; align-items: center; justify-content: center; min-width: 0; "
               f"{wellcss(T, radius)}; {extra}", garment(kind, fill, T))


def collage(T, items, label, h=236):
    """An outfit is a plain grid of garment tiles, with no frame around it."""
    if len(items) == 5:
        cols, ch = 3, (h - 8) // 2
        cells = gcell(items[0][0], items[0][1], T, h, extra="grid-row: span 2")
        cells += "".join(gcell(k, c, T, ch) for k, c in items[1:])
    else:
        cols, ch = 2, (h - 8) // 2
        cells = "".join(gcell(k, c, T, ch) for k, c in items)
    return box(f"height: {h}px; display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: 8px; flex-shrink: 0",
               cells, "div", f'role="img" aria-label="{label}"')


def skel(T, w, h, r=8, extra=""):
    return box(f"width: {w}; height: {h}px; border-radius: {r}px; background: {T['skel']}; flex-shrink: 0; display: block; {extra}", "", "span")


def tile(T, kind, fill, name, caption="", href=None):
    cap = caption if caption else "&nbsp;"
    inner = (gcell(kind, fill, T, 148, pad=20)
             + box("display: flex; flex-direction: column; gap: 2px; padding: 0 4px",
                   txt("span", name, f"{TY['secm']}; color: {T['text']}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis")
                   + txt("span", cap, f"{TY['meta']}; color: {T['sec']}")))
    style = ("display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: inherit; min-width: 0; background: transparent; "
             "border: none; padding: 0; font-family: inherit; text-align: left; cursor: pointer")
    if href:
        return f'<a href="{href}" style="{style}">{inner}</a>'
    return f'<button type="button" style="{style}">{inner}</button>'


def screen(T, inner, h=844, w=390):
    return box(f"width: {w}px; height: {h}px; box-sizing: border-box; background: {T['canvas']}; color: {T['text']}; font-family: {FB}; "
               "display: flex; flex-direction: column; position: relative; overflow: hidden", inner)


MAIN = "flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 52px 16px 16px; box-sizing: border-box"


def steps(T, n, back, total=5):
    bars = "".join(f'<span style="flex: 1; height: 4px; border-radius: 2px; background: {T["action"] if i <= n else T["border"]}; display: block"></span>'
                   for i in range(1, total + 1))
    top = box("display: flex; align-items: center; justify-content: space-between; margin: 0 -10px",
              iconbtn(T, "left", "Wróć", back) + txt("p", f"Krok {n} z {total}", f"{TY['secm']}; color: {T['sec']}")
              + box("width: 44px; height: 44px", "", "span"))
    return box("display: flex; flex-direction: column; gap: 8px",
               top + box("display: flex; gap: 4px", bars, "div", f'role="img" aria-label="Krok {n} z {total}"'), "header")


def backhead(T, title, meta, back, right=""):
    titles = box("display: flex; flex-direction: column; min-width: 0; flex: 1",
                 txt("h1", title, TY["head"]) + (txt("p", meta, f"{TY['sec']}; color: {T['sec']}") if meta else ""))
    return box("display: flex; align-items: flex-start; gap: 4px; margin-left: -10px", iconbtn(T, "left", "Wróć", back) + titles + right, "header")


def panel(T, inner, extra=""):
    """The one emphasis container: a sage panel. At most one per screen."""
    return box(f"background: {T['sage'][0]}; border-radius: {R_CARD}px; padding: 16px; flex-shrink: 0; {extra}", inner, "section")


# ------------------------------------------------------------------ brand

def brandmark(T, small=False):
    side, rad, ic, key = (40, 10, 22, "logos") if small else (56, 14, 30, "logo")
    mark = box(f"width: {side}px; height: {side}px; border-radius: {rad}px; background: {T['action']}; display: flex; align-items: center; "
               "justify-content: center; flex-shrink: 0", icon("hanger", T["on"], ic), "span", 'aria-hidden="true"')
    word = f'<span aria-hidden="true">Fit</span><span aria-hidden="true" style="color: {T["action"]}">It</span>'
    return box(f"display: flex; align-items: center; gap: {12 if small else 16}px",
               mark + txt("p", word, f"{TY[key]}; color: {T['text']}", 'role="img" aria-label="FitIt"'))


def mosaic(T):
    cols = [[("shirt", NAVY), ("sneakers", WHITE)], [("sweater", BURG), ("coat", GREY)], [("trousers", CAMEL), ("boots", BROWN)]]
    out = ""
    for i, col in enumerate(cols):
        tiles = "".join(gcell(k, c, T, 132, pad=20, radius=R_CARD) for k, c in col)
        out += box(f"flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; margin-top: {24 if i == 1 else 0}px", tiles)
    return box("display: flex; gap: 8px; flex-shrink: 0", out, "div", 'aria-hidden="true"')


# ------------------------------------------------------------------ direction board

def s_palette(T):
    def swatch(bg, fg, body, name, role, flex):
        return box(f"flex: {flex}; min-width: 0; background: {bg}; border-radius: {R_CARD}px; padding: 20px; box-sizing: border-box; height: 176px; "
                   "display: flex; flex-direction: column; justify-content: space-between",
                   box("display: flex; flex-direction: column; gap: 4px",
                       txt("h2", name, f"{TY['head']}; color: {fg}") + txt("p", bg, f"{TY['meta']}; color: {fg}"))
                   + txt("p", role, f"{TY['sec']}; color: {body}"), "section")

    def chipcol(label, value, ring=False):
        bd = T["ctl"] if ring else value
        return box("display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0",
                   box(f"height: 56px; border-radius: {R_CTL}px; background: {value}; border: 1px solid {bd}; box-sizing: border-box; display: block", "", "span")
                   + box("display: flex; flex-direction: column", txt("span", label, f"{TY['secm']}; color: {T['text']}")
                         + txt("span", value, f"{TY['meta']}; color: {T['sec']}")))

    head = box("display: flex; flex-direction: column; gap: 8px",
               txt("h1", "Jeden kolor: " + em(T, "szałwia"), TY["disp"])
               + txt("p", "Szałwia jest tłem każdego ubrania i znakiem wyboru. Butelkowa zieleń to przyciski. Wszystko inne jest neutralne.",
                     f"{TY['body']}; color: {T['sec']}"), "header")
    duo = box("display: flex; gap: 16px",
              swatch(T["sage"][0], T["sage"][1], T["text"], "Szałwia", "Tło ubrań i sylwetek, zaznaczone opcje, najwyżej jeden panel wyróżnienia na ekran.", 2)
              + swatch(T["action"], T["on"], T["on"], "Butelkowa zieleń", "Przyciski, linki, postęp i akcent w nagłówku.", 1))
    neutrals = box("display: flex; flex-direction: column; gap: 12px",
                   txt("h2", "Neutralne", TY["sub"])
                   + box("display: flex; gap: 16px",
                         chipcol("Tło", T["canvas"], True) + chipcol("Karta", T["surface"], True) + chipcol("Linie", T["border"], True)
                         + chipcol("Tekst", T["text"]) + chipcol("Tekst pomocniczy", T["sec"]) + chipcol("Usuwanie", T["danger"])))
    kinds = ["sun", "cloud-sun", "cloud", "rain", "snow"]
    weather = box("display: flex; flex-direction: column; gap: 12px",
                  txt("h2", "Pogoda: ikona zamiast ramki", TY["sub"])
                  + box("display: flex; gap: 16px",
                        "".join(box("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-start",
                                    wx(T, k, 56) + txt("span", WX_NAMES[k], f"{TY['secm']}; color: {T['text']}")) for k in kinds)))
    typo = box("display: flex; gap: 32px",
               box("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px",
                   txt("h2", "Nagłówki: Bricolage Grotesque", TY["sub"])
                   + txt("p", "Co dziś " + em(T, "ubrać?"), TY["disp"])
                   + txt("p", "Propozycje na dziś", TY["head"]))
               + box("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px",
                     txt("h2", "Tekst: Figtree", TY["sub"])
                     + txt("p", "Granatowa koszula i beżowe chinosy to zestaw, po który sięgasz najczęściej.", TY["body"])
                     + txt("p", "Rano 7°C, po południu 18°C.", f"{TY['sec']}; color: {T['sec']}")
                     + txt("p", "Zostały 4 z 5 wizualizacji na dziś.", f"{TY['meta']}; color: {T['sec']}")))
    parts = box("display: flex; flex-direction: column; gap: 12px",
                txt("h2", "Elementy", TY["sub"])
                + box("display: flex; gap: 12px; align-items: center; flex-wrap: wrap",
                      btn(T, "Zaproponuj zestawy", full=False) + btn(T, "Pokaż na sylwetce", "secondary", full=False)
                      + box("width: 168px; flex-shrink: 0; display: flex; flex-direction: column", option(T, "Na co dzień", True))
                      + box("width: 168px; flex-shrink: 0; display: flex; flex-direction: column", option(T, "Trening", False))
                      + chip(T, "Zapomniane", "Usuń filtr: zapomniane")
                      + box("width: 72px; height: 72px; flex-shrink: 0", gcell("shirt", NAVY, T, 72, pad=8))))
    return screen(T, box("flex: 1; display: flex; flex-direction: column; gap: 32px; padding: 40px; box-sizing: border-box",
                         head + duo + neutrals + weather + typo + parts, "main"), PALETTE_H, 860)


PALETTE_H = 1080


# ------------------------------------------------------------------ entry

def s_start(T, linked=True):
    top = box("display: flex; flex-direction: column; gap: 24px",
              mosaic(T) + brandmark(T)
              + box("display: flex; flex-direction: column; gap: 8px",
                    txt("h1", "Pełna szafa, a nie masz się " + em(T, "w co ubrać?"), TY["disp"])
                    + txt("p", "Ułożymy zestawy z tego, co już masz. Na pogodę i na okazję.", f"{TY['body']}; color: {T['sec']}")))
    actions = box("display: flex; flex-direction: column; gap: 8px",
                  btn(T, "Załóż konto", href="Rejestracja-konto.dc.html" if linked else None)
                  + btn(T, "Mam już konto", "secondary", href="Logowanie.dc.html" if linked else None))
    return screen(T, box(MAIN + "; padding-bottom: 32px; gap: 16px; justify-content: space-between", top + actions, "main"))


def s_login(T):
    head = box("display: flex; flex-direction: column; gap: 32px",
               brandmark(T, small=True)
               + box("display: flex; flex-direction: column; gap: 8px",
                     txt("h1", "Dobrze Cię widzieć", TY["disp"])
                     + txt("p", "Zaloguj się, żeby zobaczyć zestawy na dziś.", f"{TY['body']}; color: {T['sec']}")), "header")
    form = box("display: flex; flex-direction: column; gap: 16px",
               field(T, "login-email", "E-mail", typ="email")
               + box("display: flex; flex-direction: column; align-items: flex-start",
                     box("align-self: stretch", field(T, "login-pass", "Hasło", typ="password", trail=("eye", "Pokaż hasło")))
                     + link(T, "Nie pamiętasz hasła?", None)))
    foot = box("display: flex; flex-direction: column; gap: 4px; align-items: center",
               btn(T, "Zaloguj się", href="Main.dc.html")
               + box("display: flex; gap: 8px; align-items: center",
                     txt("span", "Nie masz konta?", f"{TY['sec']}; color: {T['sec']}") + link(T, "Załóż konto", "Rejestracja-konto.dc.html")))
    return screen(T, box(MAIN + "; padding-top: 60px; padding-bottom: 24px; gap: 24px; justify-content: space-between",
                         box("display: flex; flex-direction: column; gap: 24px", head + form) + foot, "main"))


def wizard(T, n, back, title, lead, body, footer):
    top = box("display: flex; flex-direction: column; gap: 24px; flex: 1; min-height: 0",
              steps(T, n, back)
              + box("display: flex; flex-direction: column; gap: 8px", txt("h1", title, TY["disp"]) + txt("p", lead, f"{TY['body']}; color: {T['sec']}"))
              + body)
    return screen(T, box(MAIN + "; padding-bottom: 32px; gap: 16px",
                         top + box("display: flex; flex-direction: column; gap: 4px; align-items: center", footer), "main"))


def s_reg1(T):
    body = box("display: flex; flex-direction: column; gap: 16px",
               field(T, "reg-email", "E-mail", typ="email", ph="np. ola@poczta.pl")
               + field(T, "reg-pass", "Hasło", typ="password", helper="Co najmniej 8 znaków.", trail=("eye", "Pokaż hasło")))
    return wizard(T, 1, "Start.dc.html", "Załóż konto", "Zaczniemy od adresu e-mail i hasła.", body,
                  btn(T, "Dalej", href="Rejestracja-o-tobie.dc.html") + link(T, "Mam już konto", "Logowanie.dc.html"))


def s_reg2(T):
    body = box("display: flex; flex-direction: column; gap: 16px",
               field(T, "reg-name", "Imię", value="Ola")
               + field(T, "reg-birth", "Data urodzenia", value="14.03.1999", ph="DD.MM.RRRR", trail=("calendar", "Wybierz datę z kalendarza"),
                       helper="Potrzebna do potwierdzenia wieku. Nikomu jej nie pokazujemy.")
               + labeled(T, "Płeć", segmented(T, ["Kobieta", "Mężczyzna"], 0, "Płeć"),
                         "Od niej zależy, które typy sylwetek pokażemy w następnym kroku."))
    return wizard(T, 2, "Rejestracja-konto.dc.html", "Powiedz coś o sobie", "Dzięki temu zwrócimy się do Ciebie po imieniu.", body,
                  btn(T, "Dalej", href="Rejestracja-sylwetka.dc.html"))


def silhouettes(T, sex, chosen):
    cells = ""
    for i, (name, src, _) in enumerate(SIL[sex]):
        on = i == chosen
        frame = f"3px solid {T['action']}" if on else f"1px solid {T['wellline']}"
        mark = (box(f"position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 12px; background: {T['action']}; "
                    "display: flex; align-items: center; justify-content: center", icon("check", T["on"], 16), "span") if on else "")
        photo = box(f"position: relative; height: 172px; box-sizing: border-box; border: {frame}; border-radius: {R_WELL}px; overflow: hidden; background: {T['well']}",
                    f'<img src="{src}" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block">{mark}', "span")
        cells += (f'<button type="button" role="radio" aria-checked="{"true" if on else "false"}" aria-label="{name}" style="display: flex; '
                  f'flex-direction: column; gap: 8px; padding: 0; border: none; background: transparent; font-family: inherit; color: {T["text"]}; '
                  f'cursor: pointer; min-width: 0; text-align: center">{photo}<span style="{TY["secm"]}">{name}</span></button>')
    return box("display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 8px; align-items: start", cells, "div",
               'role="radiogroup" aria-label="Typ sylwetki"')


def s_reg3(T, sex, chosen, linked=True):
    return wizard(T, 3, "Rejestracja-o-tobie.dc.html" if linked else None, "Wybierz typ sylwetki",
                  "Pokażemy na niej Twoje zestawy. Wybierz najbliższą swojej, zmienisz ją w profilu.", silhouettes(T, sex, chosen),
                  btn(T, "Dalej", href="Rejestracja-styl.dc.html" if linked else None))


def s_reg4(T):
    body = options(T, ["Casual", "Smart", "Elegancki", "Sportowy", "Streetwear"], {0, 1}, "Styl", role="checkbox")
    return wizard(T, 4, "Rejestracja-sylwetka.dc.html", "Jaki styl jest Ci bliski?", "Wybierz jeden lub kilka. Zmienisz to potem w profilu.", body,
                  btn(T, "Dalej", href="Rejestracja-lokalizacja.dc.html") + link(T, "Pomiń", "Rejestracja-lokalizacja.dc.html"))


def thermal(T):
    return labeled(T, "Jak zwykle odczuwasz temperaturę?",
                   segmented(T, ["Marznę", "Normalnie", "Jest mi ciepło"], 1, "Odczuwanie temperatury"),
                   "Dzięki temu dobierzemy cieplejsze albo lżejsze zestawy.")


def legal(T):
    return txt("p", 'Zakładając konto, akceptujesz <span style="text-decoration: underline">Regulamin</span> i '
                    '<span style="text-decoration: underline">Politykę prywatności</span>.',
               f"{TY['meta']}; color: {T['sec']}; text-align: center; padding-bottom: 8px")


def s_reg5(T):
    info = box("display: flex; gap: 12px; align-items: flex-start",
               icon("navigation", T["action"])
               + box("display: flex; flex-direction: column; gap: 4px; min-width: 0",
                     txt("h2", "Użyjemy lokalizacji telefonu", f"{TY['label']}; color: {T['text']}")
                     + txt("p", "Za chwilę telefon zapyta o zgodę. Wystarczy przybliżona lokalizacja, sprawdzamy tylko pogodę.",
                           f"{TY['sec']}; color: {T['sec']}")), "section")
    body = box("display: flex; flex-direction: column; gap: 24px", info + thermal(T))
    return wizard(T, 5, "Rejestracja-styl.dc.html", "Pogoda tam, gdzie jesteś", "Zestawy dobieramy do pogody w Twojej okolicy. Nie musisz podawać miasta.", body,
                  legal(T) + btn(T, "Załóż konto", href="Main.dc.html") + link(T, "Wolę wpisać miasto", "Rejestracja-miasto.dc.html"))


def s_reg5_city(T):
    body = box("display: flex; flex-direction: column; gap: 24px",
               box("display: flex; flex-direction: column; align-items: flex-start",
                   box("align-self: stretch", field(T, "reg-city", "Miasto", value="Gliwice", lead="search"))
                   + link(T, "Użyj lokalizacji telefonu", "Rejestracja-lokalizacja.dc.html"))
               + thermal(T))
    return wizard(T, 5, "Rejestracja-lokalizacja.dc.html", "Wpisz miasto", "Bez dostępu do lokalizacji sprawdzimy pogodę dla wybranego miasta.", body,
                  legal(T) + btn(T, "Załóż konto", href="Main.dc.html"))


# ------------------------------------------------------------------ today and proposals

OCCASIONS = ["Na co dzień", "Praca lub uczelnia", "Spotkanie biznesowe", "Randka lub wieczór", "Ze znajomymi", "Trening"]


def weather_row(T, glyph, temp, headline, advice, place):
    """Weather sits in the page itself: place, temperature, one line of advice, and a glyph for the sky. No box."""
    left = box("display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1",
               box("display: flex; align-items: center; gap: 4px", icon("navigation", T["sec"], 16) + txt("p", place, f"{TY['secm']}; color: {T['sec']}"))
               + txt("p", temp, f"{TY['num']}; color: {T['text']}")
               + box("display: flex; flex-direction: column",
                     txt("p", headline, f"{TY['label']}; color: {T['text']}") + txt("p", advice, f"{TY['sec']}; color: {T['sec']}")))
    return box("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-shrink: 0", left + wx(T, glyph, 80),
               "section", 'aria-label="Pogoda"')


def occasion_block(T):
    return box("display: flex; flex-direction: column; gap: 8px", txt("h2", "Okazja", TY["sub"]) + options(T, OCCASIONS, {0}, "Okazja"))


def today_head(T):
    return box("display: flex; flex-direction: column; gap: 2px",
               txt("p", "Cześć, Ola. Dziś poniedziałek, 5 października.", f"{TY['sec']}; color: {T['sec']}")
               + txt("h1", "Co dziś " + em(T, "ubrać?"), TY["disp"]), "header")


def s_today(T, linked=True):
    body = (today_head(T)
            + weather_row(T, "sun", "7-18°C", "Słonecznie, bez opadów", "Rano chłodno, przyda się warstwa do zdjęcia.", "Gliwice")
            + occasion_block(T)
            + field(T, "today-note", "Notatka (opcjonalnie)", ph="np. prezentacja przed klientem")
            + box("flex: 1", "")
            + btn(T, "Zaproponuj zestawy", href="Propozycje-pewniak.dc.html" if linked else None))
    return screen(T, box(MAIN + "; gap: 24px", body, "main") + tabbar(T, "today", linked))


def s_today_noloc(T):
    ask = box("display: flex; flex-direction: column; gap: 12px; flex-shrink: 0",
              box("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px",
                  box("display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1",
                      txt("h2", "Nie wiemy, gdzie sprawdzić pogodę", f"{TY['label']}; color: {T['text']}")
                      + txt("p", "Włącz lokalizację albo wpisz miasto, a dobierzemy zestaw do pogody.", f"{TY['sec']}; color: {T['sec']}"))
                  + wx(T, "cloud", 80, muted=True, label="Brak danych o pogodzie"))
              + box("display: flex; align-items: center; gap: 16px",
                    btn(T, "Włącz lokalizację", ic="navigation", compact=True, full=False) + link(T, "Wpisz miasto", "Rejestracja-miasto.dc.html")),
              "section", 'aria-label="Pogoda"')
    body = (today_head(T) + ask + occasion_block(T) + box("flex: 1", "") + btn(T, "Zaproponuj zestawy", "off"))
    return screen(T, box(MAIN + "; gap: 24px", body, "main") + tabbar(T, "today"))


def s_missing(T):
    notice = panel(T, txt("h2", "Brakuje ciepłego okrycia", f"{TY['label']}; color: {T['sage'][1]}")
                   + txt("p", "Przy 1°C potrzebne jest okrycie wierzchnie. Dodaj kurtkę albo płaszcz, a ułożymy zestaw.", f"{TY['sec']}; color: {T['text']}"),
                   "display: flex; flex-direction: column; gap: 4px")
    body = (today_head(T)
            + weather_row(T, "rain", "1-4°C", "Deszcz po południu", "Zimno i mokro przez cały dzień.", "Gliwice")
            + occasion_block(T)
            + notice + box("flex: 1", "") + btn(T, "Dodaj ubrania", href="Dodawanie.dc.html", ic="plus"))
    return screen(T, box(MAIN + "; gap: 24px", body, "main") + tabbar(T, "today"))


PTABS = [("Pewniak", "Propozycje-pewniak.dc.html"), ("Odkrycie", "Propozycje-odkrycie.dc.html"), ("Nowe połączenie", "Propozycje-nowe.dc.html")]


def ptabs(T, active, linked=True):
    cells = ""
    for i, (label, href) in enumerate(PTABS):
        on = i == active
        bg, fg = (T["sage"][0], T["sage"][1]) if on else ("transparent", T["sec"])
        style = (f"height: 44px; box-sizing: border-box; display: flex; align-items: center; padding: 0 16px; border-radius: 22px; background: {bg}; "
                 f"color: {fg}; {TY['secm']}; text-decoration: none; border: none; font-family: inherit; cursor: pointer; white-space: nowrap")
        cur = ' aria-current="page"' if on else ""
        cells += (f'<a href="{href}"{cur} style="{style}">{label}</a>' if linked else f'<button type="button"{cur} style="{style}">{label}</button>')
    return box("display: flex; gap: 4px; flex-shrink: 0; margin: 0 -4px", cells, "nav", 'aria-label="Propozycje"')


PROPS = [
    dict(items=[("shirt", NAVY), ("coat", GREY), ("trousers", CAMEL), ("sneakers", WHITE)],
         label="Zestaw: granatowa koszula, szary płaszcz, beżowe chinosy, białe sneakersy",
         text="Granatowa koszula i beżowe chinosy to zestaw, po który sięgasz najczęściej. Płaszcz przyda się rano."),
    dict(items=[("sweater", BURG), ("coat", OLIVE), ("scarf", CREAM), ("trousers", DGREY), ("boots", BROWN)],
         label="Zestaw: bordowy sweter, oliwkowa kurtka, kremowy szalik, szare spodnie, brązowe buty",
         text="Bordowy sweter czeka w szafie od lipca, a pasuje do szarych spodni i brązowych butów. Kurtka osłoni przed chłodem."),
    dict(items=[("shirt", LBLUE), ("coat", NAVY), ("trousers", DENIM), ("boots", BROWN)],
         label="Zestaw: błękitna koszula, granatowa kurtka, ciemne jeansy, brązowe buty",
         text="Błękitnej koszuli i ciemnych jeansów jeszcze razem nie było na Tobie. Granatowa kurtka spina kolory w całość."),
]
NOTE = "Rano 7°C, po południu 18°C."


def phead(T, linked=True):
    return backhead(T, "Propozycje na dziś", "Na co dzień, 7-18°C", "Main.dc.html" if linked else None)


def rating_row(T):
    return box("display: flex; align-items: center; justify-content: flex-end; flex-shrink: 0; margin: -4px -10px -4px 0",
               iconbtn(T, "up", "Podoba mi się") + iconbtn(T, "down", "Nie podoba mi się") + iconbtn(T, "bookmark", "Zapisz zestaw"))


def s_proposal(T, idx, linked=True):
    p = PROPS[idx]
    body = (phead(T, linked) + ptabs(T, idx, linked)
            + collage(T, p["items"], p["label"])
            + box("display: flex; flex-direction: column; gap: 4px",
                  txt("p", p["text"], TY["body"]) + txt("p", NOTE, f"{TY['sec']}; color: {T['sec']}"))
            + rating_row(T)
            + box("flex: 1", "")
            + box("display: flex; flex-direction: column; gap: 8px",
                  btn(T, "Zakładam to") + btn(T, "Pokaż na sylwetce", "secondary", href="Wizualizacja-postep.dc.html" if linked else None)))
    return screen(T, box(MAIN + "; gap: 12px", body, "main") + tabbar(T, "today", linked))


def s_loading(T):
    tiles = box("height: 236px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; flex-shrink: 0",
                "".join(skel(T, "100%", 114, R_WELL) for _ in range(4)))
    body = (phead(T) + ptabs(T, 0, False) + tiles
            + box("display: flex; flex-direction: column; gap: 8px", skel(T, "100%", 16) + skel(T, "92%", 16) + skel(T, "58%", 16))
            + txt("p", "Układamy trzy zestawy z Twojej szafy.", f"{TY['sec']}; color: {T['sec']}", 'role="status"')
            + box("flex: 1", "")
            + box("display: flex; flex-direction: column; gap: 8px", skel(T, "100%", 48, R_CTL) + skel(T, "100%", 48, R_CTL)))
    return screen(T, box(MAIN + "; gap: 12px", body, "main") + tabbar(T, "today"))


def viewtoggle(T, selected):
    return segmented(T, ["Kolaż", "Na sylwetce"], selected, "Widok zestawu", ["Propozycje-pewniak.dc.html", "Wizualizacja-wynik.dc.html"])


def s_viz_progress(T):
    wait = panel(T, box(f"width: 150px; height: 200px; border-radius: {R_WELL}px; background: {T['cell']}; display: block", "", "span")
                 + box("display: flex; flex-direction: column; gap: 4px; text-align: center",
                       txt("p", "Tworzymy obraz", f"{TY['sub']}; color: {T['sage'][1]}", 'role="status"')
                       + txt("p", "To potrwa do minuty. Możesz wyjść z ekranu, obraz będzie czekał przy zestawie.", f"{TY['sec']}; color: {T['text']}"))
                 + box(f"width: 100%; height: 4px; border-radius: 2px; background: {T['cell']}; overflow: hidden",
                       box(f"width: 40%; height: 4px; border-radius: 2px; background: {T['action']}; display: block", "", "span"),
                       "div", 'role="progressbar" aria-label="Postęp tworzenia obrazu"'),
                 "padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; align-items: center")
    body = (phead(T) + ptabs(T, 0) + viewtoggle(T, 1) + wait
            + txt("p", "Zostały 4 z 5 wizualizacji na dziś.", f"{TY['meta']}; color: {T['sec']}; text-align: center")
            + box("flex: 1", "") + btn(T, "Zakładam to"))
    return screen(T, box(MAIN + "; gap: 12px", body, "main") + tabbar(T, "today"))


def s_viz_result(T):
    shot = box("display: flex; flex-direction: column; gap: 8px; align-items: center; flex-shrink: 0",
               f'<img src="{ME[1]}" alt="Zestaw na wybranej sylwetce" style="width: 252px; height: 336px; object-fit: cover; '
               f'border-radius: {R_CARD}px; display: block">'
               + txt("p", "Wizualizacja poglądowa. Kolory i detale mogą różnić się od ubrań.", f"{TY['meta']}; color: {T['sec']}; text-align: center"),
               "section")
    body = (phead(T) + ptabs(T, 0) + viewtoggle(T, 1) + shot + box("flex: 1", "") + btn(T, "Zakładam to"))
    return screen(T, box(MAIN + "; gap: 12px", body, "main") + tabbar(T, "today"))


# ------------------------------------------------------------------ wardrobe

WARDROBE = [("shirt", NAVY, "Granatowa koszula oxford", ""), ("trousers", CAMEL, "Beżowe chinosy", "W praniu"),
            ("sweater", BURG, "Bordowy sweter", "Rzadko noszę"), ("coat", GREY, "Szary płaszcz wełniany", ""),
            None, ("sneakers", WHITE, "Białe sneakersy", "")]


def wardrobe_head(T, href):
    return box("display: flex; align-items: center; justify-content: space-between; gap: 16px",
               txt("h1", "Szafa", TY["disp"]) + btn(T, "Dodaj", href=href, ic="plus", full=False, compact=True, aria="Dodaj ubrania"), "header")


def stat_line(T):
    bar = box(f"height: 4px; border-radius: 2px; background: {T['border']}; overflow: hidden",
              box(f"width: 23%; height: 4px; border-radius: 2px; background: {T['action']}; display: block", "", "span"),
              "div", 'role="progressbar" aria-label="Wykorzystanie szafy"')
    return box("display: flex; flex-direction: column; gap: 8px; flex-shrink: 0",
               box("display: flex; align-items: baseline; justify-content: space-between; gap: 8px",
                   txt("p", "W zestawach było 14 z 62 ubrań", f"{TY['secm']}; color: {T['text']}")
                   + txt("p", "ostatnie 30 dni", f"{TY['meta']}; color: {T['sec']}")) + bar, "section", 'aria-label="Wykorzystanie szafy"')


def searchfield(T, fid, ph, aria):
    return field(T, fid, "", ph=ph, typ="search", lead="search", aria=aria)


def grid(gap):
    return f"display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: {gap}; flex: 1; min-height: 0; overflow: hidden; align-content: start"


def s_wardrobe(T, linked=True):
    tiles = ""
    for it in WARDROBE:
        if it is None:
            tiles += box("display: flex; flex-direction: column; gap: 8px; min-width: 0",
                         skel(T, "100%", 148, R_WELL)
                         + box("display: flex; flex-direction: column; gap: 2px; padding: 0 4px",
                               txt("span", "Opisujemy zdjęcie", f"{TY['secm']}; color: {T['sec']}", 'role="status"') + txt("span", "&nbsp;", TY["meta"])))
        else:
            tiles += tile(T, it[0], it[1], it[2], it[3], "Ubranie.dc.html" if linked else None)
    filters = box("display: flex; align-items: center; gap: 8px",
                  btn(T, "Filtry", "secondary", ic="sliders", full=False, compact=True) + chip(T, "Zapomniane", "Usuń filtr: zapomniane")
                  + txt("span", "62 ubrania", f"{TY['meta']}; color: {T['sec']}; margin-left: auto; font-variant-numeric: tabular-nums"))
    body = (wardrobe_head(T, "Dodawanie.dc.html" if linked else None) + stat_line(T)
            + searchfield(T, "wardrobe-search", "Szukaj po nazwie", "Szukaj w szafie") + filters
            + box(grid("16px 8px"), tiles, "div", 'data-clip="1"'))
    return screen(T, box(MAIN + "; gap: 12px; padding-bottom: 0", body, "main") + tabbar(T, "wardrobe", linked))


def s_wardrobe_empty(T):
    empty = panel(T, icon("hanger", T["sage"][1], 24)
                  + box("display: flex; flex-direction: column; gap: 8px",
                        txt("h2", "Zacznij od kilkunastu ubrań", TY["head"])
                        + txt("p", "Sfotografuj ubrania, które lubisz, i kilka takich, które leżą bez użycia. Opiszemy je za Ciebie.", f"{TY['body']}; color: {T['text']}"))
                  + btn(T, "Dodaj ubrania", href="Zgoda.dc.html", ic="plus")
                  + txt("p", "Pierwszy zestaw ułożymy od 8 ubrań.", f"{TY['meta']}; color: {T['text']}"),
                  "padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; align-items: flex-start")
    filters = box("display: flex; align-items: center; gap: 8px",
                  btn(T, "Filtry", "secondary", ic="sliders", full=False, compact=True)
                  + txt("span", "0 ubrań", f"{TY['meta']}; color: {T['sec']}; margin-left: auto"))
    body = (wardrobe_head(T, "Zgoda.dc.html") + searchfield(T, "wardrobe-search-empty", "Szukaj po nazwie", "Szukaj w szafie") + filters + empty)
    return screen(T, box(MAIN + "; gap: 12px", body, "main") + tabbar(T, "wardrobe"))


def sheet_screen(T, sheet_inner, name, h=844):
    bg = box(MAIN, txt("p", "Szafa", TY["disp"]), "div", 'aria-hidden="true"')
    scrim = box(f"position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: {T['scrim']}", "", "div", 'aria-hidden="true"')
    grab = box("display: flex; justify-content: center; padding: 8px 0 4px",
               f'<span style="width: 40px; height: 4px; border-radius: 2px; background: {T["ctl"]}; display: block"></span>')
    sheet = box(f"position: absolute; left: 0; right: 0; bottom: 0; background: {T['canvas']}; border-top: 1px solid {T['border']}; "
                f"border-radius: {R_SHEET}px {R_SHEET}px 0 0; padding: 0 16px 32px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px",
                grab + sheet_inner, "section", f'role="dialog" aria-modal="true" aria-label="{name}"')
    return screen(T, bg + scrim + sheet, h)


def s_consent(T):
    rows = card(T, srow(T, "fal.ai i Google", meta="wycinanie tła, obraz na sylwetce") + srow(T, "Anthropic", meta="opis ubrań i dobór zestawów", last=True))
    inner = (txt("h2", "Zanim dodasz pierwsze zdjęcie", TY["head"])
             + txt("p", "Żeby opisać ubrania i pokazać zestaw na sylwetce, wysyłamy zdjęcia ubrań do zewnętrznych usług.", TY["body"])
             + rows
             + txt("p", "Nie wysyłamy zdjęć osób. Zgodę możesz wycofać w profilu.", f"{TY['sec']}; color: {T['sec']}")
             + box("display: flex; flex-direction: column; gap: 4px", btn(T, "Zgadzam się", href="Dodawanie.dc.html") + btn(T, "Nie teraz", "text", href="Szafa-pusta.dc.html")))
    return sheet_screen(T, inner, "Zgoda na przetwarzanie zdjęć")


def qrow(T, kind, fill, name, status, progress=None, done=False, last=False):
    thumb = box("width: 48px; height: 48px; flex-shrink: 0", gcell(kind, fill, T, 48, pad=4, radius=8))
    info = txt("span", name, f"{TY['secm']}; color: {T['text']}") + txt("span", status, f"{TY['meta']}; color: {T['sec']}")
    if progress is not None:
        info += box(f"height: 4px; border-radius: 2px; background: {T['border']}; overflow: hidden; margin-top: 4px",
                    box(f"width: {progress}%; height: 4px; border-radius: 2px; background: {T['action']}; display: block", "", "span"),
                    "div", f'role="progressbar" aria-label="Wysyłanie: {name}"')
    right = icon("check", T["action"], 20) if done else ""
    bb = "none" if last else f"1px solid {T['border']}"
    return box(f"border-bottom: {bb}; display: flex; align-items: center; gap: 12px; padding: 8px 12px; min-height: 64px; box-sizing: border-box",
               thumb + box("display: flex; flex-direction: column; flex: 1; min-width: 0", info) + right)


def s_add(T):
    def opt(ic, label):
        return (f'<button type="button" style="height: 96px; box-sizing: border-box; border: 1px solid {T["ctl"]}; border-radius: {R_CARD}px; '
                f'background: {T["surface"]}; color: {T["text"]}; {TY["secm"]}; font-family: inherit; display: flex; flex-direction: column; '
                f'align-items: center; justify-content: center; gap: 8px; cursor: pointer; min-width: 0">{icon(ic, T["action"])}<span>{label}</span></button>')
    head = box("display: flex; align-items: center; justify-content: space-between", txt("h2", "Dodaj ubrania", TY["head"]) + iconbtn(T, "x", "Zamknij", "Szafa.dc.html"))
    queue = card(T, qrow(T, "sneakers", WHITE, "Białe sneakersy", "Gotowe, opisane", done=True)
                 + qrow(T, "trousers", DENIM, "Zdjęcie 2", "Wysyłanie", progress=60)
                 + qrow(T, "tee", GREY, "Zdjęcie 3", "Czeka w kolejce", last=True))
    inner = (head
             + box("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px", opt("camera", "Zrób zdjęcie") + opt("image", "Wybierz z galerii"))
             + txt("p", "Jedno ubranie na zdjęciu, najlepiej na jasnym tle.", f"{TY['sec']}; color: {T['sec']}")
             + box("display: flex; flex-direction: column; gap: 8px", txt("h3", "Wysyłanie", TY["sub"]) + queue)
             + box("display: flex; flex-direction: column; gap: 8px",
                   txt("p", "Dziś możesz dodać jeszcze 47 ubrań.", f"{TY['meta']}; color: {T['sec']}; text-align: center") + btn(T, "Gotowe", href="Szafa.dc.html")))
    return sheet_screen(T, inner, "Dodawanie ubrań")


ITEM_H = 1172


def s_item(T):
    head = box("display: flex; align-items: center; justify-content: space-between; margin: 0 -10px",
               iconbtn(T, "left", "Wróć", "Szafa.dc.html") + iconbtn(T, "more", "Więcej"), "header")
    photo = box("flex-shrink: 0", gcell("shirt", NAVY, T, 248, pad=24, radius=R_CARD), "div", 'role="img" aria-label="Granatowa koszula oxford"')
    title = box("display: flex; flex-direction: column; gap: 4px",
                txt("h1", "Granatowa koszula oxford", TY["head"]) + txt("p", "Góra, koszula", f"{TY['body']}; color: {T['sec']}")
                + txt("p", "Dodano 2 października. W zestawach 6 razy.", f"{TY['meta']}; color: {T['sec']}"))
    attrs = card(T, srow(T, "Kolor", "granatowy") + srow(T, "Wzór", "gładki") + srow(T, "Materiał", "bawełna")
                 + srow(T, "Formalność", "biznesowa") + srow(T, "Ciepło", "lekkie") + srow(T, "Popraw opis", chev=True, last=True))
    flags = card(T, srow(T, "W praniu", meta="Pomijamy w propozycjach.", right=switch(T, False, "W praniu"))
                 + srow(T, "Rzadko noszę", meta="Chętniej podsuniemy jako odkrycie.", right=switch(T, True, "Rzadko noszę"), last=True))
    body = (head + photo + title + attrs + flags
            + box("display: flex; flex-direction: column; gap: 4px", btn(T, "Dobierz do tego", href="Main.dc.html") + btn(T, "Usuń ubranie", "dangertext")))
    return screen(T, box(MAIN + "; gap: 16px; padding-bottom: 24px", body, "main") + tabbar(T, "wardrobe"), ITEM_H)


# ------------------------------------------------------------------ outfits, profile, subscription

def outfit_tile(T, items, name, meta):
    cells = "".join(gcell(k, c, T, 76, pad=8, radius=8) for k, c in items)
    tiles = box("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px", cells)
    textb = box("display: flex; flex-direction: column; gap: 2px; padding: 0 4px",
                txt("span", name, f"{TY['secm']}; color: {T['text']}") + txt("span", meta, f"{TY['meta']}; color: {T['sec']}"))
    return f'<a href="Propozycje-pewniak.dc.html" style="display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: inherit; min-width: 0">{tiles}{textb}</a>'


def s_outfits(T):
    tiles = (outfit_tile(T, PROPS[0]["items"], "Na co dzień", "Założony 3 października")
             + outfit_tile(T, [("sweater", BURG), ("coat", OLIVE), ("trousers", DGREY), ("boots", BROWN)], "Ze znajomymi", "Założony 1 października")
             + outfit_tile(T, PROPS[2]["items"], "Praca lub uczelnia", "Zapisany 28 września")
             + outfit_tile(T, [("tee", WHITE), ("coat", NAVY), ("trousers", CAMEL), ("sneakers", WHITE)], "Na co dzień", "Zapisany 24 września")
             + outfit_tile(T, [("sweater", BURG), ("coat", GREY), ("trousers", DENIM), ("sneakers", WHITE)], "Randka lub wieczór", "Zapisany 20 września")
             + outfit_tile(T, [("shirt", WHITE), ("coat", NAVY), ("trousers", DGREY), ("boots", BROWN)], "Spotkanie biznesowe", "Zapisany 17 września"))
    body = (box("display: flex; flex-direction: column; gap: 2px", txt("h1", "Outfity", TY["disp"])
                + txt("p", "8 zapisanych zestawów", f"{TY['sec']}; color: {T['sec']}"), "header")
            + searchfield(T, "outfits-search", "Szukaj po okazji lub ubraniu", "Szukaj w zestawach")
            + box(grid("16px 16px"), tiles, "div", 'data-clip="1"'))
    return screen(T, box(MAIN + "; gap: 12px; padding-bottom: 0", body, "main") + tabbar(T, "outfits"))


def group(T, title, rows):
    return box("display: flex; flex-direction: column; gap: 8px", txt("h2", title, TY["sub"]) + card(T, rows), "div")


PROFILE_H = 1548


def s_profile(T):
    me = box("display: flex; align-items: center; gap: 16px; flex-shrink: 0",
             f'<img src="{ME[1]}" alt="" style="width: 72px; height: 96px; object-fit: cover; border-radius: {R_WELL}px; display: block">'
             + box("display: flex; flex-direction: column; min-width: 0; flex: 1; align-items: flex-start",
                   txt("p", "Ola", TY["head"]) + txt("p", "Typ sylwetki: klepsydra", f"{TY['sec']}; color: {T['sec']}")
                   + link(T, "Zmień sylwetkę", "Rejestracja-sylwetka.dc.html")), "section")
    body = (txt("h1", "Profil", TY["disp"]) + me
            + group(T, "Konto", srow(T, "Imię", "Ola", chev=True) + srow(T, "Data urodzenia", "14.03.1999", chev=True)
                    + srow(T, "Płeć", "Kobieta", chev=True) + srow(T, "E-mail", "ola@poczta.pl", last=True))
            + group(T, "Pogoda i styl", srow(T, "Pogoda według", "Lokalizacji telefonu", chev=True) + srow(T, "Odczuwanie temperatury", "Normalnie", chev=True)
                    + srow(T, "Preferowane style", "casual, smart", chev=True, last=True))
            + group(T, "Limity na dziś", srow(T, "Propozycje", "3 z 20") + srow(T, "Wizualizacje", "1 z 5") + srow(T, "Nowe ubrania", "12 z 50")
                    + srow(T, "Zdejmij limity z FitIt Plus", href="Subskrypcja.dc.html", chev=True, accent=True, last=True))
            + group(T, "Prywatność", srow(T, "Zdjęcia ubrań w zewnętrznym AI", meta="Zgoda z 2 października 2026.", right=switch(T, True, "Zgoda na przetwarzanie zdjęć ubrań"))
                    + srow(T, "Polityka prywatności", chev=True, last=True))
            + btn(T, "Wyloguj się", "secondary", href="Start.dc.html")
            + box("display: flex; flex-direction: column; gap: 8px; margin-top: 8px",
                  txt("h2", "Usuwanie konta", TY["sub"])
                  + card(T, box("display: flex; flex-direction: column; gap: 4px; padding: 16px; align-items: flex-start",
                                txt("p", "Usuniemy konto, ubrania, zestawy i obrazy. Tego nie da się cofnąć.", f"{TY['sec']}; color: {T['sec']}")
                                + btn(T, "Usuń konto", "dangertext", href="Usun-konto.dc.html", full=False)))))
    return screen(T, box(MAIN + "; gap: 24px; padding-bottom: 24px", body, "main") + tabbar(T, "profile"), PROFILE_H)


def s_delete(T):
    bg = box(MAIN, txt("p", "Profil", TY["disp"]), "div", 'aria-hidden="true"')
    dialog = box(f"background: {T['canvas']}; border: 1px solid {T['border']}; border-radius: {R_SHEET}px; padding: 24px 20px 20px; box-sizing: border-box; "
                 "width: 100%; display: flex; flex-direction: column; gap: 16px",
                 box("display: flex; flex-direction: column; gap: 8px",
                     txt("h2", "Usunąć konto?", TY["head"])
                     + txt("p", "Usuniemy konto, 62 ubrania, zapisane zestawy i obrazy. Tego nie da się cofnąć.", TY["body"]))
                 + field(T, "delete-confirm", "Wpisz USUŃ, aby potwierdzić")
                 + box("display: flex; flex-direction: column; gap: 8px", btn(T, "Usuń konto", "danger") + btn(T, "Zostaw konto", "secondary", href="Profil.dc.html")),
                 "section", 'role="alertdialog" aria-modal="true" aria-label="Usuwanie konta"')
    scrim = box(f"position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: {T['scrim']}; display: flex; align-items: center; justify-content: center; "
                "padding: 16px; box-sizing: border-box", dialog)
    return screen(T, bg + scrim)


def plan(T, name, note, price, period, on):
    if on:
        look = f"background: {T['sage'][0]}; border: 2px solid {T['action']}; padding: 11px 15px"
        dot = box(f"width: 24px; height: 24px; border-radius: 12px; background: {T['action']}; display: flex; align-items: center; "
                  "justify-content: center; flex-shrink: 0", icon("check", T["on"], 16), "span")
    else:
        look = f"background: {T['surface']}; border: 1px solid {T['ctl']}; padding: 12px 16px"
        dot = box(f"width: 24px; height: 24px; box-sizing: border-box; border-radius: 12px; border: 2px solid {T['ctl']}; flex-shrink: 0; display: block", "", "span")
    left = box("display: flex; flex-direction: column; min-width: 0; flex: 1; text-align: left",
               txt("span", name, f"{TY['label']}; color: {T['text']}") + (txt("span", note, f"{TY['meta']}; color: {T['sec']}") if note else ""), "span")
    right = box("display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0",
                txt("span", price, f"{TY['label']}; color: {T['text']}; font-variant-numeric: tabular-nums") + txt("span", period, f"{TY['meta']}; color: {T['sec']}"), "span")
    return (f'<button type="button" role="radio" aria-checked="{"true" if on else "false"}" style="{look}; min-height: 72px; box-sizing: border-box; '
            f'border-radius: {R_CTL}px; font-family: inherit; cursor: pointer; display: flex; align-items: center; gap: 12px; width: 100%">{dot}{left}{right}</button>')


def s_paywall(T):
    """Subscription purchase. Plan name, prices and limits are placeholders until the offer is decided."""
    top = box("display: flex; align-items: center; justify-content: space-between; margin-right: -10px",
              brandmark(T, small=True) + iconbtn(T, "x", "Zamknij", "Profil.dc.html"), "header")
    head = box("display: flex; flex-direction: column; gap: 8px",
               txt("p", "FitIt Plus", f"{TY['label']}; color: {T['action']}")
               + txt("h1", "Zdejmij dzienne limity", TY["disp"])
               + txt("p", "Częściej zobaczysz zestaw na sylwetce i dodasz całą szafę od razu.", f"{TY['body']}; color: {T['sec']}"))
    perks = ["30 obrazów na sylwetce dziennie zamiast 5", "Propozycje zestawów bez dziennego limitu", "Dodawanie ubrań bez dziennego limitu"]
    items = "".join(box("display: flex; gap: 12px; align-items: flex-start", box("margin-top: 2px; flex-shrink: 0", icon("check", T["action"], 20), "span")
                        + txt("span", p, f"{TY['body']}; color: {T['text']}"), "li") for p in perks)
    lst = box("list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px", items, "ul")
    plans = box("display: flex; flex-direction: column; gap: 8px",
                plan(T, "Roczny", "12,50 zł za miesiąc, taniej o 37%", "149,99 zł", "na rok", True)
                + plan(T, "Miesięczny", None, "19,99 zł", "na miesiąc", False), "div", 'role="radiogroup" aria-label="Okres rozliczenia"')
    foot = box("display: flex; flex-direction: column; gap: 8px; align-items: center",
               btn(T, "Kup FitIt Plus")
               + txt("p", "149,99 zł rocznie. Subskrypcja odnawia się automatycznie, a anulujesz ją w każdej chwili w ustawieniach sklepu.",
                     f"{TY['meta']}; color: {T['sec']}; text-align: center")
               + box("display: flex; gap: 24px; justify-content: center",
                     link(T, "Przywróć zakupy", None) + link(T, "Regulamin", None) + link(T, "Prywatność", None)))
    upper = box("display: flex; flex-direction: column; gap: 24px", top + head + lst + plans)
    return screen(T, box(MAIN + "; padding-bottom: 16px; gap: 16px; justify-content: space-between", upper + foot, "main"))


# ------------------------------------------------------------------ output

# (file, title, body, theme, width, height, has links)
ROWS = [
    ("row-kierunek", "Kierunek: jeden kolor", [
        ("Paleta.dc.html", "Paleta, pogoda i pismo", s_palette(L), L, 860, PALETTE_H, False),
    ]),
    ("row-wejscie", "Wejście i rejestracja", [
        ("Start.dc.html", "Start", s_start(L), L, 390, 844, True),
        ("Logowanie.dc.html", "Logowanie", s_login(L), L, 390, 844, True),
        ("Rejestracja-konto.dc.html", "Rejestracja 1: konto", s_reg1(L), L, 390, 844, True),
        ("Rejestracja-o-tobie.dc.html", "Rejestracja 2: o Tobie i płeć", s_reg2(L), L, 390, 844, True),
        ("Rejestracja-sylwetka.dc.html", "Rejestracja 3: sylwetki damskie", s_reg3(L, "k", 0), L, 390, 844, True),
        ("Rejestracja-sylwetka-meskie.dc.html", "Rejestracja 3: sylwetki męskie", s_reg3(L, "m", 2, False), L, 390, 844, False),
        ("Rejestracja-styl.dc.html", "Rejestracja 4: styl", s_reg4(L), L, 390, 844, True),
        ("Rejestracja-lokalizacja.dc.html", "Rejestracja 5: pogoda z lokalizacji", s_reg5(L), L, 390, 844, True),
        ("Rejestracja-miasto.dc.html", "Rejestracja 5: miasto, gdy brak lokalizacji", s_reg5_city(L), L, 390, 844, True),
    ]),
    ("row-dzis", "Dziś i propozycje", [
        ("Main.dc.html", "Dziś", s_today(L), L, 390, 844, True),
        ("Dzis-bez-lokalizacji.dc.html", "Dziś: brak lokalizacji", s_today_noloc(L), L, 390, 844, True),
        ("Dzis-brakuje.dc.html", "Dziś: deszcz i brak okrycia", s_missing(L), L, 390, 844, True),
        ("Propozycje-ladowanie.dc.html", "Propozycje: ładowanie", s_loading(L), L, 390, 844, False),
        ("Propozycje-pewniak.dc.html", "Propozycje: pewniak", s_proposal(L, 0), L, 390, 844, True),
        ("Propozycje-odkrycie.dc.html", "Propozycje: odkrycie", s_proposal(L, 1), L, 390, 844, True),
        ("Propozycje-nowe.dc.html", "Propozycje: nowe połączenie", s_proposal(L, 2), L, 390, 844, True),
        ("Wizualizacja-postep.dc.html", "Wizualizacja w toku", s_viz_progress(L), L, 390, 844, True),
        ("Wizualizacja-wynik.dc.html", "Wizualizacja gotowa", s_viz_result(L), L, 390, 844, True),
    ]),
    ("row-szafa", "Szafa", [
        ("Szafa.dc.html", "Szafa", s_wardrobe(L), L, 390, 844, True),
        ("Szafa-pusta.dc.html", "Szafa: pusta", s_wardrobe_empty(L), L, 390, 844, True),
        ("Zgoda.dc.html", "Zgoda na AI", s_consent(L), L, 390, 844, True),
        ("Dodawanie.dc.html", "Dodawanie zdjęć", s_add(L), L, 390, 844, True),
        ("Ubranie.dc.html", "Ubranie", s_item(L), L, 390, ITEM_H, True),
    ]),
    ("row-outfity", "Outfity, profil i subskrypcja", [
        ("Outfity.dc.html", "Outfity", s_outfits(L), L, 390, 844, True),
        ("Profil.dc.html", "Profil", s_profile(L), L, 390, PROFILE_H, True),
        ("Subskrypcja.dc.html", "Subskrypcja: zakup", s_paywall(L), L, 390, 844, True),
        ("Usun-konto.dc.html", "Usuwanie konta", s_delete(L), L, 390, 844, True),
    ]),
    ("row-ciemny", "Tryb ciemny", [
        ("Ciemny-dzis.dc.html", "Ciemny: Dziś", s_today(D, False), D, 390, 844, False),
        ("Ciemny-propozycje.dc.html", "Ciemny: Propozycje", s_proposal(D, 0, False), D, 390, 844, False),
        ("Ciemny-szafa.dc.html", "Ciemny: Szafa", s_wardrobe(D, False), D, 390, 844, False),
    ]),
]

VOID = {"meta", "link", "input", "img", "br", "hr"}


class Check(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.errors = [], []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.errors.append(f"self-closing <{tag}/>")

    def handle_endtag(self, tag):
        if tag in VOID:
            self.errors.append(f"end tag for void <{tag}>")
        elif not self.stack or self.stack[-1] != tag:
            self.errors.append(f"mismatched </{tag}>, open: {self.stack[-1] if self.stack else None}")
        else:
            self.stack.pop()


FONT_LINK = f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{FONTS}&amp;display=swap">'


def stem(fname):
    return "Dzis" if fname == "Main.dc.html" else fname[:-len(".dc.html")]


def all_screens():
    """Every screen in canvas order: (row title, export name, canvas file, title, body, theme, width, height)."""
    out = []
    for _, row_title, items in ROWS:
        for fname, title, body, T, w, h, _ in items:
            out.append((row_title, f"{len(out) + 1:02d}-{stem(fname)}", fname, title, body, T, w, h))
    return out


def validate():
    """Contrast of every colour pair and the structure of every screen. Returns a list of problems."""
    problems = []
    for nm, th in (("jasny", L), ("ciemny", D)):
        rows_, bad = contrast_report(nm, th)
        problems += bad
        print(f"kontrast {nm}: najniższe pary", ", ".join(f"{n} {v:.2f}" for n, v, _ in sorted(rows_, key=lambda r: r[1] / r[2])[:4]))
    seen = set()
    for _, name, fname, _, body, _, _, _ in all_screens():
        chk = Check()
        chk.feed(body)
        if chk.errors or chk.stack:
            problems.append(f"{fname}: {chk.errors[:3]} {chk.stack[:5]}")
        if "{{" in body or "None" in body:
            problems.append(f"{fname}: double brace or None in output")
        if fname in seen:
            problems.append(f"{fname}: duplicated file name")
        seen.add(fname)
    return problems


def with_local_images(body, assets_dir, base_dir):
    rel = os.path.relpath(assets_dir, base_dir).replace(os.sep, "/")
    for group_ in SIL.values():
        for _, url, local in group_:
            body = body.replace(url, f"{rel}/{local}")
    return body


def write_export(out_dir, assets_dir):
    """One standalone page per screen. Links between screens keep working."""
    os.makedirs(out_dir, exist_ok=True)
    screens = all_screens()
    names = {fname: name for _, name, fname, *_ in screens}
    for _, name, fname, title, body, T, w, h in screens:
        for target, new in names.items():
            body = body.replace(f'href="{target}"', f'href="{new}.html"')
        body = with_local_images(body, assets_dir, out_dir)
        with open(os.path.join(out_dir, name + ".html"), "w", encoding="utf-8") as f:
            f.write(f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FitIt: {title}</title>
{FONT_LINK}
<style>
html, body {{ margin: 0; }}
body {{ min-height: 100vh; background: #D9DCD6; }}
@media (min-width: 700px) {{ body {{ display: flex; justify-content: center; align-items: flex-start; }} }}
a {{ color: inherit; }}
input::placeholder {{ color: {T['sec']}; }}
</style>
</head>
<body>
{body}
</body>
</html>
""")
    keep = {n + ext for n in names.values() for ext in (".html", ".png")}
    for f in os.listdir(out_dir):   # pages and images of screens that no longer exist
        if re.fullmatch(r"\d\d-.+\.(html|png)", f) and f not in keep:
            os.remove(os.path.join(out_dir, f))
    return screens


def render_pngs(out_dir, chrome, scale):
    """Screenshot of every exported page with headless Chrome, in a throwaway browser profile.
    Chrome may keep running after it has written the file, so each run is stopped once the image is complete.
    Its window cannot be narrower than about 500 px; the pages keep narrow screens at the left edge for that reason."""
    with tempfile.TemporaryDirectory() as profile:
        for _, name, _, _, _, _, w, h in all_screens():
            page = "file://" + quote(os.path.abspath(os.path.join(out_dir, name + ".html")))
            png = os.path.abspath(os.path.join(out_dir, name + ".png"))
            if os.path.exists(png):
                os.remove(png)
            proc = subprocess.Popen([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                                     f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", f"--user-data-dir={profile}",
                                     "--virtual-time-budget=6000", f"--screenshot={png}", page],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            size, stable, deadline = -1, 0, time.time() + 90
            while time.time() < deadline and stable < 3 and proc.poll() is None:
                time.sleep(0.3)
                now = os.path.getsize(png) if os.path.exists(png) else -1
                stable = stable + 1 if now > 0 and now == size else 0
                size = now
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    proc.kill()
            if not os.path.exists(png) or os.path.getsize(png) == 0:
                raise RuntimeError(f"Chrome did not produce {png}")
            print("  ", name + ".png")


def write_readme(path, out_dir):
    rel = os.path.relpath(out_dir, os.path.dirname(path)).replace(os.sep, "/")
    lines = ["# FitIt: makiety aplikacji mobilnej", "",
             "Plik powstaje z `gen_design.py`. Zmiany wprowadzaj w generatorze, nie tutaj.", "",
             f"- `{rel}/NN-nazwa.html`: każdy ekran jako samodzielna strona. Otwórz ją w przeglądarce; przyciski i zakładki prowadzą do kolejnych ekranów, a w kodzie widać dokładne wymiary, kolory i odstępy.",
             f"- `{rel}/NN-nazwa.png`: te same ekrany jako obrazy.",
             "- `zasoby/`: miniatury typów sylwetek.",
             "- `gen_design.py`: źródło makiet. `python3 docs/design/gen_design.py --png` odtwarza strony, obrazy i ten plik.", "",
             "Wartości zastępcze: rysunki ubrań, miniatury sylwetek, obraz na ekranie „Wizualizacja gotowa” oraz oferta subskrypcji (nazwa, ceny, limity).", ""]
    for row_title, group_ in groupby(all_screens(), key=lambda s: s[0]):
        cells = []
        for _, name, _, title, _, _, w, _ in group_:
            width = 640 if w > 400 else 200
            cells.append(f'<td align="center" valign="top"><a href="{rel}/{name}.html"><img src="{rel}/{name}.png" width="{width}" alt="{title}"></a><br>{title}</td>')
        lines += [f"## {row_title}", "", "<table>"]
        for i in range(0, len(cells), 4):
            lines += ["<tr>"] + cells[i:i + 4] + ["</tr>"]
        lines += ["</table>", ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def write_preview(pdir, assets_dir):
    """Every screen on one page, each inside [data-screen], so overflow can be measured with a script."""
    os.makedirs(pdir, exist_ok=True)
    frames = ""
    for _, _, fname, title, body, _, w, h in all_screens():
        frames += (f'<figure style="margin: 0"><figcaption style="font: 600 13px/20px system-ui; color: #333; padding: 0 0 6px">{title}</figcaption>'
                   f'<div data-screen="{fname}" style="width: {w}px; height: {h}px">{with_local_images(body, assets_dir, pdir)}</div></figure>')
    with open(os.path.join(pdir, "index.html"), "w", encoding="utf-8") as f:
        f.write(f"""<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>FitIt podgląd</title>
{FONT_LINK}
<style>body{{margin:0;background:#CFCFCB}} a{{color:inherit}} input::placeholder{{color:{L['sec']}}}
#all{{display:flex;flex-wrap:wrap;gap:28px;padding:24px;align-items:flex-start;transform-origin:0 0}}</style></head>
<body><div id="all">{frames}</div></body></html>
""")


def dc_page(title, body, T, w, h):
    """An artboard in the format the design artifact expects."""
    return f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONT_LINK}
<style>
body{{margin:0}}
a{{color:inherit}}
input::placeholder{{color:{T['sec']}}}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
"""


def write_canvas(root, base_index):
    """Artboards and canvas.json for the design artifact. Positions are laid out in rows; everything else in the
    index read from the artifact (and any board this file does not make) is kept."""
    proj = os.path.join(root, "project")
    os.makedirs(proj, exist_ok=True)
    boards, order, notes = {}, [], {}
    y = 0
    for note_id, row_title, items in ROWS:
        x, tallest = 0, 0
        for fname, title, body, T, w, h, interactive in items:
            with open(os.path.join(proj, fname), "w", encoding="utf-8") as f:
                f.write(dc_page(title, body, T, w, h))
            boards[fname] = {"x": x, "y": y, "w": w, "h": h, "title": title, **({"is_interactive": True} if interactive else {})}
            order.append(fname)
            x += w + 80
            tallest = max(tallest, h)
        notes[note_id] = {"x": 0, "y": y - 300, "text": row_title, "kind": "title1", "maxW": x - 80}
        y += tallest + 120 + 300
    order.remove("Main.dc.html")
    order.insert(0, "Main.dc.html")       # the artifact opens on the first board
    index = json.load(open(base_index, encoding="utf-8"))
    old = index.get("boards", {})
    merged = {}
    for fname, entry in boards.items():
        keep = {k: v for k, v in old.get(fname, {}).items() if k not in ("x", "y", "w", "h", "title", "is_interactive")}
        merged[fname] = {**keep, **entry}
    foreign = [f for f in old if f not in merged]
    for fname in foreign:
        merged[fname] = old[fname]
    index["boards"] = merged
    index["order"] = order + [f for f in index.get("order", []) if f not in order and f in merged]
    inotes = index.setdefault("notes", {})
    for nid, n in notes.items():
        inotes[nid] = {**{k: v for k, v in inotes.get(nid, {}).items() if k != "w"}, **n}
    with open(os.path.join(proj, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print("nowe plansze:", sorted(set(boards) - set(old)), "| plansze spoza generatora, zachowane:", foreign)


def main():
    ap = argparse.ArgumentParser(description="Generates the FitIt mobile app mock-ups.")
    ap.add_argument("--out", default=os.path.join(HERE, "ekrany"), help="directory for standalone pages and PNGs (default: ekrany next to this file)")
    ap.add_argument("--assets", default=os.path.join(HERE, "zasoby"), help="directory with the silhouette images")
    ap.add_argument("--png", action="store_true", help="also render every page to PNG with headless Chrome")
    ap.add_argument("--chrome", default="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", help="path to the Chrome binary")
    ap.add_argument("--scale", type=int, default=2, help="pixel density of the PNGs")
    ap.add_argument("--preview", metavar="DIR", help="write one page with every screen instead")
    ap.add_argument("--canvas", nargs=2, metavar=("OUT", "BASE_CANVAS_JSON"), help="write the design artifact files instead")
    args = ap.parse_args()

    problems = validate()
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print("kontrast i struktura: bez uwag,", len(all_screens()), "ekranów")
    if args.canvas:
        write_canvas(*args.canvas)
    if args.preview:
        write_preview(args.preview, args.assets)
    if not args.canvas and not args.preview:
        write_export(args.out, args.assets)
        if args.png:
            render_pngs(args.out, args.chrome, args.scale)
        write_readme(os.path.join(HERE, "README.md"), args.out)


if __name__ == "__main__":
    main()
