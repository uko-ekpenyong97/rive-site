/**
 * This is the DeveloperZone sample. It typechecks in CI on purpose.
 * Edit it like code, not like copy.
 *
 * Nothing imports this module — the section reads its SOURCE (`?raw` for the
 * copy button, a build-time tokenizer for the highlighted markup), so the text
 * on screen and the text the compiler checks are the same bytes. If the Rive
 * runtime changes an API out from under this sample, the build fails instead of
 * the marketing site quietly teaching a signature that no longer exists.
 *
 * Compressed from src/components/UseCaseModal/NoseyHero.tsx, which is the real
 * thing: the same autoBind, the same enum write, the same subscription.
 */
import { useEffect, useState } from "react";
import { useRive } from "@rive-app/react-webgl2";

export function AgentCard() {
  const [status, setStatus] = useState<string>();
  const { rive, RiveComponent } = useRive({
    src: "agent.riv",
    stateMachines: "Main",
    autoBind: true, // bind the default view model
  });

  useEffect(() => {
    const state = rive?.viewModelInstance?.enum("agentStatus");
    if (!state) return;
    state.value = "thinking"; // code drives design
    const sync = () => setStatus(state.value); // design reports back
    state.on(sync);
    return () => state.off(sync);
  }, [rive]);

  return <RiveComponent aria-label={status} />;
}
