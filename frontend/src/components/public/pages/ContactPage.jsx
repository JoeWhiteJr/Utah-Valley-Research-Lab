// ContactPage.jsx - Contact page with two-column layout and FAQ
import { useEffect } from 'react';
import { Mail, Phone, MapPin, Clock, ExternalLink, CheckCircle } from 'lucide-react';
import PageHero from '../shared/PageHero';
import SectionHeader from '../shared/SectionHeader';
import ScrollAnimateWrapper from '../shared/ScrollAnimateWrapper';
import FaqAccordion from '../shared/FaqAccordion';
import { useContactForm } from '../../../hooks/useContactForm';
import { contactPageData, faqData, siteInfo } from '../../../data/publicSiteData';

export default function ContactPage() {
  useEffect(() => {
    document.title = 'Contact Us | Utah Valley Research Lab';
  }, []);

  const { values, errors, isSubmitting, isSubmitted, handleChange, handleSubmit, reset } = useContactForm();

  const { hero, intro, form } = contactPageData;
  const { contact } = siteInfo;

  const onSubmit = async (formData) => {
    // Simulate form submission
    console.log('Form submitted:', formData);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const contactItems = [
    {
      icon: Mail,
      title: 'Email',
      content: contact.email,
      href: `mailto:${contact.email}`,
      isLink: true,
    },
    {
      icon: Phone,
      title: 'Phone',
      content: contact.phone,
      href: `tel:${contact.phoneRaw}`,
      isLink: true,
    },
    {
      icon: MapPin,
      title: 'Address',
      content: `${contact.address}\n${contact.city}, ${contact.state} ${contact.zip}`,
      isLink: false,
    },
    {
      icon: Clock,
      title: 'Office Hours',
      content: contact.officeHours,
      isLink: false,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Page Hero */}
      <PageHero title={hero.title} subtitle={hero.subtitle} />

      {/* Contact Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Left Column - Contact Info */}
            <ScrollAnimateWrapper animation="fade-right">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {intro.title}
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  {intro.description}
                </p>

                {/* Contact Items */}
                <div className="space-y-6 mb-8">
                  {contactItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-pub-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-6 h-6 text-pub-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {item.title}
                        </h4>
                        {item.isLink ? (
                          <a
                            href={item.href}
                            className="text-pub-blue-600 hover:text-pub-blue-700 transition-colors"
                          >
                            {item.content}
                          </a>
                        ) : (
                          <p className="text-gray-600 whitespace-pre-line">
                            {item.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Map Placeholder */}
                <div className="relative bg-gray-100 rounded-xl overflow-hidden h-64">
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 mb-4">Map coming soon</p>
                      <a
                        href={contact.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-pub-blue-600 text-white font-medium rounded-lg hover:bg-pub-blue-700 transition-colors"
                      >
                        <MapPin className="w-4 h-4" />
                        View on Google Maps
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollAnimateWrapper>

            {/* Right Column - Contact Form */}
            <ScrollAnimateWrapper animation="fade-left">
              <div className="bg-gray-50 rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {form.title}
                </h2>

                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-pub-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-pub-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Message Sent!
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Thank you for reaching out. We'll get back to you within 1-2 business days.
                    </p>
                    <button
                      onClick={reset}
                      className="text-pub-blue-600 hover:text-pub-blue-700 font-medium"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={(e) => handleSubmit(e, onSubmit)} className="space-y-5">
                    {/* Name Field */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        {form.fields.name.label}
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={values.name}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pub-blue-500 focus:border-pub-blue-500 outline-none transition-colors ${
                          errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                      )}
                    </div>

                    {/* Email Field */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        {form.fields.email.label}
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={values.email}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pub-blue-500 focus:border-pub-blue-500 outline-none transition-colors ${
                          errors.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                      )}
                    </div>

                    {/* Organization Field */}
                    <div>
                      <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">
                        {form.fields.organization.label}
                      </label>
                      <input
                        type="text"
                        id="organization"
                        name="organization"
                        value={values.organization}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pub-blue-500 focus:border-pub-blue-500 outline-none transition-colors"
                      />
                    </div>

                    {/* Subject Dropdown */}
                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                        {form.fields.subject.label}
                      </label>
                      <select
                        id="subject"
                        name="subject"
                        value={values.subject}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pub-blue-500 focus:border-pub-blue-500 outline-none transition-colors bg-white"
                      >
                        {form.fields.subject.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Message Field */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                        {form.fields.message.label}
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={6}
                        value={values.message}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pub-blue-500 focus:border-pub-blue-500 outline-none transition-colors resize-none ${
                          errors.message ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.message && (
                        <p className="mt-1 text-sm text-red-500">{errors.message}</p>
                      )}
                    </div>

                    {/* Submit Error */}
                    {errors.submit && (
                      <p className="text-sm text-red-500">{errors.submit}</p>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-pub-blue-600 text-white font-semibold rounded-lg hover:bg-pub-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Sending...' : form.submitButton}
                    </button>
                  </form>
                )}
              </div>
            </ScrollAnimateWrapper>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimateWrapper animation="fade-up">
            <SectionHeader
              title="Frequently Asked Questions"
              centered={true}
            />
          </ScrollAnimateWrapper>
          <ScrollAnimateWrapper animation="fade-up" delay={100}>
            <FaqAccordion items={faqData} />
          </ScrollAnimateWrapper>
        </div>
      </section>
    </div>
  );
}
