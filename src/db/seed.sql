-- no602 CRM seed data (sample leads in different pipeline stages)

INSERT INTO leads (name, company, email, phone, service_type, status, notes)
VALUES
  (
    'James Mitchell',
    'Apex Logistics',
    'jmitchell@apexlogistics.com',
    '(312) 555-0142',
    'post_arm_guards',
    'new',
    'Inbound inquiry via website. Needs overnight guard coverage for two warehouses in the Chicago metro area. Budget TBD.'
  ),
  (
    'Sarah Chen',
    'Meridian Events Co.',
    'schen@meridianevents.com',
    '(415) 555-0187',
    'events',
    'qualified',
    'Planning a 3-day tech conference in SF for ~5,000 attendees. Needs 30+ guards. Budget approved: $85K. Timeline: 8 weeks out.'
  ),
  (
    'Robert Diaz',
    'Diaz Family Office',
    'rdiaz@diazfamily.com',
    '(212) 555-0234',
    'executive_protection',
    'proposal',
    'Sent proposal for full-time EP detail (principal + family). 6-agent rotation, 24/7 coverage. Awaiting board approval. Follow up in 5 days.'
  ),
  (
    'Henderson Properties',
    'Henderson Properties LLC',
    'ops@hendersonprops.com',
    '(404) 555-0091',
    'private_clients',
    'won',
    'Signed contract for residential security at three Atlanta properties. Guard patrol + camera monitoring. Monthly retainer: $12K. Onboarding in progress.'
  ),
  (
    'Marcus Webb',
    'Webb Holdings',
    'marcus@webbholdings.com',
    '(702) 555-0312',
    'post_arm_guards',
    'lost',
    'Decided to go with in-house security team instead. Lost to internal hire. Follow up in 6 months for possible re-engagement.'
  );

-- Add contacts for leads that have qualified past "new"
INSERT INTO contacts (lead_id, name, email, phone, role, notes)
VALUES
  (
    (SELECT id FROM leads WHERE name = 'Sarah Chen'),
    'Sarah Chen',
    'schen@meridianevents.com',
    '(415) 555-0187',
    'Event Director',
    'Primary decision maker. Responsive to email.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Robert Diaz'),
    'Robert Diaz',
    'rdiaz@diazfamily.com',
    '(212) 555-0234',
    'Principal',
    'Prefers phone calls. Available Tues/Thurs afternoons.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Henderson Properties'),
    'Angela Foster',
    'afoster@hendersonprops.com',
    '(404) 555-0092',
    'Property Manager',
    'Day-to-day contact for all properties.'
  );

-- Add sample activities
INSERT INTO activities (lead_id, type, description)
VALUES
  (
    (SELECT id FROM leads WHERE name = 'James Mitchell'),
    'email',
    'Sent initial response with service overview and pricing sheet.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'James Mitchell'),
    'note',
    'Left voicemail — no callback yet. Try again tomorrow.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Sarah Chen'),
    'call',
    'Discovery call completed. Needs assessment done. Budget and timeline confirmed.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Sarah Chen'),
    'email',
    'Sent tailored proposal with staffing plan and insurance docs.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Robert Diaz'),
    'meeting',
    'In-person meeting at principal residence. Reviewed existing security posture. Identified 4 vulnerabilities.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Robert Diaz'),
    'email',
    'Proposal delivered. Detailed 6-agent rotation plan with bios.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Henderson Properties'),
    'call',
    'Contract signed. Kickoff call scheduled for Monday.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Marcus Webb'),
    'email',
    'Sent final follow-up. Decision made to go with internal team.'
  );

-- ---------------------------------------------------------------------------
-- Receptionist seed data
-- ---------------------------------------------------------------------------

