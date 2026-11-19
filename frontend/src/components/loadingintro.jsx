
import { useEffect, useState } from "react";

function LoadingIntro() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 3800);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="loading-intro">
      <div className="intro-glow"></div>

      <div className="intro-content">
        <div className="intro-logo">
          Pick<span>Drop</span><i>.</i>
        </div>

        <p>YOUR SPACE. YOUR PEOPLE.</p>

        <div className="intro-loader">
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default LoadingIntro;
