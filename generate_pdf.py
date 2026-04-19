from fpdf import FPDF

class LaunchGuide(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(180, 160, 80)
        self.cell(0, 8, 'HustleAI Launch Guide - hustleai.live', align='R', new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(50, 50, 55)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', '', 8)
        self.set_text_color(100, 100, 105)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}} - Confidential - nexus28', align='C')

    def section_title(self, title):
        self.ln(4)
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(229, 169, 62)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(229, 169, 62)
        self.line(10, self.get_y(), 80, self.get_y())
        self.ln(4)

    def sub_title(self, title):
        self.ln(2)
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(200, 200, 205)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(170, 170, 175)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet(self, text, indent=15):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(229, 169, 62)
        self.cell(indent, 5.5, '')
        self.cell(5, 5.5, '-', new_x="END")
        self.set_text_color(170, 170, 175)
        self.cell(3)
        self.multi_cell(190 - indent - 8, 5.5, text)
        self.ln(1)

    def numbered(self, num, text, indent=15):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(229, 169, 62)
        self.cell(indent, 5.5, '')
        self.cell(8, 5.5, f'{num}.', new_x="END")
        self.set_font('Helvetica', '', 10)
        self.set_text_color(170, 170, 175)
        self.cell(2)
        self.multi_cell(190 - indent - 10, 5.5, text)
        self.ln(1)

    def checkbox(self, text, indent=15):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(170, 170, 175)
        self.cell(indent, 5.5, '')
        self.set_draw_color(100, 100, 105)
        self.rect(self.get_x(), self.get_y() + 0.5, 4, 4)
        self.cell(8)
        self.multi_cell(190 - indent - 8, 5.5, text)
        self.ln(1)

    def code_block(self, text):
        self.set_font('Courier', '', 9)
        self.set_fill_color(30, 30, 35)
        self.set_text_color(200, 200, 205)
        self.multi_cell(0, 5, text, fill=True)
        self.ln(3)

    def divider(self):
        self.ln(4)
        self.set_draw_color(50, 50, 55)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)


pdf = LaunchGuide()
pdf.alias_nb_pages()
pdf.set_auto_page_break(auto=True, margin=20)

# Page background
def add_bg(pdf):
    pdf.set_fill_color(15, 15, 18)
    pdf.rect(0, 0, 210, 297, 'F')

pdf.add_page()
add_bg(pdf)

