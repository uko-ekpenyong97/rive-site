import Hero from "../components/Hero";
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

        <Hero />

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
