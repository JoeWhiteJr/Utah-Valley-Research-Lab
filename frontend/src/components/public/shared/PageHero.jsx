import { useEffect, useState } from 'react';

export default function PageHero({ title, subtitle, variant = 'default' }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const variantStyles = {
    default: 'bg-gradient-to-br from-pub-blue-600 to-pub-blue-800',
    donate: 'bg-gradient-to-br from-pub-accent-600 to-pub-accent-800',
  };

  return (
    <section
      className={`relative pt-32 pb-20 ${variantStyles[variant] || variantStyles.default}`}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1
          className={`font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`text-xl text-white/80 max-w-2xl mx-auto transition-all duration-700 delay-100 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
