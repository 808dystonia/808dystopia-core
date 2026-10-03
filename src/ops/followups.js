import { bestEffort, recordFollowups } from './publishing.js';
export async function finishPost({ pipeline, result, comment, log, facebook, story, save = recordFollowups }) {
  if (!result.published) return log(result);
  const commentResult = await bestEffort(comment);
  // Logging failure must not prevent Facebook or invalidate the IG receipt.
  const logResult = await bestEffort(() => log(result));
  const facebookResult = await bestEffort(facebook);
  const fb = facebookResult.value || { published: false, status: 'failed' };
  // Story runs last: it's the least important follow-up and is optional.
  const storyResult = story ? await bestEffort(story) : null;
  const st = storyResult && (storyResult.value || { status: 'failed' });
  const outcomes = {
    instagram: { status: 'posted', id: result.mediaId },
    comment: { status: commentResult.ok ? 'posted' : 'failed' },
    sheets: { status: logResult.ok ? 'recorded' : 'failed' },
    facebook: { status: fb.published && fb.postId ? 'posted' : fb.status === 'disabled' ? 'disabled' : 'failed', ...(fb.postId ? { id: fb.postId } : {}) },
    ...(st ? { story: { status: st.status, ...(st.id ? { id: st.id } : {}) } } : {}),
  };
  const saved = await bestEffort(() => save(pipeline, result.key, outcomes));
  const followupFailed = !saved.ok || Object.values(outcomes).some(x => x.status === 'failed');
  return { ...(logResult.value || {}), published: true, mediaId: result.mediaId, status: 'posted', followupFailed, outcomes };
}
