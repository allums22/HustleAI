"""Resend email integration for HustleAI.

Single dispatcher + HTML templates for welcome series + payment receipts.
Falls back to a no-op if RESEND_API_KEY is not configured (so dev still works).
"""
import os
import logging
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger("hustleai.email")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM_ADDRESS = os.environ.get("EMAIL_FROM_ADDRESS", "noreply@hustleai.live")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "HustleAI")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO", "support@hustleai.live")
APP_URL = os.environ.get("APP_PUBLIC_URL", "https://hustleai.live")

EMAIL_ENABLED = bool(RESEND_API_KEY)


# ─── Core wrapped HTML layout ───
def _layout(headline: str, body_html: str, cta_label: Optional[str] = None,
            cta_url: Optional[str] = None, footer_note: str = "") -> str:
    cta_html = ""
    if cta_label and cta_url:
        cta_html = f"""
        <div style="text-align:center;margin:32px 0;">
          <a href="{cta_url}" style="background:#E5A93E;color:#000;text-decoration:none;font-weight:800;
             font-size:15px;padding:14px 28px;border-radius:10px;display:inline-block;letter-spacing:0.3px;">
            {cta_label}
          </a>
        </div>
        """
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{headline}</title></head>
<body style="margin:0;padding:0;background:#0B0B0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#E5E5EA;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:24px;font-weight:900;color:#E5A93E;letter-spacing:-0.5px;">HustleAI</span>
      <span style="display:block;font-size:11px;color:#71717a;letter-spacing:1.2px;margin-top:4px;">SIDE HUSTLES THAT ACTUALLY MAKE MONEY</span>
    </div>
    <div style="background:#1F1F23;border-radius:16px;padding:28px 24px;border:1px solid #2a2a30;">
      <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:#fff;line-height:1.3;letter-spacing:-0.4px;">{headline}</h1>
      <div style="font-size:15px;line-height:1.6;color:#d4d4d8;">{body_html}</div>
      {cta_html}
    </div>
    <div style="margin-top:24px;text-align:center;font-size:12px;color:#71717a;line-height:1.6;">
      {footer_note}
      <div style="margin-top:14px;">
        <a href="{APP_URL}" style="color:#71717a;text-decoration:none;">hustleai.live</a>
        &nbsp;·&nbsp;
        <a href="mailto:{EMAIL_REPLY_TO}" style="color:#71717a;text-decoration:none;">{EMAIL_REPLY_TO}</a>
      </div>
      <div style="margin-top:8px;font-size:10px;color:#52525b;">A nexus28 product</div>
    </div>
  </div>
