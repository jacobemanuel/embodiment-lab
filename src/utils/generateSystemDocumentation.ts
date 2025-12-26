const downloadPdf = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const generateSystemDocumentationPDF = () => {
  downloadPdf('/system-docs.pdf', 'AI-Study-Buddy-System-Spec.pdf');
};

export const generateSystemWorkflowGuidePDF = () => {
  downloadPdf('/system-workflow-guide.pdf', 'AI-Study-Buddy-Workflow-Guide.pdf');
};
