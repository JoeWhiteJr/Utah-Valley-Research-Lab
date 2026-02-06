import { useEffect, useRef, useState } from 'react';

export default function ScrollAnimateWrapper({
  children,
  animation = 'fade-up',
  delay = 0,
  threshold = 0.1,
  className = '',
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold]);

  const animations = {
    'fade-up': {
      initial: 'opacity-0 translate-y-8',
      animate: 'opacity-100 translate-y-0',
    },
    'fade-in': {
      initial: 'opacity-0',
      animate: 'opacity-100',
    },
    'fade-left': {
      initial: 'opacity-0 translate-x-8',
      animate: 'opacity-100 translate-x-0',
    },
    'fade-right': {
      initial: 'opacity-0 -translate-x-8',
      animate: 'opacity-100 translate-x-0',
    },
    'scale-up': {
      initial: 'opacity-0 scale-95',
      animate: 'opacity-100 scale-100',
    },
  };

  const anim = animations[animation] || animations['fade-up'];

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        isVisible ? anim.animate : anim.initial
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
