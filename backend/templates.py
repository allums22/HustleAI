"""
Premium Landing Page Templates — 5 visually distinct designs with curated color palettes.
Each template has a unique layout, typography style, and visual personality.
"""

# 12 curated premium color palettes — NO neon green, NO generic combos
PREMIUM_PALETTES = [
    {"primary": "#6366F1", "accent": "#EC4899", "name": "Indigo Rose"},
    {"primary": "#8B5CF6", "accent": "#F59E0B", "name": "Violet Gold"},
    {"primary": "#0EA5E9", "accent": "#F97316", "name": "Ocean Ember"},
    {"primary": "#D946EF", "accent": "#06B6D4", "name": "Fuchsia Cyan"},
    {"primary": "#14B8A6", "accent": "#F43F5E", "name": "Teal Crimson"},
    {"primary": "#3B82F6", "accent": "#EF4444", "name": "Blue Fire"},
    {"primary": "#A855F7", "accent": "#22D3EE", "name": "Purple Ice"},
    {"primary": "#E11D48", "accent": "#FACC15", "name": "Ruby Gold"},
    {"primary": "#2563EB", "accent": "#F59E0B", "name": "Royal Amber"},
    {"primary": "#7C3AED", "accent": "#FB923C", "name": "Grape Tangerine"},
    {"primary": "#0891B2", "accent": "#E879F9", "name": "Deep Sea Orchid"},
    {"primary": "#DC2626", "accent": "#3B82F6", "name": "Crimson Blue"},
]

def pick_palette(seed: str) -> dict:
    """Pick a color palette based on a seed string."""
    idx = sum(ord(c) for c in seed) % len(PREMIUM_PALETTES)
    return PREMIUM_PALETTES[idx]

