import Button from "../components/Button";
import DemoSlot from "../components/DemoSlot";
import Nav from "../components/Nav";
import LogoMarquee from "../components/LogoMarquee";
import WorkflowStack from "../components/WorkflowStack";
import UseCaseBento from "../components/UseCaseBento";
import StatsBand from "../components/StatsBand";
import CaseStudies from "../components/CaseStudies";
import ExpertsStrip from "../components/ExpertsStrip";
import AudienceRails from "../components/AudienceRails";
import DeveloperZone from "../components/DeveloperZone";
import CommunityShowcase from "../components/CommunityShowcase";
import FinalCTA from "../components/FinalCTA";
import Footer from "../components/Footer";
import "./Home.css";

function Home() {
  return (
    <div className="home">
      <div className="container">
        <Nav />

        <section className="hero">
          <div className="hero__body">
            {/* Copy column */}
            <div className="hero__copy">
              <span className="hero__eyebrow">
                BEHIND SPOTIFY WRAPPED, DUOLINGO, AND LINKEDIN
              </span>
              <h1 className="hero__title">
                Interactive graphics that ship straight to production
              </h1>
              <p className="hero__subhead">
                Design, animate, and code in one tool — then run the same file
                natively on web, mobile, games, and cars.
              </p>
              <p className="hero__range">
                From a single button to two billion users.
              </p>
              <div className="hero__ctas">
                <Button variant="primary" href="https://editor.rive.app">
                  Open the editor
                </Button>
                <Button variant="secondary" href="#">
                  See it in action
                </Button>
              </div>
            </div>

            {/* Demo slot */}
            <DemoSlot
              className="hero__demo"
              label="● HERO RIVE DEMO — LIVE, HOVER, DRAG, SCRUB"
            />
          </div>
        </section>

        <LogoMarquee />

        <WorkflowStack />

        <UseCaseBento />

        <StatsBand />

        <CaseStudies />

        <ExpertsStrip />

        <AudienceRails />

        <DeveloperZone />

        <CommunityShowcase />

        <FinalCTA />

        <Footer />
      </div>
    </div>
  );
}

export default Home;
