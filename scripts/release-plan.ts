export interface ReleaseSnapshot {
  id: number
  draft: boolean
  target_commitish: string
  upload_url: string
}

export type ReleasePlan = 'create-draft' | 'resume-draft' | 'skip-published'

export function planRelease(
  snapshot: ReleaseSnapshot | undefined,
  currentSha: string,
): ReleasePlan {
  if (snapshot === undefined) return 'create-draft'
  if (!snapshot.draft) return 'skip-published'
  if (snapshot.target_commitish !== currentSha) {
    throw new Error('Existing draft release does not target the current commit')
  }
  return 'resume-draft'
}

export interface TagObject {
  type: 'commit' | 'tag'
  sha: string
}

export async function resolveTagCommit(
  fetchTag: (sha: string) => Promise<unknown>,
  initial: unknown,
): Promise<string> {
  let object = extractTagObject(initial)
  for (let depth = 0; depth < 8; depth += 1) {
    if (object.type === 'commit') return object.sha
    object = extractTagObject(await fetchTag(object.sha))
  }
  throw new Error('GitHub tag annotation nesting is too deep')
}

function extractTagObject(value: unknown): TagObject {
  if (typeof value !== 'object' || value === null || !('object' in value)) {
    throw new Error('GitHub tag object response was invalid')
  }
  const object = value.object
  if (!isTagObject(object))
    throw new Error('GitHub tag object response was invalid')
  return object
}

function isTagObject(value: unknown): value is TagObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value.type === 'commit' || value.type === 'tag') &&
    'sha' in value &&
    typeof value.sha === 'string'
  )
}
