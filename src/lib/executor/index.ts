// Executor factory: the single entry point for the web layer; picks the implementation
// from APP_MODE (mock → MockExecutor, real → GithubActionsExecutor).
import { GithubActionsExecutor } from './github'
import { MockExecutor } from './mock'
import type { Executor } from './types'

export type { BuildArtifact, BuildConfig, BuildSpec, Executor, ExecutorState, ExecutorStatus, FailureHint } from './types'
export { detectFailureHint } from './types'
export { parseWorkflowRunWebhook } from './github'
export type { WorkflowRunEvent } from './github'

let instance: Executor | null = null

/** Module-level singleton so the mock's in-process state machine survives across requests. */
export function getExecutor(): Executor {
  if (!instance) {
    // Default to mock unless APP_MODE is explicitly 'real' — never trigger real workflow
    // dispatches by accident.
    instance = process.env.APP_MODE === 'real' ? new GithubActionsExecutor() : new MockExecutor()
  }
  return instance
}