# Title Page
pdf.ln(40)
pdf.set_font('Helvetica', 'B', 32)
pdf.set_text_color(250, 250, 250)
pdf.cell(0, 14, 'HustleAI', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.set_font('Helvetica', '', 14)
pdf.set_text_color(229, 169, 62)
pdf.cell(0, 8, 'Launch & Beta Testing Guide', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.ln(8)
pdf.set_font('Helvetica', '', 10)
pdf.set_text_color(120, 120, 125)
pdf.cell(0, 6, 'hustleai.live', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, 'A nexus28 product', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.ln(40)
pdf.set_draw_color(50, 50, 55)
pdf.line(60, pdf.get_y(), 150, pdf.get_y())
pdf.ln(10)
pdf.set_font('Helvetica', '', 10)
pdf.set_text_color(100, 100, 105)
pdf.cell(0, 6, 'Prepared for: James Adrian Allums, Founder', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, 'Confidential Document', align='C', new_x="LMARGIN", new_y="NEXT")

# ============ STEP 1 ============
pdf.add_page()
add_bg(pdf)
pdf.section_title('Step 1: Deploy the App')
pdf.body_text('Deploy your HustleAI application from the Emergent platform to make it publicly accessible.')
pdf.numbered(1, 'In the Emergent interface, click "Preview" first to verify everything works correctly')
pdf.numbered(2, 'Once satisfied with the preview, click "Deploy" then "Deploy Now"')
pdf.numbered(3, 'Wait 10-15 minutes for deployment to complete')
pdf.numbered(4, 'You will receive a live URL (e.g., abc123.emergent.app)')
pdf.numbered(5, 'Test that URL in your browser to confirm the app loads')
pdf.ln(4)
pdf.body_text('Note: Deployment costs 50 credits/month on Emergent for production-ready managed infrastructure.')

# ============ STEP 2 ============
pdf.section_title('Step 2: Link hustleai.live Domain')
pdf.body_text('Connect your custom domain to the deployed application.')
pdf.numbered(1, 'After deployment completes, click "Link domain" in the Emergent interface')
pdf.numbered(2, 'Enter: hustleai.live')
pdf.numbered(3, 'Follow the Entri setup flow - it will auto-configure your DNS records')
pdf.numbered(4, 'If you purchased from Namecheap, GoDaddy, or Google Domains, Entri handles it automatically')
pdf.numbered(5, 'If manual DNS is needed: remove any existing A records and add the ones Emergent provides')
pdf.numbered(6, 'DNS propagation takes 5-30 minutes (can take up to 24 hours in rare cases)')
pdf.numbered(7, 'Test hustleai.live in your browser - you should see the Coming Soon page')

# ============ STEP 3 ============
pdf.add_page()
add_bg(pdf)
pdf.section_title('Step 3: Post-Deployment Checklist')
pdf.body_text('Verify all critical features are working on the live deployment before inviting beta testers.')
pdf.checkbox('Visit hustleai.live - Coming Soon page loads correctly')
pdf.checkbox('Visit hustleai.live/beta-invite - Code gate appears')
pdf.checkbox('Enter HUSTLEVIP2025 - Welcome letter with signature shows')
pdf.checkbox('Register a new test account - NDA screen appears')
pdf.checkbox('Accept NDA - Dashboard loads successfully')
pdf.checkbox('Complete questionnaire - Hustles are generated')
pdf.checkbox('Open a hustle - AI Team button visible, agents respond')
pdf.checkbox('Generate a launch kit - Landing page preview works')
pdf.checkbox('Try industry search - Custom hustles generated')
pdf.checkbox('Submit feedback via Profile - Feedback section works')

# ============ STEP 4 ============
pdf.section_title('Step 4: Beta Tester Communications')
pdf.body_text('Send each beta tester the following information. You can copy and customize this template.')
pdf.divider()

pdf.sub_title('Message Template for Beta Testers')
pdf.set_font('Helvetica', 'B', 10)
pdf.set_text_color(200, 200, 205)
pdf.cell(0, 6, 'Subject: You\'re Invited - HustleAI Beta Access', new_x="LMARGIN", new_y="NEXT")
pdf.ln(3)
pdf.body_text('Hey [Name],')
pdf.body_text('You\'ve been selected to beta test HustleAI - an AI-powered platform that helps you discover, launch, and scale side hustles.')

pdf.sub_title('Getting Started Instructions (Include in Message)')
pdf.numbered(1, 'Go to: hustleai.live/beta-invite')
pdf.numbered(2, 'Enter invite code: HUSTLEVIP2025')
pdf.numbered(3, 'Read the welcome letter and create your account')
pdf.numbered(4, 'Accept the Non-Disclosure Agreement')
pdf.numbered(5, 'Go to Profile > scroll down > enter promo code HUSTLEVIP2025 to unlock full Empire access')

pdf.add_page()
add_bg(pdf)
pdf.sub_title('What Testers Should Try (Include in Message)')
pdf.bullet('Take the questionnaire to get personalized hustle recommendations')
pdf.bullet('Try the industry search (e.g., "real estate flipping", "e-commerce")')
pdf.bullet('Generate business plans and launch kits for different hustles')
pdf.bullet('Chat with all 4 AI agents: Mentor, Marketing, Content, Finance')
pdf.bullet('Preview and customize landing pages (edit contact info, download HTML)')
pdf.bullet('Test on both mobile and desktop browsers')

pdf.sub_title('Feedback Instructions (Include in Message)')
pdf.body_text('Ask testers to submit feedback through the app:')
pdf.numbered(1, 'Open the app and go to the Profile tab')
pdf.numbered(2, 'Tap "Beta Feedback" button')
pdf.numbered(3, 'Select a category (General, Bug Report, Feature Request, Design/UX, AI Agents)')
pdf.numbered(4, 'Rate their experience (1-5 stars)')
pdf.numbered(5, 'Write detailed feedback and tap Submit')
pdf.ln(2)
pdf.body_text('Close the message with:\n"Your insights are shaping the future of HustleAI. Thank you!\n- James Adrian Allums, Founder, nexus28"')

# ============ STEP 5 ============
pdf.add_page()
add_bg(pdf)
pdf.section_title('Step 5: Monitoring Beta Feedback')
pdf.body_text('There are multiple ways to monitor feedback from your beta testers during the testing period.')

pdf.sub_title('Option A: In-App (Quickest)')
pdf.body_text('Log into the app with your own account. Go to Profile > Beta Feedback. You\'ll see your own feedback history. However, to see ALL testers\' feedback, use Option B or C.')

pdf.sub_title('Option B: MongoDB Dashboard')
pdf.body_text('Access your MongoDB database directly to view all feedback submissions from all users.')
pdf.numbered(1, 'Go to your Emergent project dashboard')
pdf.numbered(2, 'Find the MongoDB connection details in backend/.env (MONGO_URL)')
pdf.numbered(3, 'Connect using MongoDB Compass (free desktop app) or mongosh CLI')
pdf.numbered(4, 'Navigate to the "beta_feedback" collection')
pdf.numbered(5, 'Each document contains: user email, name, category, rating (1-5), message, and timestamp')

pdf.sub_title('Option C: Add Admin API Endpoint')
pdf.body_text('For a more streamlined approach, you can request an admin feedback dashboard to be added to the app. This would show all beta tester feedback in one view, filterable by category, rating, and date.')

pdf.sub_title('Key Feedback Fields to Monitor')
pdf.bullet('category - What area the feedback relates to (general, bug, feature, design, agents)')
pdf.bullet('rating - 1-5 star rating of overall experience')
pdf.bullet('message - Detailed written feedback')
pdf.bullet('email - Which tester submitted it')
pdf.bullet('created_at - When the feedback was submitted')

pdf.sub_title('MongoDB Query Examples')
pdf.body_text('To find all feedback sorted by newest first:')
pdf.code_block('db.beta_feedback.find({}).sort({created_at: -1})')
pdf.body_text('To find all bug reports:')
pdf.code_block('db.beta_feedback.find({category: "bug"})')
pdf.body_text('To find low-rated feedback (needs attention):')
pdf.code_block('db.beta_feedback.find({rating: {$lte: 2}})')

# ============ KEY INFO ============
pdf.add_page()
add_bg(pdf)
pdf.section_title('Key Information Reference')

pdf.sub_title('URLs')
pdf.bullet('Public homepage: hustleai.live')
pdf.bullet('Beta invite page: hustleai.live/beta-invite')
pdf.bullet('Login: hustleai.live/login')
pdf.bullet('Pricing: hustleai.live/pricing')

pdf.sub_title('Codes')
pdf.bullet('Beta invite code: HUSTLEVIP2025')
pdf.bullet('Promo code for Empire access: HUSTLEVIP2025')
pdf.bullet('(Same code works for both)')

pdf.sub_title('Subscription Tiers')
pdf.bullet('Free - $0 - Hustle discovery + 1 trial plan')
pdf.bullet('Starter - $9.99/mo - 10 plans + 2 kits + AI Mentor')
pdf.bullet('Pro - $29.99/mo - Unlimited plans + 5 kits + Marketing Agent')
pdf.bullet('Empire - $49.99/mo - Unlimited everything + All AI Agents')

pdf.sub_title('A La Carte Pricing')
pdf.bullet('Business Plan: $4.99 each')
pdf.bullet('Launch Kit: $2.99 each')
pdf.bullet('Individual AI Agent: $9.99/mo each')
pdf.bullet('AI Agent Pack (all 3 premium): $19.99/mo (33% discount)')

pdf.sub_title('AI Agents')
pdf.bullet('AI Mentor (Starter+) - Business coaching')
pdf.bullet('Marketing Agent (Pro+) - Social media, ads, growth')
pdf.bullet('Content Writer (Empire) - Blog posts, emails, copy')
pdf.bullet('Finance Advisor (Empire) - Pricing, projections, budgets')

pdf.divider()
pdf.ln(4)
pdf.set_font('Helvetica', '', 10)
pdf.set_text_color(120, 120, 125)
pdf.cell(0, 6, 'hustleai.live - A nexus28 product', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 6, 'Confidential - For internal use only', align='C', new_x="LMARGIN", new_y="NEXT")

# Save
pdf.output('/app/frontend/HustleAI_Launch_Guide.pdf')
print('PDF created successfully!')
