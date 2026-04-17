"""
Premium Landing Page Templates — 5 unique, high-quality designs.
Each template is visually distinct with different layout patterns,
typography styles, and visual hierarchies.
"""

def get_template(variant: int, data: dict) -> str:
    """Return complete HTML for the given variant (0-4) with data injected."""
    bn = data.get("biz_name", "Business")
    tg = data.get("tagline", "Your tagline")
    pt = data.get("pitch", "Your elevator pitch goes here.")
    tgt = data.get("target", "")
    p = data.get("primary", "#6366F1")
    a = data.get("accent", "#EC4899")
    email = data.get("email", "")
    phone = data.get("phone", "")
    name = data.get("name", "")
    strats = data.get("strategies", [])
    # Normalize strategies: could be strings or dicts with 'strategy' key
    normalized_strats = []
    for s in strats:
        if isinstance(s, dict):
            normalized_strats.append(s.get("strategy", str(s)))
        else:
            normalized_strats.append(str(s))
    strats = normalized_strats
    tiers = data.get("pricing_tiers", [])
    logo = bn[0] if bn else "B"

    strat_cards = ""
    icons = ["01", "02", "03"]
    for i, s in enumerate(strats[:3]):
        strat_cards += f'<div class="sc"><span class="sc-n">{icons[i]}</span><p>{s}</p></div>'

    pricing_cards = ""
    for i, t in enumerate(tiers[:3]):
        feat = "".join(f"<li>{f}</li>" for f in t.get("features", []))
        pop = " pop" if i == 1 else ""
        pricing_cards += f'<div class="pc{pop}"><h3>{t.get("name","")}</h3><div class="pr">{t.get("price","")}</div><ul>{feat}</ul><a href="#cta" class="pb">Start Now</a></div>'

    contact = f'<p class="ce">{email}</p>'
    if phone:
        contact += f'<p class="cp">{phone}</p>'
    if name:
        contact += f'<p class="cn">{name}</p>'

    templates = [
        # ═══ VARIANT 0: BOLD GRADIENT HERO ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Inter',sans-serif;background:#050505;color:#eee;-webkit-font-smoothing:antialiased}}
a{{text-decoration:none;color:inherit}}
nav{{display:flex;align-items:center;justify-content:space-between;padding:20px 6%;max-width:1100px;margin:0 auto}}
.lg{{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:800}}
.lm{{width:36px;height:36px;background:linear-gradient(135deg,{p},{a});border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:18px}}
.nb{{background:{a};color:#000;padding:10px 22px;border-radius:10px;font-weight:700;font-size:13px}}
.hero{{padding:100px 6% 80px;text-align:center}}
.hero h1{{font-size:clamp(40px,8vw,72px);font-weight:900;letter-spacing:-3px;line-height:1;margin-bottom:20px;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.hero p{{color:#888;font-size:clamp(16px,2vw,20px);max-width:560px;margin:0 auto 36px;line-height:1.6}}
.cta{{display:inline-block;background:linear-gradient(135deg,{p},{a});color:#fff;font-weight:700;padding:16px 40px;border-radius:14px;font-size:17px;box-shadow:0 0 50px {p}30}}
.cta:hover{{transform:translateY(-2px);box-shadow:0 0 60px {p}50}}
.sec{{padding:80px 6%;max-width:960px;margin:0 auto}}
.st{{font-size:12px;font-weight:700;color:{p};text-transform:uppercase;letter-spacing:2px;margin-bottom:12px}}
.sh{{font-size:clamp(28px,4vw,42px);font-weight:900;letter-spacing:-1.5px;margin-bottom:16px}}
.sp{{color:#888;font-size:16px;line-height:1.6;max-width:560px}}
.sc{{background:#111;border:1px solid #222;border-radius:16px;padding:28px;margin-bottom:12px;transition:border-color .2s}}
.sc:hover{{border-color:{a}}}
.sc-n{{display:inline-block;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:900;font-size:14px;margin-bottom:8px}}
.sc p{{color:#999;font-size:14px;line-height:1.5}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:32px}}
.pc{{background:#111;border:1px solid #222;border-radius:16px;padding:32px;text-align:center}}
.pc.pop{{border-color:{a};position:relative}}
.pc.pop::before{{content:'BEST VALUE';position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,{p},{a});color:#fff;font-size:10px;font-weight:800;padding:4px 14px;border-radius:20px}}
.pc h3{{color:#888;font-size:14px;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}}
.pr{{font-size:36px;font-weight:900;margin-bottom:20px;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.pc ul{{list-style:none;text-align:left;margin-bottom:24px}}
.pc li{{padding:8px 0;color:#888;font-size:14px;border-bottom:1px solid #1a1a1a}}
.pc li::before{{content:'✓ ';color:{a};font-weight:700}}
.pb{{display:block;padding:14px;border-radius:12px;font-weight:700;border:2px solid #222;color:#eee;transition:all .2s}}
.pb:hover,.pc.pop .pb{{background:linear-gradient(135deg,{p},{a});color:#fff;border-color:transparent}}
#cta{{background:#0a0a0a;border-top:1px solid #1a1a1a;padding:80px 6%;text-align:center}}
#cta h2{{font-size:clamp(26px,4vw,38px);font-weight:900;margin-bottom:12px}}
.ce{{font-size:22px;font-weight:800;margin-top:16px;background:linear-gradient(135deg,{p},{a});-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.cp{{color:{a};font-size:18px;font-weight:700;margin-top:8px}}
.cn{{color:#666;margin-top:8px}}
footer{{padding:24px 6%;display:flex;justify-content:space-between;font-size:12px;color:#444;flex-wrap:wrap;gap:8px}}
@media(max-width:640px){{.pg{{grid-template-columns:1fr}}footer{{flex-direction:column;text-align:center;align-items:center}}}}
</style></head><body>
<nav><div class="lg"><div class="lm">{logo}</div>{bn}</div><a href="#cta" class="nb">Get Started</a></nav>
<section class="hero"><h1>{tg}</h1><p>{pt}</p><a href="#cta" class="cta">Get Started →</a></section>
<section class="sec"><div class="st">What We Do</div><h2 class="sh">Built for Results</h2><p class="sp">{tgt}</p></section>
<section class="sec" style="background:#0a0a0a;max-width:100%;border-top:1px solid #1a1a1a;border-bottom:1px solid #1a1a1a"><div style="max-width:960px;margin:0 auto"><div class="st">Why Choose Us</div><h2 class="sh">Our Approach</h2>{strat_cards}</div></section>
<section class="sec" style="text-align:center"><div class="st">Pricing</div><h2 class="sh">Simple Pricing</h2><div class="pg">{pricing_cards}</div></section>
<section id="cta"><h2>Ready to Get Started?</h2><p style="color:#888">Reach out and let's make it happen.</p>{contact}</section>
<footer><span>© 2026 {bn}</span><span>Powered by HustleAI</span></footer>
</body></html>""",

        # ═══ VARIANT 1: SPLIT HERO WITH GLOWING ORB ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:'Inter',sans-serif;background:#030303;color:#e8e8ed;-webkit-font-smoothing:antialiased}}a{{text-decoration:none;color:inherit}}
nav{{display:flex;align-items:center;justify-content:space-between;padding:18px 5%;max-width:1200px;margin:0 auto}}
.lg{{font-size:20px;font-weight:900;letter-spacing:-.5px}}.lg span{{color:{a}}}
.nb{{border:1.5px solid #333;padding:10px 20px;border-radius:10px;font-weight:600;font-size:13px;transition:all .2s}}.nb:hover{{border-color:{a};color:{a}}}
.hero{{display:flex;align-items:center;min-height:70vh;padding:40px 5%;max-width:1200px;margin:0 auto;gap:40px}}
.hero-txt{{flex:1}}
.hero-viz{{flex:1;display:flex;justify-content:center;align-items:center;position:relative}}
.orb{{width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,{p}40,{a}20,transparent 70%);filter:blur(60px);animation:pulse 4s ease infinite}}
@keyframes pulse{{0%,100%{{opacity:.6;transform:scale(1)}}50%{{opacity:1;transform:scale(1.1)}}}}
.hero h1{{font-size:clamp(36px,6vw,58px);font-weight:900;letter-spacing:-2px;line-height:1.05;margin-bottom:20px}}
.hero h1 em{{font-style:normal;color:{a}}}
.hero p{{color:#777;font-size:18px;max-width:480px;line-height:1.6;margin-bottom:32px}}
.cta{{display:inline-block;background:{a};color:#000;font-weight:700;padding:14px 32px;border-radius:12px;font-size:16px;transition:opacity .2s}}.cta:hover{{opacity:.85}}
.sec{{padding:80px 5%;max-width:1000px;margin:0 auto}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}}
.gc{{background:#0c0c0f;border:1px solid #1a1a1f;border-radius:14px;padding:24px;transition:border-color .2s}}.gc:hover{{border-color:{p}}}
.gc h4{{font-size:14px;font-weight:700;margin-bottom:6px}}.gc p{{font-size:13px;color:#777;line-height:1.5}}
.st{{display:inline-block;background:{p}12;color:{p};font-size:11px;font-weight:700;padding:5px 12px;border-radius:16px;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px}}
.sh{{font-size:clamp(26px,4vw,38px);font-weight:900;letter-spacing:-1px;margin-bottom:8px}}.sp{{color:#777;font-size:15px}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:28px}}
.pc{{background:#0c0c0f;border:1px solid #1a1a1f;border-radius:14px;padding:28px;text-align:center;position:relative;transition:border-color .2s}}.pc.pop{{border-color:{a}}}
.pc.pop::before{{content:'POPULAR';position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:{a};color:#000;font-size:10px;font-weight:800;padding:3px 12px;border-radius:16px}}
.pc h3{{color:#666;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}}
.pr{{font-size:32px;font-weight:900;color:{a};margin-bottom:16px}}.pc ul{{list-style:none;text-align:left;margin-bottom:20px}}.pc li{{padding:6px 0;color:#777;font-size:13px;border-bottom:1px solid #151518}}.pc li::before{{content:'✓ ';color:{a}}}
.pb{{display:block;padding:12px;border-radius:10px;font-weight:600;font-size:14px;border:1.5px solid #252528;color:#ccc;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:{a};color:#000;border-color:{a}}}
#cta{{background:#080808;border-top:1px solid #1a1a1f;padding:80px 5%;text-align:center}}
#cta h2{{font-size:clamp(24px,4vw,36px);font-weight:900;margin-bottom:10px}}
.ce{{font-size:20px;font-weight:800;color:{a};margin-top:16px}}.cp{{color:{p};font-weight:700;font-size:17px;margin-top:6px}}.cn{{color:#555;margin-top:6px}}
footer{{padding:20px 5%;display:flex;justify-content:space-between;font-size:12px;color:#333;flex-wrap:wrap;gap:8px}}
@media(max-width:768px){{.hero{{flex-direction:column;text-align:center;padding:60px 5%}}.hero p{{margin:0 auto 24px}}.hero-viz{{display:none}}.grid2{{grid-template-columns:1fr}}.pg{{grid-template-columns:1fr}}footer{{flex-direction:column;text-align:center;align-items:center}}}}
</style></head><body>
<nav><div class="lg">{bn}<span>.</span></div><a href="#cta" class="nb">Contact Us</a></nav>
<section class="hero"><div class="hero-txt"><h1>{tg.split(' ')[0]} <em>{' '.join(tg.split(' ')[1:])}</em></h1><p>{pt}</p><a href="#cta" class="cta">Get Started →</a></div><div class="hero-viz"><div class="orb"></div></div></section>
<section class="sec"><span class="st">Services</span><h2 class="sh">What We Offer</h2><p class="sp">{tgt}</p></section>
<section style="background:#080808;border-top:1px solid #151518;border-bottom:1px solid #151518;padding:80px 5%"><div style="max-width:1000px;margin:0 auto"><span class="st">Why Us</span><h2 class="sh">Our Edge</h2><div class="grid2">{''.join(f'<div class="gc"><h4>Strategy {i+1}</h4><p>{s}</p></div>' for i,s in enumerate(strats[:4]))}</div></div></section>
<section class="sec" style="text-align:center"><span class="st">Pricing</span><h2 class="sh">Choose Your Plan</h2><div class="pg">{pricing_cards}</div></section>
<section id="cta"><h2>Let's Build Something Great</h2><p style="color:#666">Get in touch today.</p>{contact}</section>
<footer><span>© 2026 {bn}</span><span>Powered by HustleAI</span></footer>
</body></html>""",

        # ═══ VARIANT 2: CENTERED MINIMAL WITH ACCENT LINE ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:'Inter',sans-serif;background:#060608;color:#e0e0e5;-webkit-font-smoothing:antialiased}}a{{text-decoration:none;color:inherit}}
nav{{display:flex;align-items:center;justify-content:space-between;padding:20px 6%;max-width:1080px;margin:0 auto;border-bottom:1px solid #18181c}}
.lg{{font-size:18px;font-weight:900}}.lg::after{{content:'';display:inline-block;width:6px;height:6px;background:{a};border-radius:50%;margin-left:4px;vertical-align:super}}
.nb{{background:#fff;color:#000;padding:8px 18px;border-radius:8px;font-weight:700;font-size:12px}}
.hero{{text-align:center;padding:120px 6% 80px;position:relative}}
.hero::before{{content:'';position:absolute;top:40px;left:50%;transform:translateX(-50%);width:60px;height:3px;background:linear-gradient(90deg,{p},{a});border-radius:2px}}
.hero h1{{font-size:clamp(34px,7vw,60px);font-weight:900;letter-spacing:-2px;line-height:1.05;margin-bottom:20px;max-width:700px;margin-left:auto;margin-right:auto}}
.hl{{color:{a}}}
.hero p{{color:#666;font-size:clamp(15px,1.8vw,18px);max-width:500px;margin:0 auto 36px;line-height:1.6}}
.cta{{display:inline-flex;gap:8px;align-items:center;background:#fff;color:#000;font-weight:700;padding:14px 28px;border-radius:10px;font-size:15px;transition:transform .2s}}.cta:hover{{transform:translateY(-2px)}}
.sec{{padding:70px 6%;max-width:880px;margin:0 auto}}
.dl{{display:flex;align-items:flex-start;gap:32px;padding:24px 0;border-bottom:1px solid #14141a}}
.dl-n{{font-size:48px;font-weight:900;color:#1a1a20;min-width:60px;background:linear-gradient(180deg,{p}40,transparent);-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.dl-t{{font-size:15px;font-weight:600;margin-bottom:4px}}.dl-d{{font-size:13px;color:#666;line-height:1.5}}
.cta-block{{background:linear-gradient(160deg,{p}08,{a}05);border:1px solid #1a1a1f;border-radius:20px;padding:60px 40px;text-align:center;max-width:700px;margin:0 auto}}
.cta-block h2{{font-size:clamp(24px,4vw,34px);font-weight:900;margin-bottom:10px}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:28px}}
.pc{{background:#0c0c10;border:1px solid #1a1a20;border-radius:16px;padding:28px;text-align:center;position:relative}}.pc.pop{{border-color:{p}}}
.pc.pop::before{{content:'RECOMMENDED';position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,{p},{a});color:#fff;font-size:10px;font-weight:800;padding:3px 12px;border-radius:14px}}
.pc h3{{color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}}
.pr{{font-size:34px;font-weight:900;margin-bottom:18px}}.pc ul{{list-style:none;text-align:left;margin-bottom:22px}}.pc li{{padding:7px 0;color:#777;font-size:13px;border-bottom:1px solid #141418}}.pc li::before{{content:'→ ';color:{p};font-weight:700}}
.pb{{display:block;padding:12px;border-radius:10px;font-weight:600;font-size:14px;border:1.5px solid #222;color:#ccc;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:#fff;color:#000;border-color:#fff}}
.ce{{font-size:20px;font-weight:800;color:{a};margin-top:16px}}.cp{{color:{p};font-weight:600;font-size:16px;margin-top:6px}}.cn{{color:#555;margin-top:6px}}
footer{{padding:20px 6%;text-align:center;font-size:11px;color:#333;border-top:1px solid #111}}
@media(max-width:640px){{.dl{{flex-direction:column;gap:12px}}.dl-n{{font-size:32px}}.pg{{grid-template-columns:1fr}}.cta-block{{padding:40px 20px}}}}
</style></head><body>
<nav><div class="lg">{bn}</div><a href="#cta" class="nb">Book Now →</a></nav>
<section class="hero"><h1>{tg.replace(' ', f' <span class="hl">', 1).replace(' ', '</span> ', 1) if len(tg.split()) > 2 else f'<span class="hl">{tg}</span>'}</h1><p>{pt}</p><a href="#cta" class="cta">Get Started →</a></section>
<section class="sec">{''.join(f'<div class="dl"><div class="dl-n">{str(i+1).zfill(2)}</div><div><div class="dl-t">{s[:60]}</div><div class="dl-d">{s[60:] if len(s)>60 else ""}</div></div></div>' for i,s in enumerate(strats[:3]))}
</section>
<section class="sec" style="text-align:center"><h2 style="font-size:clamp(24px,4vw,34px);font-weight:900;letter-spacing:-1px;margin-bottom:8px">Packages</h2><p style="color:#666;margin-bottom:8px">{tgt}</p><div class="pg">{pricing_cards}</div></section>
<section class="sec" id="cta"><div class="cta-block"><h2>Ready to Start?</h2><p style="color:#666;margin-bottom:0">Let's work together.</p>{contact}</div></section>
<footer>© 2026 {bn} · Powered by HustleAI</footer>
</body></html>""",

        # ═══ VARIANT 3: DARK LUXURY WITH HORIZONTAL CARDS ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:'Inter',sans-serif;background:#020204;color:#d8d8e0;-webkit-font-smoothing:antialiased}}a{{text-decoration:none;color:inherit}}
nav{{display:flex;align-items:center;justify-content:space-between;padding:18px 5%;max-width:1200px;margin:0 auto}}
.lg{{display:flex;align-items:center;gap:10px}}.lm{{width:34px;height:34px;border-radius:8px;border:2px solid {a};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:{a}}}.ln{{font-size:18px;font-weight:800}}
.nb{{color:{a};font-weight:600;font-size:14px;border-bottom:2px solid {a};padding-bottom:2px}}
.hero{{padding:110px 5% 90px;max-width:1200px;margin:0 auto;position:relative}}
.hero::after{{content:'';position:absolute;top:20%;right:5%;width:300px;height:300px;background:radial-gradient(circle,{p}15,transparent 60%);pointer-events:none}}
.hero h1{{font-size:clamp(38px,7vw,68px);font-weight:900;letter-spacing:-3px;line-height:1;max-width:700px}}
.hero h1 span{{display:block;color:{a}}}
.hero p{{color:#666;font-size:18px;max-width:480px;margin:28px 0 40px;line-height:1.6}}
.cta{{display:inline-block;background:{a};color:#000;font-weight:700;padding:16px 36px;border-radius:12px;font-size:16px;letter-spacing:-.3px}}
.band{{display:flex;border-top:1px solid #151518;border-bottom:1px solid #151518;overflow:hidden}}
.band-item{{flex:1;padding:32px 24px;text-align:center;border-right:1px solid #151518}}
.band-item:last-child{{border-right:none}}
.band-item h4{{font-size:28px;font-weight:900;color:{a};margin-bottom:4px}}
.band-item p{{font-size:12px;color:#555;text-transform:uppercase;letter-spacing:1px}}
.sec{{padding:80px 5%;max-width:960px;margin:0 auto}}
.sh{{font-size:clamp(26px,4vw,38px);font-weight:900;letter-spacing:-1.5px;margin-bottom:24px}}
.hz{{display:flex;gap:16px;overflow-x:auto;padding-bottom:16px;-webkit-overflow-scrolling:touch}}
.hc{{min-width:280px;background:#0a0a0e;border:1px solid #1a1a20;border-radius:14px;padding:24px;flex-shrink:0;transition:border-color .2s}}.hc:hover{{border-color:{a}}}
.hc h4{{font-size:14px;font-weight:700;margin-bottom:8px;color:{a}}}.hc p{{color:#666;font-size:13px;line-height:1.5}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:24px}}
.pc{{background:#0a0a0e;border:1px solid #1a1a20;border-radius:14px;padding:28px;text-align:center;position:relative}}.pc.pop{{border-color:{a}}}
.pc.pop::before{{content:'★';position:absolute;top:12px;right:12px;color:{a};font-size:18px}}
.pc h3{{color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}}
.pr{{font-size:34px;font-weight:900;color:{a};margin-bottom:18px}}.pc ul{{list-style:none;text-align:left;margin-bottom:22px}}.pc li{{padding:6px 0;color:#666;font-size:13px;border-bottom:1px solid #111}}.pc li::before{{content:'· ';color:{a};font-weight:900}}
.pb{{display:block;padding:12px;border-radius:10px;font-weight:600;font-size:14px;background:#151518;color:#ccc;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:{a};color:#000}}
#cta{{border-top:1px solid #151518;padding:80px 5%;text-align:center}}
#cta h2{{font-size:32px;font-weight:900;margin-bottom:10px}}
.ce{{font-size:20px;font-weight:800;color:{a};margin-top:20px}}.cp{{color:{p};font-weight:600;font-size:17px;margin-top:6px}}.cn{{color:#444;margin-top:6px;font-size:14px}}
footer{{padding:20px 5%;display:flex;justify-content:space-between;font-size:11px;color:#333}}
@media(max-width:768px){{.band{{flex-direction:column}}.band-item{{border-right:none;border-bottom:1px solid #151518}}.hero h1{{font-size:42px}}.hz{{flex-direction:column}}.hc{{min-width:100%}}.pg{{grid-template-columns:1fr}}footer{{flex-direction:column;text-align:center;align-items:center;gap:4px}}}}
</style></head><body>
<nav><div class="lg"><div class="lm">{logo}</div><span class="ln">{bn}</span></div><a href="#cta" class="nb">Let's Talk →</a></nav>
<section class="hero"><h1>{tg.rsplit(' ',1)[0] if ' ' in tg else tg}<span>{tg.rsplit(' ',1)[1] if ' ' in tg else ''}</span></h1><p>{pt}</p><a href="#cta" class="cta">Start Today →</a></section>
<div class="band"><div class="band-item"><h4>24hr</h4><p>Response</p></div><div class="band-item"><h4>100%</h4><p>Satisfaction</p></div><div class="band-item"><h4>1-on-1</h4><p>Personalized</p></div></div>
<section class="sec"><h2 class="sh">How We Help</h2><p style="color:#666;margin-bottom:24px">{tgt}</p><div class="hz">{''.join(f"<div class='hc'><h4>Step {i+1}</h4><p>{s}</p></div>" for i,s in enumerate(strats[:3]))}</div></section>
<section class="sec" style="text-align:center"><h2 class="sh">Investment</h2><div class="pg">{pricing_cards}</div></section>
<section id="cta"><h2>Let's Connect</h2><p style="color:#555">Ready when you are.</p>{contact}</section>
<footer><span>© 2026 {bn}</span><span>Powered by HustleAI</span></footer>
</body></html>""",

        # ═══ VARIANT 4: GEOMETRIC / BLOCKY MODERN ═══
        f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{bn}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:'Inter',sans-serif;background:#040406;color:#ddd;-webkit-font-smoothing:antialiased}}a{{text-decoration:none;color:inherit}}
nav{{display:flex;align-items:center;justify-content:space-between;padding:16px 5%;background:#0a0a0e;border-bottom:1px solid #151518}}
.lg{{font-size:18px;font-weight:900;letter-spacing:2px;text-transform:uppercase;font-size:14px;color:{a}}}
.nb{{background:{a};color:#000;padding:10px 20px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px}}
.hero{{display:grid;grid-template-columns:1fr 1fr;min-height:75vh}}
.hero-l{{background:linear-gradient(135deg,{p}15,{a}08);display:flex;flex-direction:column;justify-content:center;padding:60px 5%}}
.hero-r{{background:{a}08;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}}
.hero-r::before{{content:'{logo}';font-size:200px;font-weight:900;color:{a}10;position:absolute}}
.hero h1{{font-size:clamp(32px,5vw,52px);font-weight:900;letter-spacing:-2px;line-height:1.05;margin-bottom:16px}}
.hero p{{color:#888;font-size:16px;max-width:440px;line-height:1.6;margin-bottom:28px}}
.cta{{display:inline-block;background:{a};color:#000;font-weight:700;padding:14px 28px;font-size:14px;text-transform:uppercase;letter-spacing:.5px}}
.row{{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid #151518}}
.row-item{{padding:32px;border-right:1px solid #151518;text-align:center}}
.row-item:last-child{{border-right:none}}
.row-item .num{{font-size:11px;font-weight:700;color:{a};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px}}
.row-item p{{color:#777;font-size:13px;line-height:1.5}}
.sec{{padding:80px 5%;max-width:960px;margin:0 auto}}
.tag{{display:inline-block;background:{a};color:#000;font-size:10px;font-weight:800;padding:4px 10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}}
.sh{{font-size:clamp(26px,4vw,38px);font-weight:900;letter-spacing:-1.5px;margin-bottom:16px}}
.pg{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0;border:1px solid #151518;margin-top:24px}}
.pc{{padding:28px;border-right:1px solid #151518;text-align:center;position:relative}}.pc:last-child{{border-right:none}}.pc.pop{{background:{a}08}}
.pc h3{{color:#555;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}}
.pr{{font-size:32px;font-weight:900;color:{a};margin-bottom:16px}}.pc ul{{list-style:none;text-align:left;margin-bottom:20px}}.pc li{{padding:6px 0;color:#777;font-size:13px;border-bottom:1px solid #0e0e12}}.pc li::before{{content:'— ';color:{a}}}
.pb{{display:block;padding:12px;font-weight:700;font-size:13px;background:#151518;color:#ccc;text-transform:uppercase;letter-spacing:.5px;transition:all .2s}}.pb:hover,.pc.pop .pb{{background:{a};color:#000}}
#cta{{background:#0a0a0e;border-top:1px solid #151518;padding:80px 5%;text-align:center}}
#cta h2{{font-size:30px;font-weight:900;letter-spacing:-1px;margin-bottom:12px}}
.ce{{font-size:18px;font-weight:800;color:{a};margin-top:16px}}.cp{{color:{p};font-weight:600;font-size:16px;margin-top:6px}}.cn{{color:#444;margin-top:4px}}
footer{{padding:16px 5%;display:flex;justify-content:space-between;font-size:11px;color:#333;text-transform:uppercase;letter-spacing:1px}}
@media(max-width:768px){{.hero{{grid-template-columns:1fr}}.hero-r{{display:none}}.row{{grid-template-columns:1fr}}.row-item{{border-right:none;border-bottom:1px solid #151518}}.pg{{grid-template-columns:1fr}}.pc{{border-right:none;border-bottom:1px solid #151518}}footer{{flex-direction:column;text-align:center;align-items:center;gap:4px}}}}
</style></head><body>
<nav><div class="lg">{bn}</div><a href="#cta" class="nb">Contact</a></nav>
<section class="hero"><div class="hero-l"><h1>{tg}</h1><p>{pt}</p><a href="#cta" class="cta">Get Started →</a></div><div class="hero-r"></div></section>
<div class="row">{''.join(f'<div class="row-item"><div class="num">0{i+1}</div><p>{s[:80]}</p></div>' for i,s in enumerate(strats[:3]))}</div>
<section class="sec"><span class="tag">About</span><h2 class="sh">What We Do</h2><p style="color:#777;line-height:1.7">{tgt}</p></section>
<section class="sec" style="text-align:center"><span class="tag">Pricing</span><h2 class="sh">Our Packages</h2><div class="pg">{pricing_cards}</div></section>
<section id="cta"><h2>Start Your Journey</h2><p style="color:#555">We're ready when you are.</p>{contact}</section>
<footer><span>© 2026 {bn}</span><span>HustleAI</span></footer>
</body></html>""",
    ]

    return templates[variant % len(templates)]
