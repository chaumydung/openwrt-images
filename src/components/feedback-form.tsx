'use client'
// Collapsible feedback form embedded in the site footer: name/email/message -> POST /api/feedback.

import { useState, type FormEvent } from 'react'
import { trackEvent } from '@/lib/analytics'

const inputClass =
  'w-full rounded-[6px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0369A1]'

export function FeedbackForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
        }),
      })
      if (res.status === 201) {
        form.reset()
        setStatus('sent')
        trackEvent({ event: 'feedback_submitted' })
      } else {
        const body: { error?: string } | null = await res.json().catch(() => null)
        setError(body?.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
      setStatus('error')
    }
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-[#0369A1] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1]">
        Send feedback
      </summary>
      <form onSubmit={handleSubmit} className="mt-3 flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Name
          <input name="name" required maxLength={100} autoComplete="name" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Email
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Message
          <textarea name="message" required maxLength={2000} rows={4} className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="self-start rounded-[6px] bg-[#0369A1] px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1] focus-visible:ring-offset-2 disabled:opacity-40"
        >
          {status === 'sending' ? 'Sending...' : 'Send'}
        </button>
        {status === 'sent' && (
          <p role="status" className="text-sm text-green-700">
            Thanks, your feedback has been sent.
          </p>
        )}
        {status === 'error' && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </details>
  )
}
