import { updateBookmark, type NavBookmark } from '@/api/nav';

/**
 * 把若干书签移动到目标分类。
 *
 * 后端 `PUT /nav/bookmarks/{id}` 本来就支持 `categoryId`（`BookmarkUpdateRequest.categoryId`
 * 与当前分类不同时会校验目标分类归属再改），只是之前前端没用到。
 * 这里只传 title / url / categoryId 三个字段：`iconType` 不传 = 保持原图标（后端语义如此），
 * 所以图标、文字图标底色都不会因为搬家而丢。
 *
 * 返回实际移动成功的数量（不存在的 id 会被忽略）。
 */
export async function moveBookmarksToCategory(
  ids: number[],
  targetCategoryId: number,
  all: NavBookmark[],
): Promise<number> {
  const targets = all.filter((b) => ids.includes(b.id));
  if (targets.length === 0) return 0;

  const results = await Promise.allSettled(
    targets.map((b) =>
      updateBookmark(b.id, {
        categoryId: targetCategoryId,
        title: b.title,
        url: b.url,
      }),
    ),
  );

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - ok;
  if (failed > 0) {
    // 部分失败时把真实原因抛出去，交给调用方提示；成功的那些已经落库
    throw new Error(`moved:${ok}/${results.length}`);
  }
  return ok;
}
