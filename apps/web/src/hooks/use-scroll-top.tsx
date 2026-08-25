import { useEffect, useState } from "react";

export const useScrollTop = (threshold = 10) => {
  const [scrolled, setScrolled] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollPercentage, setScrollPercentage] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > threshold) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }

      setScrollPosition(currentScrollY);

      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollableHeight = documentHeight - windowHeight;
      const percentage = (currentScrollY / scrollableHeight) * 100;

      setScrollPercentage(Math.min(100, Math.max(0, percentage)));
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return {
    scrolled,
    scrollPosition,
    scrollPercentage,
  };
};
