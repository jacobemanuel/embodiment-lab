import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateSystemDocumentationPDF = () => {
  try {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;
  let currentPageNum = 1;

  const addNewPageIfNeeded = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      currentPageNum++;
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

  const addSubSubtitle = (text: string, size: number = 11) => {
    addNewPageIfNeeded(12);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(text, margin, yPos);
    yPos += size * 0.35 + 3;
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

  const addCode = (text: string, size: number = 8) => {
    doc.setFontSize(size);
    doc.setFont('courier', 'normal');
    doc.setTextColor(100, 116, 139);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - 10);
    
    // Draw code background
    const codeHeight = lines.length * 4 + 6;
    addNewPageIfNeeded(codeHeight + 5);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, codeHeight, 2, 2, 'F');
    
    yPos += 2;
    lines.forEach((line: string) => {
      doc.text(line, margin + 5, yPos);
      yPos += 4;
    });
    yPos += 5;
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

  const addNumberedItem = (num: number, text: string, indent: number = 0) => {
    addNewPageIfNeeded(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const numX = margin + indent;
    doc.text(`${num}.`, numX, yPos);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - indent - 8);
    lines.forEach((line: string, i: number) => {
      if (i > 0) addNewPageIfNeeded(6);
      doc.text(line, numX + 8, yPos);
      if (i < lines.length - 1) yPos += 5;
    });
    yPos += 6;
  };

  const addTable = (headers: string[], data: string[][], options?: { columnWidths?: number[] }) => {
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
        overflow: 'linebreak',
      },
      columnStyles: options?.columnWidths ? 
        options.columnWidths.reduce((acc, width, i) => ({ ...acc, [i]: { cellWidth: width } }), {}) : 
        undefined,
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
    addSubSubtitle(title);
    steps.forEach((step, index) => {
      addNumberedItem(index + 1, step);
    });
    yPos += 3;
  };

  // =====================================================
  // COVER PAGE
  // =====================================================
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('AIDA Study Platform', pageWidth / 2, 70, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text('Complete Technical Documentation', pageWidth / 2, 90, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(148, 163, 184);
  doc.text('System Architecture, User Flows & Implementation Reference', pageWidth / 2, 105, { align: 'center' });
  
  // Version info box
  doc.setFillColor(51, 65, 85);
  doc.roundedRect(pageWidth / 2 - 50, 130, 100, 35, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Version 2.0', pageWidth / 2, 142, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, pageWidth / 2, 152, { align: 'center' });
  doc.text(`Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, 160, { align: 'center' });
  
  // Footer info
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text('AI-Powered Learning Research Platform', pageWidth / 2, 220, { align: 'center' });
  doc.text('Comparative Study: Text-Based vs Avatar-Based AI Tutoring', pageWidth / 2, 230, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text('Technical University of Munich', pageWidth / 2, 250, { align: 'center' });
  doc.text('Confidential Research Documentation', pageWidth / 2, 260, { align: 'center' });

  // =====================================================
  // TABLE OF CONTENTS
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('Table of Contents', 22);
  yPos += 5;
  
  const tocItems = [
    { num: '1', title: 'Executive Summary', sub: [] },
    { num: '2', title: 'System Overview', sub: ['2.1 Purpose & Research Goals', '2.2 Architecture Overview', '2.3 Technology Stack'] },
    { num: '3', title: 'User Perspectives', sub: ['3.1 Participant Journey', '3.2 Admin/Researcher View', '3.3 Owner Operations', '3.4 Evaluator Access'] },
    { num: '4', title: 'Study Flow & Navigation', sub: ['4.1 Complete Participant Flow', '4.2 Flow Guard System', '4.3 Session State Machine'] },
    { num: '5', title: 'Learning Modes', sub: ['5.1 Text Mode (AI Chat)', '5.2 Avatar Mode (Anam AI)', '5.3 Mode Comparison'] },
    { num: '6', title: 'AI Integration', sub: ['6.1 Lovable AI Gateway', '6.2 Anam AI Avatar', '6.3 Image Generation'] },
    { num: '7', title: 'Admin Panel', sub: ['7.1 Dashboard Overview', '7.2 Content Management', '7.3 Data Quality & Validation', '7.4 API Configuration'] },
    { num: '8', title: 'Security Architecture', sub: ['8.1 Client-Side Guards', '8.2 Server-Side Protection', '8.3 Row Level Security', '8.4 Bot Detection'] },
    { num: '9', title: 'Database Schema', sub: ['9.1 Core Tables', '9.2 Admin Tables', '9.3 Relationships & Views'] },
    { num: '10', title: 'Edge Functions Reference', sub: ['10.1 Data Operations', '10.2 AI Integrations', '10.3 Admin Functions'] },
    { num: '11', title: 'Frontend Architecture', sub: ['11.1 Component Structure', '11.2 State Management', '11.3 Routing'] },
    { num: '12', title: 'Statistical Analysis', sub: ['12.1 Metrics Collected', '12.2 Analysis Methods', '12.3 Export Formats'] },
    { num: '13', title: 'Configuration & Secrets', sub: ['13.1 Environment Variables', '13.2 API Keys', '13.3 App Settings'] },
    { num: '14', title: 'Troubleshooting Guide', sub: ['14.1 Common Issues', '14.2 API Errors', '14.3 Avatar Issues'] },
    { num: 'A', title: 'Appendix: Quick Reference', sub: [] },
  ];
  
  tocItems.forEach((item) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    addNewPageIfNeeded(15);
    doc.text(`${item.num}. ${item.title}`, margin, yPos);
    yPos += 6;
    
    if (item.sub.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      item.sub.forEach(subItem => {
        doc.text(subItem, margin + 10, yPos);
        yPos += 5;
      });
      yPos += 2;
    }
  });

  // =====================================================
  // 1. EXECUTIVE SUMMARY
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('1. Executive Summary');
  
  addParagraph('The AIDA (AI-Driven Adaptive Learning) Study Platform is a comprehensive research application designed to compare the effectiveness of text-based versus avatar-based AI tutoring for teaching AI image generation concepts. The platform collects participant data through a structured, multi-phase study flow while ensuring data integrity, security, and research validity.');
  
  yPos += 5;
  addSubtitle('Key Features');
  addBulletPoint('Two distinct learning modes: Text-based AI chat and Avatar-based visual tutor');
  addBulletPoint('Comprehensive assessment: Pre-test, learning phase, and multi-page post-test');
  addBulletPoint('Interactive Image Playground for hands-on AI image generation practice');
  addBulletPoint('Multi-tier admin panel with role-based access control');
  addBulletPoint('Bot detection and data quality validation systems');
  addBulletPoint('Real-time analytics and statistical analysis tools');
  addBulletPoint('Comprehensive audit logging for research compliance');
  
  yPos += 5;
  addSubtitle('Target Users');
  addTable(
    ['User Type', 'Count', 'Primary Purpose'],
    [
      ['Participants', 'Unlimited', 'Complete learning study and assessments'],
      ['Owner', '1', 'Full system control, final validation, code access'],
      ['Admins', 'Multiple', 'Content management, monitoring, data export'],
      ['Evaluators/Mentors', 'Multiple', 'Read-only access to statistics'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Research Metrics');
  addBulletPoint('Knowledge Gain: Difference between pre-test and post-test scores');
  addBulletPoint('Mode Effectiveness: Comparative analysis between Text and Avatar modes');
  addBulletPoint('Engagement Metrics: Time spent, interaction patterns, completion rates');
  addBulletPoint('User Experience: Trust ratings, engagement ratings, open feedback');

  // =====================================================
  // 2. SYSTEM OVERVIEW
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('2. System Overview');
  
  addSubtitle('2.1 Purpose & Research Goals');
  addParagraph('The platform addresses a key research question: Does avatar-based AI tutoring provide better learning outcomes compared to traditional text-based chat interfaces? The study specifically focuses on teaching AI image generation concepts, including prompt engineering, parameter tuning, and ethical considerations.');
  
  addBulletPoint('Primary Hypothesis: Avatar-based tutoring will show higher engagement and knowledge retention');
  addBulletPoint('Secondary Goals: Measure trust, satisfaction, and perceived usefulness of each mode');
  addBulletPoint('Data Collection: Comprehensive tracking of learning behavior and outcomes');
  
  yPos += 5;
  addSubtitle('2.2 Architecture Overview');
  addParagraph('The system follows a modern JAMstack architecture with serverless backend functions, enabling scalable and secure data collection.');
  
  addCode(`
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Welcome  │→│ Consent  │→│ Learning │→│ Post-Test    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ API Calls
┌──────────────────────────▼──────────────────────────────────┐
│                  EDGE FUNCTIONS (Deno)                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ save-study │ │ anam-sess  │ │ chat       │              │
│  │ -data      │ │ -ion       │ │            │              │
│  └──────┬─────┘ └─────┬──────┘ └──────┬─────┘              │
└─────────┼─────────────┼───────────────┼─────────────────────┘
          │             │               │
┌─────────▼─────────────▼───────────────▼─────────────────────┐
│    PostgreSQL          Anam AI        Lovable AI Gateway    │
│    (Supabase)          (Avatar)       (GPT-5-mini/Gemini)   │
└─────────────────────────────────────────────────────────────┘
  `);
  
  yPos += 5;
  addSubtitle('2.3 Technology Stack');
  
  addTable(
    ['Layer', 'Technology', 'Version/Details', 'Purpose'],
    [
      ['Frontend', 'React', '18.3.x', 'UI framework with TypeScript'],
      ['Build Tool', 'Vite', '5.x', 'Fast development and bundling'],
      ['Styling', 'Tailwind CSS', '3.x', 'Utility-first CSS framework'],
      ['UI Components', 'shadcn/ui', 'Latest', 'Accessible, customizable components'],
      ['Backend', 'Supabase', 'Lovable Cloud', 'PostgreSQL + Auth + Edge Functions'],
      ['Edge Runtime', 'Deno', 'Latest', 'Serverless function execution'],
      ['AI (Text)', 'Lovable AI Gateway', 'GPT-5-mini', 'Text-based chat responses'],
      ['AI (Avatar)', 'Anam AI SDK', '4.6.x', 'Visual avatar with voice'],
      ['AI (Images)', 'Gemini Flash', 'Image preview', 'AI image generation'],
      ['State', 'React Query', '5.x', 'Server state management'],
      ['Routing', 'React Router', '6.x', 'Client-side navigation'],
      ['PDF', 'jsPDF + AutoTable', '3.x', 'Report generation'],
    ]
  );

  // =====================================================
  // 3. USER PERSPECTIVES
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('3. User Perspectives');
  
  addParagraph('The platform serves four distinct user types, each with specific capabilities and workflows.');
  
  yPos += 5;
  addSubtitle('3.1 Participant Journey');
  addParagraph('Study participants experience a guided, sequential flow through the research study. They cannot skip steps or return to completed sections.');
  
  addFlowDescription('Phase 1: Intake & Baseline', [
    'Access study via unique URL (/study/text or /study/avatar)',
    'Read and accept research consent form (checkbox required)',
    'Complete demographic questionnaire (all questions required)',
    'Take pre-test knowledge assessment (baseline measurement)',
  ]);
  
  addFlowDescription('Phase 2: Learning Intervention', [
    'Enter assigned learning mode (Text Chat or Avatar)',
    'Navigate through 7 educational slides about AI image generation',
    'Interact with AI tutor to ask questions about slide content',
    'Use Image Playground to practice prompt engineering (optional)',
    'Complete learning phase by clicking "Finish"',
  ]);
  
  addFlowDescription('Phase 3: Assessment & Feedback', [
    'Complete Post-Test Page 1: Likert scale ratings (trust, engagement, satisfaction)',
    'Complete Post-Test Page 2: Knowledge assessment questions',
    'Complete Post-Test Page 3: Open-ended feedback (optional, 200 char limit)',
    'View completion confirmation screen',
  ]);
  
  addDivider();
  
  addSubtitle('3.2 Admin/Researcher View');
  addParagraph('Administrators can manage study content, view participant data, and export results for analysis.');
  
  addTable(
    ['Capability', 'Description', 'Access Level'],
    [
      ['View Overview', 'Summary statistics, charts, completion rates', 'All admins'],
      ['View Sessions', 'Individual participant session details', 'All admins'],
      ['Edit Questions', 'Modify pre-test/post-test questions and answers', 'Admin+'],
      ['Edit Slides', 'Update learning content, key points, AI context', 'Admin+'],
      ['Export Data', 'Download CSV/JSON reports with filters', 'Admin+'],
      ['Toggle APIs', 'Enable/disable OpenAI and Anam APIs', 'Admin (limited)'],
      ['Update API Key', 'Change Anam API key for free tier rotation', 'Admin+'],
      ['Request Validation', 'Mark suspicious sessions for owner review', 'Admin+'],
    ]
  );
  
  addNewPageIfNeeded(80);
  addSubtitle('3.3 Owner Operations');
  addParagraph('The owner (jakub.majewski@tum.de) has full system access including final validation authority.');
  
  addTable(
    ['Operation', 'Description', 'Risk Level'],
    [
      ['Final Validation', 'Accept/ignore suspicious sessions in statistics', 'Medium'],
      ['Delete Content', 'Permanently remove questions or slides', 'High'],
      ['View Audit Log', 'See all admin actions with timestamps', 'Low'],
      ['Generate Docs', 'Create system documentation PDF', 'Low'],
      ['Manage API Keys', 'Full control over all API configurations', 'High'],
      ['Delete Sessions', 'Remove participant data (not recommended)', 'Critical'],
    ]
  );
  
  yPos += 5;
  addSubtitle('3.4 Evaluator Access');
  addParagraph('External evaluators (e.g., mentors) have read-only access to research statistics without seeing raw data or administrative controls.');
  
  addBulletPoint('Can view: Overview statistics, completion charts, mode distributions');
  addBulletPoint('Cannot view: Individual session details, raw responses, questions, slides');
  addBulletPoint('Cannot access: API settings, audit log, export functions');
  addBulletPoint('Purpose: Enable external supervision without data exposure');

  // =====================================================
  // 4. STUDY FLOW & NAVIGATION
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('4. Study Flow & Navigation');
  
  addSubtitle('4.1 Complete Participant Flow');
  addParagraph('The study enforces a strict sequential flow. Participants cannot skip ahead or return to completed sections.');
  
  addCode(`
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   WELCOME   │────▶│   CONSENT   │────▶│ DEMOGRAPHICS │
│   (/)       │     │ (/consent)  │     │(/demographics)│
└─────────────┘     └─────────────┘     └───────┬──────┘
                                                │
┌─────────────┐     ┌─────────────┐     ┌───────▼──────┐
│   LEARNING  │◀────│MODE ASSIGN  │◀────│   PRE-TEST   │
│(/learning/) │     │(/mode-assign│     │  (/pre-test) │
└──────┬──────┘     └─────────────┘     └──────────────┘
       │
┌──────▼──────┐     ┌─────────────┐     ┌──────────────┐
│ POST-TEST 1 │────▶│ POST-TEST 2 │────▶│ POST-TEST 3  │
│(/post-test-1│     │(/post-test-2│     │(/post-test-3)│
└─────────────┘     └─────────────┘     └───────┬──────┘
                                                │
                                        ┌───────▼──────┐
                                        │  COMPLETION  │
                                        │ (/completion)│
                                        └──────────────┘
  `);
  
  yPos += 5;
  addSubtitle('4.2 Flow Guard System');
  addParagraph('The useStudyFlowGuard hook protects against unauthorized navigation by checking sessionStorage for required completion markers.');
  
  addTable(
    ['Page', 'Required Markers', 'If Missing → Redirect To'],
    [
      ['Demographics', 'sessionId', '/consent'],
      ['Pre-Test', 'sessionId, demographics', '/demographics or earlier'],
      ['Mode Assignment', 'sessionId, demographics, preTest', '/pre-test or earlier'],
      ['Learning', 'sessionId, demographics, preTest, studyMode', '/mode-assignment'],
      ['Post-Test 1', 'sessionId, ..., studyMode', '/learning/:mode'],
      ['Post-Test 2', 'sessionId, ..., postTestPage1', '/post-test-1'],
      ['Post-Test 3', 'sessionId, ..., postTestPage2', '/post-test-2'],
      ['Completion', 'sessionId, ..., postTestPage3', '/post-test-3'],
    ]
  );
  
  yPos += 5;
  addSubSubtitle('Guard Implementation Details');
  addBulletPoint('Polling mechanism: Waits up to 2 seconds for async session creation');
  addBulletPoint('UUID validation: Checks session ID format to detect tampering');
  addBulletPoint('Back-navigation prevention: Completed steps redirect forward');
  addBulletPoint('Toast notifications: User-friendly messages explain redirects');
  
  addNewPageIfNeeded(80);
  addSubtitle('4.3 Session State Machine');
  addParagraph('Each participant session transitions through defined states based on their actions.');
  
  addCode(`
                    ┌─────────────┐
                    │   active    │ (session created)
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────▼─────┐      ┌──────▼─────┐      ┌──────▼─────┐
│ withdrawn  │      │ completed  │      │  expired   │
│(Exit btn)  │      │(Study done)│      │(30min idle)│
└────────────┘      └──────┬─────┘      └────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐
     │ unvalidated│ │pending_acc │ │pending_ign │
     │  (default) │ │(admin ok)  │ │(admin rej) │
     └────────────┘ └──────┬─────┘ └──────┬─────┘
                           │              │
                    ┌──────▼─────┐ ┌──────▼─────┐
                    │  accepted  │ │  ignored   │
                    │(owner ok)  │ │(owner rej) │
                    └────────────┘ └────────────┘
  `);
  
  addTable(
    ['State', 'Description', 'Included in Statistics'],
    [
      ['active', 'Session currently in progress', 'No'],
      ['completed', 'Participant finished all steps', 'Yes (unless validated out)'],
      ['withdrawn', 'Participant clicked Exit Study', 'No'],
      ['expired', 'Session timed out (30 min inactivity)', 'No'],
      ['reset', 'Mode switch or session invalidation', 'No'],
      ['accepted', 'Owner confirmed valid data', 'Yes'],
      ['ignored', 'Owner confirmed invalid data', 'No'],
    ]
  );

  // =====================================================
  // 5. LEARNING MODES
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('5. Learning Modes');
  
  addParagraph('The platform offers two distinct learning experiences, each powered by different AI technologies but sharing the same educational content.');
  
  yPos += 5;
  addSubtitle('5.1 Text Mode (AI Chat)');
  addParagraph('Text Mode provides a traditional chat interface where participants type questions and receive written responses from an AI tutor named "Alex".');
  
  addSubSubtitle('Technical Implementation');
  addBulletPoint('AI Model: OpenAI GPT-5-mini via Lovable AI Gateway');
  addBulletPoint('Response: Streaming SSE (Server-Sent Events) for real-time display');
  addBulletPoint('Context: Pre-test results used to personalize explanations');
  addBulletPoint('File: src/components/modes/TextModeChat.tsx');
  
  addSubSubtitle('User Interface');
  addBulletPoint('Left panel (60%): Slide content with navigation');
  addBulletPoint('Right panel (40%): Chat interface with message history');
  addBulletPoint('Input: Text field with send button');
  addBulletPoint('Chat preserved throughout learning session');
  
  addSubSubtitle('System Prompt Highlights');
  addCode(`
Role: "Alex" - friendly, casual AI tutor for AI image generation
Personality: Warm, approachable, slightly playful
Response length: 2-4 sentences max (concise)
Topic focus: Only AI image generation topics
Pre-test adaptation: Emphasizes user's weak areas
  `);
  
  yPos += 5;
  addSubtitle('5.2 Avatar Mode (Anam AI)');
  addParagraph('Avatar Mode displays a visual AI avatar that speaks responses aloud and can hear the participant via microphone.');
  
  addSubSubtitle('Technical Implementation');
  addBulletPoint('Avatar Platform: Anam AI SDK v4.6.x');
  addBulletPoint('AI Brain: ANAM_GPT_4O_MINI_V1 (Anam\'s built-in GPT-4o-mini)');
  addBulletPoint('Voice: Pre-configured voice ID for consistent experience');
  addBulletPoint('Video: WebRTC streaming to HTML video element');
  addBulletPoint('File: src/hooks/useAnamClient.ts');
  
  addSubSubtitle('Push-to-Talk System');
  addBulletPoint('RED button (default): Avatar cannot hear user (microphone muted)');
  addBulletPoint('BLUE button: Avatar is listening (microphone active)');
  addBulletPoint('Purpose: Prevents avatar from responding to ambient noise');
  addBulletPoint('Implementation: Hard mute via Anam SDK muteInputAudio/unmuteInputAudio');
  
  addSubSubtitle('Silent Context Updates');
  addParagraph('When slides change, the system reconnects with updated context. The avatar receives silent updates that it should NOT speak aloud.');
  
  addCode(`
Message format: [SILENT_CONTEXT_UPDATE:EVENT_TYPE] {...} [DO_NOT_SPEAK]
Example: [SILENT_CONTEXT_UPDATE:SLIDE_CHANGE] {"title": "CFG Scale"} [DO_NOT_SPEAK]
Result: Avatar silently knows new context, waits for user question
  `);
  
  addSubSubtitle('Noise Filtering');
  addBulletPoint('Filters JSON and system messages from transcript');
  addBulletPoint('Filters toggle state noise ("on", "off", "camera on")');
  addBulletPoint('Prevents avatar from reading technical data aloud');
  addBulletPoint('Buffers avatar responses for complete sentences');
  
  addNewPageIfNeeded(80);
  addSubtitle('5.3 Mode Comparison');
  
  addTable(
    ['Feature', 'Text Mode', 'Avatar Mode'],
    [
      ['AI Model', 'GPT-5-mini (Lovable Gateway)', 'GPT-4o-mini (Anam built-in)'],
      ['Interaction', 'Type to chat', 'Speak via microphone'],
      ['Response', 'Text (streaming)', 'Voice + visual avatar'],
      ['Latency', 'Lower', 'Higher (video stream)'],
      ['API Cost', 'Per token (Lovable AI)', 'Per minute (Anam)'],
      ['Offline Use', 'Not possible', 'Not possible'],
      ['Accessibility', 'Screen reader friendly', 'Requires audio/video'],
      ['Mobile Support', 'Full', 'Limited (bandwidth)'],
    ]
  );
  
  yPos += 5;
  addSubSubtitle('Shared Features');
  addBulletPoint('Same 7 educational slides');
  addBulletPoint('Same AI tutor persona "Alex"');
  addBulletPoint('Same Image Playground access');
  addBulletPoint('Same slide navigation controls');
  addBulletPoint('Same exit and finish options');

  // =====================================================
  // 6. AI INTEGRATION
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('6. AI Integration');
  
  addSubtitle('6.1 Lovable AI Gateway');
  addParagraph('The Lovable AI Gateway provides access to various AI models without requiring user-provided API keys. It is automatically available in Lovable Cloud projects.');
  
  addSubSubtitle('Endpoint');
  addCode(`URL: https://ai.gateway.lovable.dev/v1/chat/completions
Auth: Bearer ${'{LOVABLE_API_KEY}'} (auto-provisioned)
Format: OpenAI-compatible API`);
  
  addSubSubtitle('Available Models');
  addTable(
    ['Model', 'Use Case', 'Cost/Speed'],
    [
      ['google/gemini-2.5-pro', 'Complex reasoning, multimodal', 'High/Slow'],
      ['google/gemini-2.5-flash', 'Balanced quality/speed (default)', 'Medium/Medium'],
      ['google/gemini-2.5-flash-lite', 'Simple tasks, classification', 'Low/Fast'],
      ['google/gemini-2.5-flash-image', 'Image generation', 'Medium/Medium'],
      ['openai/gpt-5', 'Highest accuracy', 'High/Slow'],
      ['openai/gpt-5-mini', 'Good quality, lower cost', 'Medium/Medium'],
      ['openai/gpt-5-nano', 'High volume, simple tasks', 'Low/Fast'],
    ]
  );
  
  addSubSubtitle('Error Handling');
  addBulletPoint('429 Too Many Requests: Rate limit exceeded, retry later');
  addBulletPoint('402 Payment Required: Usage credits exhausted');
  addBulletPoint('503 Service Unavailable: API disabled by admin toggle');
  
  yPos += 5;
  addSubtitle('6.2 Anam AI Avatar');
  addParagraph('Anam AI provides a realistic avatar that can listen, speak, and respond in real-time.');
  
  addSubSubtitle('Session Token Flow');
  addCode(`
1. Frontend calls: supabase.functions.invoke('anam-session', { body: { slideContext } })
2. Edge function fetches: POST https://api.anam.ai/v1/auth/session-token
3. Edge function returns: { sessionToken: "..." }
4. Frontend initializes: createClient(sessionToken)
5. Frontend streams: client.streamToVideoElement(videoElementId)
  `);
  
  addSubSubtitle('Configuration');
  addTable(
    ['Parameter', 'Value', 'Purpose'],
    [
      ['avatarId', '30fa96d0-...', 'Visual appearance of avatar'],
      ['voiceId', '6bfbe25a-...', 'Voice characteristics'],
      ['brainType', 'ANAM_GPT_4O_MINI_V1', 'AI model for responses'],
      ['systemPrompt', 'Dynamic (per slide)', 'Teaching context and rules'],
    ]
  );
  
  addSubSubtitle('Free Tier Limitations');
  addBulletPoint('Limited minutes per month per account');
  addBulletPoint('429 error when usage limit reached');
  addBulletPoint('Workaround: Admins can update API key via dashboard');
  addBulletPoint('Multiple Anam accounts can be rotated for more usage');
  
  addNewPageIfNeeded(80);
  addSubtitle('6.3 Image Generation');
  addParagraph('The Image Playground allows participants to practice AI image generation with customizable parameters.');
  
  addSubSubtitle('Edge Function: generate-image');
  addCode(`
Model: google/gemini-2.5-flash-image-preview
Input: { prompt, negativePrompt?, width?, height? }
Output: { imageUrl } (base64 or URL)
  `);
  
  addSubSubtitle('Available Parameters');
  addTable(
    ['Parameter', 'Range', 'Default', 'Description'],
    [
      ['prompt', '1-1000 chars', 'Required', 'Text description of desired image'],
      ['negativePrompt', '0-500 chars', 'None', 'Elements to avoid'],
      ['width', '256-2048', '512', 'Image width in pixels'],
      ['height', '256-2048', '512', 'Image height in pixels'],
      ['cfgScale', '1-15', '7', 'How closely to follow prompt'],
      ['steps', '1-100', '30', 'Generation iterations'],
      ['seed', 'Any integer', 'Random', 'Reproducibility seed'],
    ]
  );

  // =====================================================
  // 7. ADMIN PANEL
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('7. Admin Panel');
  
  addSubtitle('7.1 Dashboard Overview');
  addParagraph('The admin dashboard at /admin provides comprehensive tools for managing the study and analyzing results.');
  
  addSubSubtitle('Authentication Flow');
  addFlowDescription('Login Process', [
    'Navigate to /admin/login',
    'Enter email (must exist in admin_users table)',
    'Enter password (role-specific: Owner, Admin, or Mentor password)',
    'create-admin-users edge function validates credentials',
    'Supabase Auth session created on success',
    'Redirect to /admin with role-based UI',
  ]);
  
  addSubSubtitle('Dashboard Tabs');
  addTable(
    ['Tab', 'Purpose', 'Owner', 'Admin', 'Evaluator'],
    [
      ['Overview', 'Summary stats, charts, alerts', '✓', '✓', '✓'],
      ['Sessions', 'View all participant sessions', '✓', '✓', '✓'],
      ['Responses', 'Detailed response data', '✓', '✓', 'View only'],
      ['Questions', 'Edit pre/post-test questions', '✓', '✓', '✗'],
      ['Slides', 'Edit learning content', '✓', '✓', '✗'],
      ['API Settings', 'Toggle APIs, manage keys', '✓', 'Limited', '✗'],
      ['My Access', 'View own permissions', '✓', '✓', '✓'],
      ['Activity Log', 'Audit trail of changes', '✓', '✓', '✗'],
    ]
  );
  
  yPos += 5;
  addSubtitle('7.2 Content Management');
  
  addSubSubtitle('Question Editor');
  addBulletPoint('Supports multiple question types: multiple-choice, likert, open-text');
  addBulletPoint('Category assignment: demographics, pre-test, post-test, feedback');
  addBulletPoint('Correct answer marking for knowledge questions');
  addBulletPoint('Sort order control for question sequence');
  addBulletPoint('Active/inactive toggle without deletion');
  addBulletPoint('All changes logged in audit trail');
  
  addSubSubtitle('Slide Editor');
  addBulletPoint('Title and content editing with markdown support');
  addBulletPoint('Key points array for structured learning objectives');
  addBulletPoint('AI Tutor Context field: Instructions for how AI should teach this slide');
  addBulletPoint('Image URL support for visual content');
  addBulletPoint('Sort order and active status controls');
  addBulletPoint('Changes immediately available to new participants');
  
  addNewPageIfNeeded(80);
  addSubtitle('7.3 Data Quality & Validation');
  addParagraph('The platform includes automated bot detection and a two-tier validation system for suspicious sessions.');
  
  addSubSubtitle('Suspicion Scoring');
  addTable(
    ['Flag', 'Points', 'Trigger Condition'],
    [
      ['Fast page completion', '+30', 'Page completed in < 5s (demographics), < 30s (pre-test), < 45s (post-test)'],
      ['Fast answer ratio', '+25', '> 50% of answers in < 3s'],
      ['Fast average answer', '+20', 'Mean answer time < 1.5s'],
      ['Fast slide viewing', '+25', 'Average slide view < 8s'],
    ]
  );
  
  addSubSubtitle('Score Bands');
  addTable(
    ['Score Range', 'Risk Level', 'Default Action'],
    [
      ['0-19', 'Normal', 'Include in statistics'],
      ['20-39', 'Low risk', 'Review recommended'],
      ['40-59', 'Medium risk', 'Manual validation needed'],
      ['60+', 'High risk', 'Likely invalid data'],
    ]
  );
  
  addSubSubtitle('Two-Tier Validation Process');
  addFlowDescription('Validation Workflow', [
    'Bot detection flags suspicious behavior during study',
    'Sessions with flags appear in "Data Quality Alerts" section',
    'ADMIN reviews and marks as "Accept" or "Ignore" (creates pending status)',
    'OWNER reviews pending decisions and confirms final status',
    'Accepted sessions included in statistics; ignored sessions excluded',
  ]);
  
  yPos += 5;
  addSubtitle('7.4 API Configuration');
  
  addSubSubtitle('Master Toggle');
  addBulletPoint('api_enabled: Master switch for all external API calls');
  addBulletPoint('When OFF: Both Text and Avatar modes return 503 errors');
  addBulletPoint('Purpose: Emergency shutoff during issues or maintenance');
  
  addSubSubtitle('Per-API Toggles');
  addBulletPoint('openai_api_enabled: Controls Text Mode chat functionality');
  addBulletPoint('anam_api_enabled: Controls Avatar Mode functionality');
  addBulletPoint('Each can be disabled independently while master is ON');
  
  addSubSubtitle('Anam API Key Rotation');
  addParagraph('Admins can update the Anam API key through the dashboard to rotate between free tier accounts.');
  addBulletPoint('Current key stored in app_settings table (encrypted)');
  addBulletPoint('Database key takes priority over environment variable');
  addBulletPoint('Key updates logged in audit trail (key value not logged)');

  // =====================================================
  // 8. SECURITY ARCHITECTURE
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('8. Security Architecture');
  
  addParagraph('The platform implements multiple security layers to protect participant data and ensure research integrity.');
  
  yPos += 5;
  addSubtitle('8.1 Client-Side Guards');
  
  addTable(
    ['Guard', 'File', 'Purpose', 'Implementation'],
    [
      ['Flow Guard', 'useStudyFlowGuard.ts', 'Enforce sequential flow', 'sessionStorage checks'],
      ['Session Timeout', 'useSessionTimeout.ts', 'Expire inactive sessions', '30min timer with warning'],
      ['Bot Detection', 'useBotDetection.ts', 'Flag suspicious patterns', 'Timing analysis'],
      ['Mode Lock', 'SessionProvider.tsx', 'Prevent mode switching', 'sessionStorage guard'],
      ['Exit Confirm', 'ExitStudyButton.tsx', 'Prevent accidental exit', 'Dialog confirmation'],
    ]
  );
  
  yPos += 5;
  addSubtitle('8.2 Server-Side Protection');
  
  addSubSubtitle('Edge Function Security');
  addBulletPoint('All edge functions validate input using Zod schemas');
  addBulletPoint('Rate limiting: Max 10 requests per minute per IP');
  addBulletPoint('Session validation: Verify sessionId exists before data operations');
  addBulletPoint('Service role key: Used only in edge functions, never exposed');
  
  addSubSubtitle('Input Validation Examples');
  addCode(`
// Session ID validation
const sessionIdSchema = z.string().min(10).max(100);

// Message content validation
const messageSchema = z.object({
  role: z.string().max(50),
  content: z.string().max(10000),
});

// Rate limit check
if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
}
  `);
  
  yPos += 5;
  addSubtitle('8.3 Row Level Security (RLS)');
  addParagraph('PostgreSQL RLS policies restrict data access at the database level, preventing unauthorized queries.');
  
  addSubSubtitle('Research Data Tables (No Public Access)');
  addBulletPoint('study_sessions: Researchers can SELECT only');
  addBulletPoint('demographic_responses: Researchers can SELECT only');
  addBulletPoint('pre_test_responses: Researchers can SELECT only');
  addBulletPoint('post_test_responses: Researchers can SELECT only');
  addBulletPoint('dialogue_turns: Researchers can SELECT only');
  addBulletPoint('scenarios: Researchers can SELECT only');
  
  addSubSubtitle('Admin Tables');
  addBulletPoint('study_questions: Researchers can manage (all CRUD)');
  addBulletPoint('study_slides: Anyone can view active; researchers can manage');
  addBulletPoint('admin_audit_log: Researchers can SELECT and INSERT');
  addBulletPoint('app_settings: Researchers can SELECT and UPDATE');
  
  addSubSubtitle('Public View');
  addCode(`
-- study_questions_public view hides correct_answer
CREATE VIEW study_questions_public AS
SELECT id, question_id, question_type, question_text, options, 
       category, sort_order, is_active, question_meta,
       COALESCE((options->0->>'allowMultiple')::boolean, false) as allow_multiple
FROM study_questions
WHERE is_active = true;
-- Note: correct_answer column is NOT exposed
  `);
  
  addNewPageIfNeeded(80);
  addSubtitle('8.4 Bot Detection');
  addParagraph('Automated detection of bot-like behavior patterns during study participation.');
  
  addSubSubtitle('Detection Metrics');
  addTable(
    ['Metric', 'Threshold', 'Detection Method'],
    [
      ['Question answer time', '< 3 seconds', 'Timestamp difference between questions'],
      ['Page completion time', 'Varies by page', 'Time from page load to submit'],
      ['Slide view time', '< 8 seconds avg', 'Time spent on each learning slide'],
      ['Fast answer ratio', '> 50%', 'Percentage of suspiciously fast answers'],
    ]
  );
  
  addSubSubtitle('Reporting Mechanism');
  addCode(`
// Suspicious activity reported via edge function
save-study-data action: 'report_suspicious'
{
  sessionId: string,
  flags: string[],     // e.g., ["Page completed in 3.2s"]
  score: number,       // e.g., 45
  pageType: string     // e.g., "demographics"
}
  `);

  // =====================================================
  // 9. DATABASE SCHEMA
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('9. Database Schema');
  
  addSubtitle('9.1 Core Tables');
  
  addSubSubtitle('study_sessions');
  addTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'UUID', 'Primary key (auto-generated)'],
      ['session_id', 'TEXT', 'Public session identifier'],
      ['mode', 'ENUM (text/avatar)', 'Assigned learning mode'],
      ['modes_used', 'TEXT[]', 'Array of modes used (for switching detection)'],
      ['status', 'TEXT', 'active/completed/withdrawn/expired/reset'],
      ['validation_status', 'TEXT', 'pending/accepted/ignored'],
      ['started_at', 'TIMESTAMP', 'Session creation time'],
      ['completed_at', 'TIMESTAMP', 'Study completion time (null if incomplete)'],
      ['last_activity_at', 'TIMESTAMP', 'Last user interaction'],
      ['suspicion_score', 'INTEGER', 'Bot detection score (0-100)'],
      ['suspicious_flags', 'JSONB', 'Array of detected issues'],
      ['browser_fingerprint', 'TEXT', 'Client identification (optional)'],
      ['validated_by', 'TEXT', 'Email of validator'],
      ['validated_at', 'TIMESTAMP', 'Validation timestamp'],
    ]
  );
  
  addSubSubtitle('demographic_responses');
  addTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'UUID', 'Primary key'],
      ['session_id', 'UUID', 'Foreign key to study_sessions'],
      ['question_id', 'TEXT', 'Reference to question'],
      ['answer', 'TEXT', 'User\'s response'],
      ['created_at', 'TIMESTAMP', 'Response timestamp'],
    ]
  );
  
  addSubSubtitle('pre_test_responses / post_test_responses');
  addParagraph('Same structure as demographic_responses, linked to different question categories.');
  
  addSubSubtitle('scenarios');
  addTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'UUID', 'Primary key'],
      ['session_id', 'UUID', 'Foreign key to study_sessions'],
      ['scenario_id', 'TEXT', 'Learning scenario identifier'],
      ['confidence_rating', 'INTEGER', 'Self-reported confidence (0-100)'],
      ['trust_rating', 'INTEGER', 'Trust in AI tutor (0-10)'],
      ['engagement_rating', 'BOOLEAN', 'Would recommend experience'],
      ['generated_images', 'JSONB', 'Images created in playground'],
      ['completed_at', 'TIMESTAMP', 'Scenario completion time'],
    ]
  );
  
  addSubSubtitle('dialogue_turns');
  addTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'UUID', 'Primary key'],
      ['scenario_id', 'UUID', 'Foreign key to scenarios'],
      ['role', 'TEXT', 'user or assistant'],
      ['content', 'TEXT', 'Message text'],
      ['timestamp', 'TIMESTAMP', 'Message time'],
    ]
  );
  
  addNewPageIfNeeded(80);
  addSubtitle('9.2 Admin Tables');
  
  addSubSubtitle('study_questions');
  addTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'UUID', 'Primary key'],
      ['question_id', 'TEXT', 'Unique question identifier (e.g., pre-1)'],
      ['question_type', 'TEXT', 'multiple-choice / likert / open-text'],
      ['question_text', 'TEXT', 'The question displayed to user'],
      ['options', 'JSONB', 'Answer options array'],
      ['correct_answer', 'TEXT', 'For knowledge questions (hidden from public view)'],
      ['category', 'TEXT', 'demographics / pre-test / post-test / feedback'],
      ['mode_specific', 'TEXT', 'both / text / avatar (for mode-specific questions)'],
      ['sort_order', 'INTEGER', 'Display order within category'],
      ['is_active', 'BOOLEAN', 'Whether question is shown'],
      ['question_meta', 'JSONB', 'Additional metadata'],
    ]
  );
  
  addSubSubtitle('study_slides');
  addTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'UUID', 'Primary key'],
      ['slide_id', 'TEXT', 'Unique slide identifier'],
      ['title', 'TEXT', 'Slide title'],
      ['content', 'TEXT', 'Main slide content (markdown)'],
      ['image_url', 'TEXT', 'Optional image URL'],
      ['key_points', 'JSONB', 'Array of key learning points'],
      ['system_prompt_context', 'TEXT', 'AI tutor instructions for this slide'],
      ['sort_order', 'INTEGER', 'Display order'],
      ['is_active', 'BOOLEAN', 'Whether slide is shown'],
    ]
  );
  
  addSubSubtitle('admin_audit_log');
  addTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'UUID', 'Primary key'],
      ['admin_email', 'TEXT', 'Who made the change'],
      ['action_type', 'TEXT', 'create / update / delete'],
      ['entity_type', 'TEXT', 'question / slide / api_key / etc.'],
      ['entity_id', 'TEXT', 'ID of affected entity'],
      ['entity_name', 'TEXT', 'Human-readable name'],
      ['changes', 'JSONB', 'Before/after values'],
      ['created_at', 'TIMESTAMP', 'When action occurred'],
    ]
  );
  
  addSubtitle('9.3 Relationships & Views');
  
  addCode(`
study_sessions (1) ──── (N) demographic_responses
study_sessions (1) ──── (N) pre_test_responses
study_sessions (1) ──── (N) post_test_responses
study_sessions (1) ──── (N) scenarios
study_sessions (1) ──── (N) avatar_time_tracking
scenarios (1) ────────── (N) dialogue_turns
  `);
  
  addBulletPoint('study_questions_public: Public view hiding correct_answer column');
  addBulletPoint('All foreign keys use ON DELETE CASCADE for data integrity');
  addBulletPoint('Indexes on session_id columns for query performance');

  // =====================================================
  // 10. EDGE FUNCTIONS REFERENCE
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('10. Edge Functions Reference');
  
  addParagraph('All edge functions are deployed as Deno serverless functions on Supabase.');
  
  yPos += 5;
  addSubtitle('10.1 Data Operations');
  
  addSubSubtitle('save-study-data');
  addParagraph('Central function for all participant data saving operations.');
  addTable(
    ['Action', 'Input', 'Output', 'Tables'],
    [
      ['create_session', '{mode}', '{sessionId}', 'study_sessions'],
      ['save_demographics', '{sessionId, demographics}', '{success}', 'demographic_responses'],
      ['save_pre_test', '{sessionId, preTestResponses[]}', '{success}', 'pre_test_responses'],
      ['save_scenario', '{sessionId, scenarioData}', '{success}', 'scenarios, dialogue_turns'],
      ['save_post_test', '{sessionId, postTestResponses[]}', '{success}', 'post_test_responses'],
      ['update_mode', '{sessionId, mode}', '{success, modesUsed}', 'study_sessions'],
      ['reset_session', '{sessionId, reason}', '{success}', 'study_sessions'],
      ['update_activity', '{sessionId}', '{success}', 'study_sessions'],
      ['report_suspicious', '{sessionId, flags, score}', '{success}', 'study_sessions'],
    ]
  );
  
  addSubSubtitle('complete-session');
  addCode(`
Input: { sessionId: string }
Process: 
  1. Verify session exists and is not already completed
  2. Update status to 'completed', set completed_at timestamp
Output: { success: true }
  `);
  
  addSubSubtitle('save-avatar-time');
  addCode(`
Input: { sessionId, slideId, slideTitle, startedAt, endedAt, durationSeconds }
Process: Insert time tracking record for avatar interaction
Output: { success: true }
  `);
  
  yPos += 5;
  addSubtitle('10.2 AI Integrations');
  
  addSubSubtitle('chat');
  addCode(`
Input: { messages: [{role, content}], preTestData?: {} }
Process:
  1. Check if API is enabled (api_enabled + openai_api_enabled)
  2. Build system prompt with tutor persona + pre-test context
  3. Call Lovable AI Gateway (GPT-5-mini)
  4. Stream response via SSE
Output: Server-Sent Events stream
  `);
  
  addSubSubtitle('anam-session');
  addCode(`
Input: { slideContext: {id, title, keyPoints, systemPromptContext} }
Process:
  1. Check if API is enabled (api_enabled + anam_api_enabled)
  2. Get API key (database first, then environment)
  3. Build system prompt with slide context
  4. Call Anam API for session token
Output: { sessionToken: string }
  `);
  
  addSubSubtitle('generate-image');
  addCode(`
Input: { prompt, negativePrompt?, width?, height? }
Process:
  1. Call Lovable AI Gateway (gemini-2.5-flash-image)
  2. Extract image URL from response
Output: { imageUrl: string }
  `);
  
  addNewPageIfNeeded(80);
  addSubtitle('10.3 Admin Functions');
  
  addSubSubtitle('toggle-api');
  addCode(`
Input: { key: string, value: object }
Example: { key: 'anam_api_enabled', value: { enabled: false } }
Process: Update app_settings with new value
Output: { success: true }
  `);
  
  addSubSubtitle('update-session-validation');
  addCode(`
Input: { sessionId, newStatus, validatedBy }
Example: { sessionId: 'abc-123', newStatus: 'accepted', validatedBy: 'admin@tum.de' }
Process: 
  1. Validate status transition (pending → accepted/ignored)
  2. Update study_sessions
Output: { success: true }
  `);
  
  addSubSubtitle('create-admin-users');
  addCode(`
Input: { email, password, secret }
Process:
  1. Verify ADMIN_CREATION_SECRET
  2. Check email exists in admin_users table
  3. Verify password matches role-specific password
  4. Create or sign in Supabase Auth user
  5. Assign role in user_roles table
Output: { success: true, user: {...} }
  `);

  // =====================================================
  // 11. FRONTEND ARCHITECTURE
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('11. Frontend Architecture');
  
  addSubtitle('11.1 Component Structure');
  addParagraph('The frontend follows a modular component architecture with clear separation of concerns.');
  
  addCode(`
src/
├── components/
│   ├── ui/                 # shadcn/ui base components
│   ├── admin/              # Admin panel components
│   ├── modes/              # Learning mode components
│   │   ├── TextModeChat.tsx
│   │   ├── AvatarModePanel.tsx
│   │   └── AvatarMode.tsx
│   ├── SessionProvider.tsx # Session state context
│   ├── SlideViewer.tsx     # Learning slide display
│   ├── ImagePlayground.tsx # AI image generation
│   └── ...
├── hooks/
│   ├── useStudyFlowGuard.ts  # Navigation protection
│   ├── useSessionTimeout.ts  # Inactivity handling
│   ├── useBotDetection.ts    # Suspicious behavior tracking
│   ├── useAnamClient.ts      # Anam AI SDK integration
│   └── useStudyQuestions.ts  # Question data fetching
├── pages/
│   ├── Welcome.tsx           # Landing page
│   ├── Consent.tsx           # Consent form
│   ├── Demographics.tsx      # Demographic survey
│   ├── PreTest.tsx           # Pre-test assessment
│   ├── Learning.tsx          # Main learning page
│   ├── PostTestPage1-3.tsx   # Post-test pages
│   ├── Completion.tsx        # Study completion
│   └── AdminDashboard.tsx    # Admin panel
├── lib/
│   ├── permissions.ts        # Role-based access control
│   ├── studyData.ts          # Data saving utilities
│   └── suspicion.ts          # Bot detection rules
└── utils/
    ├── aiChat.ts             # Streaming chat utility
    └── generateSystemDocumentation.ts
  `);
  
  yPos += 5;
  addSubtitle('11.2 State Management');
  
  addSubSubtitle('Session Storage');
  addParagraph('Participant progress is tracked via sessionStorage to enable flow guards and prevent data loss.');
  addTable(
    ['Key', 'Purpose', 'Set By'],
    [
      ['sessionId', 'Links all data to one session', 'Consent page'],
      ['studyMode', 'Assigned learning mode', 'Mode Assignment'],
      ['demographics', 'Completion marker', 'Demographics page'],
      ['preTest', 'Pre-test answers + marker', 'Pre-Test page'],
      ['postTestPage1', 'Completion marker', 'Post-Test Page 1'],
      ['postTestPage2', 'Completion marker', 'Post-Test Page 2'],
      ['postTestPage3', 'Completion marker', 'Post-Test Page 3'],
      ['studyCompleted', 'Final completion flag', 'Completion page'],
    ]
  );
  
  addSubSubtitle('React Query');
  addBulletPoint('Server state management for admin dashboard');
  addBulletPoint('Automatic refetching and caching');
  addBulletPoint('Used for questions, slides, and session data');
  
  addSubSubtitle('Context Providers');
  addBulletPoint('SessionProvider: Timeout warnings and session management');
  addBulletPoint('QueryClientProvider: React Query configuration');
  addBulletPoint('TooltipProvider: UI tooltips');
  
  yPos += 5;
  addSubtitle('11.3 Routing');
  
  addTable(
    ['Route Pattern', 'Component', 'Purpose'],
    [
      ['/', 'Welcome', 'Study landing page'],
      ['/study/:mode', 'StudyEntry', 'Entry point with mode param'],
      ['/consent', 'Consent', 'Research consent form'],
      ['/demographics', 'Demographics', 'Demographic questionnaire'],
      ['/pre-test', 'PreTest', 'Baseline knowledge assessment'],
      ['/mode-assignment', 'ModeAssignment', 'Learning mode selection'],
      ['/learning/:mode', 'Learning', 'Main learning experience'],
      ['/post-test-1', 'PostTestPage1', 'Likert scale ratings'],
      ['/post-test-2', 'PostTestPage2', 'Knowledge check'],
      ['/post-test-3', 'PostTestPage3', 'Open feedback'],
      ['/completion', 'Completion', 'Study complete'],
      ['/admin/login', 'AdminLogin', 'Admin authentication'],
      ['/admin', 'AdminDashboard', 'Admin panel'],
      ['*', 'NotFound', '404 page'],
    ]
  );

  // =====================================================
  // 12. STATISTICAL ANALYSIS
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('12. Statistical Analysis');
  
  addSubtitle('12.1 Metrics Collected');
  
  addSubSubtitle('Knowledge Assessment');
  addBulletPoint('Pre-test score: Percentage of correct answers before learning');
  addBulletPoint('Post-test score: Percentage of correct answers after learning');
  addBulletPoint('Knowledge gain: Post-test score minus pre-test score');
  addBulletPoint('Per-question analysis: Correct rate for each question by mode');
  
  addSubSubtitle('Engagement Metrics');
  addBulletPoint('Session duration: Total time from consent to completion');
  addBulletPoint('Learning time: Time spent in learning phase');
  addBulletPoint('Avatar interaction time: Duration of avatar mode usage');
  addBulletPoint('Slide view times: How long each slide was viewed');
  addBulletPoint('Chat/voice turns: Number of interactions with AI tutor');
  
  addSubSubtitle('User Experience');
  addBulletPoint('Trust rating: How much participant trusts AI tutor (1-10)');
  addBulletPoint('Engagement rating: Would recommend this learning experience');
  addBulletPoint('Satisfaction: Various Likert scale items');
  addBulletPoint('Open feedback: Qualitative responses about experience');
  
  yPos += 5;
  addSubtitle('12.2 Analysis Methods');
  
  addTable(
    ['Method', 'Purpose', 'Output'],
    [
      ['Welch\'s t-test', 'Compare means between Text and Avatar groups', 't-statistic, p-value'],
      ['Cohen\'s d', 'Measure effect size of mode difference', 'Small/Medium/Large effect'],
      ['95% CI', 'Estimate precision of mean difference', 'Confidence interval bounds'],
      ['Correlation', 'Relate avatar time to knowledge gain', 'Correlation coefficient'],
      ['Descriptive stats', 'Summarize distributions', 'Mean, SD, range'],
    ]
  );
  
  addSubSubtitle('Mode Comparison Analysis');
  addCode(`
Text Only group: Participants who used only text mode
Avatar Only group: Participants who used only avatar mode
Both Modes group: Participants who switched modes (excluded from main comparison)

Primary comparison: Text Only vs Avatar Only
Metrics: Knowledge gain, session duration, trust rating, engagement
  `);
  
  yPos += 5;
  addSubtitle('12.3 Export Formats');
  
  addTable(
    ['Export Type', 'Format', 'Contents', 'Filters Applied'],
    [
      ['Demographics CSV', 'CSV', 'All demographic responses', 'Date range, mode'],
      ['Pre-Test CSV', 'CSV', 'Pre-test answers with correct marking', 'Date range, mode'],
      ['Post-Test CSV', 'CSV', 'Post-test answers with correct marking', 'Date range, mode'],
      ['Feedback CSV', 'CSV', 'Open-ended feedback responses', 'Date range, mode'],
      ['Full JSON', 'JSON', 'Complete session data with nested arrays', 'Date range, mode'],
      ['PDF Report', 'PDF', 'Summary statistics and charts', 'Date range'],
    ]
  );
  
  addBulletPoint('All exports respect current filter settings (date range, mode, validation status)');
  addBulletPoint('Completed-only filter excludes incomplete sessions');
  addBulletPoint('Question text and category included for context');

  // =====================================================
  // 13. CONFIGURATION & SECRETS
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('13. Configuration & Secrets');
  
  addSubtitle('13.1 Environment Variables');
  addParagraph('Frontend environment variables are prefixed with VITE_ and are available in browser code.');
  
  addTable(
    ['Variable', 'Source', 'Purpose'],
    [
      ['VITE_SUPABASE_URL', 'Auto-provisioned', 'Supabase project URL'],
      ['VITE_SUPABASE_PUBLISHABLE_KEY', 'Auto-provisioned', 'Supabase anon key for client'],
      ['VITE_SUPABASE_PROJECT_ID', 'Auto-provisioned', 'Project identifier'],
    ]
  );
  
  yPos += 5;
  addSubtitle('13.2 API Keys (Secrets)');
  addParagraph('Server-side secrets are stored in Supabase and accessed only by edge functions.');
  
  addTable(
    ['Secret Name', 'Purpose', 'Used By'],
    [
      ['LOVABLE_API_KEY', 'Lovable AI Gateway access', 'chat, generate-image'],
      ['ANAM_API_KEY', 'Anam AI avatar access (fallback)', 'anam-session'],
      ['SUPABASE_URL', 'Database connection', 'All edge functions'],
      ['SUPABASE_SERVICE_ROLE_KEY', 'Elevated database access', 'All edge functions'],
      ['OWNER_PASSWORD', 'Owner account authentication', 'create-admin-users'],
      ['DEFAULT_ADMIN_PASSWORD', 'Admin account authentication', 'create-admin-users'],
      ['MENTOR_PASSWORD', 'Evaluator account authentication', 'create-admin-users'],
      ['ADMIN_CREATION_SECRET', 'Protect admin creation endpoint', 'create-admin-users'],
    ]
  );
  
  yPos += 5;
  addSubtitle('13.3 App Settings');
  addParagraph('Runtime configuration stored in the app_settings database table.');
  
  addTable(
    ['Key', 'Value Type', 'Purpose'],
    [
      ['api_enabled', '{enabled: boolean}', 'Master API toggle'],
      ['openai_api_enabled', '{enabled: boolean}', 'Text mode toggle'],
      ['anam_api_enabled', '{enabled: boolean}', 'Avatar mode toggle'],
      ['anam_api_key', '{key: string}', 'Custom Anam API key (overrides env)'],
    ]
  );
  
  addSubSubtitle('Anam API Key Priority');
  addCode(`
1. Check app_settings.anam_api_key.key
2. If empty/null → Use ANAM_API_KEY from environment
3. If neither exists → Return configuration error
  `);

  // =====================================================
  // 14. TROUBLESHOOTING GUIDE
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('14. Troubleshooting Guide');
  
  addSubtitle('14.1 Common Issues');
  
  addSubSubtitle('Participant cannot proceed to next page');
  addBulletPoint('Check: Is sessionStorage populated correctly?');
  addBulletPoint('Check: Are all required questions answered?');
  addBulletPoint('Check: Is browser allowing sessionStorage?');
  addBulletPoint('Solution: Clear browser data and restart study');
  
  addSubSubtitle('Admin cannot log in');
  addBulletPoint('Check: Is email in admin_users table?');
  addBulletPoint('Check: Is correct password being used for role?');
  addBulletPoint('Check: Is create-admin-users function deployed?');
  addBulletPoint('Solution: Verify admin_users entry and password secrets');
  
  addSubSubtitle('Data not saving');
  addBulletPoint('Check: Are edge functions deployed and accessible?');
  addBulletPoint('Check: Is rate limiting being triggered?');
  addBulletPoint('Check: Are RLS policies correctly configured?');
  addBulletPoint('Solution: Check edge function logs in Supabase dashboard');
  
  yPos += 5;
  addSubtitle('14.2 API Errors');
  
  addTable(
    ['Error', 'Cause', 'Solution'],
    [
      ['429 Rate Limit', 'Too many requests', 'Wait and retry; check Lovable AI limits'],
      ['402 Payment Required', 'Usage credits exhausted', 'Add credits to Lovable workspace'],
      ['503 Service Unavailable', 'API disabled by admin', 'Enable API in admin panel'],
      ['401 Unauthorized', 'Invalid API key', 'Check and update API key configuration'],
      ['500 Internal Error', 'Server-side issue', 'Check edge function logs'],
    ]
  );
  
  yPos += 5;
  addSubtitle('14.3 Avatar Issues');
  
  addSubSubtitle('Avatar not loading');
  addBulletPoint('Check: Is Anam API enabled in admin panel?');
  addBulletPoint('Check: Is API key valid and not expired?');
  addBulletPoint('Check: Has usage limit been reached?');
  addBulletPoint('Solution: Update API key or wait for limit reset');
  
  addSubSubtitle('Avatar not hearing user');
  addBulletPoint('Check: Is microphone button BLUE (unmuted)?');
  addBulletPoint('Check: Is browser microphone permission granted?');
  addBulletPoint('Check: Is correct audio input device selected?');
  addBulletPoint('Solution: Click blue mic button and allow permission');
  
  addSubSubtitle('Avatar reading JSON aloud');
  addBulletPoint('Cause: Silent context update not properly filtered');
  addBulletPoint('Check: Is [DO_NOT_SPEAK] tag present in system message?');
  addBulletPoint('Solution: Verify noise filtering in useAnamClient.ts');

  // =====================================================
  // APPENDIX: QUICK REFERENCE
  // =====================================================
  doc.addPage();
  currentPageNum++;
  yPos = margin;
  addTitle('Appendix A: Quick Reference');
  
  addSubtitle('Key Files');
  addTable(
    ['File', 'Purpose'],
    [
      ['src/hooks/useStudyFlowGuard.ts', 'Sequential navigation enforcement'],
      ['src/hooks/useSessionTimeout.ts', 'Inactivity timeout (30 min)'],
      ['src/hooks/useBotDetection.ts', 'Suspicious behavior tracking'],
      ['src/hooks/useAnamClient.ts', 'Anam AI SDK integration'],
      ['src/hooks/useStudySlides.ts', 'Learning slide data fetching'],
      ['src/hooks/useStudyQuestions.ts', 'Question data fetching'],
      ['src/lib/permissions.ts', 'Role-based access control definitions'],
      ['src/lib/studyData.ts', 'Data saving utility functions'],
      ['src/lib/suspicion.ts', 'Bot detection rules and thresholds'],
      ['src/utils/aiChat.ts', 'Streaming chat with Lovable AI'],
      ['src/pages/Learning.tsx', 'Main learning experience page'],
      ['src/pages/AdminDashboard.tsx', 'Admin panel entry point'],
      ['supabase/functions/save-study-data/', 'Central data saving function'],
      ['supabase/functions/anam-session/', 'Avatar session token generation'],
      ['supabase/functions/chat/', 'Text mode AI chat'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Important Constants');
  addTable(
    ['Constant', 'Value', 'Location'],
    [
      ['Session timeout', '30 minutes', 'useSessionTimeout.ts'],
      ['Timeout warning', '5 minutes before', 'useSessionTimeout.ts'],
      ['Min answer time', '3 seconds', 'suspicion.ts'],
      ['Min page time (demographics)', '15 seconds', 'suspicion.ts'],
      ['Min page time (pre-test)', '30 seconds', 'suspicion.ts'],
      ['Min page time (post-test)', '45 seconds', 'suspicion.ts'],
      ['Min slide view time', '8 seconds', 'suspicion.ts'],
      ['Fast answer threshold', '50%', 'suspicion.ts'],
      ['Rate limit window', '60 seconds', 'save-study-data'],
      ['Rate limit max requests', '10', 'save-study-data'],
      ['Open feedback char limit', '200', 'PostTestPage3.tsx'],
      ['Learning slides count', '7', 'study_slides table'],
    ]
  );
  
  yPos += 5;
  addSubtitle('Role Email Mappings');
  addTable(
    ['Role', 'Email Pattern', 'Password Secret'],
    [
      ['Owner', 'jakub.majewski@tum.de', 'OWNER_PASSWORD'],
      ['Evaluator', 'efe.bozkir@tum.de', 'MENTOR_PASSWORD'],
      ['Admin', 'Any other in admin_users', 'DEFAULT_ADMIN_PASSWORD'],
    ]
  );
  
  // Final page with footer
  yPos = pageHeight - 30;
  addDivider();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('AIDA Study Platform - Complete Technical Documentation', margin, yPos);
  doc.text(`Generated: ${new Date().toISOString()}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 5;
  doc.text('Confidential Research Document - Technical University of Munich', margin, yPos);
  doc.text(`Total Pages: ${currentPageNum}`, pageWidth - margin, yPos, { align: 'right' });

    // Save the PDF
    doc.save('AIDA-Complete-Technical-Documentation.pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
