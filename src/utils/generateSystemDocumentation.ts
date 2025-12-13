import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateSystemDocumentationPDF = () => {
  try {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  const addNewPageIfNeeded = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  const addTitle = (text: string, size: number = 24) => {
    addNewPageIfNeeded(20);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(text, margin, yPos);
    yPos += size * 0.5 + 5;
  };

  const addSubtitle = (text: string, size: number = 14) => {
    addNewPageIfNeeded(15);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(text, margin, yPos);
    yPos += size * 0.4 + 4;
  };

  const addParagraph = (text: string, size: number = 10) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    lines.forEach((line: string) => {
      addNewPageIfNeeded(8);
      doc.text(line, margin, yPos);
      yPos += 5;
    });
    yPos += 3;
  };

  const addBulletPoint = (text: string, indent: number = 0) => {
    addNewPageIfNeeded(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const bulletX = margin + indent;
    doc.text('•', bulletX, yPos);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - indent - 5);
    lines.forEach((line: string, i: number) => {
      if (i > 0) addNewPageIfNeeded(6);
      doc.text(line, bulletX + 5, yPos);
      if (i < lines.length - 1) yPos += 5;
    });
    yPos += 6;
  };

  const addTable = (headers: string[], data: string[][]) => {
    addNewPageIfNeeded(40);
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: data,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  };

  const addDivider = () => {
    addNewPageIfNeeded(10);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  };

  const addFlowDescription = (title: string, steps: string[]) => {
    addSubtitle(title);
    steps.forEach((step, index) => {
      addBulletPoint(`${index + 1}. ${step}`);
    });
    yPos += 5;
  };

  // === COVER PAGE ===
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('AIDA Study Platform', pageWidth / 2, 80, { align: 'center' });
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('System Documentation', pageWidth / 2, 95, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184);
  doc.text('Complete Workflow & Architecture Reference', pageWidth / 2, 110, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, pageWidth / 2, 250, { align: 'center' });
  
  doc.text('AI-Powered Learning Research Platform', pageWidth / 2, 260, { align: 'center' });

  // === TABLE OF CONTENTS ===
  doc.addPage();
  yPos = margin;
  addTitle('Table of Contents', 20);
  yPos += 5;
  
  const tocItems = [
    '1. System Overview',
    '2. User Roles & Permissions',
    '3. Participant Journey (Complete Workflow)',
    '4. Study Flow Guard System',
    '5. Admin Panel Workflow',
    '6. Session State Machine',
    '7. Learning Modes',
    '8. Security Architecture',
    '9. Data Flow Architecture',
    '10. Database Schema',
    '11. Edge Functions Reference',
    '12. Application Routes',
    '13. Secrets Management',
    '14. Statistical Analysis',
  ];
  
  tocItems.forEach((item) => {
    addBulletPoint(item);
  });

  // === 1. SYSTEM OVERVIEW ===
  doc.addPage();
  yPos = margin;
  addTitle('1. System Overview');
  addParagraph('The AIDA Study Platform is a research application designed to compare learning effectiveness between text-based and avatar-based AI tutoring. The platform collects participant data through a structured study flow while ensuring data integrity and security.');
  
  yPos += 5;
  addSubtitle('Architecture Components');
  addBulletPoint('Frontend: React + TypeScript + Tailwind CSS + Vite');
  addBulletPoint('Backend: Lovable Cloud (Supabase) with Edge Functions');
  addBulletPoint('AI Services: OpenAI GPT-5-mini (Text Mode), Anam AI (Avatar Mode)');
  addBulletPoint('Database: PostgreSQL with Row Level Security');
  addBulletPoint('Authentication: Supabase Auth with role-based access');
  
  addDivider();
  
  addSubtitle('System Flow Overview');
  addFlowDescription('Frontend Layer', [
    'Welcome Page → Consent Form → Demographics',
    'Pre-Test Assessment → Mode Assignment',
    'Learning Module (Text/Avatar) → Post-Test',
    'Open Feedback → Completion'
  ]);
  
  addFlowDescription('Backend Layer', [
    'Edge Functions handle all data operations',
    'PostgreSQL stores all research data',
    'RLS policies protect data access',
    'Audit logging tracks admin actions'
  ]);

  // === 2. USER ROLES ===
  doc.addPage();
  yPos = margin;
  addTitle('2. User Roles & Permissions');
  
  addParagraph('The platform implements a hierarchical role-based access control system with four distinct user types.');
  yPos += 5;
  
  addSubtitle('Role Hierarchy');
  addBulletPoint('OWNER (jakub.majewski@tum.de): Full system access including code modifications');
  addBulletPoint('ADMIN: Content management with security limitations');
  addBulletPoint('EVALUATOR/MENTOR: View-only access for external evaluation');
  addBulletPoint('PARTICIPANT: Study participants with guided flow');
  
  yPos += 5;
  addSubtitle('Permissions Matrix');
  
  addTable(
    ['Feature', 'Owner', 'Admin', 'Evaluator'],
    [
      ['View Statistics', '✓', '✓', '✓'],
      ['View Sessions', '✓', '✓', '✓'],
      ['Edit Questions', '✓', '✓', '✗'],
      ['Edit Slides', '✓', '✓', '✗'],
      ['Delete Content', '✓', '✗', '✗'],
      ['Export Data (CSV/JSON)', '✓', '✓', '✗'],
      ['API Control', '✓', 'Limited', '✗'],
      ['Validate Sessions', '✓ (Final)', '✓ (Pending)', '✗'],
      ['View Audit Log', '✓', '✗', '✗'],
      ['Manage Users', '✓', '✗', '✗'],
    ]
  );

  // === 3. PARTICIPANT JOURNEY ===
  doc.addPage();
  yPos = margin;
  addTitle('3. Participant Journey');
  
  addParagraph('Complete workflow showing all paths, feedback loops, and exit points for study participants.');
  yPos += 5;
  
  addSubtitle('Phase 1: Intake');
  addFlowDescription('Entry Flow', [
    'WELCOME: Landing page with study introduction',
    '→ Click "Start Study" clears previous session data',
    '→ CONSENT: Read and accept research consent form',
    '→ Must check agreement checkbox to proceed',
    '→ DEMOGRAPHICS: Complete demographic questionnaire',
    '→ All questions required before advancing'
  ]);
  
  addSubtitle('Phase 2: Assessment');
  addFlowDescription('Pre-Test Flow', [
    'PRE-TEST: Knowledge assessment (baseline)',
    '→ Measures initial understanding of AI image generation',
    '→ All questions must be answered',
    '→ Responses saved to database immediately'
  ]);
  
  addSubtitle('Phase 3: Mode Selection');
  addFlowDescription('Assignment Flow', [
    'MODE ASSIGNMENT: Choose learning modality',
    '→ TEXT MODE: Chat-based AI tutor interaction',
    '→ AVATAR MODE: Visual AI avatar with voice interaction',
    '→ Once selected, mode is LOCKED for session',
    '→ "Change Mode" button restarts learning only'
  ]);
  
  addNewPageIfNeeded(80);
  addSubtitle('Phase 4: Learning');
  addFlowDescription('Learning Flow', [
    'LEARNING: 7 sequential educational slides',
    '→ Slide 1: Introduction to AI Image Generation',
    '→ Slide 2: Anatomy of a Prompt',
    '→ Slide 3: Style Keywords & Artistic Directions',
    '→ Slide 4: CFG Scale & Parameters',
    '→ Slide 5: Image-to-Image Workflows',
    '→ Slide 6: Negative Prompts',
    '→ Slide 7: Ethics & Responsible AI Art',
    '→ Image Playground available (appears after 3 seconds)',
    '→ Can navigate forward/backward through slides',
    '→ "Finish Learning" advances to post-test'
  ]);
  
  addSubtitle('Phase 5: Evaluation');
  addFlowDescription('Post-Test Flow', [
    'POST-TEST PAGE 1: Likert scale assessments',
    '→ Trust, engagement, satisfaction ratings',
    '→ Avatar quality and realism preferences',
    'POST-TEST PAGE 2: Knowledge check questions',
    '→ Tests understanding of learned concepts',
    'POST-TEST PAGE 3: Open feedback (optional)',
    '→ "What did you like most?"',
    '→ "What was confusing or frustrating?"',
    '→ "What ONE change would help?"',
    '→ 200 character limit per response',
    '→ Skip checkbox available for each question'
  ]);
  
  addSubtitle('Phase 6: Completion');
  addFlowDescription('Completion Flow', [
    'COMPLETION: Study finished successfully',
    '→ Session marked as "completed" in database',
    '→ Completion timestamp recorded',
    '→ Data included in research statistics'
  ]);
  
  addDivider();
  addSubtitle('Exit Paths & Feedback Loops');
  
  addTable(
    ['Action', 'From', 'Result', 'Data Status'],
    [
      ['Exit Study (button)', 'Any page', 'Redirect to Welcome', 'Session marked "withdrawn"'],
      ['Session Timeout', 'Any page', 'Warning modal → Expire', 'Session marked "expired"'],
      ['Change Mode', 'Learning', 'Return to Mode Selection', 'Learning progress reset'],
      ['Browser Close', 'Any page', 'Session interrupted', 'Marked "in_progress"'],
      ['URL Direct Access', 'Any page', 'Redirect to correct step', 'Flow guard enforced'],
    ]
  );

  // === 4. STUDY FLOW GUARD ===
  doc.addPage();
  yPos = margin;
  addTitle('4. Study Flow Guard System');
  
  addParagraph('The Study Flow Guard (useStudyFlowGuard.ts) enforces sequential progression through the study, preventing users from skipping steps via direct URL access.');
  yPos += 5;
  
  addSubtitle('Guard Mechanism');
  addFlowDescription('Validation Process', [
    'On each page load, guard checks sessionStorage for required keys',
    'Each step has specific requirements defined in STEP_REQUIREMENTS',
    'If requirements not met, user is redirected to appropriate step',
    'Toast notification explains why redirect occurred'
  ]);
  
  yPos += 5;
  addSubtitle('Step Requirements');
  
  addTable(
    ['Step', 'Required Keys', 'Redirect If Missing'],
    [
      ['Demographics', 'sessionId', '/consent'],
      ['Pre-Test', 'sessionId, demographics', '/demographics'],
      ['Mode Assignment', 'sessionId, preTest', '/pre-test'],
      ['Learning', 'sessionId, studyMode', '/mode-assignment'],
      ['Post-Test Page 1', 'sessionId, learningComplete', '/learning/:mode'],
      ['Post-Test Page 2', 'sessionId, postTestPage1', '/post-test-1'],
      ['Post-Test Page 3', 'sessionId, postTestPage2', '/post-test-2'],
      ['Completion', 'sessionId, postTestPage3', '/post-test-3'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Security Features');
  addBulletPoint('Polling mechanism handles race conditions during session creation');
  addBulletPoint('Session validation checks for valid UUID format');
  addBulletPoint('Invalid sessions are cleared automatically');
  addBulletPoint('Progress percentage calculated for UI display');

  // === 5. ADMIN PANEL WORKFLOW ===
  doc.addPage();
  yPos = margin;
  addTitle('5. Admin Panel Workflow');
  
  addParagraph('The admin panel at /admin provides research team members with tools to manage content, view statistics, and validate data quality.');
  yPos += 5;
  
  addSubtitle('Authentication Flow');
  addFlowDescription('Login Process', [
    'Navigate to /admin/login',
    'Enter email (must be in admin_users table)',
    'Enter password (verified by create-admin-users edge function)',
    'Role determined by email (owner vs admin vs evaluator)',
    'Session stored in Supabase Auth',
    'Redirect to /admin dashboard'
  ]);
  
  addSubtitle('Dashboard Sections');
  addTable(
    ['Section', 'Purpose', 'Owner', 'Admin', 'Evaluator'],
    [
      ['Overview', 'Summary statistics & charts', '✓', '✓', '✓'],
      ['Sessions', 'View & validate participant sessions', '✓', '✓', '✓'],
      ['Responses', 'Detailed response data & exports', '✓', '✓', 'View only'],
      ['Questions', 'Edit pre/post-test questions', '✓', '✓', '✗'],
      ['Slides', 'Edit learning slide content', '✓', '✓', '✗'],
      ['API Control', 'Toggle APIs & manage keys', '✓', 'Limited', '✗'],
      ['Audit Log', 'View all admin actions', '✓', '✗', '✗'],
    ]
  );
  
  addNewPageIfNeeded(60);
  addSubtitle('Suspicious Session Validation');
  addFlowDescription('Two-Tier Validation Process', [
    'Bot detection flags suspicious behavior during study',
    'Suspicious flags: fast answers (<2s), fast pages (<5s), fast completion (<3min)',
    'Sessions with flags appear in "Data Quality Alerts"',
    'ADMIN validates → Status becomes "pending_accepted" or "pending_ignored"',
    'OWNER approves → Final status "accepted" or "ignored"',
    'Accepted sessions included in statistics',
    'Ignored sessions excluded from analysis'
  ]);

  // === 6. SESSION STATE MACHINE ===
  doc.addPage();
  yPos = margin;
  addTitle('6. Session State Machine');
  
  addParagraph('Sessions transition through various states based on participant actions and admin validation.');
  yPos += 5;
  
  addSubtitle('Session States');
  addTable(
    ['State', 'Description', 'Included in Stats'],
    [
      ['active', 'Session in progress', 'No'],
      ['completed', 'Study finished successfully', 'Yes'],
      ['withdrawn', 'Participant clicked Exit Study', 'No'],
      ['expired', 'Session timed out (30min inactivity)', 'No'],
      ['reset', 'Unauthorized mode switch attempted', 'No'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Validation States');
  addTable(
    ['State', 'Description', 'Who Sets', 'Included in Stats'],
    [
      ['unvalidated', 'Default state, not yet reviewed', 'System', 'Yes (if completed)'],
      ['pending_accepted', 'Admin approved, awaiting owner', 'Admin', 'No (pending)'],
      ['pending_ignored', 'Admin rejected, awaiting owner', 'Admin', 'No (pending)'],
      ['accepted', 'Owner confirmed acceptance', 'Owner', 'Yes'],
      ['ignored', 'Owner confirmed rejection', 'Owner', 'No'],
    ]
  );
  
  addDivider();
  addSubtitle('State Transitions');
  addFlowDescription('Normal Flow', [
    '[Start] → active (session created)',
    'active → completed (participant finishes study)',
    'completed → accepted/ignored (validation process)'
  ]);
  
  addFlowDescription('Exit Flows', [
    'active → withdrawn (Exit Study button clicked)',
    'active → expired (30 min timeout)',
    'active → reset (unauthorized mode switch)'
  ]);

  // === 7. LEARNING MODES ===
  doc.addPage();
  yPos = margin;
  addTitle('7. Learning Modes');
  
  addSubtitle('Text Mode');
  addParagraph('Chat-based interaction with an AI tutor using OpenAI GPT-5-mini.');
  addFlowDescription('Text Mode Flow', [
    'User views slide content in central panel (60-70% width)',
    'Right panel (30-40% width) contains chat interface',
    'User types questions about current slide',
    'AI responds with slide-aware context',
    'Chat history preserved during session',
    'Image Playground accessible via button'
  ]);
  
  yPos += 5;
  addSubtitle('Avatar Mode');
  addParagraph('Visual AI avatar with voice interaction using Anam AI SDK.');
  addFlowDescription('Avatar Mode Flow', [
    'User views slide content in central panel',
    'Right panel displays live avatar video stream',
    'Push-to-talk microphone (default: OFF/muted)',
    'RED button = avatar cannot hear (hard mute)',
    'BLUE button = avatar listening and responding',
    'Real-time transcript shows conversation',
    'Avatar receives silent context updates on slide changes',
    'Camera toggle available (default: ON)',
    'Session rebuilds on each slide navigation for fresh context'
  ]);
  
  yPos += 5;
  addSubtitle('Shared Features');
  addBulletPoint('7 sequential educational slides');
  addBulletPoint('Image Playground (appears after 3 seconds)');
  addBulletPoint('Advanced settings: CFG Scale, steps, seed, dimensions, negative prompt');
  addBulletPoint('Quick-start example prompts');
  addBulletPoint('Slide navigation with progress indicator');
  addBulletPoint('Same AI tutor persona "Alex" in both modes');

  // === 8. SECURITY ARCHITECTURE ===
  doc.addPage();
  yPos = margin;
  addTitle('8. Security Architecture');
  
  addParagraph('Multi-layered security approach protecting research data integrity and participant privacy.');
  yPos += 5;
  
  addSubtitle('Layer 1: Client-Side Security');
  addTable(
    ['Guard', 'File', 'Purpose'],
    [
      ['Study Flow Guard', 'useStudyFlowGuard.ts', 'Enforce sequential study progression'],
      ['Session Timeout', 'useSessionTimeout.ts', '30min inactivity protection'],
      ['Bot Detection', 'useBotDetection.ts', 'Flag suspicious behavior patterns'],
      ['Mode Lock', 'SessionProvider.tsx', 'Prevent unauthorized mode switching'],
      ['Exit Confirmation', 'ExitStudyButton.tsx', 'Confirm before abandoning study'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Layer 2: Server-Side Security');
  addTable(
    ['Mechanism', 'Implementation', 'Purpose'],
    [
      ['Row Level Security', 'PostgreSQL RLS policies', 'Restrict data access at database level'],
      ['Supabase Auth', 'Built-in authentication', 'Admin panel access control'],
      ['Edge Functions', 'Deno serverless functions', 'Validate all data operations'],
      ['Secrets Management', 'Supabase environment vars', 'Protect API keys and credentials'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Layer 3: Data Protection');
  addBulletPoint('study_questions_public view hides correct_answer column from participants');
  addBulletPoint('All public RLS policies removed from research data tables');
  addBulletPoint('Data access only through validated edge functions');
  addBulletPoint('Audit logging tracks all admin content modifications');
  addBulletPoint('Session validation requires owner approval for suspicious data');

  // === 9. DATA FLOW ===
  doc.addPage();
  yPos = margin;
  addTitle('9. Data Flow Architecture');
  
  addSubtitle('Participant Data Collection');
  addFlowDescription('Input → Processing → Storage', [
    'Participant completes form/question',
    'Frontend validates input locally',
    'Data sent to appropriate edge function',
    'Edge function validates and sanitizes',
    'Data inserted into PostgreSQL table',
    'Session ID links all participant data'
  ]);
  
  yPos += 5;
  addSubtitle('Admin Data Access');
  addFlowDescription('Database → Analysis → Export', [
    'Admin authenticates via Supabase Auth',
    'Role-based queries filter accessible data',
    'Statistics calculated from database queries',
    'Filters applied (date range, mode, status)',
    'Data displayed in dashboard components',
    'Export generates CSV/JSON with applied filters'
  ]);
  
  yPos += 5;
  addSubtitle('Edge Function Data Routing');
  addTable(
    ['Function', 'Input', 'Output', 'Tables Affected'],
    [
      ['save-study-data', 'Session/response data', 'Success/error', 'Multiple tables'],
      ['complete-session', 'Session ID', 'Completion status', 'study_sessions'],
      ['save-avatar-time', 'Time tracking data', 'Success/error', 'avatar_time_tracking'],
      ['anam-session', 'Slide context', 'Session token', 'None (external API)'],
      ['chat', 'User message', 'AI response', 'None (external API)'],
    ]
  );

  // === 10. DATABASE SCHEMA ===
  doc.addPage();
  yPos = margin;
  addTitle('10. Database Schema');
  
  addParagraph('Core tables and their relationships in the PostgreSQL database.');
  yPos += 5;
  
  addSubtitle('Core Tables');
  addTable(
    ['Table', 'Purpose', 'Key Fields'],
    [
      ['study_sessions', 'Track participant sessions', 'id, session_id, mode, status, modes_used'],
      ['demographic_responses', 'Store demographic answers', 'session_id, question_id, answer'],
      ['pre_test_responses', 'Store pre-test answers', 'session_id, question_id, answer'],
      ['post_test_responses', 'Store post-test answers', 'session_id, question_id, answer'],
      ['open_feedback_responses', 'Store open feedback', 'session_id, question_id, answer'],
      ['scenarios', 'Store learning interaction data', 'session_id, confidence_rating, trust_rating'],
      ['dialogue_turns', 'Store chat messages', 'scenario_id, role, content, timestamp'],
      ['avatar_time_tracking', 'Track avatar interaction time', 'session_id, slide_id, duration_seconds'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Admin Tables');
  addTable(
    ['Table', 'Purpose', 'Key Fields'],
    [
      ['study_questions', 'Store all questions', 'question_id, question_type, correct_answer'],
      ['study_slides', 'Store learning slides', 'slide_id, title, content, system_prompt_context'],
      ['admin_users', 'Store admin accounts', 'email, created_at'],
      ['user_roles', 'Map users to roles', 'user_id, role'],
      ['admin_audit_log', 'Track admin actions', 'admin_email, action_type, entity_type, changes'],
      ['app_settings', 'Store app configuration', 'key, value'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Views');
  addBulletPoint('study_questions_public: Exposes questions without correct_answer column');

  // === 11. EDGE FUNCTIONS ===
  doc.addPage();
  yPos = margin;
  addTitle('11. Edge Functions Reference');
  
  addTable(
    ['Function', 'Purpose', 'Security'],
    [
      ['save-study-data', 'Handle all participant data saving', 'Session validation'],
      ['complete-session', 'Mark session as completed', 'Session ownership check'],
      ['save-avatar-time', 'Track avatar interaction duration', 'Session validation'],
      ['anam-session', 'Generate Anam AI session token', 'API key protected'],
      ['chat', 'Process AI chat messages', 'API key protected'],
      ['generate-image', 'Generate AI images', 'API key protected'],
      ['toggle-api', 'Enable/disable APIs', 'Owner authentication'],
      ['update-session-validation', 'Update session validation status', 'Role-based access'],
      ['create-admin-users', 'Manage admin accounts', 'Secret-protected'],
    ]
  );
  
  yPos += 10;
  addSubtitle('API Toggle Checks');
  addParagraph('Edge functions that call external APIs check app_settings before execution:');
  addBulletPoint('api_enabled: Master toggle for all APIs');
  addBulletPoint('openai_api_enabled: Controls OpenAI API access');
  addBulletPoint('anam_api_enabled: Controls Anam AI API access');
  addParagraph('When disabled, functions return 503 Service Unavailable.');

  // === 12. APPLICATION ROUTES ===
  doc.addPage();
  yPos = margin;
  addTitle('12. Application Routes');
  
  addSubtitle('Participant Routes');
  addTable(
    ['Route', 'Page', 'Guard'],
    [
      ['/', 'Welcome', 'None'],
      ['/consent', 'Consent Form', 'None'],
      ['/demographics', 'Demographics', 'Requires sessionId'],
      ['/pre-test', 'Pre-Test', 'Requires demographics'],
      ['/mode-assignment', 'Mode Selection', 'Requires preTest'],
      ['/learning/:mode', 'Learning Module', 'Requires studyMode'],
      ['/post-test-1', 'Post-Test Page 1', 'Requires learningComplete'],
      ['/post-test-2', 'Post-Test Page 2', 'Requires postTestPage1'],
      ['/post-test-3', 'Open Feedback', 'Requires postTestPage2'],
      ['/completion', 'Study Complete', 'Requires postTestPage3'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Admin Routes');
  addTable(
    ['Route', 'Page', 'Access'],
    [
      ['/admin/login', 'Admin Login', 'Public'],
      ['/admin', 'Admin Dashboard', 'Authenticated admins'],
    ]
  );

  // === 13. SECRETS MANAGEMENT ===
  doc.addPage();
  yPos = margin;
  addTitle('13. Secrets Management');
  
  addParagraph('All sensitive credentials are stored as Supabase environment secrets, not in source code.');
  yPos += 5;
  
  addTable(
    ['Secret', 'Purpose', 'Used By'],
    [
      ['OWNER_PASSWORD', 'Owner account authentication', 'create-admin-users'],
      ['DEFAULT_ADMIN_PASSWORD', 'Default admin authentication', 'create-admin-users'],
      ['MENTOR_PASSWORD', 'Evaluator account authentication', 'create-admin-users'],
      ['ADMIN_CREATION_SECRET', 'Protect admin creation endpoint', 'create-admin-users'],
      ['OPENAI_API_KEY', 'OpenAI API access', 'chat, generate-image'],
      ['ANAM_API_KEY', 'Anam AI API access', 'anam-session'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Security Notes');
  addBulletPoint('Secrets accessed via Deno.env.get() in edge functions');
  addBulletPoint('Never exposed in client-side code');
  addBulletPoint('Anam API key can be updated by admins through dashboard');
  addBulletPoint('All API key updates logged in audit log');

  // === 14. STATISTICAL ANALYSIS ===
  doc.addPage();
  yPos = margin;
  addTitle('14. Statistical Analysis');
  
  addSubtitle('Collected Metrics');
  addBulletPoint('Knowledge Gain: Post-test score minus pre-test score');
  addBulletPoint('Mode Comparison: Separate analysis for Text Only, Avatar Only, Both Modes');
  addBulletPoint('Question Performance: Correct answer rates per question by mode');
  addBulletPoint('Avatar Interaction Time: Total duration and per-slide breakdown');
  addBulletPoint('Demographics: Age range, education, digital experience distributions');
  addBulletPoint('Completion Rates: Completed vs incomplete session counts');
  
  yPos += 5;
  addSubtitle('Statistical Methods');
  addTable(
    ['Method', 'Purpose', 'Output'],
    [
      ["Welch's t-test", 'Compare means between modes', 't-statistic, p-value'],
      ["Cohen's d", 'Measure effect size', 'Effect magnitude (small/medium/large)'],
      ['95% Confidence Interval', 'Estimate precision', 'Range for mean difference'],
      ['Correlation Analysis', 'Avatar time vs knowledge gain', 'Correlation coefficient'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Export Options');
  addBulletPoint('Demographics CSV: All demographic response data');
  addBulletPoint('Pre-Test CSV: All pre-test responses with correct answer marking');
  addBulletPoint('Post-Test CSV: All post-test responses with correct answer marking');
  addBulletPoint('Open Feedback CSV: All open-ended feedback responses');
  addBulletPoint('Full JSON: Complete session data with all nested responses');
  addBulletPoint('All exports respect date range and mode filters');

  // === APPENDIX ===
  doc.addPage();
  yPos = margin;
  addTitle('Appendix: Quick Reference');
  
  addSubtitle('Key Files');
  addTable(
    ['File', 'Purpose'],
    [
      ['src/hooks/useStudyFlowGuard.ts', 'Study progression enforcement'],
      ['src/hooks/useSessionTimeout.ts', 'Inactivity timeout handling'],
      ['src/hooks/useBotDetection.ts', 'Suspicious behavior detection'],
      ['src/hooks/useAnamClient.ts', 'Anam AI SDK integration'],
      ['src/lib/studyData.ts', 'Data saving utilities'],
      ['src/lib/permissions.ts', 'Role-based access control'],
      ['src/components/SessionProvider.tsx', 'Session state management'],
      ['src/pages/AdminDashboard.tsx', 'Admin panel main component'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Important Constants');
  addBulletPoint('Session timeout: 30 minutes inactivity');
  addBulletPoint('Timeout warning: 5 minutes before expiry');
  addBulletPoint('Suspicious thresholds: <2s answer, <5s page, <3min total');
  addBulletPoint('Open feedback limit: 200 characters per response');
  addBulletPoint('Learning slides: 7 total');
  
  // Footer on last page
  yPos = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('AIDA Study Platform - System Documentation', margin, yPos);
  doc.text('Confidential Research Document', pageWidth - margin, yPos, { align: 'right' });

    // Save the PDF
    doc.save('AIDA-System-Documentation.pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