</body></html>"""


# ─── Templates ───
def render_day1(first_name: str) -> Dict[str, str]:
    body = f"""
    <p>Hey {first_name},</p>
    <p>Welcome to HustleAI. Real talk — most "side hustle" apps just give you a list and ghost you. This one doesn't.</p>
    <p><strong>Today's job (5 minutes):</strong></p>
    <ul style="padding-left:20px;line-height:1.8;">
      <li>Finish the questionnaire if you haven't</li>
      <li>Pick your #1 hustle match</li>
      <li>Open the Day 1 task in your dashboard</li>
    </ul>
    <p>By Day 7, most users earn their first dollar. Your move.</p>
    """
    return {
        "subject": "Your Day 1 action plan is ready 🚀",
        "html": _layout("Let's get you to your first dollar.", body,
                        "Open Dashboard", f"{APP_URL}/dashboard",
                        "Day 1 of your 30-day launch sprint."),
    }


def render_day3(first_name: str) -> Dict[str, str]:
    body = f"""
    <p>{first_name},</p>
    <p>Three days in. Here's the truth nobody tells you about side hustles:</p>
    <p><strong>The first $100 is harder than the next $10,000.</strong></p>
    <p>It's a psychological barrier. Once you log even $5 of real income in HustleAI, your brain flips a switch.</p>
    <p>Open the app, hit "Log Earning," and break the seal. Even if it's tiny.</p>
    """
    return {
        "subject": "Day 3 check-in: the first $100 is the hardest 💰",
        "html": _layout("Break the seal on your first dollar.", body,
                        "Log Your First Win", f"{APP_URL}/(tabs)/progress",
                        "Day 3 · 27 days left in your launch sprint."),
    }


def render_day7(first_name: str) -> Dict[str, str]:
    body = f"""
    <p>{first_name},</p>
    <p>Week 1 is in the books. Take 60 seconds to look at:</p>
    <ul style="padding-left:20px;line-height:1.8;">
      <li>Your <strong>streak</strong> (every consecutive day adds compound momentum)</li>
      <li>Your <strong>earnings tracker</strong> (every dollar matters)</li>
      <li>Your <strong>Week 2 tasks</strong> (already loaded in your dashboard)</li>
    </ul>
    <p>The hustlers who hit $1k a month all share one trait: they showed up in Week 2.</p>
    """
    return {
        "subject": "Week 1 reflection — what's working? 📊",
        "html": _layout("You made it through Week 1.", body,
                        "Open Week 2 Tasks", f"{APP_URL}/dashboard",
                        "Day 7 · 23 days left in your launch sprint."),
    }


def render_day14(first_name: str) -> Dict[str, str]:
    body = f"""
    <p>{first_name},</p>
    <p>Halfway. Two weeks in.</p>
    <p>This is where 80% of people quit. That's also exactly why 80% of people don't make it.</p>
    <p>The hustlers earning $3k+/mo from HustleAI didn't have more skill. They had more <em>follow-through</em>.</p>
    <p>Open the app. Log a win. Even a small one. Keep the streak alive.</p>
    """
    return {
        "subject": "Halfway through your 30-day plan 🔥",
        "html": _layout("This is where most people quit.", body,
                        "Keep Going", f"{APP_URL}/dashboard",
                        "Day 14 · 16 days left in your launch sprint."),
    }


def render_lifetime_receipt(first_name: str, amount: float) -> Dict[str, str]:
    body = f"""
    <p>{first_name},</p>
    <p>You're officially a <strong>HustleAI Founder</strong>. Welcome.</p>
    <p>Your <strong>Lifetime Empire access</strong> is now active. That means:</p>
    <ul style="padding-left:20px;line-height:1.8;">
      <li>✅ Unlimited business plans · forever</li>
      <li>✅ Unlimited launch kits + landing pages</li>
      <li>✅ All 4 AI Agents (Mentor, Marketing, Content, Finance)</li>
      <li>✅ White-label landing pages</li>
      <li>✅ Every future feature, free, forever</li>
      <li>🏆 Founder badge on the leaderboard</li>
    </ul>
    <p><strong>Receipt:</strong> $149.00 USD · one-time · paid in full</p>
    <p>If you have any issues, just reply to this email. I read every one.</p>
    <p>— Adrian, founder</p>
    """
    return {
        "subject": "🏆 Welcome, Founder — your Lifetime access is live",
        "html": _layout("You're in. For life.", body,
                        "Open Your Empire Dashboard", f"{APP_URL}/dashboard",
                        f"Receipt: ${amount:.2f} USD · one-time · charged via Stripe."),
    }


def render_instant_kit_receipt(first_name: str, amount: float, hustle_name: str = "") -> Dict[str, str]:
    h = f" for <strong>{hustle_name}</strong>" if hustle_name else ""
    body = f"""
    <p>{first_name},</p>
    <p>Your <strong>Instant Hustle Kit</strong>{h} is ready to generate.</p>
    <p>Head to your dashboard, pick the hustle, and hit "Generate Launch Kit." You'll get:</p>
    <ul style="padding-left:20px;line-height:1.8;">
      <li>📄 AI-generated business plan</li>
      <li>📅 30-day execution calendar</li>
      <li>🌐 Branded landing page with your contact info</li>
      <li>📣 Marketing strategy + first 5 customers playbook</li>
    </ul>
    <p><strong>Receipt:</strong> ${amount:.2f} USD · one-time</p>
    <p>Yours to keep — no subscription. Reply to this email if anything's off.</p>
    <p>— Adrian</p>
    """
    return {
        "subject": "🚀 Your Instant Hustle Kit is ready",
        "html": _layout("Your kit is unlocked. Let's launch.", body,
                        "Generate My Kit", f"{APP_URL}/dashboard",
                        f"Receipt: ${amount:.2f} USD · one-time · charged via Stripe."),
    }


def render_subscription_receipt(first_name: str, plan_name: str, amount: float, billing: str) -> Dict[str, str]:
    period = "year" if billing == "annual" else "month"
    body = f"""
    <p>{first_name},</p>
    <p>You're on <strong>HustleAI {plan_name}</strong>. Welcome to the next level.</p>
    <p><strong>Receipt:</strong> ${amount:.2f} USD · per {period} · billed via Stripe</p>
    <p>Your dashboard is updated and your full feature set is unlocked. Go make something.</p>
    <p>— Adrian</p>
    """
    return {
        "subject": f"Welcome to HustleAI {plan_name} ✅",
        "html": _layout(f"You're on {plan_name}.", body,
                        "Open Dashboard", f"{APP_URL}/dashboard",
                        f"Receipt: ${amount:.2f} USD per {period} · cancel anytime."),
    }


# ─── Send via Resend REST API ───
async def send_email(to_email: str, subject: str, html: str,
                     to_name: Optional[str] = None,
                     reply_to: Optional[str] = None) -> Dict[str, Any]:
    """Dispatch an email via Resend. Returns {ok, id|error}."""
    if not EMAIL_ENABLED:
        logger.warning(f"[email DISABLED] would-send to={to_email} subj={subject!r}")
        return {"ok": False, "error": "RESEND_API_KEY not configured", "disabled": True}
    if not to_email:
        return {"ok": False, "error": "no recipient"}

    to_field = f"{to_name} <{to_email}>" if to_name else to_email
    payload = {
        "from": f"{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDRESS}>",
        "to": [to_field],
        "subject": subject,
        "html": html,
        "reply_to": reply_to or EMAIL_REPLY_TO,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code in (200, 201, 202):
                data = r.json()
                logger.info(f"[email] sent id={data.get('id')} to={to_email} subj={subject!r}")
                return {"ok": True, "id": data.get("id")}
            logger.error(f"[email] Resend {r.status_code}: {r.text[:300]} to={to_email}")
            return {"ok": False, "error": f"{r.status_code}: {r.text[:300]}"}
    except Exception as e:
        logger.error(f"[email] exception sending to {to_email}: {e}")
        return {"ok": False, "error": str(e)}
