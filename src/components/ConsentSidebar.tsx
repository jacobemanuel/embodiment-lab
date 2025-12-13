import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ChevronRight } from "lucide-react";

const ConsentSidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-card/80 backdrop-blur border border-border rounded-l-lg rounded-r-none px-2 py-8 hover:bg-card shadow-lg"
        >
          <div className="flex flex-col items-center gap-1">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground [writing-mode:vertical-lr] rotate-180">Consent</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground rotate-180" />
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[450px] p-0">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Informed Consent
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-6">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Purpose of the Study</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                This research investigates how embodied AI agents, such as virtual avatars powered by large language models, can enhance learners' trust, engagement, and comprehension in AI literacy education. You will learn about AI image generation as a practical example of AI capabilities, comparing text-based and avatar-based learning formats.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Procedures</h2>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex gap-2">
                  <span>1.</span>
                  <span>Complete demographic questions and a brief pre-test about AI image generation</span>
                </li>
                <li className="flex gap-2">
                  <span>2.</span>
                  <span>Learn AI image generation basics through interactive slides (~10 minutes)</span>
                </li>
                <li className="flex gap-2">
                  <span>3.</span>
                  <span>Practice with the AI Image Playground to generate your own images</span>
                </li>
                <li className="flex gap-2">
                  <span>4.</span>
                  <span>Complete a post-test evaluating trust, engagement, satisfaction, and knowledge</span>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Data Collection & Privacy</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We will collect your responses, confidence ratings, and dialogue interactions. All data is:
              </p>
              <ul className="space-y-2 text-muted-foreground text-sm ml-4">
                <li>• Completely anonymous (no names or emails linked to responses)</li>
                <li>• Assigned a random session ID only</li>
                <li>• Stored securely and encrypted</li>
                <li>• Used solely for research purposes</li>
                <li>• Compliant with GDPR and privacy regulations</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Risks & Benefits</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                <strong className="text-foreground">Risks:</strong> Minimal. Some participants may experience mild fatigue during the approximately 10-minute session.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                <strong className="text-foreground">Benefits:</strong> You will learn fundamental concepts of AI image generation, including prompt engineering, style control, and creative techniques. You'll contribute to research on AI-powered educational systems.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Voluntary Participation</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your participation is completely voluntary. You may withdraw at any time without penalty by simply closing your browser. Partial data will not be used.
              </p>
            </section>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground italic">
                By continuing with this study, you have agreed to these terms.
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default ConsentSidebar;
