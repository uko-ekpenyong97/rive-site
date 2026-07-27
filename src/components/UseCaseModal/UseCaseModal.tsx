import { useEffect, useState } from "react";
import { CommunityStrip } from "./CommunityStrip";
import { ModalCTA } from "./ModalCTA";
import { ModalHero } from "./ModalHero";
import { ModalRoot } from "./ModalRoot";
import { ModalSheet } from "./ModalSheet";
import { ProofReel } from "./ProofReel";
import { RuntimeChips } from "./RuntimeChips";
import { EDITOR_URL, type UseCaseContent } from "./useCaseContent";
import { resolveDials, type ModalDials } from "./dials";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export interface UseCaseModalProps {
  /** The use case to show; `null` keeps the modal closed. */
  useCase: UseCaseContent | null;
  onClose: () => void;
  /** Tuning overrides — supplied by useModalDials on the tuning surface. */
  dials?: Partial<ModalDials>;
  reducedMotion?: boolean;
}

/**
 * The composed sheet — spec §4 anatomy, top to bottom:
 * eyebrow + claim → live credited hero → proof reel (+ quote) → runtimes → CTA.
 *
 * Both tiers render the same sheet; Tier 2 is simply shorter data (fewer proof
 * cards, no quote), so no cell dead-ends and no cell needs a bespoke build.
 */
export function UseCaseModal({
  useCase,
  onClose,
  dials,
  reducedMotion,
}: UseCaseModalProps) {
  /* Retain the last use case so the sheet still has content to animate while
     it exits — `useCase` goes null the moment close is requested, and ModalRoot
     keeps the overlay mounted through the exit choreography. */
  const [shown, setShown] = useState(useCase);
  useEffect(() => {
    if (useCase) setShown(useCase);
  }, [useCase]);

  /* The hero canvas outlives the close (content is retained for the exit), so it
     needs to know whether the modal is actually open in order to idle. */
  const open = useCase !== null;
  const resolved = resolveDials(dials);
  /* Resolved exactly as ModalRoot does it, so the ghost never autoplays for a
     reduced-motion visitor on pages that pass no explicit override. */
  const systemReduce = usePrefersReducedMotion();
  const reduce = reducedMotion ?? systemReduce;

  return (
    <ModalRoot
      open={open}
      onClose={onClose}
      dials={dials}
      reducedMotion={reducedMotion}
    >
      {shown && (
        <ModalSheet
          eyebrow={shown.eyebrow}
          title={shown.claim}
          onClose={onClose}
        >
          {/* A lite modal may be designed without a hero (Campaigns). Omitting
              the element entirely means no empty container and no reserved
              space — the sheet's gap layout simply closes up. */}
          {shown.hero && (
            <ModalHero
              hero={shown.hero}
              active={open}
              dials={resolved}
              reducedMotion={reduce}
            />
          )}
          <ProofReel proof={shown.proof} quote={shown.quote} />
          {/* Tier 1 only — sits between proof and runtimes per the §4 anatomy. */}
          {shown.community && (
            <CommunityStrip items={shown.community} label={shown.slug} />
          )}
          <RuntimeChips runtimes={shown.runtimes} label={shown.slug} />
          <ModalCTA
            pageHref={shown.pageHref}
            label={shown.name}
            editorHref={EDITOR_URL}
          />
        </ModalSheet>
      )}
    </ModalRoot>
  );
}

export default UseCaseModal;