-- Sample calls (mix of answered, missed, voicemail, completed)
INSERT INTO calls (lead_id, caller_number, caller_name, direction, status, duration_seconds, transcript, summary, notes)
VALUES
  (
    (SELECT id FROM leads WHERE name = 'James Mitchell'),
    '(312) 555-0142',
    'James Mitchell',
    'inbound',
    'answered',
    187,
    E'AI: Thank you for calling no602. How can I help?\nJames: Hi, this is James Mitchell from Apex Logistics. I need information about overnight guard coverage for two warehouses in Chicago.\nAI: I can help with that, Mr. Mitchell. Can you tell me more about the properties?\nJames: Sure — one is a 50,000 sq ft distribution center, the other is a smaller 20,000 sq ft storage facility. Both need overnight coverage, 7 days a week.\nAI: Understood. We provide licensed post arm guards for commercial properties. Let me take down your contact info and have a security consultant reach out with a custom quote.\nJames: That would be great. I sent an inquiry through the website but wanted to follow up by phone.\nAI: I see your inquiry, Mr. Mitchell. Someone will be in touch within 2 hours.',
    'James Mitchell from Apex Logistics called about overnight guard coverage for two Chicago warehouses. Needs 7-day coverage. Requested a quote. Consultant to follow up within 2 hours.',
    'Follow-up quote sent. Lead moved to contacted status.'
  ),
  (
    NULL,
    '(602) 555-0891',
    'Unknown Caller',
    'inbound',
    'missed',
    0,
    NULL,
    'Missed call from unknown (602) number. No voicemail left.',
    NULL
  ),
  (
    (SELECT id FROM leads WHERE name = 'Sarah Chen'),
    '(415) 555-0187',
    'Sarah Chen',
    'inbound',
    'voicemail',
    45,
    E'Sarah: Hi, this is Sarah Chen from Meridian Events. I spoke with someone earlier about event security for our conference and I have a few follow-up questions about the staffing plan. Please call me back at your earliest convenience. Thanks!',
    'Sarah Chen left voicemail with follow-up questions about the conference staffing plan.',
    'Callback scheduled for tomorrow morning.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Henderson Properties'),
    '(404) 555-0091',
    'Angela Foster',
    'inbound',
    'completed',
    312,
    E'AI: no602, how can I help?\nAngela: This is Angela Foster from Henderson Properties. The guards started yesterday and everything went smoothly. Just wanted to confirm the patrol schedule for the Buckhead property.\nAI: Great to hear, Ms. Foster. Let me pull up your account. The Buckhead property has patrols from 8 PM to 6 AM, with a supervisor check-in at midnight and 4 AM.\nAngela: Perfect, that matches what I have. Also, can you send me the contact info for the shift supervisor?\nAI: Absolutely. I will have that emailed to you right now. Is there anything else?\nAngela: No, that''s it. Thank you!',
    'Angela Foster confirmed guards started smoothly. Verified Buckhead patrol schedule (8 PM - 6 AM). Requested supervisor contact info — sent via email.',
    'Client satisfied. All properties active.'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Robert Diaz'),
    '(212) 555-0234',
    'Robert Diaz',
    'outbound',
    'answered',
    245,
    E'AI (outbound): Good afternoon Mr. Diaz, this is no602 following up on your executive protection proposal.\nRobert: Yes, thanks for calling. The board is reviewing the proposal now. I should have an answer by Friday.\nAI: Excellent. Is there anything in the proposal that needs clarification?\nRobert: The 6-agent rotation plan looks solid, but they had a question about the travel risk assessment coverage — does that include international?\nAI: Yes, international travel risk assessment and advance planning are included in the proposed package.\nRobert: Good, I will relay that. Let me circle back Friday.',
    'Follow-up call with Robert Diaz. Board reviewing EP proposal. Travel risk includes international coverage. Decision expected Friday.',
    'Set reminder for Friday follow-up.'
  ),
  (
    NULL,
    '(310) 555-0456',
    'Michael Torres',
    'inbound',
    'missed',
    0,
    NULL,
    'New inbound from Michael Torres (310) 555-0456. First-time caller. Appears to be a private client inquiry.',
    'Add to lead pipeline if callback connects.'
  );

-- Sample message threads

-- Thread 1: SMS conversation with James Mitchell
INSERT INTO messages (lead_id, contact_number, direction, channel, body, status, thread_id)
VALUES
  (
    (SELECT id FROM leads WHERE name = 'James Mitchell'),
    '(312) 555-0142',
    'inbound',
    'sms',
    'Hi, I submitted a request on your website about guard coverage for our Chicago warehouses. Just checking to see if someone can call me today.',
    'read',
    'thread_1'
  ),
  (
    (SELECT id FROM leads WHERE name = 'James Mitchell'),
    '(312) 555-0142',
    'outbound',
    'sms',
    'Hi James, thanks for reaching out. We received your inquiry. A security consultant will call you within the next 2 hours to discuss your warehouse coverage needs.',
    'delivered',
    'thread_1'
  ),
  (
    (SELECT id FROM leads WHERE name = 'James Mitchell'),
    '(312) 555-0142',
    'outbound',
    'sms',
    'Quick update: our Chicago area consultant, David, will be calling you at (312) 555-0142 around 3 PM today. Let us know if that time works.',
    'delivered',
    'thread_1'
  ),
  (
    (SELECT id FROM leads WHERE name = 'James Mitchell'),
    '(312) 555-0142',
    'inbound',
    'sms',
    '3 PM works great. Thanks for the quick response!',
    'read',
    'thread_1'
  );

