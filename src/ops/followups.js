import { bestEffort, recordFollowups } from './publishing.js';
export async function finishPost({ pipeline, result, comment, log, facebook, save = recordFollowups }) {
  if (!result.published) return log(result);
  const commentResult = await bestEffort(comment);
  // Logging failure must not prevent Facebook or invalidate the IG receipt.
  const logResult = await bestEffort(() => log(result));
  const facebookResult = await bestEffort(facebook);
  const fb = facebookResult.value || { published: false, status: 'failed' };
  const outcomes = {
    instagram: { status: 'posted', id: result.mediaId },
    comment: { status: commentResult.ok ? 'posted' : 'failed' },
    sheets: { status: logResult.ok ? 'recorded' : 'failed' },
    facebook: { status: fb.published && fb.postId ? 'posted' : fb.status === 'disabled' ? 'disabled' : 'failed', ...(fb.postId ? { id: fb.postId } : {}) },
  };
  const saved = await bestEffort(() => save(pipeline, result.key, outcomes));
  const followupFailed = !saved.ok || Object.values(outcomes).some(x => x.status === 'failed');
  return { ...(logResult.value || {}), published: true, mediaId: result.mediaId, status: 'posted', followupFailed, outcomes };
}
