export default function SectionHeader({ label, title, subtitle, centered = true }) {
  return (
    <div className={`mb-12 ${centered ? 'text-center' : ''}`}>
      {label && (
        <span className="inline-block px-4 py-1.5 bg-pub-blue-100 text-pub-blue-700 rounded-full text-sm font-medium mb-4">
          {label}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h2>
      {subtitle && (
        <p className={`text-lg text-gray-600 max-w-2xl ${centered ? "mx-auto" : ""}`}>{subtitle}</p>
      )}
    </div>
  );
}
