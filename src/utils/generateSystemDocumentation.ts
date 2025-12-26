export const generateSystemDocumentationPDF = () => {
  const url = '/system-docs.pdf';
  const link = document.createElement('a');
  link.href = url;
  link.download = 'AI-Study-Buddy-System-Spec.pdf';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
};
