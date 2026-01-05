const ParticipantFooter = () => (
  <footer className="mt-8 md:mt-12 border-t border-border/70 bg-card/50">
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="flex flex-col items-center text-center gap-2 md:gap-3">
        <h2 className="text-base md:text-lg font-semibold text-foreground/90">
          P6: AI Study Buddy
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground max-w-2xl px-4">
          Exploring Trust and Engagement toward Embodied AI Agents for AI Literacy
        </p>
        <p className="text-xs text-muted-foreground/80">
          Mentor: Efe Bozkir
        </p>
      </div>

      <div className="mt-4 md:mt-6 pt-4 border-t border-border/60 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-xs text-muted-foreground/80">
        <span>Technical University of Munich</span>
        <span className="hidden md:inline">•</span>
        <span>&copy; {new Date().getFullYear()}</span>
      </div>
    </div>
  </footer>
);

export default ParticipantFooter;