-- Thread 2: Email thread with Sarah Chen
INSERT INTO messages (lead_id, contact_email, direction, channel, subject, body, status, thread_id)
VALUES
  (
    (SELECT id FROM leads WHERE name = 'Sarah Chen'),
    'schen@meridianevents.com',
    'inbound',
    'email',
    'Re: Event Security Proposal — TechConf 2026',
    E'Hi team,\n\nI reviewed the staffing plan you sent over. A few questions:\n\n1. Can we increase the guard count from 30 to 35 for Saturday?\n2. Do you have experience with tech conferences of this scale?\n3. What''s the overtime policy if we run over on setup day?\n\nThanks,\nSarah',
    'read',
    'thread_2'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Sarah Chen'),
    'schen@meridianevents.com',
    'outbound',
    'email',
    'Re: Event Security Proposal — TechConf 2026',
    E'Hi Sarah,\n\nGreat questions. To address them:\n\n1. Yes, we can scale to 35 guards for Saturday. I''ve updated the staffing plan and attached the revised version.\n2. Absolutely — we''ve secured tech conferences at Moscone Center, Javits Center, and McCormick Place. I''ve included a case study from a similar 5,000-attendee event.\n3. Overtime is billed at 1.5x the standard rate after 8 hours on assignment days. Setup day can be structured as a separate flat-rate day to avoid overtime charges.\n\nLet me know if you''d like to hop on a call to walk through the updated plan.\n\nBest,\nno602 Security Team',
    'delivered',
    'thread_2'
  ),
  (
    (SELECT id FROM leads WHERE name = 'Sarah Chen'),
    'schen@meridianevents.com',
    'inbound',
    'email',
    'Re: Event Security Proposal — TechConf 2026',
    E'This looks great. Let''s lock in the 35-guard plan. Please send over the contract and I''ll get it signed this week.\n\n— Sarah',
    'read',
    'thread_2'
  );

-- Thread 3: SMS conversation with an unlinked lead
INSERT INTO messages (contact_number, direction, channel, body, status, thread_id)
VALUES
  (
    '(702) 555-0998',
    'inbound',
    'sms',
    'Hey, I need security for a private party next month in Summerlin. About 150 guests at a residence. Can you handle that?',
    'read',
    'thread_3'
  ),
  (
    '(702) 555-0998',
    'outbound',
    'sms',
    'Hi there! Yes, we specialize in private event security. For a 150-guest residence party, we typically recommend 4-6 guards depending on the property layout and duration. Would you like me to have a consultant call you to discuss details?',
    'delivered',
    'thread_3'
  ),
  (
    '(702) 555-0998',
    'inbound',
    'sms',
    'Sounds good. Name is Derek. Call me at this number tomorrow between 10 and noon.',
    'read',
    'thread_3'
  );

-- ---------------------------------------------------------------------------
-- Marketing seed data
-- ---------------------------------------------------------------------------

-- Sample campaign
INSERT INTO campaigns (name, subject_line, body_template, status, target_count, sent_count, opened_count, replied_count)
VALUES (
  'Q4 Private Client Outreach',
  'Security Services for {{company}} — Let''s Talk',
  E'Hi {{name}},\n\nI hope this email finds you well. I''m reaching out from no602, a licensed protection services firm serving private clients, commercial properties, and executive teams.\n\nWe noticed {{company}} may benefit from a security posture assessment. Our team specializes in residential security, event protection, and executive protection — all built on military-grade discipline and precision.\n\nWould you be open to a 15-minute call this week to discuss your current security arrangements?\n\nBest,\nThe no602 Team',
  'active',
  50,
  35,
  14,
  3
);

-- Sample recipients for the campaign
INSERT INTO campaign_recipients (campaign_id, email, name, company, status, sent_at)
VALUES
  (1, 'jpeterson@hudsoncapital.com', 'James Peterson', 'Hudson Capital', 'sent', NOW() - INTERVAL '2 days'),
  (1, 'emily@sterlingestates.com', 'Emily Rhodes', 'Sterling Estates', 'sent', NOW() - INTERVAL '2 days'),
  (1, 'david@benchmarkproperties.com', 'David Park', 'Benchmark Properties', 'opened', NOW() - INTERVAL '2 days'),
  (1, 'sarah@meridianevents.com', 'Sarah Chen', 'Meridian Events Co.', 'replied', NOW() - INTERVAL '1 day'),
  (1, 'mrodriguez@westsideholdings.com', 'Maria Rodriguez', 'Westside Holdings', 'pending', NULL);

-- Sample scraped leads
INSERT INTO scraped_leads (name, company, email, phone, source_url, source_type, industry, notes, imported_to_crm)
VALUES
  (
    'Tom Bradshaw',
    'Bradshaw Security Consulting',
    'tom@bradshawsecurity.com',
    '(602) 555-0341',
    'https://www.google.com/maps/search/security+companies+phoenix',
    'google_maps',
    'Security Consulting',
    'High-end residential security consultant. Could be a referral partner or client. Listed 4.8 stars.',
    false
  ),
  (
    'Grant Industries',
    'Grant Industries HQ',
    'security@grantindustries.com',
    '(480) 555-0782',
    'https://www.linkedin.com/company/grant-industries',
    'linkedin',
    'Manufacturing',
    'Manufacturing firm with multiple AZ locations. Recently posted about expanding facilities — likely needs guard services.',
    false
  ),
  (
    'Valencia Events',
    'Valencia Events LLC',
    'info@valenciaevents.com',
    '(520) 555-0456',
    'https://www.valenciaevents.com/contact',
    'website',
    'Event Planning',
    'Upscale event planning company in Scottsdale. Organizes corporate galas, weddings, and private parties. Needs security vendors.',
    false
  );