def get_template(variant: int, data: dict) -> str:
    """Return complete HTML for the given variant (0-4) with data injected."""
    bn = (data.get("biz_name", "") or "Business").rstrip(". ")
    tg = (data.get("tagline", "") or "Your business tagline").rstrip(". ")
    pt = data.get("pitch", "Your elevator pitch goes here.")
    tgt = data.get("target", "")
    email = data.get("email", "")
    phone = data.get("phone", "")
    name = data.get("name", "")
    strats = data.get("strategies", [])
    tiers = data.get("pricing_tiers", [])
    logo = bn[0].upper() if bn else "H"

    # Always use curated palette instead of AI-generated colors
    palette = pick_palette(bn + tg)
    p = palette["primary"]
    a = palette["accent"]

    # Normalize strategies
    normalized_strats = []
    for s in strats:
        if isinstance(s, dict):
            normalized_strats.append(s.get("strategy", str(s)))
        else:
            normalized_strats.append(str(s))
    strats = normalized_strats[:3]

    # Build strategy cards
    strat_html = ""
    strat_icons = ["01", "02", "03"]
    for i, s in enumerate(strats):
        strat_html += f'<div class="sc"><div class="sc-n">{strat_icons[i]}</div><h4>{s[:60]}</h4><p>{s[60:] if len(s)>60 else ""}</p></div>'

    # Build pricing
    pricing_html = ""
    for i, t in enumerate(tiers[:3]):
        feat = "".join(f"<li>{f}</li>" for f in t.get("features", []))
        pop = " pop" if i == 1 else ""
        pricing_html += f'<div class="pc{pop}"><h3>{t.get("name","Package")}</h3><div class="pr">{t.get("price","")}</div><ul>{feat}</ul><a href="#cta" class="pb">Get Started</a></div>'

    # Contact section
    contact_parts = []
    if email:
        contact_parts.append(f'<a href="mailto:{email}" class="ce">{email}</a>')
    if phone:
        contact_parts.append(f'<a href="tel:{phone}" class="cp">{phone}</a>')
    if name:
        contact_parts.append(f'<p class="cn">{name}</p>')
    contact = "\n".join(contact_parts)

    # CSS Logo component (used in all templates)
    logo_css = f"""
.logo-box{{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,{p},{a});display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:#fff;flex-shrink:0}}
.logo-text{{font-size:20px;font-weight:900;letter-spacing:-0.5px}}
"""

    templates = [
        # ═══ V0: BOLD GRADIENT — Large centered hero, gradient text, minimal sections ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Inter',sans-serif;background:#050505;color:#eee;-webkit-font-smoothing:antialiased}}
a{{text-decoration:none;color:inherit}}
{logo_css}
nav{{display:flex;align-items:center;justify-content:space-between;padding:20px 6%;max-width:1100px;margin:0 auto}}
.lg{{display:flex;align-items:center;gap:10px}}
.nb{{background:linear-gradient(135deg,{p},{a});color:#fff;padding:10px 24px;border-radius:10px;font-weight:700;font-size:13px;transition:opacity .2s}}.nb:hover{{opacity:.85}}
.hero{{padding:120px 6% 80px;text-align:center;position:relative}}
.hero::before{{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:600px;height:600px;background:radial-gradient(circle,{p}15,transparent 70%);pointer-events:none}}
.hero h1{{font-size:clamp(40px,8vw,72px);font-weight:900;letter-spacing:-3px;line-height:1;margin-bottom:24px;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent;position:relative}}
.hero p{{color:#777;font-size:clamp(16px,2vw,20px);max-width:560px;margin:0 auto 40px;line-height:1.6;position:relative}}
.cta{{display:inline-block;background:linear-gradient(135deg,{p},{a});color:#fff;font-weight:700;padding:16px 40px;border-radius:14px;font-size:17px;box-shadow:0 0 50px {p}25;transition:all .2s;position:relative}}.cta:hover{{transform:translateY(-2px);box-shadow:0 0 70px {p}40}}
.sec{{padding:80px 6%;max-width:960px;margin:0 auto}}
.tag{{display:inline-block;background:{p}12;color:{p};font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px}}
.sh{{font-size:clamp(28px,4vw,42px);font-weight:900;letter-spacing:-1.5px;margin-bottom:16px}}
.sc{{background:#0c0c0f;border:1px solid #1a1a20;border-radius:16px;padding:28px;margin-bottom:14px;transition:border-color .2s}}.sc:hover{{border-color:{a}}}
.sc-n{{font-size:13px;font-weight:800;color:{a};margin-bottom:8px}}
.sc h4{{font-size:15px;font-weight:700;margin-bottom:4px}}.sc p{{color:#777;font-size:13px;line-height:1.5}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:32px}}
.pc{{background:#0c0c0f;border:1px solid #1a1a20;border-radius:16px;padding:32px;text-align:center;position:relative;transition:all .2s}}.pc.pop{{border-color:{a}}}
.pc.pop::before{{content:'BEST VALUE';position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,{p},{a});color:#fff;font-size:10px;font-weight:800;padding:4px 16px;border-radius:20px}}
.pc h3{{color:#666;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}}
.pr{{font-size:36px;font-weight:900;margin-bottom:20px;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.pc ul{{list-style:none;text-align:left;margin-bottom:24px}}.pc li{{padding:7px 0;color:#777;font-size:13px;border-bottom:1px solid #151518}}.pc li::before{{content:'✓ ';color:{a};font-weight:700}}
.pb{{display:block;padding:14px;border-radius:12px;font-weight:700;border:1.5px solid #222;color:#ccc;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:linear-gradient(135deg,{p},{a});color:#fff;border-color:transparent}}
#cta{{background:#0a0a0a;border-top:1px solid #151518;padding:80px 6%;text-align:center}}
#cta h2{{font-size:clamp(26px,4vw,38px);font-weight:900;margin-bottom:16px}}
.ce{{display:block;font-size:22px;font-weight:800;margin-top:20px;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.cp{{display:block;color:{a};font-size:18px;font-weight:700;margin-top:8px}}.cn{{color:#555;margin-top:8px}}
footer{{padding:24px 6%;display:flex;justify-content:space-between;font-size:12px;color:#333;flex-wrap:wrap;gap:8px}}
@media(max-width:640px){{.pg{{grid-template-columns:1fr}}footer{{flex-direction:column;text-align:center;align-items:center}}}}
</style></head><body>
<nav><div class="lg"><div class="logo-box">{logo}</div><span class="logo-text">{bn}</span></div><a href="#cta" class="nb">Get Started</a></nav>
<section class="hero"><h1>{tg}</h1><p>{pt}</p><a href="#cta" class="cta">Start Now →</a></section>
<section class="sec"><span class="tag">Our Approach</span><h2 class="sh">Why {bn}</h2><p style="color:#777;margin-bottom:24px">{tgt}</p>{strat_html}</section>
<section class="sec" style="text-align:center"><span class="tag">Investment</span><h2 class="sh">Pricing</h2><div class="pg">{pricing_html}</div></section>
<section id="cta"><h2>Ready to Get Started?</h2><p style="color:#666">Let's make it happen</p>{contact}</section>
<footer><span>© 2026 {bn}</span><span style="opacity:.4">hustleai.live</span></footer></body></html>""",

        # ═══ V1: SPLIT HERO — Left text, right glowing orb animation ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:'Inter',sans-serif;background:#030303;color:#e8e8ed;-webkit-font-smoothing:antialiased}}a{{text-decoration:none;color:inherit}}
{logo_css}
nav{{display:flex;align-items:center;justify-content:space-between;padding:18px 5%;max-width:1200px;margin:0 auto}}
.lg{{display:flex;align-items:center;gap:10px}}
.nb{{border:1.5px solid {a};color:{a};padding:10px 22px;border-radius:10px;font-weight:600;font-size:13px;transition:all .2s}}.nb:hover{{background:{a};color:#000}}
.hero{{display:flex;align-items:center;min-height:75vh;padding:40px 5%;max-width:1200px;margin:0 auto;gap:60px}}
.hero-txt{{flex:1}}.hero-viz{{flex:1;display:flex;justify-content:center;align-items:center;position:relative}}
.orb{{width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,{p}30,{a}15,transparent 70%);filter:blur(50px);animation:pulse 4s ease infinite}}
@keyframes pulse{{0%,100%{{opacity:.5;transform:scale(1)}}50%{{opacity:.8;transform:scale(1.15)}}}}
.hero h1{{font-size:clamp(36px,6vw,58px);font-weight:900;letter-spacing:-2px;line-height:1.05;margin-bottom:20px}}
.hero h1 em{{font-style:normal;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.hero p{{color:#777;font-size:18px;max-width:480px;line-height:1.6;margin-bottom:32px}}
.cta{{display:inline-block;background:{a};color:#000;font-weight:700;padding:14px 32px;border-radius:12px;font-size:16px;transition:all .2s}}.cta:hover{{transform:translateY(-2px)}}
.sec{{padding:80px 5%;max-width:1000px;margin:0 auto}}
.tag{{display:inline-block;background:{p}12;color:{p};font-size:11px;font-weight:700;padding:5px 14px;border-radius:16px;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px}}
.sh{{font-size:clamp(26px,4vw,38px);font-weight:900;letter-spacing:-1px;margin-bottom:16px}}
.g2{{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}}
.gc{{background:#0c0c0f;border:1px solid #1a1a1f;border-radius:14px;padding:24px;transition:border-color .2s}}.gc:hover{{border-color:{a}}}
.gc h4{{font-size:14px;font-weight:700;margin-bottom:6px;color:{a}}}.gc p{{font-size:13px;color:#777;line-height:1.5}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:28px}}
.pc{{background:#0c0c0f;border:1px solid #1a1a1f;border-radius:14px;padding:28px;text-align:center;position:relative}}.pc.pop{{border-color:{a}}}
.pc.pop::before{{content:'POPULAR';position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:{a};color:#000;font-size:10px;font-weight:800;padding:3px 14px;border-radius:16px}}
.pc h3{{color:#666;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}}
.pr{{font-size:32px;font-weight:900;color:{a};margin-bottom:16px}}.pc ul{{list-style:none;text-align:left;margin-bottom:20px}}.pc li{{padding:6px 0;color:#777;font-size:13px;border-bottom:1px solid #151518}}.pc li::before{{content:'✓ ';color:{a}}}
.pb{{display:block;padding:12px;border-radius:10px;font-weight:600;font-size:14px;border:1.5px solid #252528;color:#ccc;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:{a};color:#000;border-color:{a}}}
#cta{{border-top:1px solid #1a1a1f;padding:80px 5%;text-align:center}}
#cta h2{{font-size:clamp(24px,4vw,36px);font-weight:900;margin-bottom:12px}}
.ce{{display:block;font-size:20px;font-weight:800;color:{a};margin-top:20px}}.cp{{display:block;color:{p};font-weight:700;font-size:17px;margin-top:8px}}.cn{{color:#555;margin-top:6px}}
footer{{padding:20px 5%;display:flex;justify-content:space-between;font-size:12px;color:#333;flex-wrap:wrap;gap:8px}}
@media(max-width:768px){{.hero{{flex-direction:column;text-align:center;padding:60px 5%}}.hero p{{margin:0 auto 24px}}.hero-viz{{display:none}}.g2,.pg{{grid-template-columns:1fr}}footer{{flex-direction:column;text-align:center;align-items:center}}}}
</style></head><body>
<nav><div class="lg"><div class="logo-box">{logo}</div><span class="logo-text">{bn}</span></div><a href="#cta" class="nb">Contact Us →</a></nav>
<section class="hero"><div class="hero-txt"><h1>{tg.split()[0] if tg else bn} <em>{' '.join(tg.split()[1:]) if len(tg.split())>1 else ''}</em></h1><p>{pt}</p><a href="#cta" class="cta">Get Started →</a></div><div class="hero-viz"><div class="orb"></div></div></section>
<section class="sec"><span class="tag">Services</span><h2 class="sh">What We Offer</h2><p style="color:#777;margin-bottom:20px">{tgt}</p><div class="g2">{''.join(f'<div class="gc"><h4>{s[:50]}</h4><p>{s[50:]}</p></div>' for s in strats)}</div></section>
<section class="sec" style="text-align:center"><span class="tag">Pricing</span><h2 class="sh">Choose Your Plan</h2><div class="pg">{pricing_html}</div></section>
<section id="cta"><h2>Let's Build Together</h2><p style="color:#666">Get in touch today</p>{contact}</section>
<footer><span>© 2026 {bn}</span><span style="opacity:.4">hustleai.live</span></footer></body></html>""",

        # ═══ V2: MINIMAL ACCENT LINE — Clean, whitespace-heavy, numbered strategies ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:'Inter',sans-serif;background:#060608;color:#e0e0e5;-webkit-font-smoothing:antialiased}}a{{text-decoration:none;color:inherit}}
{logo_css}
nav{{display:flex;align-items:center;justify-content:space-between;padding:20px 6%;max-width:1080px;margin:0 auto;border-bottom:1px solid #18181c}}
.lg{{display:flex;align-items:center;gap:10px}}
.nb{{background:#fff;color:#000;padding:9px 20px;border-radius:8px;font-weight:700;font-size:12px}}
.hero{{text-align:center;padding:120px 6% 80px;position:relative}}
.hero::before{{content:'';position:absolute;top:40px;left:50%;transform:translateX(-50%);width:60px;height:3px;background:linear-gradient(90deg,{p},{a});border-radius:2px}}
.hero h1{{font-size:clamp(34px,7vw,60px);font-weight:900;letter-spacing:-2px;line-height:1.05;margin-bottom:20px;max-width:700px;margin-left:auto;margin-right:auto}}
.hl{{background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.hero p{{color:#666;font-size:clamp(15px,1.8vw,18px);max-width:500px;margin:0 auto 36px;line-height:1.6}}
.cta{{display:inline-flex;gap:8px;align-items:center;background:#fff;color:#000;font-weight:700;padding:14px 28px;border-radius:10px;font-size:15px;transition:transform .2s}}.cta:hover{{transform:translateY(-2px)}}
.sec{{padding:70px 6%;max-width:880px;margin:0 auto}}
.dl{{display:flex;align-items:flex-start;gap:28px;padding:24px 0;border-bottom:1px solid #14141a}}
.dl-n{{font-size:42px;font-weight:900;min-width:56px;background:linear-gradient(180deg,{a}40,transparent);-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.dl h4{{font-size:15px;font-weight:700;margin-bottom:4px}}.dl p{{font-size:13px;color:#666;line-height:1.5}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:28px}}
.pc{{background:#0c0c10;border:1px solid #1a1a20;border-radius:16px;padding:28px;text-align:center;position:relative}}.pc.pop{{border-color:{p}}}
.pc.pop::before{{content:'★ RECOMMENDED';position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,{p},{a});color:#fff;font-size:10px;font-weight:800;padding:3px 14px;border-radius:14px}}
.pc h3{{color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}}
.pr{{font-size:34px;font-weight:900;margin-bottom:18px;color:{a}}}.pc ul{{list-style:none;text-align:left;margin-bottom:22px}}.pc li{{padding:7px 0;color:#777;font-size:13px;border-bottom:1px solid #141418}}.pc li::before{{content:'→ ';color:{p};font-weight:700}}
.pb{{display:block;padding:12px;border-radius:10px;font-weight:600;font-size:14px;border:1.5px solid #222;color:#ccc;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:#fff;color:#000;border-color:#fff}}
.ce{{display:block;font-size:20px;font-weight:800;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:20px}}.cp{{display:block;color:{a};font-weight:600;font-size:16px;margin-top:8px}}.cn{{color:#555;margin-top:6px}}
#cta{{padding:80px 6%;text-align:center;background:#0a0a0e;border-top:1px solid #151518;border-bottom:1px solid #151518}}
#cta h2{{font-size:clamp(24px,4vw,34px);font-weight:900;margin-bottom:10px}}
footer{{padding:20px 6%;text-align:center;font-size:11px;color:#333;border-top:1px solid #111}}
@media(max-width:640px){{.dl{{flex-direction:column;gap:12px}}.pg{{grid-template-columns:1fr}}}}
</style></head><body>
<nav><div class="lg"><div class="logo-box">{logo}</div><span class="logo-text">{bn}</span></div><a href="#cta" class="nb">Book Now →</a></nav>
<section class="hero"><h1><span class="hl">{tg}</span></h1><p>{pt}</p><a href="#cta" class="cta">Get Started →</a></section>
<section class="sec"><p style="color:#777;margin-bottom:24px">{tgt}</p>{''.join(f'<div class="dl"><div class="dl-n">{str(i+1).zfill(2)}</div><div><h4>{s[:60]}</h4><p>{s[60:]}</p></div></div>' for i,s in enumerate(strats))}</section>
<section class="sec" style="text-align:center"><h2 style="font-size:clamp(24px,4vw,34px);font-weight:900;letter-spacing:-1px;margin-bottom:24px">Our Packages</h2><div class="pg">{pricing_html}</div></section>
<section id="cta"><h2>Ready to Start?</h2><p style="color:#666">Let's work together</p>{contact}</section>
<footer>© 2026 {bn} · hustleai.live</footer></body></html>""",

        # ═══ V3: LUXURY HORIZONTAL — Side-scrolling cards, metric band, elegant contact ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:'Inter',sans-serif;background:#020204;color:#d8d8e0;-webkit-font-smoothing:antialiased}}a{{text-decoration:none;color:inherit}}
{logo_css}
nav{{display:flex;align-items:center;justify-content:space-between;padding:18px 5%;max-width:1200px;margin:0 auto}}
.lg{{display:flex;align-items:center;gap:10px}}
.nb{{color:{a};font-weight:700;font-size:14px;border-bottom:2px solid {a};padding-bottom:2px}}
.hero{{padding:110px 5% 90px;max-width:1200px;margin:0 auto;position:relative}}
.hero::after{{content:'';position:absolute;top:20%;right:5%;width:350px;height:350px;background:radial-gradient(circle,{p}12,{a}08,transparent 60%);pointer-events:none}}
.hero h1{{font-size:clamp(38px,7vw,68px);font-weight:900;letter-spacing:-3px;line-height:1;max-width:700px;position:relative}}
.hero h1 span{{display:block;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.hero p{{color:#666;font-size:18px;max-width:480px;margin:28px 0 40px;line-height:1.6;position:relative}}
.cta{{display:inline-block;background:linear-gradient(135deg,{p},{a});color:#fff;font-weight:700;padding:16px 36px;border-radius:12px;font-size:16px;position:relative;transition:all .2s}}.cta:hover{{transform:translateY(-2px)}}
.band{{display:flex;border-top:1px solid #151518;border-bottom:1px solid #151518;overflow:hidden}}
.bi{{flex:1;padding:32px 24px;text-align:center;border-right:1px solid #151518}}.bi:last-child{{border-right:none}}
.bi h4{{font-size:28px;font-weight:900;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}}.bi p{{font-size:12px;color:#555;text-transform:uppercase;letter-spacing:1px}}
.sec{{padding:80px 5%;max-width:960px;margin:0 auto}}
.sh{{font-size:clamp(26px,4vw,38px);font-weight:900;letter-spacing:-1.5px;margin-bottom:24px}}
.hz{{display:flex;gap:16px;overflow-x:auto;padding-bottom:16px;-webkit-overflow-scrolling:touch}}
.hc{{min-width:280px;background:#0a0a0e;border:1px solid #1a1a20;border-radius:14px;padding:24px;flex-shrink:0;transition:border-color .2s}}.hc:hover{{border-color:{a}}}
.hc h4{{font-size:14px;font-weight:700;margin-bottom:8px;color:{a}}}.hc p{{color:#666;font-size:13px;line-height:1.5}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:24px}}
.pc{{background:#0a0a0e;border:1px solid #1a1a20;border-radius:14px;padding:28px;text-align:center;position:relative}}.pc.pop{{border-color:{a}}}
.pc.pop::before{{content:'★';position:absolute;top:14px;right:14px;color:{a};font-size:18px}}
.pc h3{{color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}}
.pr{{font-size:34px;font-weight:900;color:{a};margin-bottom:18px}}.pc ul{{list-style:none;text-align:left;margin-bottom:22px}}.pc li{{padding:6px 0;color:#666;font-size:13px;border-bottom:1px solid #111}}.pc li::before{{content:'· ';color:{a};font-weight:900}}
.pb{{display:block;padding:12px;border-radius:10px;font-weight:600;font-size:14px;background:#151518;color:#ccc;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:{a};color:#000}}
#cta{{border-top:1px solid #151518;padding:80px 5%;text-align:center}}
#cta h2{{font-size:32px;font-weight:900;margin-bottom:12px}}
.ce{{display:block;font-size:20px;font-weight:800;color:{a};margin-top:20px}}.cp{{display:block;color:{p};font-weight:600;font-size:17px;margin-top:8px}}.cn{{color:#444;margin-top:6px;font-size:14px}}
footer{{padding:20px 5%;display:flex;justify-content:space-between;font-size:11px;color:#333}}
@media(max-width:768px){{.band{{flex-direction:column}}.bi{{border-right:none;border-bottom:1px solid #151518}}.hero h1{{font-size:42px}}.hz{{flex-direction:column}}.hc{{min-width:100%}}.pg{{grid-template-columns:1fr}}footer{{flex-direction:column;text-align:center;align-items:center;gap:4px}}}}
</style></head><body>
<nav><div class="lg"><div class="logo-box">{logo}</div><span class="logo-text">{bn}</span></div><a href="#cta" class="nb">Let's Talk →</a></nav>
<section class="hero"><h1>{tg.rsplit(' ',1)[0] if ' ' in tg else tg}<span>{tg.rsplit(' ',1)[1] if ' ' in tg else ''}</span></h1><p>{pt}</p><a href="#cta" class="cta">Start Today →</a></section>
<div class="band"><div class="bi"><h4>24hr</h4><p>Response</p></div><div class="bi"><h4>100%</h4><p>Satisfaction</p></div><div class="bi"><h4>1-on-1</h4><p>Personalized</p></div></div>
<section class="sec"><h2 class="sh">How We Help</h2><p style="color:#666;margin-bottom:24px">{tgt}</p><div class="hz">{''.join(f"<div class=hc><h4>Step {i+1}</h4><p>{s}</p></div>" for i,s in enumerate(strats))}</div></section>
<section class="sec" style="text-align:center"><h2 class="sh">Investment</h2><div class="pg">{pricing_html}</div></section>
<section id="cta"><h2>Let's Connect</h2><p style="color:#555">Ready when you are</p>{contact}</section>
<footer><span>© 2026 {bn}</span><span style="opacity:.4">hustleai.live</span></footer></body></html>""",

        # ═══ V4: GEOMETRIC BLOCKS — Split grid hero, angular sections, bold borders ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:'Inter',sans-serif;background:#040406;color:#ddd;-webkit-font-smoothing:antialiased}}a{{text-decoration:none;color:inherit}}
{logo_css}
nav{{display:flex;align-items:center;justify-content:space-between;padding:16px 5%;background:#0a0a0e;border-bottom:1px solid #151518}}
.lg{{display:flex;align-items:center;gap:10px}}
.nb{{background:linear-gradient(135deg,{p},{a});color:#fff;padding:10px 22px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-radius:8px}}
.hero{{display:grid;grid-template-columns:1fr 1fr;min-height:75vh}}
.hero-l{{background:linear-gradient(135deg,{p}10,{a}05);display:flex;flex-direction:column;justify-content:center;padding:60px 5%}}
.hero-r{{background:linear-gradient(160deg,{a}05,{p}08);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}}
.hero-r::before{{content:'{logo}';font-size:200px;font-weight:900;background:linear-gradient(135deg,{p}08,{a}05);-webkit-background-clip:text;-webkit-text-fill-color:transparent;position:absolute}}
.hero h1{{font-size:clamp(32px,5vw,52px);font-weight:900;letter-spacing:-2px;line-height:1.05;margin-bottom:16px}}
.hero p{{color:#888;font-size:16px;max-width:440px;line-height:1.6;margin-bottom:28px}}
.cta{{display:inline-block;background:linear-gradient(135deg,{p},{a});color:#fff;font-weight:700;padding:14px 28px;font-size:14px;border-radius:10px;transition:all .2s}}.cta:hover{{transform:translateY(-2px)}}
.row{{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid #151518}}
.ri{{padding:32px;border-right:1px solid #151518;text-align:center}}.ri:last-child{{border-right:none}}
.ri .num{{font-size:11px;font-weight:700;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px}}
.ri p{{color:#777;font-size:13px;line-height:1.5}}
.sec{{padding:80px 5%;max-width:960px;margin:0 auto}}
.tag2{{display:inline-block;background:linear-gradient(135deg,{p},{a});color:#fff;font-size:10px;font-weight:800;padding:4px 12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;border-radius:4px}}
.sh{{font-size:clamp(26px,4vw,38px);font-weight:900;letter-spacing:-1.5px;margin-bottom:16px}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0;border:1px solid #151518;margin-top:24px;border-radius:14px;overflow:hidden}}
.pc{{padding:28px;border-right:1px solid #151518;text-align:center;position:relative}}.pc:last-child{{border-right:none}}.pc.pop{{background:linear-gradient(180deg,{a}05,transparent)}}
.pc h3{{color:#555;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}}
.pr{{font-size:32px;font-weight:900;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:16px}}.pc ul{{list-style:none;text-align:left;margin-bottom:20px}}.pc li{{padding:6px 0;color:#777;font-size:13px;border-bottom:1px solid #0e0e12}}.pc li::before{{content:'— ';color:{a}}}
.pb{{display:block;padding:12px;font-weight:700;font-size:13px;background:#151518;color:#ccc;border-radius:8px;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:linear-gradient(135deg,{p},{a});color:#fff}}
#cta{{background:#0a0a0e;border-top:1px solid #151518;padding:80px 5%;text-align:center}}
#cta h2{{font-size:30px;font-weight:900;letter-spacing:-1px;margin-bottom:12px}}
.ce{{display:block;font-size:18px;font-weight:800;color:{a};margin-top:20px}}.cp{{display:block;color:{p};font-weight:600;font-size:16px;margin-top:8px}}.cn{{color:#444;margin-top:4px}}
footer{{padding:16px 5%;display:flex;justify-content:space-between;font-size:11px;color:#333;text-transform:uppercase;letter-spacing:1px}}
@media(max-width:768px){{.hero{{grid-template-columns:1fr}}.hero-r{{display:none}}.row{{grid-template-columns:1fr}}.ri{{border-right:none;border-bottom:1px solid #151518}}.pg{{grid-template-columns:1fr}}.pc{{border-right:none;border-bottom:1px solid #151518}}footer{{flex-direction:column;text-align:center;align-items:center;gap:4px}}}}
</style></head><body>
<nav><div class="lg"><div class="logo-box">{logo}</div><span class="logo-text">{bn}</span></div><a href="#cta" class="nb">Contact</a></nav>
<section class="hero"><div class="hero-l"><h1>{tg}</h1><p>{pt}</p><a href="#cta" class="cta">Get Started →</a></div><div class="hero-r"></div></section>
<div class="row">{''.join(f'<div class="ri"><div class="num">0{i+1}</div><p>{s[:80]}</p></div>' for i,s in enumerate(strats))}</div>
<section class="sec"><span class="tag2">About</span><h2 class="sh">What We Do</h2><p style="color:#777;line-height:1.7">{tgt}</p></section>
<section class="sec" style="text-align:center"><span class="tag2">Pricing</span><h2 class="sh">Our Packages</h2><div class="pg">{pricing_html}</div></section>
<section id="cta"><h2>Start Your Journey</h2><p style="color:#555">We're ready when you are</p>{contact}</section>
<footer><span>© 2026 {bn}</span><span style="opacity:.4">hustleai.live</span></footer></body></html>""",
    ]

    return templates[variant % len(templates)]
