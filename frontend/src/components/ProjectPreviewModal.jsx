import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'
import { useProjectStore } from '../store/projectStore'
import { CheckCircle2, Mail, User } from 'lucide-react'

export default function ProjectPreviewModal({ project, onClose }) {
  const [phase, setPhase] = useState('preview') // 'preview' | 'requested'
  const [isRequesting, setIsRequesting] = useState(false)
  const { requestJoin } = useProjectStore()

  // Reset phase when project changes
  useEffect(() => {
    setPhase('preview')
  }, [project?.id])

  if (!project) return null

  const handleRequestJoin = async () => {
    setIsRequesting(true)
    const success = await requestJoin(project.id)
    setIsRequesting(false)
    if (success) {
      setPhase('requested')
    }
  }

  const isPending = project.membership_status === 'pending'

  return (
    <Modal
      isOpen={!!project}
      onClose={onClose}
      title={phase === 'preview' ? project.title : 'Request Sent'}
    >
      {phase === 'preview' ? (
        <div className="space-y-5">
          {/* Subtitle */}
          {project.important_info && (
            <p className="text-sm font-medium text-text-primary dark:text-gray-200">
              {project.important_info}
            </p>
          )}

          {/* Project description */}
          {project.description && (
            <p className="text-sm text-text-secondary dark:text-gray-400 leading-relaxed">
              {project.description}
            </p>
          )}

          {/* Project lead card */}
          {project.lead_name && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <p className="text-xs font-medium text-text-secondary dark:text-gray-400 uppercase tracking-wide mb-2">
                Project Lead
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <User size={18} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="font-medium text-text-primary dark:text-gray-100">{project.lead_name}</p>
                  {project.lead_email && (
                    <a
                      href={`mailto:${project.lead_email}`}
                      className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      <Mail size={13} />
                      {project.lead_email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {isPending ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-organic text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                Request Pending
              </span>
            ) : (
              <Button onClick={handleRequestJoin} loading={isRequesting}>
                Request to Join
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="font-display font-semibold text-lg text-text-primary dark:text-gray-100">
            Thanks for your interest!
          </h3>

          {/* Lead info */}
          {project.lead_name && (
            <div className="inline-flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <User size={14} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary dark:text-gray-100">{project.lead_name}</p>
                {project.lead_email && (
                  <a
                    href={`mailto:${project.lead_email}`}
                    className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <Mail size={11} />
                    {project.lead_email}
                  </a>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-text-secondary dark:text-gray-400">
            Your join request will be approved shortly.
          </p>

          <div className="pt-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
